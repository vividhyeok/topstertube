export function parseVideo(input) {
    const value = input.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(value)) return { id: value, t: 0 };
    try {
        const url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol)) return null;
        const host = url.hostname.toLowerCase();
        if (host !== 'youtu.be' && host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null;
        const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
        if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return null;
        const time = url.searchParams.get('t') || url.searchParams.get('start') || '0';
        const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
        const seconds = /^\d+$/.test(time) ? Number(time) : parts ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : 0;
        return { id, t: Math.min(86400, seconds) };
    } catch { return null; }
}

export function parsePlaylist(input) {
    try {
        const url = new URL(input.trim());
        if (!['youtube.com', 'youtu.be'].includes(url.hostname) && !url.hostname.endsWith('.youtube.com')) return null;
        const id = url.searchParams.get('list');
        return /^[A-Za-z0-9_-]{10,200}$/.test(id || '') ? id : null;
    } catch { return null; }
}

export function layoutData(value) {
    if (value === 'classic') return { theme: 'classic', w: 3, h: 3, capacity: 42 };
    const n = [2, 3, 4, 5].includes(Number(value)) ? Number(value) : 3;
    return { theme: 'grid', w: n, h: n, capacity: n * n };
}
