const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const files = fs.readdirSync(assetsDir);

files.forEach(file => {
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp')) {
        const stats = fs.statSync(path.join(assetsDir, file));
        console.log(`${file}: ${stats.size} bytes`);
    }
});
