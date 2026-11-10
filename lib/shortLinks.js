import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { decodeTopsterData, encodeTopsterData } from './topsterPayload';

export function normalizePayload(value) {
    if (typeof value !== 'string' || value.length > 3000 || !/^v1:(c|g(?:[1-9]|10)x(?:[1-9]|10)):[A-Za-z0-9_.~-]+$/.test(value)) {
        throw new Error('올바른 탑스터 데이터가 아닙니다.');
    }
    const data = decodeTopsterData(value);
    if (!data.links.some(Boolean) || encodeTopsterData(data) !== value) throw new Error('올바른 탑스터 데이터가 아닙니다.');
    return value;
}

export const shortCode = (payload) => createHash('sha256').update(payload).digest('base64url').slice(0, 16);
export const validCode = (code) => typeof code === 'string' && /^[A-Za-z0-9_-]{16}$/.test(code);

export async function readShortLink(code) {
    if (!validCode(code)) return null;
    const result = await get(`links/${code}.json`, { access: 'private', useCache: false });
    if (!result) return null;
    const record = await new Response(result.stream).json();
    return normalizePayload(record.payload);
}

export async function saveShortLink(payload) {
    normalizePayload(payload);
    const code = shortCode(payload);
    const existing = await readShortLink(code);
    if (existing) {
        if (existing !== payload) throw new Error('Short link collision');
        return code;
    }
    try {
        await put(`links/${code}.json`, JSON.stringify({ payload }), {
            access: 'private', addRandomSuffix: false, allowOverwrite: false,
            contentType: 'application/json',
        });
    } catch (error) {
        // Concurrent requests for the same immutable snapshot are safe.
        if (await readShortLink(code) !== payload) throw error;
    }
    return code;
}
