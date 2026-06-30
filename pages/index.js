import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { decodeTopsterSearchParams } from '../lib/topsterPayload';

const chromeStoreUrl = 'https://chromewebstore.google.com/detail/topstertube-%EC%9E%AC%EC%83%9D-%EA%B0%80%EB%8A%A5%ED%95%9C-%ED%83%91%EC%8A%A4%ED%84%B0/nnhcekoanhgdanobfegpjhdlankamgba';

/*
 * 단일 영속 플레이어 방식
 * - 곡마다 새 iframe을 만들지 않고, 플레이어 하나를 계속 살려둔 채
 *   loadVideoById()로 곡만 교체한다.
 * - 플레이어 요소가 파괴되지 않으므로 PC에서 다른 탭/창에 가 있어도
 *   다음 곡으로 자동 전환이 끊기지 않는다.
 * - 영상은 활성 셀 위에 픽셀 단위로 겹쳐(overlay) 표시 → PC/모바일 레이아웃 모두 대응.
 */

// YouTube IFrame API를 한 번만 로드해서 공유하기 위한 헬퍼
let ytApiPromise = null;
function loadYouTubeApi() {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof prev === 'function') prev();
            resolve(window.YT);
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
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
        const syncSearchParams = () => {
            setSearchParams(new URLSearchParams(window.location.search));
        };

        syncSearchParams();
        window.addEventListener('popstate', syncSearchParams);

        return () => {
            window.removeEventListener('popstate', syncSearchParams);
        };
    }, []);

    return searchParams;
}

function cleanTopicSuffix(value) {
    return String(value || '').replace(' - Topic', '');
}

async function fetchTrackMetadata(videoId, signal) {
    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, { signal });
        const data = await response.json();

        return {
            title: data.title ? cleanTopicSuffix(data.title) : videoId,
            author: data.author_name ? cleanTopicSuffix(data.author_name) : '',
        };
    } catch (error) {
        return { title: videoId, author: '' };
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

    // DOM/플레이어 참조
    const cellRefs = useRef([]);          // 각 그리드 셀 DOM
    const overlayRef = useRef(null);      // 영상이 올라갈 오버레이 컨테이너
    const playerSlotRef = useRef(null);   // YT.Player 마운트 노드를 담는 래퍼
    const playerHostRef = useRef(null);   // YT.Player가 대체할 마운트 노드
    const playerRef = useRef(null);       // 영속 YT.Player 인스턴스

    // 핸들러에서 항상 최신 값을 읽도록 ref 동기화
    const activeIdxRef = useRef(activeIdx);
    activeIdxRef.current = activeIdx;
    const linksRef = useRef(links);
    linksRef.current = links;

    const togglePlay = (idx) => {
        setActiveIdx((cur) => (cur === idx ? null : idx));
    };

    // 현재 곡 다음의 빈칸이 아닌 트랙으로 전환 (없으면 정지)
    const advanceNext = useCallback(() => {
        const cur = activeIdxRef.current;
        const list = linksRef.current;
        if (cur === null) return;
        for (let j = cur + 1; j < list.length; j++) {
            if (list[j]) {
                setActiveIdx(j);
                return;
            }
        }
        setActiveIdx(null);
    }, []);

    // 오버레이를 활성 셀 위치/크기에 맞춤 (PC/모바일 공통, 픽셀 측정)
    const positionOverlay = useCallback(() => {
        const idx = activeIdxRef.current;
        const overlay = overlayRef.current;
        if (!overlay) return;
        if (idx === null) {
            overlay.style.display = 'none';
            return;
        }
        const cell = cellRefs.current[idx];
        if (!cell) return;
        overlay.style.display = 'block';
        overlay.style.left = `${cell.offsetLeft}px`;
        overlay.style.top = `${cell.offsetTop}px`;
        overlay.style.width = `${cell.offsetWidth}px`;
        overlay.style.height = `${cell.offsetHeight}px`;
    }, []);

    // URL 파라미터 파싱. 새 compact payload(d=)와 기존 link1/link2 방식을 모두 지원한다.
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

    // 활성 트랙이 바뀔 때: 플레이어 생성(최초 1회) 또는 loadVideoById로 교체
    useEffect(() => {
        if (activeIdx === null) {
            positionOverlay();
            if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
                try { playerRef.current.stopVideo(); } catch (err) { /* noop */ }
            }
            return;
        }

        const link = links[activeIdx];
        if (!link) return;

        let cancelled = false;
        positionOverlay();

        loadYouTubeApi().then((YT) => {
            if (cancelled || !YT || !overlayRef.current) return;
            positionOverlay();

            if (!playerRef.current && playerSlotRef.current) {
                // 영속 플레이어 최초 생성 — 이후 파괴하지 않고 재사용
                const host = document.createElement('div');
                host.style.width = '100%';
                host.style.height = '100%';
                playerHostRef.current = host;
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
                                try { e.target.playVideo(); } catch (err) { /* 정책상 차단 가능 */ }
                            },
                            onStateChange: (e) => {
                                if (e.data === YT.PlayerState.ENDED) advanceNext();
                            },
                        },
                    });
                } catch (err) {
                    // 생성 실패해도 앱 자체는 동작
                }
            } else {
                // 같은 플레이어 재사용 → 백그라운드에서도 끊김 없이 다음 곡 재생
                try {
                    playerRef.current.loadVideoById({ videoId: link.id, startSeconds: link.t });
                } catch (err) { /* noop */ }
            }
        });

        return () => { cancelled = true; };
    }, [activeIdx, links, positionOverlay, advanceNext]);

    // 레이아웃 변화(리사이즈/회전) 시 오버레이 재배치 + 데스크톱 리스트 높이 동기화
    useEffect(() => {
        const gridEl = document.querySelector('.grid-container');
        if (!gridEl) return;

        const sync = () => {
            if (window.innerWidth > 850) {
                setGridHeight(`${gridEl.getBoundingClientRect().height}px`);
            } else {
                setGridHeight('auto');
            }
            positionOverlay();
        };

        const observer = new ResizeObserver(sync);
        observer.observe(gridEl);
        window.addEventListener('resize', sync);
        window.addEventListener('orientationchange', sync);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', sync);
        };
    }, [positionOverlay]);

    if (searchParams === null) {
        return <BootState />;
    }

    if (!hasSharedTopster) {
        return <LandingState />;
    }

    return (
        <>
            <div className="main-container">
                <div
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

                    {/* 단일 영속 플레이어가 올라가는 오버레이 (활성 셀 위에 겹침) */}
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
                <p className="play-help-text">
                    곡 제목이나 표지를 클릭해 음악을 들어보세요. 끝나면 다음 곡으로 자동 재생됩니다.
                </p>
                <a
                    className="create-topster-link"
                    href="/help"
                >
                    직접 탑스터 만들기
                </a>
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
                    e.target.onerror = null; // Prevent infinite loop
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

function LandingState() {
    return (
        <main className="landing-state">
            <section className="landing-copy">
                <p className="landing-kicker">Topstertube</p>
                <h1>좋아하는 음악을 재생 가능한 탑스터로 만들어보세요.</h1>
                <p>
                    Chrome 확장 프로그램에서 YouTube 곡을 모으고, 공유 링크를 받은 사람은 설치 없이 웹에서 바로 감상할 수 있습니다.
                </p>
                <div className="landing-actions">
                    <a className="landing-primary-link" href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
                        확장 프로그램 설치
                    </a>
                    <a className="landing-secondary-link" href="/help">
                        사용법 보기
                    </a>
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
