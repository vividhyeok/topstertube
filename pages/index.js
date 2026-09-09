import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { decodeTopsterSearchParams, encodeTopsterData } from '../lib/topsterPayload';

const chromeStoreUrl = 'https://chromewebstore.google.com/detail/topstertube-%EC%9E%AC%EC%83%9D-%EA%B0%80%EB%8A%A5%ED%95%9C-%ED%83%91%EC%8A%A4%ED%84%B0/nnhcekoanhgdanobfegpjhdlankamgba';
const YT_API_TIMEOUT_MS = 12000;
const METADATA_TIMEOUT_MS = 5000;
const BUFFERING_RECOVERY_MS = 18000;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

let ytApiPromise = null;
function loadYouTubeApi() {
    if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API is only available in the browser'));
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve, reject) => {
        let settled = false;
        let pollTimer = null;
        let timeoutTimer = null;
        const previousReady = window.onYouTubeIframeAPIReady;
        let script = null;

        const cleanup = () => {
            if (pollTimer) clearInterval(pollTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
        };

        const succeed = () => {
            if (settled || !window.YT?.Player) return;
            settled = true;
            cleanup();
            resolve(window.YT);
        };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (!window.YT?.Player && script?.parentNode) script.parentNode.removeChild(script);
            reject(error instanceof Error ? error : new Error('YouTube API load failed'));
        };

        window.onYouTubeIframeAPIReady = () => {
            try {
                if (typeof previousReady === 'function') previousReady();
            } finally {
                succeed();
            }
        };

        script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
        if (!script) {
            script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            document.head.appendChild(script);
        }
        script.addEventListener('error', () => fail(new Error('YouTube API network error')), { once: true });

        pollTimer = setInterval(succeed, 100);
        timeoutTimer = setTimeout(() => fail(new Error('YouTube API load timeout')), YT_API_TIMEOUT_MS);
    }).catch((error) => {
        ytApiPromise = null;
        throw error;
    });

    return ytApiPromise;
}

function hasTopsterParams(searchParams) {
    if (searchParams.get('d')) return true;
    return Array.from(searchParams.keys()).some((key) => /^link\d+$/.test(key));
}

function useUrlSearchParams() {
    const [searchParams, setSearchParams] = useState(null);

    useEffect(() => {
        const syncSearchParams = () => setSearchParams(new URLSearchParams(window.location.search));
        syncSearchParams();
        window.addEventListener('popstate', syncSearchParams);
        return () => window.removeEventListener('popstate', syncSearchParams);
    }, []);

    return searchParams;
}

function cleanTopicSuffix(value) {
    return String(value || '').replace(' - Topic', '');
}

async function fetchTrackMetadata(videoId, externalSignal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
    const abortFromParent = () => controller.abort();
    if (externalSignal) externalSignal.addEventListener('abort', abortFromParent, { once: true });

    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
        const data = await response.json();

        return {
            title: data?.title ? cleanTopicSuffix(data.title) : videoId,
            author: data?.author_name ? cleanTopicSuffix(data.author_name) : '',
        };
    } catch (error) {
        return { title: videoId, author: '' };
    } finally {
        clearTimeout(timeout);
        if (externalSignal) externalSignal.removeEventListener('abort', abortFromParent);
    }
}

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, runWorker);
    await Promise.all(workers);
    return results;
}

