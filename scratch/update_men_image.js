const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    'https://ugphxapfbzcrauchwlef.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGh4YXBmYnpjcmF1Y2h3bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDE2NjQsImV4cCI6MjA5OTE3NzY2NH0.C9NiffVu_8sqPrXgOwCcXG1ok6atJLTg1Qt8N1_Kd38'
);

async function run() {
    try {
        console.log("1. Reading local assets/duplicate.png...");
        const fileBuffer = fs.readFileSync('assets/duplicate.png');
        const filePath = `homepage/editorial_men_${Date.now()}_duplicate.png`;

        console.log("2. Uploading assets/duplicate.png to Supabase Storage bucket 'product-images'...");
        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, fileBuffer, {
            contentType: 'image/png',
            upsert: true
        });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return;
        }

        const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        const newMenImageUrl = publicUrlData.publicUrl;
        console.log("✅ Uploaded successfully! Public URL:", newMenImageUrl);

        console.log("3. Fetching existing homepage_settings.json...");
        const res = await fetch('https://ugphxapfbzcrauchwlef.supabase.co/storage/v1/object/public/product-images/homepage_settings.json?t=' + Date.now());
        let config = {};
        if (res.ok) {
            config = await res.json();
        }

        console.log("Current config before update:", JSON.stringify(config, null, 2));

        // Update editorial.men to point to duplicate.png
        if (!config.editorial) config.editorial = {};
        config.editorial.men = {
            images: [newMenImageUrl],
            video: ""
        };

        console.log("New config to save:", JSON.stringify(config, null, 2));

        console.log("4. Saving updated homepage_settings.json back to Supabase Storage...");
        const configBlob = Buffer.from(JSON.stringify(config, null, 2));
        const { error: saveError } = await supabase.storage.from('product-images').upload('homepage_settings.json', configBlob, {
            upsert: true,
            contentType: 'application/json',
            cacheControl: '0'
        });

        if (saveError) {
            console.error("Save config error:", saveError);
            return;
        }

        console.log("🎉 SUCCESS! Men editorial image updated to duplicate.png in Supabase settings!");

    } catch (e) {
        console.error("Script failed:", e);
    }
}

run();
