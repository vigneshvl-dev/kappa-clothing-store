async function checkConfig() {
    try {
        const url = 'https://ugphxapfbzcrauchwlef.supabase.co/storage/v1/object/public/product-images/homepage_settings.json?t=' + Date.now();
        console.log("Fetching config from Supabase:", url);
        const res = await fetch(url);
        if (!res.ok) {
            console.log("Error status:", res.status, res.statusText);
            return;
        }
        const data = await res.json();
        console.log("Current config content:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

checkConfig();
