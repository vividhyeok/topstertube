import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PlayerContent() {
    const searchParams = useSearchParams();
    const [links, setLinks] = useState([]);
    const [gridConfig, setGridConfig] = useState({ w: 3, h: 3, theme: 'grid' });

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

    return (
        <div className="main-container">
            <div
                className={`grid-container ${gridConfig.theme === 'classic' ? 'classic-layout' : ''}`}
                style={gridConfig.theme !== 'classic' ? { gridTemplateColumns: `repeat(${gridConfig.w}, 1fr)` } : {}}
            >
                {links.map((link, i) => (
                    <GridItem key={i} link={link} index={i} theme={gridConfig.theme} />
                ))}
            </div>
            <div className="list-container">
                <ol id="track-list">
                    {links.map((link, i) => (
                        <ListItem key={i} link={link} index={i} />
                    ))}
                </ol>
            </div>
        </div>
    );
}

function GridItem({ link, index, theme }) {
    const [isPlaying, setIsPlaying] = useState(false);
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
        <div className={getClassName()} onClick={() => setIsPlaying(true)}>
            {isPlaying ? (
                <iframe
                    src={`https://www.youtube.com/embed/${link.id}?start=${link.t}&autoplay=1&playsinline=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            ) : (
                <img src={`https://img.youtube.com/vi/${link.id}/hqdefault.jpg`} alt={title} title={title} />
            )}
        </div>
    );
}

function ListItem({ link, index }) {
    const [text, setText] = useState(`Track ${index + 1}`);

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
        <li>
            <a href={`https://www.youtube.com/watch?v=${link.id}${link.t ? '&t=' + link.t : ''}`} target="_blank" rel="noreferrer">
                {text}
            </a>
        </li>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div style={{ color: 'white', padding: '20px' }}>Loading Topster...</div>}>
            <PlayerContent />
        </Suspense>
    );
}
