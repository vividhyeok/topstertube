import { useEffect, useRef, useState } from 'react';

export default function SharePanel({ payload }) {
    const [origin, setOrigin] = useState('');
    const [short, setShort] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const current = useRef(payload);
    current.current = payload;
    useEffect(() => { setOrigin(window.location.origin); }, []);
    useEffect(() => { setMessage(''); }, [payload]);
    const longUrl = `${origin}/?d=${encodeURIComponent(payload)}`;
    const shortUrl = short?.payload === payload ? `${origin}${short.path}` : '';
    const url = shortUrl || longUrl;
    const imageUrl = `${origin}/api/topster.png?d=${encodeURIComponent(payload)}`;
    async function copy(text) {
        try { await navigator.clipboard.writeText(text); setMessage('복사했습니다.'); }
        catch { setMessage('복사 권한이 없습니다. 주소를 길게 눌러 직접 복사해주세요.'); }
    }
    async function shorten() {
        setBusy(true); setMessage('단축 링크를 저장하고 있습니다…');
        const requested = payload;
        try {
            const response = await fetch('/api/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload }), signal: AbortSignal.timeout(20000) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '단축 링크 생성에 실패했습니다.');
            if (current.current !== requested) return;
            setShort({ payload: requested, path: data.path });
            setMessage('단축 링크가 준비됐습니다. 복사해서 NFC의 URL 항목에 기록하세요.');
        } catch (error) { if (current.current === requested) setMessage(error.message); }
        finally { setBusy(false); }
    }
    async function download() {
        setMessage('이미지를 만들고 있습니다…');
        try {
            const res = await fetch(imageUrl, { signal: AbortSignal.timeout(60000) });
            if (!res.ok) throw new Error();
            const objectUrl = URL.createObjectURL(await res.blob());
            const a = document.createElement('a'); a.href = objectUrl; a.download = 'topstertube.png'; a.click();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000); setMessage('이미지를 저장했습니다.');
        } catch { setMessage('이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
    }
    return <section className="share-panel" aria-label="공유 및 NFC">
        <div className="section-heading"><h2>음악을 건네는 가장 작은 방법</h2><span className="badge">SHARE / NFC</span></div>
        <p className="muted">단축 주소를 NFC 태그에 담으면, 터치 한 번으로 이 탑스터를 열 수 있어요.</p>
        <label htmlFor="share-url">{shortUrl ? 'NFC용 단축 주소' : '원본 공유 주소'}</label>
        <input id="share-url" readOnly value={origin ? url : ''} onFocus={e => e.target.select()} />
        <div className="share-meta"><span>{origin ? `${new TextEncoder().encode(url).length} bytes · URL 텍스트 기준` : '주소 준비 중'}</span><span>{shortUrl ? '저장된 링크' : '단축 주소를 만들어보세요'}</span></div>
        <div className="button-row">
            <button className="primary" disabled={busy || !origin} onClick={shorten}>{busy ? '저장 중…' : shortUrl ? '단축 주소 준비 완료' : '단축 주소 만들기'}</button>
            <button onClick={() => copy(url)}>링크 복사</button>
            <button onClick={async () => { if (!navigator.share) return copy(url); try { await navigator.share({ title: '나의 TopsterTube', url }); } catch (e) { if (e.name !== 'AbortError') setMessage('공유 창을 열지 못했습니다. 링크 복사를 이용해주세요.'); } }}>공유</button>
        </div>
        <div className="button-row secondary-actions">
            <button onClick={download}>PNG 저장</button>
            <button onClick={() => copy(imageUrl)}>이미지 링크</button>
            <button onClick={() => copy(`<a href="${url}"><img src="${imageUrl}" alt="TopsterTube" style="max-width:100%;height:auto" /></a>`)}>HTML 복사</button>
        </div>
        <p className="status-message" role="status">{message}</p>
        <details><summary>NFC에 기록하는 방법</summary><p>단축 주소를 복사한 뒤 NFC 기록 앱에서 ‘URL/웹 주소’로 저장하세요. 태그의 실제 여유 용량에는 NDEF 형식의 추가 공간도 필요합니다. 저장 후 다른 기기로 태그를 읽어 확인하세요.</p><p>단축 링크는 현재 곡 목록의 고정된 사본입니다. 수정한 목록은 새 링크로 공유해주세요. 링크를 아는 누구나 열 수 있습니다.</p></details>
    </section>;
}
