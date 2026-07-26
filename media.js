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
        addHeroSlideRowElement(slide.desktop || '', slide.mobile || '', slide.video || '', index);
    });

    // 2. Render Reels
    reelsContainer.innerHTML = '';
    if (currentHomepageConfig.reels && currentHomepageConfig.reels.length > 0) {
        currentHomepageConfig.reels.forEach((reel, index) => {
            addReelCardElement(reel.video, reel.poster, index);
        });
    } else {
        addReelCardElement('', '', 0);
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

    // 4. Render Editorial Category Media
    const menImagesContainer = document.getElementById('editorial-men-images-container');
    const womenImagesContainer = document.getElementById('editorial-women-images-container');

    if (menImagesContainer && womenImagesContainer) {
        menImagesContainer.innerHTML = '';
        womenImagesContainer.innerHTML = '';

        const menConfig = currentHomepageConfig.editorial?.men || { images: [], video: '' };
        const womenConfig = currentHomepageConfig.editorial?.women || { images: [], video: '' };

        // Support legacy format where editorial.men/women were simple URLs
        let menImages = [];
        let menVideo = '';
        if (typeof menConfig === 'string') {
            menImages = [menConfig];
        } else {
            menImages = menConfig.images || [];
            menVideo = menConfig.video || '';
        }

        let womenImages = [];
        let womenVideo = '';
        if (typeof womenConfig === 'string') {
            womenImages = [womenConfig];
        } else {
            womenImages = womenConfig.images || [];
            womenVideo = womenConfig.video || '';
        }

        // Render image list for Men
        if (menImages.length > 0) {
            menImages.forEach(imgUrl => addEditorialImageRowElement('men', imgUrl));
        } else {
            addEditorialImageRowElement('men', '');
        }

        // Render Men video
        document.getElementById('editorial-men-video-url').value = menVideo;
        const menVideoPreview = document.getElementById('editorial-men-video-preview');
        if (menVideo) {
            menVideoPreview.src = menVideo;
            menVideoPreview.style.display = 'block';
        } else {
            menVideoPreview.style.display = 'none';
        }

        // Render image list for Women
        if (womenImages.length > 0) {
            womenImages.forEach(imgUrl => addEditorialImageRowElement('women', imgUrl));
        } else {
            addEditorialImageRowElement('women', '');
        }

        // Render Women video
        document.getElementById('editorial-women-video-url').value = womenVideo;
        const womenVideoPreview = document.getElementById('editorial-women-video-preview');
        if (womenVideo) {
            womenVideoPreview.src = womenVideo;
            womenVideoPreview.style.display = 'block';
        } else {
            womenVideoPreview.style.display = 'none';
        }
    }
}

