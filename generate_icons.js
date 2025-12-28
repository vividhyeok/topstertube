const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = path.join(__dirname, '..', 'daftpunk.png');
const extIconsDir = path.join(__dirname, '..', 'browser-extension', 'icons');
const webIconsDir = path.join(__dirname, 'public', 'icons');

const sizes = [16, 32, 48, 128];

async function generate() {
    for (const size of sizes) {
        // Extension icons - Trim added here
        await sharp(source)
            .trim()
            .resize(size, size, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toFile(path.join(extIconsDir, `icon${size}.png`));

        // Web icons - Trim added here
        await sharp(source)
            .trim()
            .resize(size, size, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toFile(path.join(webIconsDir, `icon${size}.png`));
    }

    // Favicon (32x32)
    await sharp(source)
        .trim()
        .resize(32, 32)
        .toFile(path.join(__dirname, 'public', 'favicon.ico'));

    console.log('Icons trimmed and generated successfully!');
}

generate().catch(err => {
    console.error('Error generating icons:', err);
    process.exit(1);
});
