const fs = require('fs');

const SUPABASE_URL = 'https://ugphxapfbzcrauchwlef.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGh4YXBmYnpjcmF1Y2h3bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDE2NjQsImV4cCI6MjA5OTE3NzY2NH0.C9NiffVu_8sqPrXgOwCcXG1ok6atJLTg1Qt8N1_Kd38';

async function run() {
    try {
        console.log("1. Reading assets/duplicate.png...");
        const fileBuffer = fs.readFileSync('assets/duplicate.png');
        const fileName = `homepage/editorial_men_${Date.now()}_duplicate.png`;

        console.log("2. Uploading assets/duplicate.png via Supabase Storage REST API...");
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${fileName}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Content-Type': 'image/png',
                'x-upsert': 'true'
            },
            body: fileBuffer
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error("Upload failed:", uploadRes.status, errText);
            return;
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
        console.log("✅ Uploaded image successfully! Public URL:", publicUrl);

        console.log("3. Fetching active homepage_settings.json...");
        const configRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/product-images/homepage_settings.json?t=` + Date.now());
        let config = {};
        if (configRes.ok) {
            config = await configRes.json();
        }

        console.log("Current config before update:", JSON.stringify(config, null, 2));

        if (!config.editorial) config.editorial = {};
        config.editorial.men = {
            images: [publicUrl],
            video: ""
        };

        console.log("New config to save:", JSON.stringify(config, null, 2));

        console.log("4. Saving updated homepage_settings.json to Supabase...");
        const saveRes = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/homepage_settings.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json',
                'cache-control': '0',
                'x-upsert': 'true'
            },
            body: JSON.stringify(config, null, 2)
        });

        if (!saveRes.ok) {
            const errText = await saveRes.text();
            console.error("Save config failed:", saveRes.status, errText);
            return;
        }

        console.log("🎉 SUCCESS! Men editorial image updated to duplicate.png in Supabase!");

    } catch (e) {
        console.error("Script error:", e);
    }
}

run();