function PlayerContent() {
    const searchParams = useUrlSearchParams();
    const hasSharedTopster = searchParams ? hasTopsterParams(searchParams) : null;
    const [links, setLinks] = useState([]);
    const [gridConfig, setGridConfig] = useState({ w: 3, h: 3, theme: 'grid' });
    const [activeIdx, setActiveIdx] = useState(null);
    const [gridHeight, setGridHeight] = useState('auto');
    const [metadata, setMetadata] = useState({});
    const [playbackStatus, setPlaybackStatus] = useState(null);

    const gridRef = useRef(null);
    const cellRefs = useRef([]);
    const overlayRef = useRef(null);
    const playerSlotRef = useRef(null);
    const playerRef = useRef(null);
    const bufferingTimerRef = useRef(null);
    const bufferingRetryRef = useRef({});
    const activeIdxRef = useRef(activeIdx);
    const linksRef = useRef(links);

    activeIdxRef.current = activeIdx;
    linksRef.current = links;

    const clearBufferTimer = useCallback(() => {
        if (bufferingTimerRef.current) {
            clearTimeout(bufferingTimerRef.current);
            bufferingTimerRef.current = null;
        }
    }, []);

    const togglePlay = (idx) => {
        setPlaybackStatus(null);
        setActiveIdx((cur) => (cur === idx ? null : idx));
    };

    const advanceNext = useCallback(() => {
        const cur = activeIdxRef.current;
        const list = linksRef.current;
        if (cur === null) return false;
        for (let j = cur + 1; j < list.length; j++) {
            if (list[j]) {
                setActiveIdx(j);
                return true;
            }
        }
        setActiveIdx(null);
        return false;
    }, []);

    const retryCurrent = useCallback(() => {
        const idx = activeIdxRef.current;
        const link = idx === null ? null : linksRef.current[idx];
        const player = playerRef.current;
        if (!link || !player?.loadVideoById) return;
        clearBufferTimer();
        setPlaybackStatus(null);
        try {
            player.loadVideoById({ videoId: link.id, startSeconds: link.t });
        } catch (error) {
            setPlaybackStatus({ message: '이 곡을 다시 불러오지 못했습니다.', canSkip: true });
        }
    }, [clearBufferTimer]);

    const positionOverlay = useCallback(() => {
        const idx = activeIdxRef.current;
        const overlay = overlayRef.current;
        const grid = gridRef.current;
        if (!overlay || !grid) return;
        if (idx === null) {
            overlay.style.display = 'none';
            return;
        }

        const cell = cellRefs.current[idx];
        if (!cell) return;
        const gridRect = grid.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        overlay.style.display = 'block';
        overlay.style.left = `${cellRect.left - gridRect.left + grid.scrollLeft}px`;
        overlay.style.top = `${cellRect.top - gridRect.top + grid.scrollTop}px`;
        overlay.style.width = `${cellRect.width}px`;
        overlay.style.height = `${cellRect.height}px`;
    }, []);

    const handlePlaybackError = useCallback((event) => {
        clearBufferTimer();
        const code = Number(event?.data);
        const unavailable = [100, 101, 150].includes(code);
        const failedIdx = activeIdxRef.current;
        setPlaybackStatus({
            message: unavailable ? '재생할 수 없는 영상이라 다음 곡으로 넘어갑니다.' : 'YouTube 재생 오류가 발생해 다음 곡으로 넘어갑니다.',
        });
        window.setTimeout(() => {
            if (activeIdxRef.current === failedIdx) advanceNext();
        }, 350);
    }, [advanceNext, clearBufferTimer]);

    const handlePlayerStateChange = useCallback((event) => {
        const state = Number(event?.data);
        if (state === 0) {
            clearBufferTimer();
            setPlaybackStatus(null);
            advanceNext();
            return;
        }

        if (state === 1) {
            clearBufferTimer();
            setPlaybackStatus(null);
            return;
        }

        if (state !== 3) {
            clearBufferTimer();
            return;
        }

        clearBufferTimer();
        bufferingTimerRef.current = window.setTimeout(() => {
            const idx = activeIdxRef.current;
            const player = playerRef.current;
            const link = idx === null ? null : linksRef.current[idx];
            if (!link || !player) return;

            let currentState = null;
            try { currentState = player.getPlayerState(); } catch (error) { return; }
            if (currentState !== 3) return;

            const retryCount = bufferingRetryRef.current[idx] || 0;
            if (retryCount < 1) {
                bufferingRetryRef.current[idx] = retryCount + 1;
                setPlaybackStatus({ message: '재생이 지연되어 한 번 다시 연결하고 있습니다.' });
                try {
                    player.loadVideoById({ videoId: link.id, startSeconds: link.t });
                } catch (error) {
                    setPlaybackStatus({ message: '재생을 다시 연결하지 못했습니다.', canRetry: true, canSkip: true });
                }
            } else {
                setPlaybackStatus({ message: '재생이 오래 지연되고 있습니다.', canRetry: true, canSkip: true });
            }
        }, BUFFERING_RECOVERY_MS);
    }, [advanceNext, clearBufferTimer]);

    useEffect(() => {
        if (!searchParams) return;

        if (!hasSharedTopster) {
            setLinks([]);
            setMetadata({});
            setActiveIdx(null);
            return;
        }

        const { links: loadedLinks, w, h, theme } = decodeTopsterSearchParams(searchParams);
        cellRefs.current = new Array(loadedLinks.length).fill(null);
        setLinks(loadedLinks);
        setGridConfig({ w, h, theme });
    }, [searchParams, hasSharedTopster]);

    useEffect(() => {
        if (!hasSharedTopster || links.length === 0) {
            setMetadata({});
            return;
        }

        const videoIds = Array.from(new Set(links.filter(Boolean).map((link) => link.id)));
        if (videoIds.length === 0) {
            setMetadata({});
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        mapLimit(videoIds, 6, async (videoId) => {
            const data = await fetchTrackMetadata(videoId, controller.signal);
            return [videoId, data];
        }).then((entries) => {
            if (!cancelled) setMetadata(Object.fromEntries(entries));
        });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [links, hasSharedTopster]);

    useEffect(() => {
        clearBufferTimer();
        if (activeIdx !== null) bufferingRetryRef.current[activeIdx] = 0;

        if (activeIdx === null) {
            positionOverlay();
            setPlaybackStatus(null);
            if (playerRef.current?.stopVideo) {
                try { playerRef.current.stopVideo(); } catch (error) { /* Player may already be detached. */ }
            }
            return undefined;
        }

        const link = links[activeIdx];
        if (!link) return undefined;

        let cancelled = false;
        positionOverlay();

        loadYouTubeApi().then((YT) => {
            if (cancelled || !YT || !overlayRef.current) return;
            positionOverlay();

            if (!playerRef.current && playerSlotRef.current) {
                const host = document.createElement('div');
                host.style.width = '100%';
                host.style.height = '100%';
                playerSlotRef.current.textContent = '';
                playerSlotRef.current.appendChild(host);

                try {
                    playerRef.current = new YT.Player(host, {
                        width: '100%',
                        height: '100%',
                        videoId: link.id,
                        playerVars: {
                            start: link.t,
                            autoplay: 1,
                            playsinline: 1,
                        },
                        events: {
                            onReady: (e) => {
                                try { e.target.playVideo(); } catch (error) {
                                    setPlaybackStatus({ message: '재생을 시작하려면 한 번 더 눌러주세요.', canRetry: true });
                                }
                            },
                            onStateChange: handlePlayerStateChange,
                            onError: handlePlaybackError,
                            onAutoplayBlocked: () => {
                                setPlaybackStatus({ message: '브라우저가 자동 재생을 차단했습니다.', canRetry: true });
                            },
                        },
                    });
                } catch (error) {
                    setPlaybackStatus({ message: 'YouTube 플레이어를 만들지 못했습니다.', canRetry: true });
                }
            } else {
                try {
                    playerRef.current.loadVideoById({ videoId: link.id, startSeconds: link.t });
                } catch (error) {
                    setPlaybackStatus({ message: '다음 곡을 불러오지 못했습니다.', canRetry: true, canSkip: true });
                }
            }
        }).catch(() => {
            if (!cancelled) setPlaybackStatus({ message: 'YouTube 플레이어를 불러오지 못했습니다.', canRetry: true });
        });

        return () => { cancelled = true; };
    }, [activeIdx, links, positionOverlay, handlePlayerStateChange, handlePlaybackError, clearBufferTimer]);

    useEffect(() => {
        const gridEl = gridRef.current;
        if (!gridEl) return undefined;

        const sync = () => {
            if (window.innerWidth > 850) setGridHeight(`${gridEl.getBoundingClientRect().height}px`);
            else setGridHeight('auto');
            positionOverlay();
        };

        const observer = new ResizeObserver(sync);
        observer.observe(gridEl);
        window.addEventListener('resize', sync);
        window.addEventListener('orientationchange', sync);
        sync();

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', sync);
        };
    }, [positionOverlay, links]);

    useEffect(() => () => {
        clearBufferTimer();
        if (playerRef.current?.destroy) {
            try { playerRef.current.destroy(); } catch (error) { /* noop */ }
        }
        playerRef.current = null;
    }, [clearBufferTimer]);

    if (searchParams === null) return <BootState />;
    if (!hasSharedTopster) return <LandingState />;

    return (
        <>
            <div className="main-container">
                <div
                    ref={gridRef}
                    className={`grid-container ${gridConfig.theme === 'classic' ? 'classic-layout' : ''}`}
                    data-theme={gridConfig.theme}
                    data-size={`${gridConfig.w}x${gridConfig.h}`}
                    style={
                        gridConfig.theme !== 'classic'
                            ? { gridTemplateColumns: `repeat(${gridConfig.w}, 1fr)`, position: 'relative' }
                            : { position: 'relative' }
                    }
                >
                    {links.map((link, i) => (
                        <GridItem
                            key={i}
                            link={link}
                            metadata={link ? metadata[link.id] : null}
                            index={i}
                            theme={gridConfig.theme}
                            onToggle={() => togglePlay(i)}
                            cellRef={(el) => { cellRefs.current[i] = el; }}
                        />
                    ))}

                    <div
                        ref={overlayRef}
                        className="player-overlay"
                        style={{
                            position: 'absolute',
                            display: 'none',
                            zIndex: 5,
                            background: '#000',
                            borderRadius: '2px',
                            overflow: 'hidden',
                        }}
                    >
                        <div ref={playerSlotRef} className="player-host" />
                    </div>
                </div>
                <div className="list-container" style={{ maxHeight: gridHeight }}>
                    <ol id="track-list">
                        {links.map((link, i) => (
                            <ListItem
                                key={i}
                                link={link}
                                metadata={link ? metadata[link.id] : null}
                                onToggle={() => togglePlay(i)}
                                isActive={activeIdx === i}
                            />
                        ))}
                    </ol>
                </div>
            </div>
            <div className="topster-action-stack" aria-label="Topstertube 안내">
                {playbackStatus && (
                    <div className="playback-status" role="status" aria-live="polite">
                        <span>{playbackStatus.message}</span>
                        {(playbackStatus.canRetry || playbackStatus.canSkip) && (
                            <span className="playback-status-actions">
                                {playbackStatus.canRetry && <button type="button" onClick={retryCurrent}>다시 시도</button>}
                                {playbackStatus.canSkip && <button type="button" onClick={advanceNext}>다음 곡</button>}
                            </span>
                        )}
                    </div>
                )}
                <p className="play-help-text">
                    곡 제목이나 표지를 클릭해 음악을 들어보세요. 끝나면 다음 곡으로 자동 재생됩니다.
                </p>
                <a className="create-topster-link" href="/help">직접 탑스터 만들기</a>
            </div>
        </>
    );
}

function GridItem({ link, metadata, index, theme, onToggle, cellRef }) {
    const getClassName = () => {
        let base = 'grid-item';
        if (theme === 'classic') {
            if (index < 10) base += ' large';
            else if (index < 22) base += ' medium';
            else base += ' small';
        }
        return base;
    };

    if (!link) {
        return <div ref={cellRef} className={getClassName()} style={{ backgroundColor: '#1e1e1e', cursor: 'default' }} />;
    }

    const title = metadata?.title || link.id;

    return (
        <div ref={cellRef} className={getClassName()} onClick={onToggle}>
            <img
                src={`https://img.youtube.com/vi/${link.id}/mqdefault.jpg`}
                alt={title}
                title={title}
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://img.youtube.com/vi/${link.id}/hqdefault.jpg`;
                }}
            />
        </div>
    );
}

