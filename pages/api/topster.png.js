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
            // "Classic 42" Hierarchy
            // Row 1-2: 5 items (Large)
            // Row 3-4: 6 items (Medium)
            // Row 5-6: 10 items (Small)
            // Width is fixed by 10 small items + gaps
            const smallCell = cellBase;
            const totalWidth = 10 * smallCell + 9 * gap;

            // Large cell size: (totalWidth - 4*gap) / 5
            const largeCell = (totalWidth - 4 * gap) / 5;
            // Medium cell size: (totalWidth - 5*gap) / 6
            const mediumCell = (totalWidth - 5 * gap) / 6;

            width = totalWidth;

            let currentY = 0;
            // Large rows
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 5; c++) {
                    layoutCoords.push({ x: c * (largeCell + gap), y: currentY, size: largeCell });
                }
                currentY += largeCell + gap;
            }
            // Medium rows
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 6; c++) {
                    layoutCoords.push({ x: c * (mediumCell + gap), y: currentY, size: mediumCell });
                }
                currentY += mediumCell + gap;
            }
            // Small rows
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 10; c++) {
                    layoutCoords.push({ x: c * (smallCell + gap), y: currentY, size: smallCell });
                }
                currentY += smallCell + gap;
            }
            height = currentY - gap;
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
                    const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                    const buf = await fetchBuffer(thumbUrl);

                    // 1. Base Tile: Center Crop 1:1
                    const size = Math.round(coord.size);
                    const baseTile = sharp(buf)
                        .resize(size, size, { fit: "cover", position: "centre" })
                        .modulate({ contrast: 1.05, brightness: 1.02 })
                        .sharpen();

                    // 2. Optional: Text Overlay (Pro Feature)
                    // If we want title overlays, we can fetch metadata.
                    // For now, let's stick to consistent 1:1 high-quality visual.

                    const tileBuffer = await baseTile.toBuffer();
                    return { tile: tileBuffer, left: Math.round(coord.x), top: Math.round(coord.y) };
                } catch (e) {
                    console.error(`Error processing tile ${videoId}:`, e);
                    return null;
                }
            })
        )).filter(t => t !== null);

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
