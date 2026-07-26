"use strict";

// ==========================================
// HOMEPAGE MEDIA MANAGER LOGIC
// ==========================================
let currentHomepageConfig = null;

async function loadHomepageSettings() {
    const slideContainer = document.getElementById('hero-slides-editor-container');
    const reelsContainer = document.getElementById('reels-editor-container');
    
    if (!slideContainer || !reelsContainer) return;

    slideContainer.innerHTML = '<p style="color:#666;">Loading homepage settings...</p>';
    reelsContainer.innerHTML = '';

    try {
        const response = await fetch('https://ugphxapfbzcrauchwlef.supabase.co/storage/v1/object/public/product-images/homepage_settings.json?t=' + Date.now());
        if (!response.ok) throw new Error("File not found or failed to fetch");
        currentHomepageConfig = await response.json();
    } catch (err) {
        console.warn("Could not load homepage settings, using defaults:", err);
        // Default settings matching index.html hardcoded layout
        currentHomepageConfig = {
            heroSlides: [
                { desktop: "assets/Frame 4.webp", mobile: "assets/Frame 4 - Mobile.webp" },
                { desktop: "assets/Frame 1.webp", mobile: "assets/Frame 1 - Mobile.webp" },
                { desktop: "assets/Frame 12.webp", mobile: "assets/Frame 2 - Mobile.webp" },
                { desktop: "assets/Frame 3.webp", mobile: "assets/Frame 3 - Mobile.webp" },
                { desktop: "assets/Frame 6.webp", mobile: "assets/Frame 6 - Mobile.webp" },
                { desktop: "assets/Frame 7.webp", mobile: "assets/Frame 7 - Mobile.webp" },
                { desktop: "assets/Frame 8.webp", mobile: "assets/Frame 8 - Mobile.webp" },
                { desktop: "assets/Frame 9.webp", mobile: "assets/Frame 9 - Mobile.webp" },
                { desktop: "assets/Frame 10.webp", mobile: "assets/Frame 10 - Mobile.webp" },
                { desktop: "assets/Frame 11.webp", mobile: "assets/Frame 11 - Mobile.webp" },
                { desktop: "assets/Frame 13.webp", mobile: "assets/Frame 5 - Mobile.webp" }
            ],
            reels: [
                { video: "assets/reel1.mp4", poster: "assets/reel1_thumb.jpg" },
                { video: "assets/reel2.mp4", poster: "assets/reel2_thumb.jpg" },
                { video: "assets/reel5.mp4", poster: "assets/reel5_thumb.jpg" },
                { video: "assets/reel4.mp4", poster: "assets/reel4_thumb.jpg" },
                { video: "assets/reel3.mp4", poster: "assets/reel3_thumb.jpg" },
                { video: "assets/reel6.mp4", poster: "assets/reel6_thumb.jpg" }
            ],
            storePromoVideo: "assets/kappa.mp4",
            editorial: {
                men: "assets/duplicate.png",
                women: "assets/WOMENFASHION.png"
            }
        };
    }

    renderHomepageForm();
}