function ListItem({ link, metadata, onToggle, isActive }) {
    if (!link) return <li><span className="empty-li">-</span></li>;

    const title = metadata?.title || link.id;
    const text = metadata?.author ? `${metadata.author} - ${title}` : title;

    return (
        <li style={isActive ? { backgroundColor: '#111' } : {}}>
            <a
                href="#"
                onClick={(e) => {
                    e.preventDefault();
                    onToggle();
                }}
            >
                {isActive ? `▶ ${text}` : text}
            </a>
        </li>
    );
}

function BootState() {
    return <main className="boot-state" aria-hidden="true" />;
}

function parsePlaylistUrl(input) {
    try {
        const url = new URL(String(input || '').trim());
        const hostname = url.hostname.toLowerCase();
        const isYoutube = hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be';
        if (!isYoutube) return null;
        const playlistId = url.searchParams.get('list');
        if (!playlistId || !/^[A-Za-z0-9_-]{10,}$/.test(playlistId)) return null;
        return playlistId;
    } catch (error) {
        return null;
    }
}

function getImportLayout(value) {
    if (value === 'classic') return { theme: 'classic', w: 3, h: 3, total: 42 };
    const match = /^(2|3|4|5)x\1$/.exec(value || '');
    const size = match ? parseInt(match[1], 10) : 3;
    return { theme: 'grid', w: size, h: size, total: size * size };
}

