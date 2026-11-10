import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { loadYouTubeApi, fetchTrackMetadata } from '../lib/youtube';
import Editor from '../components/Editor';
import SharePanel from '../components/SharePanel';
import { decodeTopsterSearchParams, encodeTopsterData } from '../lib/topsterPayload';

const BUFFERING_RECOVERY_MS = 18000;

function hasTopsterParams(searchParams) {
    if (searchParams.get('d')) return true;
    return Array.from(searchParams.keys()).some((key) => /^link\d+$/.test(key));
}

function useUrlSearchParams(initialPayload) {
    const [searchParams, setSearchParams] = useState(initialPayload ? new URLSearchParams({ d: initialPayload }) : null);

    useEffect(() => {
        const syncSearchParams = () => setSearchParams(initialPayload ? new URLSearchParams({ d: initialPayload }) : new URLSearchParams(window.location.search));
        syncSearchParams();
        window.addEventListener('popstate', syncSearchParams);
        return () => window.removeEventListener('popstate', syncSearchParams);
    }, [initialPayload]);

    return searchParams;
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

function PlayerContent({ initialPayload }) {
    const searchParams = useUrlSearchParams(initialPayload);
    const hasSharedTopster = searchParams ? hasTopsterParams(searchParams) : null;
    const editorData = useMemo(() => hasSharedTopster ? decodeTopsterSearchParams(searchParams) : null, [hasSharedTopster, searchParams]);
    const [links, setLinks] = useState([]);
    const [gridConfig, setGridConfig] = useState({ w: 3, h: 3, theme: 'grid' });
    const [activeIdx, setActiveIdx] = useState(null);
    const [gridHeight, setGridHeight] = useState('auto');
    const [metadata, setMetadata] = useState({});
    const [playbackStatus, setPlaybackStatus] = useState(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState({ time: 0, duration: 0 });
    const [resume, setResume] = useState(null);
    const [showShare, setShowShare] = useState(false);
    const [playerAttempt, setPlayerAttempt] = useState(0);
    const [repeat, setRepeat] = useState(false);
    const repeatRef = useRef(false);
    repeatRef.current = repeat;
    const resumeTimeRef = useRef(null);
    const dockRef = useRef(null);
    const failedTracks = useRef(new Set());
    const payload = encodeTopsterData({ ...gridConfig, links });

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
        failedTracks.current.delete(idx);
        setPlaybackStatus(null);
        if (activeIdxRef.current === idx && playerRef.current) {
            const player = playerRef.current;
            if (player.getPlayerState?.() === 1) player.pauseVideo?.();
            else player.playVideo?.();
        } else setActiveIdx(idx);
    };

    const advanceNext = useCallback(() => {
        const cur = activeIdxRef.current;
        const list = linksRef.current;
        if (cur === null) { setActiveIdx(list.findIndex(Boolean) < 0 ? null : list.findIndex(Boolean)); return true; }
        for (let j = cur + 1; j < list.length; j++) {
            if (list[j]) {
                setActiveIdx(j);
                return true;
            }
        }
        if (repeatRef.current && list.some(Boolean)) {
            const first = list.findIndex(Boolean);
            if (first === cur) playerRef.current?.seekTo?.(list[first].t, true);
            else setActiveIdx(first);
        } else setActiveIdx(null);
        return false;
    }, []);

    const previous = useCallback(() => {
        const current = activeIdxRef.current;
        if (current === null) return;
        for (let i = current - 1; i >= 0; i--) if (linksRef.current[i]) { setActiveIdx(i); return; }
        playerRef.current?.seekTo?.(linksRef.current[current].t, true);
    }, []);

    useEffect(() => {
        if (!links.some(Boolean)) return;
        try {
            const saved = JSON.parse(sessionStorage.getItem('topstertube:playback') || 'null');
            if (saved?.payload === payload && links[saved.index] && Number.isFinite(saved.time)) setResume(saved);
        } catch { /* Storage is optional. */ }
    }, [links, payload]);

    useEffect(() => {
        const sample = () => {
            const player = playerRef.current;
            if (!player?.getCurrentTime || activeIdxRef.current === null) return;
            const time = player.getCurrentTime() || 0;
            const duration = player.getDuration?.() || 0;
            setProgress({ time, duration });
            try { sessionStorage.setItem('topstertube:playback', JSON.stringify({ payload, index: activeIdxRef.current, time })); } catch { /* Storage is optional. */ }
        };
        const timer = setInterval(() => { if (!document.hidden) sample(); }, 1000);
        const visibility = () => { sample(); clearBufferTimer(); };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('pagehide', sample);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', sample); };
    }, [payload, clearBufferTimer]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        const session = navigator.mediaSession;
        const link = links[activeIdx];
        if (link && typeof MediaMetadata !== 'undefined') session.metadata = new MediaMetadata({
            title: metadata[link.id]?.title || link.id, artist: metadata[link.id]?.author || 'TopsterTube',
            artwork: [{ src: `https://img.youtube.com/vi/${link.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }],
        });
        else session.metadata = null;
        session.playbackState = activeIdx === null ? 'none' : playing ? 'playing' : 'paused';
        const actions = { play: () => playerRef.current?.playVideo?.(), pause: () => playerRef.current?.pauseVideo?.(), previoustrack: previous, nexttrack: advanceNext, seekto: (event) => playerRef.current?.seekTo?.(event.seekTime, true) };
        for (const [action, handler] of Object.entries(actions)) { try { session.setActionHandler(action, handler); } catch { /* Browser-dependent. */ } }
        return () => { for (const action of Object.keys(actions)) { try { session.setActionHandler(action, null); } catch {} } session.metadata = null; session.playbackState = 'none'; };
    }, [activeIdx, links, metadata, playing, previous, advanceNext]);

    const retryCurrent = useCallback(() => {
        const idx = activeIdxRef.current;
        const link = idx === null ? null : linksRef.current[idx];
        const player = playerRef.current;
        if (!link) return;
        if (!player?.loadVideoById) { setPlayerAttempt(value => value + 1); return; }
        failedTracks.current.delete(idx);
        clearBufferTimer();
        setPlaybackStatus(null);
        try {
            player.loadVideoById({ videoId: link.id, startSeconds: player.getCurrentTime?.() || link.t });
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
        let cellRect = cell.getBoundingClientRect();
        const dock = dockRef.current;
        const useDock = cellRect.width < 200 || cellRect.height < 200;
        if (dock) {
            dock.hidden = !useDock;
            if (useDock) cellRect = dock.getBoundingClientRect();
        }

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
        if (code === 153) {
            setPlaybackStatus({ message: 'YouTube에서 이 브라우저의 재생을 허용하지 않았습니다. 아래 YouTube 링크로 열어주세요.', canRetry: true });
            return;
        }
        failedTracks.current.add(failedIdx);
        setPlaybackStatus({
            message: unavailable ? '재생할 수 없는 영상이라 다음 곡으로 넘어갑니다.' : 'YouTube 재생 오류가 발생해 다음 곡으로 넘어갑니다.',
        });
        window.setTimeout(() => {
            if (activeIdxRef.current !== failedIdx) return;
            const list = linksRef.current;
            const next = list.findIndex((link, index) => link && index > failedIdx && !failedTracks.current.has(index));
            if (next >= 0) setActiveIdx(next);
            else setPlaybackStatus({ message: '다음에 재생할 수 있는 곡이 없습니다. 다른 곡을 선택하거나 YouTube에서 열어주세요.', canRetry: true });
        }, 350);
    }, [clearBufferTimer]);

    const handlePlayerStateChange = useCallback((event) => {
        const state = Number(event?.data);
        setPlaying(state === 1);
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
            if (document.hidden) return;
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
                    player.loadVideoById({ videoId: link.id, startSeconds: player.getCurrentTime?.() || link.t });
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
            setPlaying(false);
            if (dockRef.current) dockRef.current.hidden = true;
            positionOverlay();
            setPlaybackStatus(null);
            if (playerRef.current?.stopVideo) {
                try { playerRef.current.stopVideo(); } catch (error) { /* Player may already be detached. */ }
            }
            return undefined;
        }

        const link = links[activeIdx];
        if (!link) return undefined;
        const startSeconds = resumeTimeRef.current ?? link.t;
        resumeTimeRef.current = null;
        setProgress({ time: startSeconds, duration: 0 });

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
                            start: startSeconds,
                            autoplay: 1,
                            playsinline: 1,
                            origin: window.location.origin,
                        },
                        events: {
                            onReady: (e) => {
                                const latest = linksRef.current[activeIdxRef.current];
                                if (!latest) { e.target.stopVideo(); return; }
                                if (latest.id !== link.id) { e.target.loadVideoById({ videoId: latest.id, startSeconds: latest.t }); return; }
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
                    playerRef.current.loadVideoById({ videoId: link.id, startSeconds });
                } catch (error) {
                    setPlaybackStatus({ message: '다음 곡을 불러오지 못했습니다.', canRetry: true, canSkip: true });
                }
            }
        }).catch(() => {
            if (!cancelled) setPlaybackStatus({ message: 'YouTube 플레이어를 불러오지 못했습니다.', canRetry: true });
        });

        return () => { cancelled = true; };
    }, [activeIdx, links, positionOverlay, handlePlayerStateChange, handlePlaybackError, clearBufferTimer, playerAttempt]);

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
    if (!hasSharedTopster || searchParams.has('edit')) return <Editor initialData={editorData} />;

    return (
        <>
            <header className="player-header"><a className="wordmark" href="/">TOPSTER<span>TUBE</span><i /></a><div className="button-row"><a href={`/?edit=1&d=${encodeURIComponent(payload)}`}>편집</a><button onClick={() => setShowShare(!showShare)} aria-expanded={showShare}>공유 / NFC</button></div></header>
            {showShare && <div className="player-share"><SharePanel payload={payload} /></div>}
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
                            isActive={activeIdx === i}
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
                    <div ref={dockRef} className="video-dock" hidden />
                    <div className="section-heading"><h2>트랙 리스트</h2><span className="badge">{links.filter(Boolean).length} TRACKS</span></div>
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
                <p className="play-help-text">화면 잠금·다른 앱 전환 시 재생이 중단될 수 있어요. 돌아오면 재생 버튼으로 이어 들으세요.</p>
            </div>
            <section className="transport" aria-label="재생 컨트롤">
                <div className="now-playing"><span className="eyebrow">{playing ? 'NOW PLAYING' : 'READY TO PLAY'}</span><strong>{activeIdx !== null ? metadata[links[activeIdx]?.id]?.title || links[activeIdx]?.id : '표지를 누르고 취향을 들어보세요'}</strong></div>
                <div className="transport-buttons"><button onClick={previous} disabled={activeIdx === null} aria-label="이전 곡">⏮</button><button className="primary" aria-label={playing ? '일시정지' : '재생'} disabled={!links.some(Boolean)} onClick={() => activeIdx === null ? setActiveIdx(links.findIndex(Boolean)) : togglePlay(activeIdx)}>{playing ? 'Ⅱ' : '▶'}</button><button onClick={advanceNext} disabled={!links.some(Boolean)} aria-label="다음 곡">⏭</button><button aria-pressed={repeat} onClick={() => setRepeat(!repeat)} aria-label="전체 반복">↻</button></div>
                <label className="seek-control"><span className="sr-only">재생 위치</span><input aria-label="재생 위치" type="range" min="0" max={progress.duration || 1} value={Math.min(progress.time, progress.duration || 1)} disabled={!progress.duration || activeIdx === null} onChange={e => { const time = Number(e.target.value); playerRef.current?.seekTo?.(time, true); setProgress(v => ({ ...v, time })); }} /><span>{Math.floor(progress.time / 60)}:{String(Math.floor(progress.time % 60)).padStart(2, '0')}</span></label>
                {resume && activeIdx === null && <button onClick={() => { resumeTimeRef.current = resume.time; setActiveIdx(resume.index); setResume(null); }}>이어듣기</button>}
                {activeIdx !== null && <a className="youtube-link" href={`https://www.youtube.com/watch?v=${links[activeIdx].id}&t=${Math.floor(progress.time)}`} target="_blank" rel="noopener noreferrer">YouTube ↗</a>}
            </section>
        </>
    );
}

function GridItem({ link, metadata, index, theme, onToggle, cellRef, isActive }) {
    const getClassName = () => {
        let base = `grid-item${isActive ? ' active-cover' : ''}`;
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
        <div ref={cellRef} className={getClassName()} onClick={onToggle} role="button" tabIndex={0} aria-label={`${title} 재생`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
            <img
                src={`https://img.youtube.com/vi/${link.id}/mqdefault.jpg`}
                loading="lazy"
                decoding="async"
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

export default function Home({ initialPayload }) {
    return (
        <>
            <Head>
                <title>Topstertube - 재생 가능한 탑스터</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
                <meta name="description" content="유튜브 음악으로 만드는 나만의 재생 가능한 탑스터" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <PlayerContent initialPayload={initialPayload} />
        </>
    );
}
