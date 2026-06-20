import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Head from 'next/head';

/*
 * [TEST 라우트] 단일 영속 플레이어 버전
 * - 메인(/)과 UI/동작은 동일하게 보이지만, 곡마다 새 iframe을 만들지 않고
 *   "플레이어 하나를 계속 살려두고 loadVideoById()로 곡만 교체"한다.
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

function PlayerContent() {
    const searchParams = useSearchParams();
    const [links, setLinks] = useState([]);
    const [gridConfig, setGridConfig] = useState({ w: 3, h: 3, theme: 'grid' });
    const [activeIdx, setActiveIdx] = useState(null);
    const [gridHeight, setGridHeight] = useState('auto');

    // DOM/플레이어 참조
    const cellRefs = useRef([]);          // 각 그리드 셀 DOM
    const overlayRef = useRef(null);      // 영상이 올라갈 오버레이 컨테이너
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

    // URL 파라미터 파싱
    useEffect(() => {
        const theme = searchParams.get('theme') || 'grid';
        let w = parseInt(searchParams.get('w')) || 3;
        let h = parseInt(searchParams.get('h')) || 3;

        const loadedLinks = [];
        const total = theme === 'classic' ? 42 : w * h;

        for (let i = 1; i <= total; i++) {
            const linkParam = searchParams.get(`link${i}`);
            if (linkParam) {
                let videoId = linkParam;
                let start = 0;
                if (linkParam.includes('?t=')) {
                    const parts = linkParam.split('?t=');
                    videoId = parts[0];
                    start = parseInt(parts[1]) || 0;
                }
                loadedLinks.push({ id: videoId, t: start, order: i });
            } else {
                loadedLinks.push(null);
            }
        }

        cellRefs.current = new Array(loadedLinks.length).fill(null);
        setLinks(loadedLinks);
        setGridConfig({ w, h, theme });
    }, [searchParams]);

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

            if (!playerRef.current) {
                // 영속 플레이어 최초 생성 — 이후 파괴하지 않고 재사용
                const host = document.createElement('div');
                host.style.width = '100%';
                host.style.height = '100%';
                playerHostRef.current = host;
                overlayRef.current.appendChild(host);

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

    return (
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
                        index={i}
                        theme={gridConfig.theme}
                        isActive={activeIdx === i}
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
                />
            </div>
            <div className="list-container" style={{ maxHeight: gridHeight }}>
                <ol id="track-list">
                    {links.map((link, i) => (
                        <ListItem
                            key={i}
                            link={link}
                            index={i}
                            onToggle={() => togglePlay(i)}
                            isActive={activeIdx === i}
                        />
                    ))}
                </ol>
            </div>
        </div>
    );
}

function GridItem({ link, index, theme, isActive, onToggle, cellRef }) {
    const [title, setTitle] = useState(`Track ${index + 1}`);

    useEffect(() => {
        if (link) {
            fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${link.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.title) setTitle(data.title.replace(' - Topic', ''));
                })
                .catch(() => { });
        }
    }, [link]);

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

function ListItem({ link, index, onToggle, isActive }) {
    const [text, setText] = useState('-');

    useEffect(() => {
        if (link) {
            fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${link.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.title) {
                        const artist = data.author_name ? data.author_name.replace(' - Topic', '') : '';
                        setText(artist ? `${artist} - ${data.title}` : data.title);
                    }
                })
                .catch(() => { });
        }
    }, [link]);

    if (!link) return <li><span className="empty-li">-</span></li>;

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

export default function TestHome() {
    return (
        <>
            <Head>
                <title>Topstertube (test) - 연속재생</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="description" content="유튜브 음악으로 만드는 나만의 재생 가능한 탑스터" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="/style.css" />
            </Head>
            <Suspense fallback={<div style={{ color: 'white', padding: '20px' }}>Loading Topstertube...</div>}>
                <PlayerContent />
            </Suspense>
        </>
    );
}
