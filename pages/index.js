import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Head from 'next/head';

function PlayerContent() {
    const searchParams = useSearchParams();
    const [links, setLinks] = useState([]);
    const [gridConfig, setGridConfig] = useState({ w: 3, h: 3, theme: 'grid' });

    const [activeIdx, setActiveIdx] = useState(null);

    const togglePlay = (idx) => {
        if (activeIdx === idx) {
            setActiveIdx(null);
        } else {
            setActiveIdx(idx);
        }
    };

    const gridRef = import.meta.env ? { current: null } : null; // Next.js SSR safety
    const [gridHeight, setGridHeight] = useState('auto');

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

        setLinks(loadedLinks);
        setGridConfig({ w, h, theme });
    }, [searchParams]);

    // Height sync logic
    useEffect(() => {
        const gridEl = document.querySelector('.grid-container');
        if (!gridEl) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (window.innerWidth > 850) {
                    setGridHeight(`${entry.contentRect.height}px`);
                } else {
                    setGridHeight('auto');
                }
            }
        });

        observer.observe(gridEl);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="main-container">
            <header className="page-header">
                <img src="/icons/icon32.png" alt="logo" className="header-logo" />
                <h1>Topstertube</h1>
            </header>
            <div
                className={`grid-container ${gridConfig.theme === 'classic' ? 'classic-layout' : ''}`}
                style={gridConfig.theme !== 'classic' ? { gridTemplateColumns: `repeat(${gridConfig.w}, 1fr)` } : {}}
            >
                {links.map((link, i) => (
                    <GridItem
                        key={i}
                        link={link}
                        index={i}
                        theme={gridConfig.theme}
                        isActive={activeIdx === i}
                        onToggle={() => togglePlay(i)}
                    />
                ))}
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

function GridItem({ link, index, theme, isActive, onToggle }) {
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

    if (!link) return <div className={getClassName()} style={{ backgroundColor: '#1e1e1e', cursor: 'default' }} />;

    return (
        <div className={getClassName()} onClick={onToggle}>
            {isActive ? (
                <iframe
                    src={`https://www.youtube.com/embed/${link.id}?start=${link.t}&autoplay=1&playsinline=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            ) : (
                <img
                    src={`https://img.youtube.com/vi/${link.id}/mqdefault.jpg`}
                    alt={title}
                    title={title}
                    onError={(e) => {
                        e.target.onerror = null; // Prevent infinite loop
                        e.target.src = `https://img.youtube.com/vi/${link.id}/hqdefault.jpg`;
                    }}
                />
            )}
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

export default function Home() {
    return (
        <>
            <Head>
                <title>Topstertube - 재생 가능한 탑스터</title>
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
