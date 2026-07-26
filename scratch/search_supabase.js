const fs = require('fs');
const files = ['admin.js', 'script.js', 'media.js', 'checkout.html'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.toLowerCase().includes('supabase')) {
                console.log(`${file}:${idx + 1}: ${line.trim()}`);
            }
        });
    }
});
