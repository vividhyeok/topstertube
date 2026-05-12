const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const storageDir = path.join(__dirname, '..', 'browser-extension', 'store_assets');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir);

const screenshots = [
    {
        src: "C:\\Users\\user\\Pictures\\Screenshots\\스크린샷 2025-12-29 062350.png",
        dst: path.join(storageDir, 'screenshot1.png'),
        w: 1280, h: 800
    },
    {
        src: "C:\\Users\\user\\Pictures\\Screenshots\\스크린샷 2025-12-29 055048.png",
        dst: path.join(storageDir, 'screenshot2.png'),
        w: 1280, h: 800
    },
    {
        src: "C:\\Users\\user\\Downloads\\Gemini_Generated_Image_xagkl7xagkl7xagk.png",
        dst: path.join(storageDir, 'promo_small.png'),
        w: 440, h: 280
    },
    {
        src: "C:\\Users\\user\\Downloads\\Gemini_Generated_Image_70w7l470w7l470w7.png",
        dst: path.join(storageDir, 'promo_marquee.png'),
        w: 1400, h: 560
    }
];

async function convert() {
    for (const item of screenshots) {
        console.log(`Converting: ${item.src} -> ${item.dst} (${item.w}x${item.h})`);
        await sharp(item.src)
            .resize(item.w, item.h, {
                fit: 'cover', // Promo tiles usually look better with cover
                position: 'centre'
            })
            .flatten({ background: { r: 0, g: 0, b: 0 } })
            .png()
            .toFile(item.dst);
    }
    console.log('All store assets converted successfully!');
}

convert().catch(err => {
    console.error('Conversion failed:', err);
    process.exit(1);
});