function addHeroSlideRowElement(desktopUrl = '', mobileUrl = '', videoUrl = '', index) {
    const slideContainer = document.getElementById('hero-slides-editor-container');
    const div = document.createElement('div');
    div.className = 'hero-slide-row';
    div.style = 'border:1px solid #eee; border-radius:8px; padding:15px; background:#fafafa; display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:16px; align-items:center;';
    
    const getPreviewSrc = (url) => url ? url : 'assets/duplicate.png';

    div.innerHTML = `
        <div style="display:grid; grid-template-columns:60px 1fr; gap:10px; align-items:center;">
            <div style="height:50px; border:1px solid #eee; border-radius:4px; overflow:hidden; background:#f0f0f0; display:flex; justify-content:center; align-items:center;">
                <img class="desktop-preview-img" src="${getPreviewSrc(desktopUrl)}" style="max-height:100%; max-width:100%; object-fit:contain;">
            </div>
            <div>
                <label style="font-size:10px; font-weight:700;">Desktop Image</label>
                <input type="text" class="admin-input slide-desktop-url" value="${desktopUrl}" style="display:none;">
                <input type="file" class="admin-input slide-desktop-file" accept="image/*" style="padding:2px; font-size:10px;" onchange="previewSlideFile(this, 'desktop')">
            </div>
        </div>
        <div style="display:grid; grid-template-columns:60px 1fr; gap:10px; align-items:center;">
            <div style="height:50px; border:1px solid #eee; border-radius:4px; overflow:hidden; background:#f0f0f0; display:flex; justify-content:center; align-items:center;">
                <img class="mobile-preview-img" src="${getPreviewSrc(mobileUrl)}" style="max-height:100%; max-width:100%; object-fit:contain;">
            </div>
            <div>
                <label style="font-size:10px; font-weight:700;">Mobile Image</label>
                <input type="text" class="admin-input slide-mobile-url" value="${mobileUrl}" style="display:none;">
                <input type="file" class="admin-input slide-mobile-file" accept="image/*" style="padding:2px; font-size:10px;" onchange="previewSlideFile(this, 'mobile')">
            </div>
        </div>
        <div style="display:grid; grid-template-columns:60px 1fr; gap:10px; align-items:center;">
            <div style="height:50px; border:1px solid #eee; border-radius:4px; overflow:hidden; background:#f0f0f0; display:flex; justify-content:center; align-items:center;">
                <video class="slide-video-preview" style="max-height:100%; max-width:100%; display:${videoUrl ? 'block' : 'none'};" muted controls src="${videoUrl}"></video>
                <span class="slide-video-placeholder" style="color:#bbb; font-size:9px; display:${videoUrl ? 'none' : 'block'};">No video</span>
            </div>
            <div>
                <label style="font-size:10px; font-weight:700;">Optional Video (.mp4)</label>
                <input type="text" class="admin-input slide-video-url" value="${videoUrl}" style="display:none;">
                <input type="file" class="admin-input slide-video-file" accept="video/mp4" style="padding:2px; font-size:10px;" onchange="previewSlideVideoFile(this)">
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

function previewSlideVideoFile(input) {
    const file = input.files[0];
    if (file) {
        const row = input.closest('.hero-slide-row');
        const video = row.querySelector('.slide-video-preview');
        const placeholder = row.querySelector('.slide-video-placeholder');
        if (video) {
            video.src = URL.createObjectURL(file);
            video.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        }
    }
}
window.previewSlideVideoFile = previewSlideVideoFile;

function addHeroSlideRow() {
    addHeroSlideRowElement('', '', '', document.querySelectorAll('.hero-slide-row').length);
}

function addReelCardElement(videoUrl = '', posterUrl = '', index) {
    const reelsContainer = document.getElementById('reels-editor-container');
    const div = document.createElement('div');
    div.className = 'card reel-card';
    div.style = 'padding:15px; border:1px solid #eee; border-radius:8px; background:#fcfcfc; display:flex; flex-direction:column; justify-content:space-between; position:relative;';
    
    div.innerHTML = `
        <button type="button" class="btn-delete" style="position:absolute; top:10px; right:10px; background:#ff4d4d; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;" onclick="this.closest('.reel-card').remove()">Delete</button>
        <h3 style="margin-top:0; font-size:14px; font-weight:700; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:12px; padding-right:50px;">Reel Card</h3>
        
        <div style="margin-bottom:10px;">
            <label style="font-size:11px; color:#555; font-weight:700;">Video URL / Path</label>
            <input type="text" class="admin-input reel-video-url" value="${videoUrl}" style="padding:6px; margin-bottom:4px;">
            <input type="file" class="admin-input reel-video-file" accept="video/mp4" style="padding:4px; font-size:11px;" onchange="previewReelFile(this, 'video')">
            <video class="reel-video-preview" style="max-height:80px; max-width:100%; display:none; margin-top:6px;" muted controls></video>
        </div>

        <div>
            <label style="font-size:11px; color:#555; font-weight:700;">Poster Image URL / Path</label>
            <input type="text" class="admin-input reel-poster-url" value="${posterUrl}" style="padding:6px; margin-bottom:4px;">
            <input type="file" class="admin-input reel-poster-file" accept="image/*" style="padding:4px; font-size:11px;" onchange="previewReelFile(this, 'poster')">
            <img class="reel-poster-preview" style="max-height:80px; max-width:100%; object-fit:contain; display:none; margin-top:6px; border:1px solid #ddd; border-radius:4px;">
        </div>
    `;

    reelsContainer.appendChild(div);

    // Initialize visual previews if URLs are valid
    if (videoUrl && (videoUrl.startsWith('http') || videoUrl.endsWith('.mp4'))) {
        const vPreview = div.querySelector('.reel-video-preview');
        vPreview.src = videoUrl;
        vPreview.style.display = 'block';
    }
    if (posterUrl && (posterUrl.startsWith('http') || posterUrl.endsWith('.jpg') || posterUrl.endsWith('.png') || posterUrl.endsWith('.webp'))) {
        const pPreview = div.querySelector('.reel-poster-preview');
        pPreview.src = posterUrl;
        pPreview.style.display = 'block';
    }
}

function addReelCard() {
    addReelCardElement('', '', document.querySelectorAll('.reel-card').length);
}

function previewReelFile(input, type) {
    const file = input.files[0];
    if (file) {
        const card = input.closest('.reel-card');
        if (type === 'video') {
            const preview = card.querySelector('.reel-video-preview');
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        } else if (type === 'poster') {
            const preview = card.querySelector('.reel-poster-preview');
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        }
    }
}

window.addReelCard = addReelCard;
window.previewReelFile = previewReelFile;

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

function addEditorialImageRowElement(gender, imageUrl = '') {
    const container = document.getElementById(`editorial-${gender}-images-container`);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'editorial-image-row';
    div.style = 'display:grid; grid-template-columns:50px 1fr auto; gap:10px; align-items:center; border:1px dashed #ccc; padding:8px; border-radius:6px; background:#fff;';

    const getPreviewSrc = (url) => url ? url : 'assets/duplicate.png';

    div.innerHTML = `
        <div style="height:40px; overflow:hidden; background:#eee; border-radius:4px; display:flex; justify-content:center; align-items:center;">
            <img class="editorial-preview-img" src="${getPreviewSrc(imageUrl)}" style="max-height:100%; max-width:100%; object-fit:contain;">
        </div>
        <div>
            <input type="text" class="admin-input editorial-image-url" value="${imageUrl}" style="display:none;">
            <input type="file" class="admin-input editorial-image-file" accept="image/*" style="font-size:11px; padding:2px;" onchange="previewEditorialImage(this)">
        </div>
        <button type="button" class="btn-delete" style="background:#ff4d4d; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;" onclick="this.closest('.editorial-image-row').remove()">Delete</button>
    `;

    container.appendChild(div);
}

function addEditorialImageRow(gender) {
    addEditorialImageRowElement(gender, '');
}

function previewEditorialImage(input) {
    const file = input.files[0];
    if (file) {
        const row = input.closest('.editorial-image-row');
        const img = row.querySelector('.editorial-preview-img');
        if (img) {
            img.src = URL.createObjectURL(file);
        }
    }
}

function previewEditorialVideo(input, gender) {
    const file = input.files[0];
    const preview = document.getElementById(`editorial-${gender}-video-preview`);
    if (file && preview) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    }
}

window.addEditorialImageRow = addEditorialImageRow;
window.previewEditorialImage = previewEditorialImage;
window.previewEditorialVideo = previewEditorialVideo;

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

            let video = row.querySelector('.slide-video-url').value.trim();
            const videoFile = row.querySelector('.slide-video-file').files[0];
            if (videoFile) {
                video = await uploadHomepageFile(videoFile, 'hero_video');
            }

            if (desktop || mobile || video) {
                heroSlides.push({ desktop, mobile, video });
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

        // 4. Gather Editorial Images and Video for MEN
        const menRows = document.querySelectorAll('#editorial-men-images-container .editorial-image-row');
        const menImages = [];
        for (const row of menRows) {
            let imgUrl = row.querySelector('.editorial-image-url').value.trim();
            const imgFile = row.querySelector('.editorial-image-file').files[0];
            if (imgFile) {
                imgUrl = await uploadHomepageFile(imgFile, 'editorial_men');
            }
            if (imgUrl) menImages.push(imgUrl);
        }

        let editorialMenVideo = document.getElementById('editorial-men-video-url').value.trim();
        const menVideoFile = document.getElementById('editorial-men-video-file').files[0];
        if (menVideoFile) {
            editorialMenVideo = await uploadHomepageFile(menVideoFile, 'editorial_men_video');
        }

        // Gather Editorial Images and Video for WOMEN
        const womenRows = document.querySelectorAll('#editorial-women-images-container .editorial-image-row');
        const womenImages = [];
        for (const row of womenRows) {
            let imgUrl = row.querySelector('.editorial-image-url').value.trim();
            const imgFile = row.querySelector('.editorial-image-file').files[0];
            if (imgFile) {
                imgUrl = await uploadHomepageFile(imgFile, 'editorial_women');
            }
            if (imgUrl) womenImages.push(imgUrl);
        }

        let editorialWomenVideo = document.getElementById('editorial-women-video-url').value.trim();
        const womenVideoFile = document.getElementById('editorial-women-video-file').files[0];
        if (womenVideoFile) {
            editorialWomenVideo = await uploadHomepageFile(womenVideoFile, 'editorial_women_video');
        }

        const newConfig = {
            heroSlides,
            reels,
            storePromoVideo,
            editorial: {
                men: {
                    images: menImages,
                    video: editorialMenVideo
                },
                women: {
                    images: womenImages,
                    video: editorialWomenVideo
                }
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
window.saveHomepageSettings = saveHomepageSettings;
