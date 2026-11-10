import { useEffect, useRef, useState } from 'react';
import { decodeTopsterData, encodeTopsterData } from '../lib/topsterPayload';
import { layoutData, parsePlaylist, parseVideo } from '../lib/editor';
import { loadYouTubeApi, fetchTrackMetadata } from '../lib/youtube';
import SharePanel from './SharePanel';

const DRAFT_KEY = 'topstertube:draft:v1';
const demo = ['jfKfPfyJRdk', '5qap5aO4i9A', 'DWcJFNfaw9c', 'rUxyKA_-grg'];

export default function Editor({ initialData }) {
    const [tracks, setTracks] = useState(initialData?.links || []);
    const [layout, setLayout] = useState(initialData?.theme === 'classic' ? 'classic' : String(initialData?.w || 3));
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('');
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [undo, setUndo] = useState(null);
    const [metadata, setMetadata] = useState({});
    const helper = useRef(null);
    const helperPlayer = useRef(null);
    const cleanupImport = useRef(null);
    const settings = layoutData(layout);
    const payload = encodeTopsterData({ ...settings, links: tracks });
    const used = tracks.slice(0, settings.capacity).filter(Boolean).length;
    const trackIds = [...new Set(tracks.filter(Boolean).map(track => track.id))].join(',');
    useEffect(() => {
        const controller = new AbortController();
        const ids = trackIds ? trackIds.split(',') : [];
        let cursor = 0;
        async function worker() {
            while (cursor < ids.length && !controller.signal.aborted) {
                const id = ids[cursor++];
                const result = await fetchTrackMetadata(id, controller.signal);
                if (!controller.signal.aborted) setMetadata(current => ({ ...current, [id]: result }));
            }
        }
        for (let i = 0; i < Math.min(4, ids.length); i++) worker();
        return () => controller.abort();
    }, [trackIds]);
    useEffect(() => {
        if (!initialData) {
            try {
                const saved = localStorage.getItem(DRAFT_KEY);
                if (saved) {
                    const data = decodeTopsterData(saved);
                    setTracks(data.links); setLayout(data.theme === 'classic' ? 'classic' : String(data.w));
                    setStatus('이 브라우저에 저장된 작업을 복원했습니다.');
                }
            } catch { setStatus('저장된 작업을 읽지 못했습니다. 새로 만들 수 있습니다.'); }
        }
        setReady(true);
        return () => { cleanupImport.current?.(); helperPlayer.current?.destroy?.(); };
    }, [initialData]);
    useEffect(() => {
        if (!ready) return;
        try { localStorage.setItem(DRAFT_KEY, payload); }
        catch { setStatus('브라우저 자동 저장을 사용할 수 없습니다. 공유 링크를 복사해 보관해주세요.'); }
    }, [ready, payload]);
    function change(next) { setUndo(tracks); setTracks(next); }
    function move(index, delta) {
        const next = [...tracks]; const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]]; change(next);
    }
    async function add(event) {
        event.preventDefault();
        const playlist = parsePlaylist(input);
        if (playlist && !input.trim().includes('\n')) {
            setBusy(true); setStatus('YouTube 공개 플레이리스트를 불러오는 중…');
            try {
                const YT = await loadYouTubeApi();
                const ids = await new Promise((resolve, reject) => {
                    let finished = false;
                    let poll;
                    let timeout;
                    const finish = (value, error) => {
                        if (finished) return; finished = true; clearInterval(poll); clearTimeout(timeout);
                        error ? reject(error) : resolve(value);
                    };
                    cleanupImport.current = () => finish(null, new Error('가져오기를 취소했습니다.'));
                    helperPlayer.current?.destroy?.();
                    const host = document.createElement('div'); helper.current.replaceChildren(host);
                    helperPlayer.current = new YT.Player(host, { width: 240, height: 240, playerVars: { playsinline: 1 }, events: {
                        onReady: (e) => e.target.cuePlaylist({ listType: 'playlist', list: playlist }),
                        onError: () => finish(null, new Error('공개 재생목록인지 확인해주세요. 개별 영상 링크도 추가할 수 있습니다.')),
                    } });
                    poll = setInterval(() => { const list = helperPlayer.current?.getPlaylist?.(); if (list?.length) finish(list.filter(id => /^[A-Za-z0-9_-]{11}$/.test(id))); }, 250);
                    timeout = setTimeout(() => finish(null, new Error('목록을 불러오지 못했습니다. 공개 상태를 확인하거나 영상 링크를 직접 넣어주세요.')), 15000);
                });
                const existing = tracks.filter(Boolean);
                const available = settings.capacity - existing.length;
                const selected = ids.slice(0, Math.max(0, available));
                change([...existing, ...selected.map(id => ({ id, t: 0 }))]);
                setStatus(`${ids.length}곡 중 ${selected.length}곡을 추가했습니다.${ids.length > available ? ' 레이아웃의 빈칸만큼 가져왔습니다.' : ''}`); setInput('');
            } catch (error) { setStatus(error.message || '목록을 불러오지 못했습니다.'); }
            finally { helperPlayer.current?.destroy?.(); helperPlayer.current = null; cleanupImport.current = null; setBusy(false); }
            return;
        }
        const values = input.split(/\s+/).filter(Boolean);
        const parsed = values.map(parseVideo);
        if (!values.length || parsed.some(v => !v)) { setStatus('YouTube 영상 링크 또는 영상 ID를 확인해주세요. 여러 링크는 줄바꿈으로 구분하세요.'); return; }
        const next = [...tracks]; let added = 0;
        for (const track of parsed) {
            let index = next.findIndex(v => !v);
            if (index < 0) index = next.length;
            if (index >= settings.capacity) break;
            next[index] = track; added++;
        }
        change(next); setInput(''); setStatus(`${added}곡을 추가했습니다.${added < parsed.length ? ' 빈칸이 부족합니다. 더 큰 레이아웃을 선택해주세요.' : ''}`);
    }
    return <main className="studio">
        <header className="site-header"><a className="wordmark" href="/">TOPSTER<span>TUBE</span><i /></a><nav><a href="/help">사용법</a><a href="/privacy">개인정보</a></nav></header>
        <section className="studio-hero"><div><p className="eyebrow">YOUR MUSIC, IN A FRAME</p><h1>취향을 담고.<br /><span>음악을 건네고.</span></h1><p>좋아하는 YouTube 음악을 하나의 탑스터로.<br />표지를 누르면 재생되고, 작은 링크 하나로 공유돼요.</p></div><div className="hero-note"><span>01 / COLLECT</span><span>02 / ARRANGE</span><span>03 / PLAY & SHARE</span></div></section>
        <div className="studio-columns">
            <section className="editor-panel">
                <div className="section-heading"><h2>내 탑스터 만들기</h2><span className="badge">{used} / {settings.capacity} TRACKS</span></div>
                <form onSubmit={add}>
                    <label htmlFor="music-input">YouTube 링크</label>
                    <textarea id="music-input" value={input} onChange={e => setInput(e.target.value)} placeholder={'영상 또는 공개 플레이리스트 링크를 붙여넣으세요.\n여러 영상은 한 줄에 하나씩 넣을 수 있어요.'} rows={3} disabled={busy} />
                    <div className="button-row"><button className="primary" disabled={busy || !input.trim()} type="submit">{busy ? '불러오는 중…' : '+ 음악 추가'}</button><span className="muted">YouTube Music · Shorts 지원</span></div>
                </form>
                <div ref={helper} className="import-player" hidden={!busy} />
                <div className="layout-picker" role="group" aria-label="레이아웃 선택">{['2','3','4','5','classic'].map(value => <button key={value} aria-pressed={layout === value} disabled={busy} onClick={() => {
                    if (tracks.slice(layoutData(value).capacity).some(Boolean)) { setStatus('작은 레이아웃으로 바꾸려면 뒤쪽 곡을 먼저 삭제해주세요.'); return; }
                    setLayout(value);
                }}>{value === 'classic' ? 'Classic 42' : `${value} × ${value}`}</button>)}</div>
                <p className="status-message" role="status">{status || '링크의 시작 시간도 함께 저장됩니다. 순서는 아래에서 바꿔보세요.'}</p>
                <div className="editor-tools"><span className="muted">{ready ? '이 기기에 자동 저장' : '작업 불러오는 중'}</span><button disabled={!undo || busy} onClick={() => { setTracks(undo); setUndo(null); }}>실행 취소</button></div>
                <ol className="edit-tracks">{tracks.map((track, index) => track && <li key={`${index}-${track.id}`}>
                    <span className="track-number">{String(index + 1).padStart(2,'0')}</span><img src={`https://img.youtube.com/vi/${track.id}/default.jpg`} alt="" loading="lazy" />
                    <a href={`https://www.youtube.com/watch?v=${track.id}`} target="_blank" rel="noopener noreferrer" title={metadata[track.id]?.title || track.id}>{metadata[track.id]?.title || track.id}</a>
                    <label className="time-field"><span className="sr-only">{index + 1}번 곡 시작 시간 (초)</span><input aria-label={`${index + 1}번 곡 시작 시간 (초)`} type="number" min="0" max="86400" value={track.t} disabled={busy} onChange={e => { const next = [...tracks]; next[index] = { ...track, t: Math.max(0, Math.min(86400, Number(e.target.value) || 0)) }; change(next); }} /><span>초</span></label>
                    <div className="track-tools"><button disabled={index === 0 || busy} aria-label={`${index + 1}번 곡 위로`} onClick={() => move(index, -1)}>↑</button><button disabled={index === tracks.length - 1 || busy} aria-label={`${index + 1}번 곡 아래로`} onClick={() => move(index, 1)}>↓</button><button disabled={busy} aria-label={`${index + 1}번 곡 삭제`} onClick={() => change(tracks.filter((_, i) => i !== index))}>×</button></div>
                </li>)}</ol>
                {!used && <div className="empty-state"><span>아직 비어 있는 플레이리스트</span><p>첫 곡을 추가하면 표지가 여기에 나타납니다.</p><button onClick={() => { change(demo.map(id => ({ id, t: 0 }))); setStatus('샘플을 넣었습니다. 원하는 곡으로 바꿔보세요.'); }}>샘플로 시작하기 ↗</button></div>}
            </section>
            <aside className="preview-panel"><div className="section-heading"><h2>커버 미리보기</h2><span className="badge">LIVE PREVIEW</span></div><div className={`editor-grid ${settings.theme === 'classic' ? 'editor-classic' : ''}`} style={{ gridTemplateColumns: `repeat(${settings.w}, 1fr)` }}>{Array.from({ length: settings.capacity }, (_, i) => <div key={i} className={settings.theme === 'classic' ? i < 10 ? 'tier-large' : i < 22 ? 'tier-medium' : 'tier-small' : ''}>{tracks[i] ? <img src={`https://img.youtube.com/vi/${tracks[i].id}/mqdefault.jpg`} alt={`${i + 1}번 곡 커버`} loading="lazy" /> : <span>{String(i+1).padStart(2,'0')}</span>}</div>)}</div>
                {used > 0 ? <><a className="listen-link" href={`/?d=${encodeURIComponent(payload)}`}>내 탑스터 재생하기 <span>↗</span></a><SharePanel payload={payload} /></> : <p className="preview-caption">커버는 취향의 한 장면.<br />완성하면 음악이 흐르는 링크가 됩니다.</p>}
            </aside>
        </div>
        <footer className="studio-footer"><span>MADE OF MUSIC. MADE BY YOU.</span><a href="/help">확장 프로그램과 함께 사용하기 ↗</a></footer>
    </main>;
}