function renderHomepageForm() {
    const slideContainer = document.getElementById('hero-slides-editor-container');
    const reelsContainer = document.getElementById('reels-editor-container');

    // 1. Render Hero Slides
    slideContainer.innerHTML = '';
    currentHomepageConfig.heroSlides.forEach((slide, index) => {
        addHeroSlideRowElement(slide.desktop, slide.mobile, index);
    });

    // 2. Render Reels (Always exactly 6 reels)
    reelsContainer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const reel = currentHomepageConfig.reels[i] || { video: '', poster: '' };
        reelsContainer.innerHTML += `
            <div class="card reel-card" style="padding:15px; border:1px solid #eee; border-radius:8px; background:#fcfcfc;">
                <h3 style="margin-top:0; font-size:14px; font-weight:700; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:12px;">Reel Card ${i+1}</h3>
                
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; color:#555;">Video URL / Path</label>
                    <input type="text" class="admin-input reel-video-url" value="${reel.video}" style="padding:6px; margin-bottom:4px;">
                    <input type="file" class="admin-input reel-video-file" accept="video/mp4" style="padding:4px; font-size:11px;">
                </div>

                <div>
                    <label style="font-size:11px; color:#555;">Poster Image URL / Path</label>
                    <input type="text" class="admin-input reel-poster-url" value="${reel.poster}" style="padding:6px; margin-bottom:4px;">
                    <input type="file" class="admin-input reel-poster-file" accept="image/*" style="padding:4px; font-size:11px;">
                </div>
            </div>
        `;
    }

    // 3. Render Promo Video
    document.getElementById('store-promo-video-url').value = currentHomepageConfig.storePromoVideo;
    const storeVideoPreview = document.getElementById('store-promo-video-preview');
    const storeVideoPlaceholder = document.getElementById('store-promo-video-placeholder');
    if (currentHomepageConfig.storePromoVideo) {
        storeVideoPreview.src = currentHomepageConfig.storePromoVideo;
        storeVideoPreview.style.display = 'block';
        storeVideoPlaceholder.style.display = 'none';
    } else {
        storeVideoPreview.style.display = 'none';
        storeVideoPlaceholder.style.display = 'block';
    }

    // 4. Render Editorial Images
    document.getElementById('editorial-men-url').value = currentHomepageConfig.editorial.men;
    document.getElementById('editorial-men-preview').src = currentHomepageConfig.editorial.men;

    document.getElementById('editorial-women-url').value = currentHomepageConfig.editorial.women;
    document.getElementById('editorial-women-preview').src = currentHomepageConfig.editorial.women;
}

function addHeroSlideRowElement(desktopUrl = '', mobileUrl = '', index) {
    const slideContainer = document.getElementById('hero-slides-editor-container');
    const div = document.createElement('div');
    div.className = 'hero-slide-row';
    div.style = 'border:1px solid #eee; border-radius:8px; padding:15px; background:#fafafa; display:grid; grid-template-columns:1fr 1fr auto; gap:16px; align-items:center;';
    
    const getPreviewSrc = (url) => url ? url : 'assets/duplicate.png';

    div.innerHTML = `
        <div style="display:grid; grid-template-columns:80px 1fr; gap:12px; align-items:center;">
            <div style="height:60px; border:1px solid #eee; border-radius:4px; overflow:hidden; background:#f0f0f0; display:flex; justify-content:center; align-items:center;">
                <img class="desktop-preview-img" src="${getPreviewSrc(desktopUrl)}" style="max-height:100%; max-width:100%; object-fit:contain;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:700;">Desktop Image</label>
                <input type="text" class="admin-input slide-desktop-url" value="${desktopUrl}" style="padding:6px; margin-bottom:4px; display:none;">
                <input type="file" class="admin-input slide-desktop-file" accept="image/*" style="padding:4px; font-size:11px;" onchange="previewSlideFile(this, 'desktop')">
            </div>
        </div>
        <div style="display:grid; grid-template-columns:80px 1fr; gap:12px; align-items:center;">
            <div style="height:60px; border:1px solid #eee; border-radius:4px; overflow:hidden; background:#f0f0f0; display:flex; justify-content:center; align-items:center;">
                <img class="mobile-preview-img" src="${getPreviewSrc(mobileUrl)}" style="max-height:100%; max-width:100%; object-fit:contain;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:700;">Mobile Image</label>
                <input type="text" class="admin-input slide-mobile-url" value="${mobileUrl}" style="padding:6px; margin-bottom:4px; display:none;">
                <input type="file" class="admin-input slide-mobile-file" accept="image/*" style="padding:4px; font-size:11px;" onchange="previewSlideFile(this, 'mobile')">
            </div>
        </div>
        <button type="button" class="btn-delete" style="background:#ff4d4d; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" onclick="this.closest('.hero-slide-row').remove()">Delete</button>
    `;
    
    slideContainer.appendChild(div);
}

function previewSlideFile(input, type) {
    const file = input.files[0];
    if (file) {
        const row = input.closest('.hero-slide-row');
        const img = row.querySelector(`.${type}-preview-img`);
        if (img) {
            img.src = URL.createObjectURL(file);
        }
    }
}
window.previewSlideFile = previewSlideFile;

function addHeroSlideRow() {
    addHeroSlideRowElement('', '', document.querySelectorAll('.hero-slide-row').length);
}