function LandingState() {
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [layoutValue, setLayoutValue] = useState('3x3');
    const [importStatus, setImportStatus] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const helperSlotRef = useRef(null);
    const helperPlayerRef = useRef(null);

    useEffect(() => () => {
        if (helperPlayerRef.current?.destroy) {
            try { helperPlayerRef.current.destroy(); } catch (error) { /* noop */ }
        }
    }, []);

    const importPlaylist = async (event) => {
        event.preventDefault();
        if (isImporting) return;

        const playlistId = parsePlaylistUrl(playlistUrl);
        if (!playlistId) {
            setImportStatus('올바른 YouTube 플레이리스트 링크를 입력해주세요.');
            return;
        }

        setIsImporting(true);
        setImportStatus('플레이리스트를 불러오는 중입니다.');

        try {
            const YT = await loadYouTubeApi();
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            const slot = helperSlotRef.current;
            if (!slot) throw new Error('Playlist helper is unavailable');

            if (helperPlayerRef.current?.destroy) {
                try { helperPlayerRef.current.destroy(); } catch (error) { /* noop */ }
            }
            slot.textContent = '';
            const host = document.createElement('div');
            slot.appendChild(host);

            const videoIds = await new Promise((resolve, reject) => {
                let settled = false;
                let pollTimer = null;
                let timeoutTimer = null;

                const cleanup = () => {
                    if (pollTimer) clearInterval(pollTimer);
                    if (timeoutTimer) clearTimeout(timeoutTimer);
                };

                const finish = (ids) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve(ids);
                };

                const fail = (message) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(new Error(message));
                };

                try {
                    helperPlayerRef.current = new YT.Player(host, {
                        width: '240',
                        height: '240',
                        playerVars: { playsinline: 1 },
                        events: {
                            onReady: (e) => {
                                try {
                                    e.target.cuePlaylist({ listType: 'playlist', list: playlistId, index: 0, startSeconds: 0 });
                                } catch (error) {
                                    fail('플레이리스트를 불러올 수 없습니다.');
                                }
                            },
                        },
                    });
                } catch (error) {
                    fail('YouTube 플레이어를 만들 수 없습니다.');
                    return;
                }

                const readPlaylist = () => {
                    const player = helperPlayerRef.current;
                    if (!player?.getPlaylist) return;
                    try {
                        const ids = player.getPlaylist();
                        const validIds = Array.isArray(ids) ? ids.filter((id) => VIDEO_ID_PATTERN.test(String(id || ''))) : [];
                        if (validIds.length > 0) finish(validIds);
                    } catch (error) {
                        // The playlist is not ready yet; polling continues until timeout.
                    }
                };

                pollTimer = window.setInterval(readPlaylist, 250);
                timeoutTimer = window.setTimeout(() => fail('플레이리스트를 불러오지 못했습니다. 공개 또는 링크 공개 상태인지 확인해주세요.'), 15000);
            });

            const layout = getImportLayout(layoutValue);
            const selectedIds = videoIds.slice(0, layout.total);
            const links = new Array(layout.total).fill(null);
            selectedIds.forEach((id, index) => {
                links[index] = { id, t: 0 };
            });

            const payload = encodeTopsterData({ links, theme: layout.theme, w: layout.w, h: layout.h });
            window.location.assign(`/?d=${encodeURIComponent(payload)}`);
        } catch (error) {
            setImportStatus(error?.message || '플레이리스트를 불러오지 못했습니다.');
            setIsImporting(false);
            if (helperPlayerRef.current?.destroy) {
                try { helperPlayerRef.current.destroy(); } catch (destroyError) { /* noop */ }
            }
            helperPlayerRef.current = null;
            if (helperSlotRef.current) helperSlotRef.current.textContent = '';
        }
    };

    return (
        <main className="landing-state">
            <section className="landing-copy">
                <p className="landing-kicker">Topstertube</p>
                <h1>좋아하는 음악을 재생 가능한 탑스터로 만들어보세요.</h1>
                <p>
                    YouTube 또는 YouTube Music 플레이리스트 링크 하나로 웹에서 바로 만들 수 있습니다.
                    공유받은 사람은 설치 없이 탑스터의 커버를 눌러 음악을 감상합니다.
                </p>

                <form className="playlist-import-form" onSubmit={importPlaylist}>
                    <label htmlFor="playlist-url">YouTube 플레이리스트</label>
                    <input
                        id="playlist-url"
                        type="url"
                        value={playlistUrl}
                        onChange={(e) => setPlaylistUrl(e.target.value)}
                        placeholder="https://www.youtube.com/playlist?list=..."
                        disabled={isImporting}
                    />
                    <div className="playlist-layout-row">
                        <label htmlFor="playlist-layout">레이아웃</label>
                        <select
                            id="playlist-layout"
                            value={layoutValue}
                            onChange={(e) => setLayoutValue(e.target.value)}
                            disabled={isImporting}
                        >
                            <option value="2x2">2 x 2</option>
                            <option value="3x3">3 x 3</option>
                            <option value="4x4">4 x 4</option>
                            <option value="5x5">5 x 5</option>
                            <option value="classic">Classic 42</option>
                        </select>
                    </div>
                    <button className="playlist-import-button" type="submit" disabled={isImporting}>
                        {isImporting ? '불러오는 중...' : 'Topster 만들기'}
                    </button>
                    {importStatus && <p className="playlist-import-status" role="status">{importStatus}</p>}
                    {isImporting && (
                        <div className="playlist-helper-wrap" aria-label="YouTube 플레이리스트 불러오기">
                            <div ref={helperSlotRef} className="playlist-helper-player" />
                        </div>
                    )}
                </form>

                <p className="landing-extension-note">
                    웹에서는 각 곡을 처음부터 재생합니다. 시작 구간까지 지정하려면 Chrome 확장 프로그램을 사용하세요.
                </p>
                <div className="landing-actions">
                    <a className="landing-primary-link" href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
                        확장 프로그램 설치
                    </a>
                    <a className="landing-secondary-link" href="/help">사용법 보기</a>
                </div>
            </section>
        </main>
    );
}

export default function Home() {
    return (
        <>
            <Head>
                <title>Topstertube - 재생 가능한 탑스터</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="description" content="유튜브 음악으로 만드는 나만의 재생 가능한 탑스터" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <PlayerContent />
        </>
    );
}
