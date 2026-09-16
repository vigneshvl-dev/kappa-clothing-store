const fs = require('fs');
const js = fs.readFileSync('script.js', 'utf8');
const urlMatch = js.match(/createClient\(\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/);
if (!urlMatch) {
  console.log('No supabase client found');
  process.exit(1);
}
const url = urlMatch[1];
const key = urlMatch[2];
const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };

async function migrateImages() {
  const resp = await fetch(url + '/rest/v1/product_images?url=like.data:image%25&select=id,url', { headers });
  const images = await resp.json();
  if (images.error || !Array.isArray(images)) {
    console.error('Error fetching images:', images);
    return;
  }
  console.log('Found ' + images.length + ' base64 images to migrate.');
  
  for (const img of images) {
    if (!img.url.startsWith('data:image')) continue;
    
    // Parse base64
    const match = img.url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) continue;
    
    const mimeType = match[1];
    const ext = mimeType.split('/')[1] || 'png';
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = 'migrated_' + img.id + '.' + ext;
    
    console.log('Uploading ' + filename + '...');
    const uploadResp = await fetch(url + '/storage/v1/object/product-images/' + filename, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': mimeType
      },
      body: buffer
    });
    
    if (uploadResp.ok) {
      const publicUrl = url + '/storage/v1/object/public/product-images/' + filename;
      console.log('Uploaded! New URL: ' + publicUrl);
      
      const updateResp = await fetch(url + '/rest/v1/product_images?id=eq.' + img.id, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ url: publicUrl })
      });
      if (updateResp.ok) {
        console.log('Database updated for ' + img.id);
      } else {
        console.error('Failed to update DB for ' + img.id, await updateResp.text());
      }
    } else {
      console.error('Failed to upload ' + filename, await uploadResp.text());
    }
  }
}

migrateImages().catch(console.error);
