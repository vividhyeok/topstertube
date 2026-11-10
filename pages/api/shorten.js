import { normalizePayload, saveShortLink } from '../../lib/shortLinks';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

// A bounded, per-instance burst guard. Platform WAF should enforce global quotas.
const bursts = new Map();
function allowRequest(req) {
    const now = Date.now();
    for (const [key, value] of bursts) if (value.until <= now) bursts.delete(key);
    const key = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
    const value = bursts.get(key) || { count: 0, until: now + 60000 };
    if (value.count >= 20 || (!bursts.has(key) && bursts.size >= 10000)) return false;
    value.count++; bursts.set(key, value); return true;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    }
    const origin = req.headers.origin;
    if (origin) {
        try {
            if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: '같은 사이트에서 요청해주세요.' });
        } catch { return res.status(403).json({ error: '잘못된 요청입니다.' }); }
    }
    let payload;
    try { payload = normalizePayload(req.body?.payload); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (!allowRequest(req)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: '요청이 많습니다. 1분 뒤 다시 시도해주세요.' });
    }
    try {
        const code = await saveShortLink(payload);
        return res.status(200).json({ path: `/s/${code}` });
    } catch {
        return res.status(503).json({ error: '단축 링크 저장소에 연결하지 못했습니다. 잠시 후 다시 시도하거나 원본 링크를 사용해주세요.' });
    }
}
