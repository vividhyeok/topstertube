import sharp from "sharp";

export default async function handler(req, res) {
    try {
        const q = req.query;
        const theme = q.theme || "grid"; // grid, classic

        let width, height;
        let cellBase = clampInt(q.cell, 120, 700, 360);
        let gap = clampInt(q.gap, 0, 60, 10);
        let bg = q.bg || "#121212";

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
            const w = clampInt(q.w, 1, 10, 3);
            const h = clampInt(q.h, 1, 10, 3);
            width = w * cellBase + (w - 1) * gap;
            height = h * cellBase + (h - 1) * gap;

            for (let i = 0; i < w * h; i++) {
                const x = (i % w) * (cellBase + gap);
                const y = Math.floor(i / w) * (cellBase + gap);
                layoutCoords.push({ x, y, size: cellBase });
            }
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
            const link = q[`link${i + 1}`];
            if (!link) continue;
            const videoId = String(link).split("?t=")[0].trim();
            if (videoId) jobs.push({ order: i, videoId, coord: layoutCoords[i] });
        }

        const tiles = (await Promise.all(
            jobs.map(async ({ videoId, coord, order }) => {
                try {
                    // Try 16:9 sources to avoid black bars: maxresdefault -> mqdefault
                    const sources = [
                        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                    ];

                    let buf = null;
                    for (const url of sources) {
                        try {
                            const res = await fetch(url);
                            if (res.ok) {
                                const ab = await res.arrayBuffer();
                                buf = Buffer.from(ab);
                                break;
                            }
                        } catch (e) { }
                    }

                    if (!buf) throw new Error("No image found");

                    // 1. Base Tile: Center Crop 1:1
                    const size = Math.round(coord.size);
                    const baseTile = sharp(buf)
                        .resize(size, size, { fit: "cover", position: "centre" })
                        .modulate({ contrast: 1.05, brightness: 1.02 })
                        .sharpen();

                    const tileBuffer = await baseTile.toBuffer();
                    return { tile: tileBuffer, left: Math.round(coord.x), top: Math.round(coord.y) };
                } catch (e) {
                    console.error(`Error processing tile ${videoId}:`, e);
                    return null;
                }
            })
        )).filter(t => t !== null);

        const path = await import("path");
        const fs = await import("fs");
        const footerPath = path.join(process.cwd(), "public", "footer.png");
        let footerOverlay = null;

        if (fs.existsSync(footerPath)) {
            const footerBuf = fs.readFileSync(footerPath);
            footerOverlay = {
                input: await sharp(footerBuf).resize(Math.round(width), 40, { fit: "contain", background: "#000000" }).toBuffer(),
                left: 0,
                top: Math.round(height)
            };
        } else {
            // Fallback to SVG if file not found (though squares might appear)
            footerOverlay = {
                input: Buffer.from(`
                    <svg width="${Math.round(width)}" height="40" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#000000" />
                        <text x="50%" y="25" font-family="sans-serif" font-size="16" fill="#ffffff" text-anchor="middle" font-weight="bold">
                            TopsterTube - 이미지를 클릭하여 감상하세요
                        </text>
                    </svg>
                `),
                left: 0,
                top: Math.round(height)
            };
        }

        const out = await base
            .composite(tiles.map(t => ({ input: t.tile, left: t.left, top: t.top })))
            .png()
            .toBuffer();

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
        res.status(200).send(out);
    } catch (e) {
        console.error(e);
        res.status(500).send("Failed to generate image");
    }
}

async function fetchBuffer(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch failed: ${url}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
}

function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}
