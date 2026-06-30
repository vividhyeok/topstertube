import sharp from "sharp";
import { decodeTopsterData, decodeTopsterQueryObject } from "../../lib/topsterPayload";

const ALLOWED_GRID_KEYS = new Set(["2x2", "3x3", "4x4", "5x5"]);
const MAX_PIXELS = 12_000_000;
const THUMBNAIL_CONCURRENCY = 6;
const THUMBNAIL_TIMEOUT_MS = 4000;

class RequestError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

export default async function handler(req, res) {
    try {
        const q = req.query;
        const { links, w, h, theme } = decodeRequestQuery(q);

        validateLayout({ w, h, theme });

        let width, height;
        let cellBase = clampInt(q.cell, 120, 400, 360);
        let gap = clampInt(q.gap, 0, 60, 10);
        let bg = normalizeColorParam(q.bg) || "#121212";

        let layoutCoords = [];

        if (theme === "classic") {
            // "Classic 42" Hierarchy: 5x2 (Large), 6x2 (Medium), 10x2 (Small)
            // Lower default cellBase for classic to avoid timeouts (42 items is a lot)
            cellBase = clampInt(q.cell, 80, 240, 120);

            const smallCell = cellBase;
            const totalWidth = 10 * smallCell + 9 * gap;

            const largeCell = (totalWidth - 4 * gap) / 5;
            const mediumCell = (totalWidth - 5 * gap) / 6;

            width = totalWidth;
            layoutCoords = [];
            let currentY = 0;

            // 0-9: Large (5x2)
            for (let i = 0; i < 10; i++) {
                const r = Math.floor(i / 5);
                const c = i % 5;
                layoutCoords.push({ x: c * (largeCell + gap), y: r * (largeCell + gap), size: largeCell });
            }
            currentY = 2 * (largeCell + gap);

            // 10-21: Medium (6x2)
            for (let i = 0; i < 12; i++) {
                const r = Math.floor(i / 6);
                const c = i % 6;
                layoutCoords.push({ x: c * (mediumCell + gap), y: currentY + r * (mediumCell + gap), size: mediumCell });
            }
            currentY += 2 * (mediumCell + gap);

            // 22-41: Small (10x2)
            for (let i = 0; i < 20; i++) {
                const r = Math.floor(i / 10);
                const c = i % 10;
                layoutCoords.push({ x: c * (smallCell + gap), y: currentY + r * (smallCell + gap), size: smallCell });
            }
            height = currentY + 2 * (smallCell + gap) - gap;
        } else {
            // Standard Grid
            width = w * cellBase + (w - 1) * gap;
            height = h * cellBase + (h - 1) * gap;

            for (let i = 0; i < w * h; i++) {
                const x = (i % w) * (cellBase + gap);
                const y = Math.floor(i / w) * (cellBase + gap);
                layoutCoords.push({ x, y, size: cellBase });
            }
        }

        const pixelCount = Math.round(width) * Math.round(height);
        if (pixelCount > MAX_PIXELS) {
            throw new RequestError(400, "Requested image is too large");
        }

        const base = sharp({
            create: {
                width: Math.round(width),
                height: Math.round(height),
                channels: 3,
                background: bg
            }
        });

        // Collect valid links
        const jobs = [];
        for (let i = 0; i < layoutCoords.length; i++) {
            const link = links[i];
            if (link?.id) jobs.push({ videoId: link.id, coord: layoutCoords[i] });
        }

        const tiles = (await mapLimit(jobs, THUMBNAIL_CONCURRENCY, renderTile)).filter(t => t !== null);

        const out = await base
            .composite(tiles.map(t => ({ input: t.tile, left: t.left, top: t.top })))
            .png()
            .toBuffer();

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
        res.status(200).send(out);
    } catch (e) {
        const status = e.statusCode || 500;
        if (status >= 500) {
            console.error(e);
        }
        res.status(status).send(status === 400 ? e.message : "Failed to generate image");
    }
}

function decodeRequestQuery(query) {
    const compactPayload = readStringParam(query.d);

    if (compactPayload) {
        try {
            return decodeTopsterData(compactPayload);
        } catch (error) {
            throw new RequestError(400, "Invalid topster payload");
        }
    }

    try {
        return decodeTopsterQueryObject(query);
    } catch (error) {
        throw new RequestError(400, "Invalid topster query");
    }
}

function validateLayout({ w, h, theme }) {
    if (theme === "classic") return;

    if (!ALLOWED_GRID_KEYS.has(`${w}x${h}`)) {
        throw new RequestError(400, "Unsupported topster layout");
    }
}

async function renderTile({ videoId, coord }) {
    try {
        // Try 16:9 sources to avoid black bars: maxresdefault -> mqdefault
        const sources = [
            `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        ];

        let buf = null;
        for (const url of sources) {
            buf = await fetchImageBuffer(url);
            if (buf) break;
        }

        if (!buf) throw new Error("No image found");

        const size = Math.round(coord.size);
        const tileBuffer = await sharp(buf)
            .resize(size, size, { fit: "cover", position: "centre" })
            .modulate({ brightness: 1.02 })
            .sharpen()
            .toBuffer();

        return { tile: tileBuffer, left: Math.round(coord.x), top: Math.round(coord.y) };
    } catch (e) {
        console.error(`Error processing tile ${videoId}:`, e);
        return null;
    }
}

async function fetchImageBuffer(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), THUMBNAIL_TIMEOUT_MS);

    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;

        const contentType = res.headers.get("content-type") || "";
        if (contentType && !contentType.startsWith("image/")) return null;

        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeout);
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

function normalizeColorParam(value) {
    const text = readStringParam(value).trim();
    if (!text) return null;
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : null;
}

function readStringParam(value) {
    if (Array.isArray(value)) return value[0] || "";
    if (value === undefined || value === null) return "";
    return String(value);
}

function clampInt(v, min, max, fallback) {
    const n = parseInt(readStringParam(v), 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}
