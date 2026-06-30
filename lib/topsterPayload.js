const DEFAULT_GRID = { w: 3, h: 3 };
const CLASSIC_SIZE = 42;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function clampInt(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function parseLinkValue(value) {
    if (!value) return null;

    const [rawId, rawTime] = String(value).split('?t=');
    const id = rawId.trim();
    if (!VIDEO_ID_PATTERN.test(id)) return null;

    return {
        id,
        t: rawTime ? clampInt(rawTime, 0, 86400, 0) : 0,
    };
}

export function getLayoutSize({ theme = 'grid', w = DEFAULT_GRID.w, h = DEFAULT_GRID.h }) {
    if (theme === 'classic') return CLASSIC_SIZE;
    return clampInt(w, 1, 10, DEFAULT_GRID.w) * clampInt(h, 1, 10, DEFAULT_GRID.h);
}

export function decodeTopsterData(value) {
    const payload = String(value || '');
    const [version, layout, body = ''] = payload.split(':');

    if (version !== 'v1') {
        throw new Error('Unsupported topster payload version');
    }

    let theme = 'grid';
    let w = DEFAULT_GRID.w;
    let h = DEFAULT_GRID.h;

    if (layout === 'c') {
        theme = 'classic';
    } else {
        const gridMatch = /^g(\d+)x(\d+)$/.exec(layout || '');
        if (!gridMatch) throw new Error('Invalid topster layout');
        w = clampInt(gridMatch[1], 1, 10, DEFAULT_GRID.w);
        h = clampInt(gridMatch[2], 1, 10, DEFAULT_GRID.h);
    }

    const total = getLayoutSize({ theme, w, h });
    const links = new Array(total).fill(null);
    const tokens = body ? body.split('.') : [];

    tokens.slice(0, total).forEach((token, index) => {
        if (!token) return;
        const [id, timeToken] = token.split('~');
        if (!VIDEO_ID_PATTERN.test(id)) return;

        const t = timeToken ? parseInt(timeToken, 36) : 0;
        links[index] = {
            id,
            t: Number.isFinite(t) ? Math.max(0, t) : 0,
            order: index + 1,
        };
    });

    return { links, w, h, theme };
}

export function decodeLegacySearchParams(searchParams) {
    const theme = searchParams.get('theme') === 'classic' ? 'classic' : 'grid';
    const w = clampInt(searchParams.get('w'), 1, 10, DEFAULT_GRID.w);
    const h = clampInt(searchParams.get('h'), 1, 10, DEFAULT_GRID.h);
    const total = getLayoutSize({ theme, w, h });
    const links = [];

    for (let i = 1; i <= total; i++) {
        const link = parseLinkValue(searchParams.get(`link${i}`));
        links.push(link ? { ...link, order: i } : null);
    }

    return { links, w, h, theme };
}

export function decodeTopsterSearchParams(searchParams) {
    const compact = searchParams.get('d');

    if (compact) {
        try {
            return decodeTopsterData(compact);
        } catch (error) {
            // Fall through to the legacy parser so old URLs still work.
        }
    }

    return decodeLegacySearchParams(searchParams);
}

export function decodeTopsterQueryObject(query) {
    const searchParams = new URLSearchParams();

    Object.entries(query || {}).forEach(([key, value]) => {
        const normalizedValue = Array.isArray(value) ? value[0] : value;
        if (normalizedValue !== undefined) searchParams.set(key, normalizedValue);
    });

    return decodeTopsterSearchParams(searchParams);
}
