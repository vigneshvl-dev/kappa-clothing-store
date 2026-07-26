const SUPABASE_URL = 'https://ugphxapfbzcrauchwlef.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGh4YXBmYnpjcmF1Y2h3bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDE2NjQsImV4cCI6MjA5OTE3NzY2NH0.C9NiffVu_8sqPrXgOwCcXG1ok6atJLTg1Qt8N1_Kd38';

async function updateConfig() {
    try {
        console.log("1. Fetching current homepage_settings.json...");
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/product-images/homepage_settings.json?t=` + Date.now());
        let config = {};
        if (res.ok) {
            config = await res.json();
            console.log("Fetched existing config:", JSON.stringify(config, null, 2));
        } else {
            console.log("Could not fetch existing config, status:", res.status);
        }

        // Set editorial.men to "assets/duplicate.png"
        if (!config.editorial) config.editorial = {};
        config.editorial.men = {
            images: ["assets/duplicate.png"],
            video: ""
        };

        console.log("Updating editorial.men in config:", JSON.stringify(config, null, 2));

        console.log("2. Uploading updated homepage_settings.json using PUT...");
        const putRes = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/homepage_settings.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json',
                'cache-control': '0'
            },
            body: JSON.stringify(config, null, 2)
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            console.log("PUT status:", putRes.status, errText);

            console.log("Trying POST...");
            const postRes = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/homepage_settings.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'cache-control': '0'
                },
                body: JSON.stringify(config, null, 2)
            });
            console.log("POST status:", postRes.status, await postRes.text());
        } else {
            console.log("✅ PUT succeeded!");
        }

    } catch (e) {
        console.error("Failed:", e);
    }
}

updateConfig();