function previewStorePromoVideo(input) {
    const file = input.files[0];
    const preview = document.getElementById('store-promo-video-preview');
    const placeholder = document.getElementById('store-promo-video-placeholder');
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    }
}

function previewEditorial(input, type) {
    const file = input.files[0];
    const preview = document.getElementById(`editorial-${type}-preview`);
    if (file) {
        preview.src = URL.createObjectURL(file);
    }
}

async function uploadHomepageFile(file, pathPrefix) {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const filePath = `homepage/${pathPrefix}_${Date.now()}_${cleanFileName}`;
    const { error } = await supabaseClient.storage.from('product-images').upload(filePath, file);
    if (error) throw error;
    const { data } = supabaseClient.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
}

async function saveHomepageSettings() {
    const submitBtn = document.querySelector('#homepage-media-form button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving & Uploading Assets... Please wait...';
    submitBtn.disabled = true;

    try {
        // 1. Gather Hero Slides
        const slideRows = document.querySelectorAll('.hero-slide-row');
        const heroSlides = [];
        for (const row of slideRows) {
            let desktop = row.querySelector('.slide-desktop-url').value.trim();
            const desktopFile = row.querySelector('.slide-desktop-file').files[0];
            if (desktopFile) {
                desktop = await uploadHomepageFile(desktopFile, 'hero_desktop');
            }

            let mobile = row.querySelector('.slide-mobile-url').value.trim();
            const mobileFile = row.querySelector('.slide-mobile-file').files[0];
            if (mobileFile) {
                mobile = await uploadHomepageFile(mobileFile, 'hero_mobile');
            }

            if (desktop || mobile) {
                heroSlides.push({ desktop, mobile });
            }
        }

        // 2. Gather Reels
        const reelCards = document.querySelectorAll('.reel-card');
        const reels = [];
        for (const card of reelCards) {
            let video = card.querySelector('.reel-video-url').value.trim();
            const videoFile = card.querySelector('.reel-video-file').files[0];
            if (videoFile) {
                video = await uploadHomepageFile(videoFile, 'reel_video');
            }

            let poster = card.querySelector('.reel-poster-url').value.trim();
            const posterFile = card.querySelector('.reel-poster-file').files[0];
            if (posterFile) {
                poster = await uploadHomepageFile(posterFile, 'reel_poster');
            }

            reels.push({ video, poster });
        }

        // 3. Gather Promo Video
        let storePromoVideo = document.getElementById('store-promo-video-url').value.trim();
        const promoFile = document.getElementById('store-promo-video-file').files[0];
        if (promoFile) {
            storePromoVideo = await uploadHomepageFile(promoFile, 'store_promo');
        }

        // 4. Gather Editorial Images
        let editorialMen = document.getElementById('editorial-men-url').value.trim();
        const menFile = document.getElementById('editorial-men-file').files[0];
        if (menFile) {
            editorialMen = await uploadHomepageFile(menFile, 'editorial_men');
        }

        let editorialWomen = document.getElementById('editorial-women-url').value.trim();
        const womenFile = document.getElementById('editorial-women-file').files[0];
        if (womenFile) {
            editorialWomen = await uploadHomepageFile(womenFile, 'editorial_women');
        }

        const newConfig = {
            heroSlides,
            reels,
            storePromoVideo,
            editorial: {
                men: editorialMen,
                women: editorialWomen
            }
        };

        // Write configuration file back to Supabase storage
        const configBlob = new Blob([JSON.stringify(newConfig, null, 2)], { type: 'application/json' });
        const { error } = await supabaseClient.storage.from('product-images').upload('homepage_settings.json', configBlob, {
            upsert: true,
            cacheControl: '0'
        });

        if (error) throw error;
        alert('✅ Homepage Layout Settings saved successfully!');
        await loadHomepageSettings();

    } catch (err) {
        console.error("Failed to save homepage settings:", err);
        alert("❌ Error saving settings: " + err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Bind handlers globally so HTML template can call them
window.loadHomepageSettings = loadHomepageSettings;
window.addHeroSlideRow = addHeroSlideRow;
window.previewStorePromoVideo = previewStorePromoVideo;
window.previewEditorial = previewEditorial;
window.saveHomepageSettings = saveHomepageSettings;
