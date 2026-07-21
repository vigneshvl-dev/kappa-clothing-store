// --- LANGUAGE DEFINITIONS ---
const LANGS = {
    "en": {
        "nav_home": "Home",
        "nav_shop": "Shop",
        "nav_faq": "FaQ",
        "nav_about": "About",
        "nav_contact": "Contact",
    }
};

const supabaseClient = window.supabase.createClient(
    'https://ugphxapfbzcrauchwlef.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGh4YXBmYnpjcmF1Y2h3bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDE2NjQsImV4cCI6MjA5OTE3NzY2NH0.C9NiffVu_8sqPrXgOwCcXG1ok6atJLTg1Qt8N1_Kd38'
);

async function testDatabaseConnection() {
    console.log("Testing connection to Supabase...");

    // Grabbing just the products to see if it works
    const { data, error } = await supabaseClient.from('products').select('*');

    if (error) {
        console.error("Connection failed:", error);
    } else {
        console.log("Connection successful! Here are your products from the database:", data);
    }
}

testDatabaseConnection();

/* ============================================================
   KAPPA — vanilla JS
   ============================================================ */
(() => {
    "use strict";

    

    const INSTA = [
        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1512327646107-d5b74d5b1c5b?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop",
    ];

    const LANG_NAMES = { en: "English", ta: "Tamil", ml: "Malayalam", hi: "Hindi" };
    let currentLang = localStorage.getItem("kappa-lang") || "en";

    function applyLanguage(lang) {
        currentLang = lang;
        localStorage.setItem("kappa-lang", lang);
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (LANGS[lang] && LANGS[lang][key]) {
                el.innerHTML = LANGS[lang][key];
            }
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (LANGS[lang] && LANGS[lang][key]) {
                el.placeholder = LANGS[lang][key];
            }
        });
        document.querySelectorAll(".hn-lang span, .lang-select span").forEach(span => {
            span.textContent = LANG_NAMES[lang] + " ▼";
        });
    }

    document.querySelectorAll(".hn-lang .lang-dropdown button, .lang-select .lang-dropdown button").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const lang = btn.getAttribute("data-lang");
            applyLanguage(lang);
            document.querySelectorAll(".hn-lang, .lang-select").forEach(d => d.classList.remove("open"));
        });
    });

    document.querySelectorAll(".hn-lang, .lang-select").forEach(d => {
        d.addEventListener("click", e => {
            e.stopPropagation();
            d.classList.toggle("open");
        });
    });

    document.addEventListener("click", () => {
        document.querySelectorAll(".hn-lang, .lang-select").forEach(d => d.classList.remove("open"));
    });

    applyLanguage(currentLang);

    /* ---------- STATE ---------- */
    let cart = JSON.parse(localStorage.getItem("kappa_cart") || "[]");     // {id, size, qty}
    let wishlist = []; // [id]
    let discount = 0;
    let PRODUCTS = []; // Will be populated by storefront loader
    let currentUserSession = null;

    /* ---------- UTILITIES ---------- */
    // Fixes the "fmt is not defined" error
    function fmt(price) {
        return "₹" + Number(price).toLocaleString('en-IN');
    }

    // Fixes the "stars is not defined" error (which is likely missing too!)
    function stars(rating) {
        const r = Math.round(rating || 0);
        return "★".repeat(r) + "☆".repeat(5 - r);
    }

    /* ---------- LOADER ---------- */
    function initMarquee() {
        const marquee = document.querySelector(".marquee");
        if (marquee) {
            marquee.classList.add("start-marquee");
        }
    }

    function hideLoader() {
        const loader = document.getElementById("loader");
        if (loader && !loader.classList.contains("hide")) {
            loader.classList.add("hide");
            document.body.style.overflow = "";
            revealCheck();
            startHeroSlideshow(); // Start slideshow transitions after loader is hidden
            initMarquee(); // Start marquee animations after loader is hidden
        }
    }
    // Only run loader logic if the loader element exists on the page
    if (document.getElementById("loader")) {
        document.body.style.overflow = "hidden";
        document.addEventListener("DOMContentLoaded", () => {
            const fill = document.getElementById("loaderFill");
            let p = 0;
            const iv = setInterval(() => {
                p += 1;
                if (p >= 100) { p = 100; clearInterval(iv); }
                if (fill) fill.style.width = p + "%";
            }, 30); // 100 steps of 30ms = 3000ms (3 seconds)
            setTimeout(hideLoader, 3000);
        });
        // Safety fallback: ensure loader closes after 3 seconds
        setTimeout(hideLoader, 3000);
    } else {
        // If no loader, start marquee immediately
        initMarquee();
    }

    /* ---------- HERO SLIDESHOW ---------- */
    const heroSlides = document.querySelectorAll(".hero-slide");
    let currentSlide = 0;
    let heroSlideshowInterval = null;
    function nextSlide() {
        if (heroSlides.length === 0) return;
        heroSlides.forEach(slide => slide.classList.remove("previous"));
        heroSlides[currentSlide].classList.add("previous");
        heroSlides[currentSlide].classList.remove("active");
        currentSlide = (currentSlide + 1) % heroSlides.length;
        heroSlides[currentSlide].classList.add("active");
    }
    function startHeroSlideshow() {
        if (heroSlides.length > 1 && !heroSlideshowInterval) {
            heroSlideshowInterval = setInterval(nextSlide, 3000);
        }
    }

    /* ---------- HERO MOBILE BACKGROUND SWAP ---------- */
    const MOBILE_BP = 768;
    function applyHeroMobileBg() {
        heroSlides.forEach(slide => {
            const mobileBg = slide.getAttribute("data-mobile-bg");
            if (!mobileBg) return;
            if (!slide.dataset.desktopBg) {
                const styleAttr = slide.getAttribute("style") || "";
                const match = styleAttr.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/);
                slide.dataset.desktopBg = match ? match[1] : "";
            }
            if (window.innerWidth <= MOBILE_BP) {
                slide.style.backgroundImage = `url('${mobileBg}')`;
            } else {
                if (slide.dataset.desktopBg) {
                    slide.style.backgroundImage = `url('${slide.dataset.desktopBg}')`;
                }
            }
        });
    }
    window.addEventListener("resize", applyHeroMobileBg);
    applyHeroMobileBg();
    /* ---------- HAMBURGER / MOBILE MENU ---------- */
    const glow = document.getElementById("cursorGlow");
    const dot = document.getElementById("cursorDot");
    let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my;
    if (dot) {
        window.addEventListener("mousemove", e => {
            mx = e.clientX; my = e.clientY;
            dot.style.left = mx + "px"; dot.style.top = my + "px";
        });
    }
    (function loop() {
        gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
        glow.style.left = gx + "px"; glow.style.top = gy + "px";
        requestAnimationFrame(loop);
    })();
    if (dot) {
        document.querySelectorAll("a, button, .cat-item, .look-item, .product-card").forEach(el => {
            el.addEventListener("mouseenter", () => dot.classList.add("grow"));
            el.addEventListener("mouseleave", () => dot.classList.remove("grow"));
        });
    }

    /* ---------- SCROLL PROGRESS + NAVBAR / MARQUEE REVEAL ---------- */
    const progress = document.getElementById("scrollProgress");
    const navbar = document.getElementById("navbar");
    let lastY = 0;

    function handleScroll() {
        const h = document.documentElement;
        const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
        if (progress) progress.style.width = scrolled + "%";
        const y = window.scrollY;
        const isScrolled = y > 40;
        document.body.classList.toggle("scrolled", isScrolled);
        if (navbar) navbar.classList.toggle("scrolled", isScrolled);
        lastY = y;
        revealCheck();
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once initially to style page if scrolled on load
    handleScroll();

    /* ---------- REVEAL ON SCROLL ---------- */
    function revealCheck() {
        document.querySelectorAll(".reveal-up:not(.in), .reveal:not(.in)").forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top < innerHeight * 0.88) el.classList.add("in");
        });
    }
    window.addEventListener("scroll", revealCheck, { passive: true });
    window.addEventListener("resize", revealCheck);

    /* ---------- HAMBURGER / MOBILE MENU ---------- */
    const heroHamburger = document.getElementById("heroHamburger");
    const mobileMenu = document.getElementById("mobileMenu");

    const mobileMenuLinks = {
        "Home": "index.html#home",
        "About": "about.html",
        "Contact": "contact.html",
        "Shop": "shop.html",
        "Hot Sale": "shop.html?filter=sale",
        "Best Selling": "shop.html",
        "All products": "shop.html",
        "Reels": "reels.html",
        "Privacy Policy": "privacy.html",
        "Terms & Conditions": "terms.html",
        "Shipping Policy": "shipping.html",
        "Returns & Refunds": "refund.html"
    };

    if (mobileMenu) {
        mobileMenu.querySelectorAll(".mnav-link").forEach(link => {
            if (link.id === "mobileOrdersLink" || link.id === "mobileWishLink" || link.id === "mobileAccountLink") {
                return;
            }

            const label = link.textContent.replace(/\s+/g, " ").trim();
            const targetHref = mobileMenuLinks[label];

            if (targetHref) {
                link.setAttribute("href", targetHref);
            }
        });
    }

    function toggleMenu() {
        const isOpen = mobileMenu.classList.toggle("open");
        if (heroHamburger) heroHamburger.classList.toggle("open", isOpen);
        document.body.style.overflow = isOpen ? "hidden" : "";
    }

    function closeMenu() {
        mobileMenu.classList.remove("open");
        if (heroHamburger) heroHamburger.classList.remove("open");
        document.body.style.overflow = "";
        void mobileMenu.offsetHeight;
    }

    if (heroHamburger) heroHamburger.addEventListener("click", toggleMenu);

    const mobileMenuClose = document.getElementById("mobileMenuClose");
    if (mobileMenuClose) mobileMenuClose.addEventListener("click", closeMenu);

    mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
        closeMenu();
    }));

    /* ---------- SMOOTH NAV LINKS ---------- */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener("click", e => {
            const id = a.getAttribute("href").slice(1);
            const target = document.getElementById(id);
            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
        });
    });
    document.querySelectorAll("[data-target]").forEach(btn => {
        btn.addEventListener("click", () => {
            const t = document.getElementById(btn.dataset.target);
            if (t) t.scrollIntoView({ behavior: "smooth" });
        });
    });

    /* ---------- MAGNETIC BUTTONS + RIPPLE ---------- */
    document.querySelectorAll(".magnetic:not(.hero .magnetic)").forEach(btn => {
        const isFull = btn.classList.contains("full");
        if (!isFull) {
            btn.addEventListener("mousemove", e => {
                const r = btn.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2;
                const y = e.clientY - r.top - r.height / 2;
                btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
            });
            btn.addEventListener("mouseleave", () => { btn.style.transform = "translate(0,0)"; });
        }
        btn.addEventListener("click", e => {
            if (isFull) return; // Skip ripple on full-width buttons to prevent visual distortion/size bugs
            btn.style.transform = "translate(0,0)";
            const r = btn.getBoundingClientRect();
            const ripple = document.createElement("span");
            ripple.className = "ripple";
            const size = Math.max(r.width, r.height);
            ripple.style.width = ripple.style.height = size + "px";
            ripple.style.left = (e.clientX - r.left - size / 2) + "px";
            ripple.style.top = (e.clientY - r.top - size / 2) + "px";
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 650);
        });
    });

    /* ---------- RENDER: PRODUCT CARDS ---------- */
    function productCard(p, small) {
        const discountPct = p.old ? Math.round((1 - p.price / p.old) * 100) : null;
        return `
  <div class="product-card ${small ? 'trend-card' : ''}" data-id="${p.id}">
    <div class="pc-media">
      ${p.tag ? `<span class="pc-tag ${p.tag === 'SALE' ? 'sale' : ''}">${p.tag}</span>` : ''}
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      ${!small ? `
      <div class="pc-quick">
        <button class="pc-btn add" data-add="${p.id}">Add to Cart</button>
        <button class="pc-btn view" data-view="${p.id}">Quick View</button>
      </div>` : ''}
    </div>
    <div class="pc-body">
      <span class="pc-cat">${p.cat}</span>
      <h3 class="pc-name">${p.name}</h3>
      ${small ? `<span class="trend-price">${fmt(p.price)}</span>` : `
      <div class="pc-price-row">
        <span class="pc-price">${fmt(p.price)}</span>
        ${p.old ? `<span class="pc-old">${fmt(p.old)}</span>` : ''}
        ${discountPct ? `<span class="pc-tag sale" style="position:static;">-${discountPct}%</span>` : ''}
      </div>
      <div class="pc-rating"><span class="stars">${stars(p.rating)}</span> (${p.reviews})</div>
      <div class="pc-sizes">${p.sizes.map(s => `<span class="pc-size">${s}</span>`).join('')}</div>
      `}
    </div>
  </div>`;
    }

    const arrivalsGrid = document.getElementById("arrivalsGrid");
    if (arrivalsGrid) arrivalsGrid.innerHTML = PRODUCTS.map(p => productCard(p, false)).join('');

    const trendTrack = document.getElementById("trendTrack");
    if (trendTrack) {
        const trendItems = [...PRODUCTS, ...PRODUCTS];
        trendTrack.innerHTML = trendItems.map(p => productCard(p, true)).join('');
    }

    /* ---------- RENDER: CATEGORIES ---------- */
    const catGrid = document.getElementById("catGrid");
    if (catGrid) {
        catGrid.innerHTML = CATEGORIES.map(c => `
  <div class="cat-item" data-cat="${c.name}">
    <div class="cat-circle" style="background-image:url('${c.img}')"></div>
    <span class="cat-name">${c.name}</span>
  </div>`).join('');
        document.querySelectorAll(".cat-item").forEach(el => {
            el.addEventListener("click", () => {
                const arrivals = document.getElementById("arrivals");
                if (arrivals) {
                    arrivals.scrollIntoView({ behavior: "smooth" });
                } else {
                    window.location.href = "index.html#arrivals";
                }
            });
        });
    }

    /* ---------- RENDER: LOOKBOOK ---------- */
    const lookbookGrid = document.getElementById("lookbookGrid");
    if (lookbookGrid) {
        lookbookGrid.innerHTML = LOOKBOOK.map(l => `
  <div class="look-item">
    <img src="${l.img}" alt="${l.cap}" loading="lazy">
    <span class="look-caption">${l.cap}</span>
  </div>`).join('');
    }

    /* ---------- RENDER: REVIEWS ---------- */
    const reviewsTrack = document.getElementById("reviewsTrack");
    if (reviewsTrack) {
        const reviewSet = [...REVIEWS, ...REVIEWS];
        reviewsTrack.innerHTML = reviewSet.map(r => `
  <div class="review-card">
    <div class="review-stars">${stars(r.stars)}</div>
    <p class="review-text">"${r.text}"</p>
    <div class="review-person">
      <div class="review-avatar">${r.name[0]}</div>
      <div>
        <div class="review-name">${r.name}</div>
        <div class="review-loc">${r.loc}</div>
      </div>
    </div>
  </div>`).join('');
    }

    const testimonialTrack = document.querySelector(".testimonial-container");
    if (testimonialTrack && !testimonialTrack.dataset.looped) {
        const originals = Array.from(testimonialTrack.children);
        originals.forEach(item => {
            const clone = item.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            testimonialTrack.appendChild(clone);
        });
        testimonialTrack.dataset.looped = "true";
    }

    /* ---------- RENDER: INSTAGRAM ---------- */
    const instaGrid = document.getElementById("instaGrid");
    if (instaGrid) {
        instaGrid.innerHTML = INSTA.map(src => `
  <div class="insta-item">
    <img src="${src}" alt="KAPPA community post" loading="lazy">
    <div class="insta-overlay">♥ View Post</div>
  </div>`).join('');
    }

    /* ---------- PROMO NUMBER COUNT-UP ---------- */
    const promoNum = document.getElementById("promoNum");
    let counted = false;
    function countUp() {
        if (!promoNum || counted) return;
        const r = promoNum.getBoundingClientRect();
        if (r.top > innerHeight * 0.85) return;
        counted = true;
        let n = 0;
        const iv = setInterval(() => {
            n += 2;
            if (n >= 40) { n = 40; clearInterval(iv); }
            promoNum.textContent = n;
        }, 30);
    }
    if (promoNum) window.addEventListener("scroll", countUp, { passive: true });

    /* ---------- COUNTDOWN TIMER ---------- */
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 4);
    endDate.setHours(endDate.getHours() + 6);
    function updateCountdown() {
        const diff = endDate - new Date();
        if (diff <= 0) return;
        const d = Math.floor(diff / 86400000);
        const h = Math.floor(diff % 86400000 / 3600000);
        const m = Math.floor(diff % 3600000 / 60000);
        const s = Math.floor(diff % 60000 / 1000);

        const cdD = document.getElementById("cdD");
        const cdH = document.getElementById("cdH");
        const cdM = document.getElementById("cdM");
        const cdS = document.getElementById("cdS");
        if (cdD) cdD.textContent = String(d).padStart(2, '0');
        if (cdH) cdH.textContent = String(h).padStart(2, '0');
        if (cdM) cdM.textContent = String(m).padStart(2, '0');
        if (cdS) cdS.textContent = String(s).padStart(2, '0');
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);

    /* ---------- TOAST ---------- */
    const toast = document.getElementById("toast");
    let toastTimer;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
    }

    /* ---------- CART ---------- */
    const cartOverlay = document.getElementById("cartOverlay");
    const wishOverlay = document.getElementById("wishOverlay");
    const searchOverlay = document.getElementById("searchOverlay");
    const qvOverlay = document.getElementById("quickViewOverlay");
    const accountOverlay = document.getElementById("accountOverlay");

    function openOverlay(el) { if (el) { el.classList.add("open"); document.body.style.overflow = "hidden"; } }
    function closeOverlay(el) { if (el) { el.classList.remove("open"); document.body.style.overflow = ""; } }

    // Helper to safely add event listeners so the script doesn't crash!
    function safeAddListener(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    safeAddListener("cartBtn", "click", () => openOverlay(cartOverlay));
    safeAddListener("bnavCart", "click", () => openOverlay(cartOverlay));
    safeAddListener("cartClose", "click", () => closeOverlay(cartOverlay));
    safeAddListener("wishBtn", "click", () => openOverlay(wishOverlay));
    safeAddListener("bnavWish", "click", () => openOverlay(wishOverlay));
    safeAddListener("wishClose", "click", () => closeOverlay(wishOverlay));

    safeAddListener("searchBtn", "click", () => { openOverlay(searchOverlay); const s = document.getElementById("searchInput"); if (s) s.focus(); });
    safeAddListener("bnavSearch", "click", () => { openOverlay(searchOverlay); const s = document.getElementById("searchInput"); if (s) s.focus(); });
    safeAddListener("searchClose", "click", () => closeOverlay(searchOverlay));

    const heroAccountBtn = document.getElementById("heroAccountBtn");
    const profileBtn = document.getElementById("profileBtn");
    const mobileAccountLink = document.getElementById("mobileAccountLink");
    const mobileOrdersLink = document.getElementById("mobileOrdersLink");
    const mobileWishLink = document.getElementById("mobileWishLink");
    const accountClose = document.getElementById("accountClose");

    // 👇 Duplicates removed from here! It will use the ones you defined earlier in the file.

    if (heroAccountBtn) heroAccountBtn.addEventListener("click", () => openOverlay(accountOverlay));
    if (profileBtn) {
        profileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentUserSession && currentUserSession.user) {
                const profilePopup = document.getElementById("profilePopup");
                if (profilePopup) {
                    profilePopup.classList.toggle("open");
                }
            } else {
                openOverlay(accountOverlay);
            }
        });
    }

    // Close profile dropdown when clicking outside
    document.addEventListener("click", (e) => {
        const profilePopup = document.getElementById("profilePopup");
        if (profilePopup && profilePopup.classList.contains("open")) {
            if (!profilePopup.contains(e.target) && (!profileBtn || !profileBtn.contains(e.target))) {
                profilePopup.classList.remove("open");
            }
        }
    });

    // Wire up profile popup quick action events
    const profilePopupLink = document.getElementById('profilePopupLink');
    if (profilePopupLink) {
        profilePopupLink.addEventListener('click', (e) => {
            e.preventDefault();
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            openOverlay(accountOverlay);
        });
    }

    const popupMyOrders = document.getElementById('popupMyOrders');
    if (popupMyOrders) {
        popupMyOrders.addEventListener('click', (e) => {
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            // Navigate handled by href="my-orders.html"
        });
    }

    const popupMyThreads = document.getElementById('popupMyThreads');
    if (popupMyThreads) {
        popupMyThreads.addEventListener('click', (e) => {
            e.preventDefault();
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            openOverlay(wishOverlay);
        });
    }

    const popupTrackOrder = document.getElementById('popupTrackOrder');
    if (popupTrackOrder) {
        popupTrackOrder.addEventListener('click', (e) => {
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            // Navigate handled by href="track-order.html"
        });
    }

    const popupSavedAddress = document.getElementById('popupSavedAddress');
    if (popupSavedAddress) {
        popupSavedAddress.addEventListener('click', (e) => {
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            // Navigate handled by href="saved-address.html"
        });
    }

    const popupMyReviews = document.getElementById('popupMyReviews');
    if (popupMyReviews) {
        popupMyReviews.addEventListener('click', (e) => {
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            // Navigate handled by href="my-reviews.html"
        });
    }

    const popupMyNotifications = document.getElementById('popupMyNotifications');
    if (popupMyNotifications) {
        popupMyNotifications.addEventListener('click', (e) => {
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            // Navigate handled by href="my-notifications.html"
        });
    }

    const popupMyCoupons = document.getElementById('popupMyCoupons');
    if (popupMyCoupons) {
        popupMyCoupons.addEventListener('click', (e) => {
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            // Navigate handled by href="my-coupons.html"
        });
    }

    const popupLogout = document.getElementById('popupLogout');
    if (popupLogout) {
        popupLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup) profilePopup.classList.remove('open');
            const { error } = await supabaseClient.auth.signOut();
            if (error) showToast('Logout failed: ' + error.message);
            else showToast('Logged out successfully');
        });
    }
    if (mobileAccountLink) mobileAccountLink.addEventListener("click", e => {
        e.preventDefault();
        if (heroHamburger) heroHamburger.classList.remove("open");
        if (mobileMenu) mobileMenu.classList.remove("open");
        openOverlay(accountOverlay);
    });
    if (mobileOrdersLink) mobileOrdersLink.addEventListener("click", e => {
        e.preventDefault();
        if (heroHamburger) heroHamburger.classList.remove("open");
        if (mobileMenu) mobileMenu.classList.remove("open");
        openOverlay(accountOverlay);
    });
    if (mobileWishLink) mobileWishLink.addEventListener("click", e => {
        e.preventDefault();
        if (heroHamburger) heroHamburger.classList.remove("open");
        if (mobileMenu) mobileMenu.classList.remove("open");
        openOverlay(wishOverlay);
    });
    if (accountClose) accountClose.addEventListener("click", () => closeOverlay(accountOverlay));

    const accountNavToggle = document.getElementById("accountNavToggle");
    if (accountNavToggle) accountNavToggle.addEventListener("click", () => closeOverlay(accountOverlay));

    [cartOverlay, wishOverlay, searchOverlay, qvOverlay, accountOverlay].forEach(o => {
        if (o) {
            o.addEventListener("click", e => { if (e.target === o) closeOverlay(o); });
        }
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") [cartOverlay, wishOverlay, searchOverlay, qvOverlay, accountOverlay].forEach(o => { if (o) closeOverlay(o); });
    });

    const checkoutBtn = cartOverlay ? cartOverlay.querySelector(".btn.btn-primary.full.magnetic") : null;
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (cart.length === 0) {
                showToast("Your cart is empty!");
                return;
            }
            const cartDetails = cart.map(c => {
                const p = PRODUCTS.find(x => x.id === c.id || x.id == c.id);
                return {
                 id: c.id,
                 name: p ? p.name : (c.name || 'Product'),
                 price: p ? p.price : (c.price || 0),
                 size: c.size,
                 color: c.color || 'N/A', // ADD THIS LINE RIGHT HERE
                 qty: c.qty,
                 img: c.customImg || (p ? p.img : 'assets/sleeping sis.png')
        };
            });
            const shipCost = Number(document.getElementById("shipSelect")?.value || 0);
            const discPercent = discount || 0;
            localStorage.setItem("kappa_checkout_cart", JSON.stringify(cartDetails));
            localStorage.setItem("kappa_checkout_shipping", shipCost);
            localStorage.setItem("kappa_checkout_discount", discPercent);
            window.location.href = "checkout.html";
        });
    }

    /* ---------- ACCOUNT FORM PANELS & INTERACTIVITY ---------- */
    if (accountOverlay) {
        const panelLogin = document.getElementById('panel-login');
        const panelSignup = document.getElementById('panel-signup');

        const showPanel = target => {
            const current = accountOverlay.querySelector('.panel.active');
            if (current === target) return;
            if (current) current.classList.remove('active');
            if (target) target.classList.add('active');
        };

        const goSignup = document.getElementById('go-signup');
        const goLogin = document.getElementById('go-login');
        if (goSignup) goSignup.addEventListener('click', e => { e.preventDefault(); showPanel(panelSignup); });
        if (goLogin) goLogin.addEventListener('click', e => { e.preventDefault(); showPanel(panelLogin); });

        accountOverlay.querySelectorAll('.toggle-eye').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.getAttribute('data-target'));
                if (!input) return;
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';

                btn.innerHTML = isPassword
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.6 19.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a19.7 19.7 0 0 1-2.29 3.36M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
            });
        });
    }


   function addToCart(id, size = 'Default', color = 'N/A', price, img, passedName) {
    let actualSize = size;
    let actualColor = color;
    let actualPrice = price;
    let actualImg = img;
    let actualName = passedName;

    // Detect if called from the homepage grid (where arguments are shifted to: id, name, price, img)
    if (typeof color === 'number' || (typeof color === 'string' && !isNaN(Number(color)) && price === undefined)) {
        actualName = size;               // 'size' slot actually holds the Name
        actualPrice = Number(color);     // 'color' slot actually holds the Price
        actualImg = price;               // 'price' slot actually holds the Image URL
        actualSize = 'Default';
        actualColor = 'N/A';
    }

    // Find product or create fallback
    let p = PRODUCTS.find(x => x.id === id || x.id == id);
    if (!p) {
        p = {
            id: id,
            name: actualName || 'Product',
            price: actualPrice || 0,
            img: actualImg || 'assets/sleeping sis.png',
            sizes: ['Default'],
            colors: ['N/A']
        };
        PRODUCTS.push(p);
    }

    const finalSize = actualSize || 'Default';
    const finalColor = actualColor || 'N/A';
    const finalName = actualName || p.name || 'Product'; 

    const existing = cart.find(c => c.id === id && c.size === finalSize && c.color === finalColor);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ 
            id, 
            size: finalSize, 
            color: finalColor, 
            qty: 1, 
            name: finalName, 
            price: actualPrice || p.price, 
            customImg: actualImg || p.img 
        });
    }
    renderCart();
    showToast(`${finalName} added to cart`);
}
window.addToCart = addToCart;

    function renderCart() {
        localStorage.setItem("kappa_cart", JSON.stringify(cart));
        const wrap = document.getElementById("cartItems");
        const cartTotal = cart.reduce((a, c) => a + c.qty, 0);
        const cartCountEl = document.getElementById("cartCount");
        if (cartCountEl) cartCountEl.textContent = cartTotal;
        const heroCartCount = document.getElementById("heroCartCount");
        if (heroCartCount) heroCartCount.textContent = cartTotal;
        const cartBtnBadge = document.querySelector("#cartBtn .badge");
        if (cartBtnBadge) cartBtnBadge.textContent = cartTotal;
        if (!cart.length) {
            wrap.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Start adding icons.</div>`;
        } else {
            wrap.innerHTML = cart.map((c, idx) => {
                const p = PRODUCTS.find(x => x.id === c.id || x.id == c.id);
                const name = (p ? p.name : null) || c.name || 'Product';
                const img = c.customImg || (p ? p.img : null) || 'assets/sleeping sis.png';
                const price = (p ? p.price : null) ?? c.price ?? 0;
                return `
      <div class="cart-item">
        <img src="${img}" alt="${name}">
        <div class="ci-info">
          <div class="ci-name">${name}</div>
          <div class="ci-meta">Size: ${c.size} | Color: ${c.color}</div>
          <div class="ci-qty">
            <button data-dec="${idx}">−</button>
            <span>${c.qty}</span>
            <button data-inc="${idx}">+</button>
          </div>
          <span class="ci-remove" data-remove="${idx}">Remove</span>
        </div>
        <div class="ci-price">${fmt(price * c.qty)}</div>
      </div>`;
            }).join('');
        }
        updateSummary();
    }

    document.getElementById("cartItems").addEventListener("click", e => {
        const inc = e.target.dataset.inc, dec = e.target.dataset.dec, rem = e.target.dataset.remove;
        if (inc !== undefined) { cart[inc].qty++; renderCart(); }
        if (dec !== undefined) { cart[dec].qty--; if (cart[dec].qty <= 0) cart.splice(dec, 1); renderCart(); }
        if (rem !== undefined) { cart.splice(rem, 1); renderCart(); }
    });

    function updateSummary() {
        const subtotal = cart.reduce((a, c) => {
            const p = PRODUCTS.find(x => x.id === c.id);
            const price = (p ? p.price : null) ?? c.price ?? 0;
            return a + price * c.qty;
        }, 0);
        const shipCost = Number(document.getElementById("shipSelect")?.value || 0);
        const discAmt = Math.round(subtotal * discount);
        const total = Math.max(subtotal - discAmt + (subtotal > 0 ? shipCost : 0), 0);
        if (document.getElementById("cartSubtotal")) {
    document.getElementById("cartSubtotal").textContent = fmt(subtotal);
    document.getElementById("cartDiscount").textContent = "- ₹ " + fmt(discAmt);
    document.getElementById("cartShipping").textContent = subtotal > 0 ? fmt(shipCost) : fmt(0);
    document.getElementById("cartTotal").textContent = fmt(total);
}}
    if (document.getElementById("shipSelect")) {
        document.getElementById("shipSelect").addEventListener("change", updateSummary);
    }

    if (document.getElementById("promoApply")) {
        document.getElementById("promoApply").addEventListener("click", () => {
            const code = document.getElementById("promoInput").value.trim().toUpperCase();
            const msg = document.getElementById("promoMsg");
            if (code === "KAPPA10") { discount = 0.10; msg.textContent = "10% off applied ✓"; }
            else if (code === "KAPPA20") { discount = 0.20; msg.textContent = "20% off applied ✓"; }
            else { discount = 0; msg.textContent = code ? "Invalid code" : ""; }
            updateSummary();
        });
    }

    /* ---------- WISHLIST ---------- */
    function toggleWishlist(id) {
        const p = PRODUCTS.find(x => x.id === id);
        const i = wishlist.indexOf(id);
        if (i > -1) { wishlist.splice(i, 1); showToast(`${p.name} removed from wishlist`); }
        else { wishlist.push(id); showToast(`${p.name} added to wishlist`); }
        renderWishlist();
    }
    function renderWishlist() {
        const wrap = document.getElementById("wishItems");
        const wishTotal = wishlist.length;
        const wishCountEl = document.getElementById("wishCount");
        if (wishCountEl) wishCountEl.textContent = wishTotal;
        const wishBtnBadge = document.querySelector("#wishBtn .badge");
        if (wishBtnBadge) wishBtnBadge.textContent = wishTotal;
        if (!wishlist.length) {
            wrap.innerHTML = `<div class="wish-empty">No favorites yet.<br>Tap the heart on any product.</div>`;
            return;
        }
        wrap.innerHTML = wishlist.map(id => {
            const p = PRODUCTS.find(x => x.id === id);
            return `
    <div class="cart-item">
      <img src="${p.img}" alt="${p.name}">
      <div class="ci-info">
        <div class="ci-name">${p.name}</div>
        <div class="ci-meta">${p.cat}</div>
        <span class="ci-remove" data-unwish="${p.id}">Remove</span>
      </div>
      <div class="ci-price">${fmt(p.price)}</div>
    </div>`;
        }).join('');
    }
    document.getElementById("wishItems").addEventListener("click", e => {
        const id = e.target.dataset.unwish;
        if (id) toggleWishlist(Number(id));
    });

    /* ---------- QUICK VIEW ---------- */
    function openQuickView(id) {
    const p = PRODUCTS.find(x => x.id === id);
    const panel = document.getElementById("qvPanel");
    panel.innerHTML = `
<button class="overlay-close" id="qvClose">✕</button>
<div class="qv-img" style="background-image:url('${p.img}')"></div>
<div class="qv-body">
  <span class="qv-cat">${p.cat || ''}</span>
  <h2 class="qv-name">${p.name}</h2>
  <div class="qv-price">${fmt(p.price)} ${p.old ? `<span class="pc-old">${fmt(p.old)}</span>` : ''}</div>
  <p class="qv-desc">Engineered fabric, oversized silhouette, and a fit built for everyday movement. Part of the KAPPA icon lineup.</p>
  <div class="qv-label">Size</div>
  <div class="qv-sizes">${(p.sizes || ['Default']).map((s, i) => `<div class="qv-size ${i === 0 ? 'active' : ''}" data-size="${s}">${s}</div>`).join('')}</div>
  <div class="qv-label">Color</div>
  <div class="qv-colors">${(p.colors || ['N/A']).map((c, i) => `<div class="qv-color ${i === 0 ? 'active' : ''}" style="background:${c}; width:25px; height:25px; border-radius:50%; display:inline-block; cursor:pointer;" data-color="${c}"></div>`).join('')}</div>
  <div class="qv-label">Quantity</div>
  <div class="qv-qty">
    <button id="qvDec">−</button><span id="qvQty">1</span><button id="qvInc">+</button>
  </div>
  <button class="btn btn-primary full magnetic" id="qvAdd"><span>Add to Cart</span></button>
</div>
`;
    let qty = 1, selectedSize = p.sizes ? p.sizes[0] : 'Default', selectedColor = p.colors ? p.colors[0] : 'N/A';
    
    panel.querySelectorAll(".qv-size").forEach(el => el.addEventListener("click", () => {
        panel.querySelectorAll(".qv-size").forEach(x => x.classList.remove("active"));
        el.classList.add("active"); selectedSize = el.dataset.size;
    }));
    panel.querySelectorAll(".qv-color").forEach(el => el.addEventListener("click", () => {
        panel.querySelectorAll(".qv-color").forEach(x => x.classList.remove("active"));
        el.classList.add("active"); selectedColor = el.dataset.color;
    }));
    panel.querySelector("#qvInc").addEventListener("click", () => { qty++; panel.querySelector("#qvQty").textContent = qty; });
    panel.querySelector("#qvDec").addEventListener("click", () => { qty = Math.max(1, qty - 1); panel.querySelector("#qvQty").textContent = qty; });
    
    panel.querySelector("#qvAdd").addEventListener("click", () => {
        for (let i = 0; i < qty; i++) addToCart(id, selectedSize, selectedColor);
        closeOverlay(qvOverlay);
    });
    panel.querySelector("#qvClose").addEventListener("click", () => closeOverlay(qvOverlay));
    openOverlay(qvOverlay);
}

    /* ---------- GLOBAL CLICK DELEGATION (product cards) ---------- */
    document.addEventListener("click", e => {
    const addId = e.target.dataset.add;
    const viewId = e.target.dataset.view;
    if (addId) {
        const p = PRODUCTS.find(x => x.id === Number(addId) || x.id == addId);
        const defaultSize = (p && p.sizes && p.sizes.length > 0) ? p.sizes[0] : 'Default';
        const defaultColor = (p && p.colors && p.colors.length > 0) ? p.colors[0] : 'N/A';
        addToCart(Number(addId), defaultSize, defaultColor);
    }
    if (viewId) openQuickView(Number(viewId));
});

    /* ---------- SEARCH ---------- */
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) { searchResults.innerHTML = ''; return; }
        const matches = PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q));
        searchResults.innerHTML = matches.length ? matches.map(p => `
    <div class="sr-item" data-view="${p.id}">
      <img src="${p.img}" alt="${p.name}">
      <div>
        <div class="sr-name">${p.name}</div>
        <div class="sr-price">${p.cat} · ${fmt(p.price)}</div>
      </div>
    </div>`).join('') : `<div class="sr-empty">No results for "${q}"</div>`;
    });
    searchResults.addEventListener("click", e => {
        const item = e.target.closest(".sr-item");
        if (item) { closeOverlay(searchOverlay); openQuickView(Number(item.dataset.view)); }
    });

    /* ---------- NEWSLETTER ---------- */
    const newsletterForm = document.getElementById("newsletterForm");
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", e => {
            e.preventDefault();
            const email = document.getElementById("newsletterEmail");
            const note = document.getElementById("newsletterNote");
            if (note) note.textContent = `You're in — confirmation sent to ${email.value}`;
            if (email) email.value = "";
            showToast("Welcome to the inner circle");
        });
    }

    /* ---------- FOOTER YEAR ---------- */
    document.getElementById("year").textContent = new Date().getFullYear();


    /* ---------- REELS AUTOPLAY, SLIDER & AUDIO CONTROL ---------- */
    const reelsContainer = document.getElementById("reels");
    if (reelsContainer) {
        const wrapper = reelsContainer.querySelector(".reels-wrapper");
        const cards = reelsContainer.querySelectorAll(".reel-card");
        const prevBtn = reelsContainer.querySelector(".reels-nav-btn.prev");
        const nextBtn = reelsContainer.querySelector(".reels-nav-btn.next");
        const videos = reelsContainer.querySelectorAll(".reel-video-element");

        let currentIndex = 2; // Start with center card (Reel 3) active
        let reelsInView = false;

        /* ---- Helpers ---- */
        function getVideo(idx) {
            const actualIdx = (idx + cards.length) % cards.length;
            return cards[actualIdx] ? cards[actualIdx].querySelector(".reel-video-element") : null;
        }

        // Control playback (play/pause/mute) based on current active card and viewport visibility
        function updateVideosState() {
            cards.forEach((card, i) => {
                const v = card.querySelector(".reel-video-element");
                const soundBtn = card.querySelector(".reel-sound-btn");
                if (!v) return;

                if (i === currentIndex && reelsInView) {
                    // Play active video and unmute it!
                    v.muted = false;
                    v.volume = 1;
                    updateSoundButtonIcon(soundBtn, false);

                    const promise = v.play();
                    if (promise !== undefined) {
                        promise.catch(() => {
                            // Fallback to muted playback if audio is blocked by user gesture policy
                            v.muted = true;
                            v.volume = 0;
                            v.play().catch(() => { });
                            updateSoundButtonIcon(soundBtn, true);
                        });
                    }
                } else {
                    // Pause all other videos
                    v.pause();
                    v.muted = true;
                    v.volume = 0;
                    updateSoundButtonIcon(soundBtn, true);
                }
            });
        }

        function updateSoundButtonIcon(btn, isMuted) {
            if (!btn) return;
            const wavePath = btn.querySelector(".sound-waves");
            if (isMuted) {
                if (wavePath) wavePath.style.display = "none";
            } else {
                if (wavePath) wavePath.style.display = "block";
            }
        }

        function playActiveWithAudio(idx) {
            currentIndex = (idx + cards.length) % cards.length;
            updateVideosState();
        }

        /* ---- Slider positioning ---- */
        function updateSlider() {
            if (!wrapper || !cards.length) return;
            const container = reelsContainer.querySelector(".reels-slider-container");
            if (!container) return;
            const cw = container.clientWidth;
            const card = cards[currentIndex];
            const tx = (cw / 2) - (card.offsetLeft + card.clientWidth / 2);
            wrapper.style.transform = `translateX(${tx}px)`;

            cards.forEach((c, i) => {
                c.classList.remove("active", "prev", "next", "far-prev", "far-next");
                const d = i - currentIndex;
                if (d === 0) c.classList.add("active");
                else if (d === -1) c.classList.add("prev");
                else if (d === 1) c.classList.add("next");
                else if (d < -1) c.classList.add("far-prev");
                else c.classList.add("far-next");
            });
        }

        /* ---- Navigate ---- */
        function goTo(idx) {
            currentIndex = (idx + cards.length) % cards.length;
            updateSlider();
            updateVideosState();
        }

        /* ---- Events ---- */
        if (prevBtn) prevBtn.addEventListener("click", e => { e.stopPropagation(); goTo(currentIndex - 1); });
        if (nextBtn) nextBtn.addEventListener("click", e => { e.stopPropagation(); goTo(currentIndex + 1); });

        cards.forEach((card, idx) => {
            card.addEventListener("click", (e) => {
                // If they clicked the sound button, handle it separately
                if (e.target.closest(".reel-sound-btn")) {
                    e.stopPropagation();
                    const v = card.querySelector(".reel-video-element");
                    const soundBtn = e.target.closest(".reel-sound-btn");
                    if (v) {
                        v.muted = !v.muted;
                        v.volume = v.muted ? 0 : 1;
                        updateSoundButtonIcon(soundBtn, v.muted);
                    }
                    return;
                }

                if (idx !== currentIndex) {
                    goTo(idx);
                }
            });
        });

        /* ---- Slider layout init ---- */
        window.addEventListener("resize", updateSlider);
        setTimeout(updateSlider, 100);
        setTimeout(updateSlider, 500);
        setTimeout(updateSlider, 1500);
        window.addEventListener("load", updateSlider);

        // Run updateVideosState once initially to load active poster frame
        setTimeout(updateVideosState, 200);

        /* ---- IntersectionObserver: auto-play on scroll into view ---- */
        const reelsObserver = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                reelsInView = true;
                updateSlider();
                updateVideosState();
            } else {
                reelsInView = false;
                updateVideosState();
            }
        }, { threshold: 0.1 }); // Lowered threshold so videos load/play as soon as they enter screen
        reelsObserver.observe(reelsContainer);
    }


    /* ---------- SEPARATE REELS PAGE GRID & LIGHTBOX LOGIC ---------- */
    const reelsGrid = document.querySelector(".reels-grid");
    if (reelsGrid) {
        const gridCards = reelsGrid.querySelectorAll(".reels-grid-card");
        const lightbox = document.getElementById("reelsLightbox");
        const lightboxWrapper = document.getElementById("lightboxWrapper");
        const closeBtn = document.getElementById("lightboxClose");
        const prevBtn = document.getElementById("lightboxPrev");
        const nextBtn = document.getElementById("lightboxNext");
        const lightboxVideos = lightbox.querySelectorAll(".lightbox-video-element");

        let activeLightboxIndex = 0;
        let lightboxIsMuted = false; // Default to unmuted in lightbox for immersive feel

        // Grid cards hover play/pause
        gridCards.forEach(card => {
            const video = card.querySelector(".reels-grid-video");
            const soundBtn = card.querySelector(".reels-grid-sound-btn");

            card.addEventListener("mouseenter", () => {
                video.play().catch(() => { });
            });

            card.addEventListener("mouseleave", () => {
                video.pause();
                video.currentTime = 0; // Reset
            });

            // Grid card click to open lightbox
            card.addEventListener("click", (e) => {
                if (e.target.closest(".reels-grid-sound-btn")) {
                    e.stopPropagation();
                    video.muted = !video.muted;
                    video.volume = video.muted ? 0 : 1;
                    const wavePath = soundBtn.querySelector(".sound-waves");
                    if (wavePath) wavePath.style.display = video.muted ? "none" : "block";
                    return;
                }

                const index = parseInt(card.dataset.index, 10);
                openLightbox(index);
            });
        });

        // Open Lightbox
        function openLightbox(index) {
            activeLightboxIndex = index;
            lightbox.classList.add("active");
            document.body.style.overflow = "hidden"; // Disable scroll

            updateLightboxSlider(false); // don't animate transitions on open
            playLightboxVideo();
        }

        // Close Lightbox
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                lightbox.classList.remove("active");
                document.body.style.overflow = ""; // Enable scroll

                // Pause all lightbox videos
                lightboxVideos.forEach(v => {
                    v.pause();
                    v.currentTime = 0;
                });
            });
        }

        // Update Slider Position
        function updateLightboxSlider(animate = true) {
            if (!lightboxWrapper) return;
            lightboxWrapper.style.transition = animate ? "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)" : "none";
            const tx = activeLightboxIndex * -100;
            lightboxWrapper.style.transform = `translateX(${tx}vw)`;
        }

        // Play active lightbox video
        function playLightboxVideo() {
            lightboxVideos.forEach((v, i) => {
                const soundBtn = v.closest(".lightbox-slide").querySelector(".lightbox-sound-btn");
                if (i === activeLightboxIndex) {
                    v.muted = lightboxIsMuted;
                    v.volume = lightboxIsMuted ? 0 : 1;
                    const wavePath = soundBtn.querySelector(".sound-waves");
                    if (wavePath) wavePath.style.display = lightboxIsMuted ? "none" : "block";

                    const promise = v.play();
                    if (promise !== undefined) {
                        promise.catch(() => {
                            v.muted = true;
                            v.volume = 0;
                            v.play().catch(() => { });
                            if (wavePath) wavePath.style.display = "none";
                        });
                    }
                } else {
                    v.pause();
                    v.currentTime = 0;
                }
            });
        }

        // Navigate Lightbox
        function nextLightbox() {
            if (activeLightboxIndex < gridCards.length - 1) {
                activeLightboxIndex++;
                updateLightboxSlider();
                playLightboxVideo();
            }
        }

        function prevLightbox() {
            if (activeLightboxIndex > 0) {
                activeLightboxIndex--;
                updateLightboxSlider();
                playLightboxVideo();
            }
        }

        if (nextBtn) nextBtn.addEventListener("click", nextLightbox);
        if (prevBtn) prevBtn.addEventListener("click", prevLightbox);

        // Sound buttons in lightbox
        lightbox.querySelectorAll(".lightbox-sound-btn").forEach((btn, index) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                lightboxIsMuted = !lightboxIsMuted;
                playLightboxVideo(); // Update audio state on all
            });
        });

        // Keydown events
        document.addEventListener("keydown", (e) => {
            if (!lightbox.classList.contains("active")) return;
            if (e.key === "Escape") closeBtn.click();
            else if (e.key === "ArrowRight") nextLightbox();
            else if (e.key === "ArrowLeft") prevLightbox();
        });

        // Touch swipe support in lightbox
        let touchStartX = 0;
        let touchEndX = 0;

        lightbox.addEventListener("touchstart", (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener("touchend", (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const threshold = 50;
            if (touchStartX - touchEndX > threshold) {
                nextLightbox(); // Swipe Left -> Next
            } else if (touchEndX - touchStartX > threshold) {
                prevLightbox(); // Swipe Right -> Prev
            }
        }
    }




    /* ---------- CATEGORIES TAB SWITCHING ---------- */
    const catTabBtns = document.querySelectorAll(".cat-tab-btn");
    const catGrids = document.querySelectorAll(".categories-grid");

    catTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.dataset.tab;

            // Update buttons active class
            catTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Switch grids
            catGrids.forEach(grid => {
                if (grid.id === `cat-grid-${targetTab}`) {
                    grid.classList.add("active");
                } else {
                    grid.classList.remove("active");
                }
            });

            // Check scroll reveal for the new grid cards
            setTimeout(revealCheck, 50);
        });
    });

    /* ---------- INIT ---------- */
    renderCart();
    renderWishlist();
    revealCheck();
    /* ---------- SUPABASE AUTH ---------- */

    function getUserDisplayName(user) {
        if (!user) return "User";
        // 1. Try local storage profile name first!
        const storedProfile = localStorage.getItem(`kappa_profile_${user.id}`);
        if (storedProfile) {
            try {
                const parsed = JSON.parse(storedProfile);
                if (parsed.name && parsed.name.trim() !== "") {
                    return parsed.name.trim();
                }
            } catch (_) { }
        }
        // 2. Try user metadata full name
        if (user.user_metadata && user.user_metadata.full_name) {
            return user.user_metadata.full_name;
        }
        // 3. Fallback to email name part
        if (user.email) {
            const parts = user.email.split('@')[0];
            const namePart = parts.split(/[\._\d]/)[0];
            return namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }
        return "User";
    }

    // Listen for auth state changes (covers Google OAuth redirect)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUserSession = session;
        const profileBtn = document.getElementById('profileBtn');
        const profilePopup = document.getElementById('profilePopup');
        if (session && session.user) {
            if (profileBtn) profileBtn.style.color = 'var(--yellow, #F5C518)';
            if (event === 'SIGNED_IN') showToast('Welcome back, ' + getUserDisplayName(session.user) + '!');

            injectDashboardPanel();

            // Adjust overlay class
            const accountOverlay = document.getElementById('accountOverlay');
            if (accountOverlay) accountOverlay.classList.add('dashboard-active');

            // Load user data
            const userId = session.user.id;
            const email = session.user.email;
            const name = getUserDisplayName(session.user);
            loadProfile(userId, email, name);

            // Update dropdown profile popup
            const popupName = document.getElementById('profilePopupName');
            if (popupName) popupName.textContent = name;

            const popupAvatarPlaceholder = document.getElementById('profilePopupAvatarPlaceholder');
            const popupAvatarImg = document.getElementById('profilePopupAvatarImg');
            const avatarKey = `kappa_avatar_${userId}`;
            const avatarSrc = localStorage.getItem(avatarKey);

            if (popupAvatarImg && popupAvatarPlaceholder) {
                if (avatarSrc) {
                    popupAvatarImg.src = avatarSrc;
                    popupAvatarImg.style.display = 'block';
                    popupAvatarPlaceholder.style.display = 'none';
                } else {
                    popupAvatarImg.style.display = 'none';
                    popupAvatarPlaceholder.style.display = 'flex';
                    popupAvatarPlaceholder.textContent = (name ? name.charAt(0).toUpperCase() : "U");
                }
            }

            // Activate the dashboard panel
            const panelDashboard = document.getElementById('panel-dashboard');
            const panelLogin = document.getElementById('panel-login');
            const panelSignup = document.getElementById('panel-signup');
            if (panelLogin) panelLogin.classList.remove('active');
            if (panelSignup) panelSignup.classList.remove('active');
            if (panelDashboard) panelDashboard.classList.add('active');
        } else {
            if (profileBtn) profileBtn.style.color = '';
            if (profilePopup) profilePopup.classList.remove('open');

            // Remove dashboard active class from overlay
            const accountOverlay = document.getElementById('accountOverlay');
            if (accountOverlay) accountOverlay.classList.remove('dashboard-active');

            // If logged out, show the login panel and hide the dashboard
            const panelDashboard = document.getElementById('panel-dashboard');
            const panelLogin = document.getElementById('panel-login');
            const panelSignup = document.getElementById('panel-signup');
            if (panelDashboard) panelDashboard.classList.remove('active');
            if (panelSignup) panelSignup.classList.remove('active');
            if (panelLogin) panelLogin.classList.add('active');
        }
    });

    const DEFAULT_MOCK_ORDERS = [];

    function injectDashboardPanel() {
        const accountOverlay = document.getElementById('accountOverlay');
        if (!accountOverlay) return;
        const card = accountOverlay.querySelector('.card');
        if (!card) return;
        if (document.getElementById('panel-dashboard')) return; // already injected

        const dashboardHtml = `
            <section class="panel" id="panel-dashboard">
                <div class="dash-header">
                    <h2 class="dash-title">My Account</h2>
                    <button type="button" class="dash-logout-btn" id="dashLogoutBtn">Sign Out</button>
                </div>

                <!-- PROFILE INFO -->
                <div class="dash-profile-card">
                    <div class="dash-profile-top">
                        <div style="position: relative; flex-shrink: 0;">
                            <div class="dash-avatar-wrapper" id="dashAvatarBtn" title="Choose profile picture">
                                <img src="" id="dashAvatarImg" class="dash-avatar-img" style="display:none;" />
                                <div id="dashAvatarPlaceholder" class="dash-avatar-placeholder">U</div>
                            </div>
                            <button type="button" class="dash-avatar-camera-btn" id="dashAvatarCameraBtn" title="Choose profile picture">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                            </button>
                            <input type="file" id="dashAvatarFileInput" accept="image/*" style="display:none;" />
                        </div>
                        <div class="dash-profile-meta">
                            <div class="dash-profile-name" id="dashProfileNameDisplay">User</div>
                            <div class="dash-profile-email" id="dashProfileEmailDisplay">user@example.com</div>
                        </div>
                    </div>

                    <form id="dash-profile-form">
                        <div class="dash-profile-fields">
                           <div class="dash-field">
                               <label for="dash-name">Full Name</label>
                               <input type="text" id="dash-name" class="dash-input" placeholder="Your Name" />
                           </div>
                           <div class="dash-field">
                               <label for="dash-phone">Mobile Number</label>
                               <input type="tel" id="dash-phone" class="dash-input" placeholder="Enter Mobile Number" />
                           </div>
                           <div class="dash-field">
                               <label for="dash-address">Shipping Address</label>
                               <textarea id="dash-address" class="dash-input dash-textarea" placeholder="Enter Shipping Address"></textarea>
                           </div>
                        </div>
                        <button type="submit" class="dash-save-btn">Save Profile</button>
                    </form>
                </div>

                <!-- ORDER TRACKING -->
                <h3 class="dash-tracking-title">Track My Orders</h3>
                <div class="dash-track-search">
                    <input type="text" id="dashTrackSearchInput" placeholder="Enter Order ID (e.g. SP-883719, OD402948194)" />
                    <button type="button" class="dash-track-search-btn" id="dashTrackSearchBtn">Track</button>
                </div>
                
                <div class="dash-orders-list" id="dashOrdersList">
                    <!-- Orders dynamically loaded -->
                </div>
            </section>
        `;

        card.insertAdjacentHTML('beforeend', dashboardHtml);
        setupDashboardEvents();
    }

    function setupDashboardEvents() {
        const logoutBtn = document.getElementById('dashLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const { error } = await supabaseClient.auth.signOut();
                if (error) showToast('Logout failed: ' + error.message);
                else showToast('Logged out successfully');
            });
        }

        const profileForm = document.getElementById('dash-profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                supabaseClient.auth.getSession().then(({ data: { session } }) => {
                    const userId = session?.user?.id || "guest";
                    const name = document.getElementById('dash-name').value.trim();
                    const phone = document.getElementById('dash-phone').value.trim();
                    const address = document.getElementById('dash-address').value.trim();
                    saveProfile(userId, name, phone, address);
                });
            });
        }

        const avatarBtn = document.getElementById('dashAvatarBtn');
        const cameraBtn = document.getElementById('dashAvatarCameraBtn');
        const fileInput = document.getElementById('dashAvatarFileInput');

        const triggerFileSelect = () => {
            if (fileInput) fileInput.click();
        };

        if (avatarBtn) avatarBtn.addEventListener('click', triggerFileSelect);
        if (cameraBtn) cameraBtn.addEventListener('click', triggerFileSelect);

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    showToast('Please select a valid image file');
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result;
                    supabaseClient.auth.getSession().then(({ data: { session } }) => {
                        const userId = session?.user?.id || "guest";
                        const avatarImg = document.getElementById('dashAvatarImg');
                        const avatarPlaceholder = document.getElementById('dashAvatarPlaceholder');

                        localStorage.setItem(`kappa_avatar_${userId}`, dataUrl);
                        if (avatarImg) {
                            avatarImg.src = dataUrl;
                            avatarImg.style.display = 'block';
                        }
                        if (avatarPlaceholder) {
                            avatarPlaceholder.style.display = 'none';
                        }

                        // Sync to profile dropdown popup
                        const popupAvatarPlaceholder = document.getElementById('profilePopupAvatarPlaceholder');
                        const popupAvatarImg = document.getElementById('profilePopupAvatarImg');
                        if (popupAvatarImg) {
                            popupAvatarImg.src = dataUrl;
                            popupAvatarImg.style.display = 'block';
                        }
                        if (popupAvatarPlaceholder) {
                            popupAvatarPlaceholder.style.display = 'none';
                        }

                        showToast("Profile picture updated!");
                    });
                };
                reader.readAsDataURL(file);
            });
        }

        const trackBtn = document.getElementById('dashTrackSearchBtn');
        const trackInput = document.getElementById('dashTrackSearchInput');
        if (trackBtn && trackInput) {
            trackBtn.addEventListener('click', () => {
                supabaseClient.auth.getSession().then(({ data: { session } }) => {
                    const userId = session?.user?.id || "guest";
                    trackOrder(trackInput.value.trim(), userId);
                });
            });
            trackInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    trackBtn.click();
                }
            });
        }
    }

    function loadOrders(userId) {
        const customOrdersKey = `kappa_orders_${userId}`;
        let orders = localStorage.getItem(customOrdersKey);
        if (!orders) {
            orders = JSON.stringify(DEFAULT_MOCK_ORDERS);
            localStorage.setItem(customOrdersKey, orders);
        }
        try {
            let parsed = JSON.parse(orders);
            // Filter out old mock details if they exist in localStorage
            const filtered = parsed.filter(o => o.id !== "KP-10294" && o.id !== "KP-18294" && o.id !== "OD402948194" && o.id !== "SP-883719");
            if (filtered.length !== parsed.length) {
                localStorage.setItem(customOrdersKey, JSON.stringify(filtered));
            }
            return filtered;
        } catch (_) {
            return [];
        }
    }

    function trackOrder(orderId, userId) {
        if (!orderId) {
            showToast("Please enter an Order ID");
            return;
        }
        orderId = orderId.toUpperCase().trim();
        const customOrdersKey = `kappa_orders_${userId}`;
        let orders = loadOrders(userId);

        const existingIndex = orders.findIndex(o => o.id === orderId);
        if (existingIndex !== -1) {
            const order = orders.splice(existingIndex, 1)[0];
            orders.unshift(order);
            localStorage.setItem(customOrdersKey, JSON.stringify(orders));
            renderOrdersList(orders);
            showToast(`Tracking order ${orderId}`);
            return;
        }

        let platform = "Kappa Store";
        let platformClass = "kappa";
        if (orderId.startsWith("OD") || orderId.startsWith("FK") || /^\d+$/.test(orderId)) {
            platform = "Flipkart";
            platformClass = "flipkart";
        } else if (orderId.startsWith("SP") || orderId.startsWith("SH")) {
            platform = "Shopify";
            platformClass = "shopify";
        }

        const statuses = [
            { status: "Processing", desc: "Order received. Preparing items.", progress: 25, activeStepIndex: 0 },
            { status: "Shipped", desc: "Order shipped via Express Delivery.", progress: 50, activeStepIndex: 1 },
            { status: "In Transit", desc: "In transit. Arrived at hub.", progress: 75, activeStepIndex: 2 },
            { status: "Delivered", desc: "Package delivered to door.", progress: 100, activeStepIndex: 3 }
        ];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        const newOrder = {
            id: orderId,
            platform: platform,
            platformClass: platformClass,
            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            items: "Kappa Premium Streetwear Apparel",
            status: randomStatus.status,
            statusDesc: randomStatus.desc,
            progress: randomStatus.progress,
            steps: ["Ordered", "Shipped", "Out for Delivery", "Delivered"],
            activeStepIndex: randomStatus.activeStepIndex
        };

        orders.unshift(newOrder);
        localStorage.setItem(customOrdersKey, JSON.stringify(orders));
        renderOrdersList(orders);
        showToast(`Order ${orderId} registered and tracked!`);
    }

    function saveProfile(userId, name, phone, address) {
        const profileKey = `kappa_profile_${userId}`;
        const profileData = { name, phone, address };
        localStorage.setItem(profileKey, JSON.stringify(profileData));
        showToast("Profile details updated!");
        const nameDisplay = document.getElementById('dashProfileNameDisplay');
        if (nameDisplay) nameDisplay.textContent = name || "User";

        // Sync to profile dropdown popup
        const popupName = document.getElementById('profilePopupName');
        if (popupName) popupName.textContent = name || "User";
        const popupAvatarPlaceholder = document.getElementById('profilePopupAvatarPlaceholder');
        if (popupAvatarPlaceholder && (!localStorage.getItem(`kappa_avatar_${userId}`))) {
            popupAvatarPlaceholder.textContent = (name ? name.charAt(0).toUpperCase() : "U");
        }
    }

    function loadProfile(userId, defaultEmail, defaultName) {
        const profileKey = `kappa_profile_${userId}`;
        const stored = localStorage.getItem(profileKey);
        let name = defaultName || "User";
        let phone = "";
        let address = "";

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                name = parsed.name || name;
                phone = parsed.phone || "";
                address = parsed.address || "";
            } catch (_) { }
        }

        const nameInput = document.getElementById('dash-name');
        const phoneInput = document.getElementById('dash-phone');
        const addressInput = document.getElementById('dash-address');
        const nameDisplay = document.getElementById('dashProfileNameDisplay');
        const emailDisplay = document.getElementById('dashProfileEmailDisplay');

        if (nameInput) nameInput.value = name;
        if (phoneInput) phoneInput.value = phone;
        if (addressInput) addressInput.value = address;
        if (nameDisplay) nameDisplay.textContent = name;
        if (emailDisplay) emailDisplay.textContent = defaultEmail;

        const avatarKey = `kappa_avatar_${userId}`;
        const avatarSrc = localStorage.getItem(avatarKey);
        const avatarImg = document.getElementById('dashAvatarImg');
        const avatarPlaceholder = document.getElementById('dashAvatarPlaceholder');

        if (avatarImg && avatarPlaceholder) {
            if (avatarSrc) {
                avatarImg.src = avatarSrc;
                avatarImg.style.display = 'block';
                avatarPlaceholder.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarPlaceholder.style.display = 'flex';
                avatarPlaceholder.textContent = (name ? name.charAt(0).toUpperCase() : "U");
            }
        }

        // Sync to profile dropdown popup
        const popupName = document.getElementById('profilePopupName');
        if (popupName) popupName.textContent = name;

        const popupAvatarImg = document.getElementById('profilePopupAvatarImg');
        const popupAvatarPlaceholder = document.getElementById('profilePopupAvatarPlaceholder');
        if (popupAvatarImg && popupAvatarPlaceholder) {
            if (avatarSrc) {
                popupAvatarImg.src = avatarSrc;
                popupAvatarImg.style.display = 'block';
                popupAvatarPlaceholder.style.display = 'none';
            } else {
                popupAvatarImg.style.display = 'none';
                popupAvatarPlaceholder.style.display = 'flex';
                popupAvatarPlaceholder.textContent = (name ? name.charAt(0).toUpperCase() : "U");
            }
        }

        const orders = loadOrders(userId);
        renderOrdersList(orders);
    }

    function renderOrdersList(orders) {
        const listContainer = document.getElementById('dashOrdersList');
        if (!listContainer) return;

        if (orders.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#888; font-size:13px; margin: 20px 0;">No orders tracked yet.</p>';
            return;
        }

        listContainer.innerHTML = orders.map(order => {
            const stepWidth = (order.activeStepIndex / (order.steps.length - 1)) * 100;
            return `
                <div class="dash-order-card">
                    <div class="dash-order-meta">
                        <div class="dash-order-id-wrap">
                            <span class="dash-order-platform ${order.platformClass}">${order.platform}</span>
                            <span class="dash-order-id">${order.id}</span>
                        </div>
                        <span class="dash-order-date">${order.date}</span>
                    </div>
                    <div class="dash-order-info">
                        <strong>Items:</strong> ${order.items}
                    </div>
                    
                    <div class="dash-order-track-steps" style="margin-bottom: 20px;">
                        <div class="dash-order-track-progress-bar" style="width: ${stepWidth}%"></div>
                        ${order.steps.map((step, idx) => {
                const isActive = idx <= order.activeStepIndex ? 'active' : '';
                return `
                                <div class="dash-order-step-node ${isActive}">
                                    <div class="dash-order-step-dot"></div>
                                    <span class="dash-order-step-label">${step}</span>
                                </div>
                            `;
            }).join('')}
                    </div>
                    
                    <div class="dash-order-status-desc">
                        Status: <span>${order.status}</span>
                    </div>
                    <p style="font-size: 11.5px; color: #777; margin-top: 6px; line-height: 1.4;">
                        ${order.statusDesc}
                    </p>
                </div>
            `;
        }).join('');
    }

    // Helper to close the account overlay
    function closeAccountOverlay() {
        const ov = document.getElementById('accountOverlay');
        if (ov) { ov.classList.remove('open'); document.body.style.overflow = ''; }
    }

    /* --- LOGIN --- */
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                showToast('Please enter your email and password');
                return;
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                // Special case: account exists but email not confirmed yet
                if (error.message.toLowerCase().includes('email not confirmed')) {
                    // Removed auto-resend to prevent hitting strict email rate limits
                    showToast('Account not confirmed yet. Please check your inbox for the confirmation link.');
                } else {
                    showToast('Login failed: ' + error.message);
                }
                return;
            }

            showToast('Welcome back, ' + getUserDisplayName(data.user) + '!');
            setTimeout(closeAccountOverlay, 1200);
        });
    }

    /* --- SIGN UP --- */
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('su-name').value.trim();
            const email = document.getElementById('su-email').value.trim();
            const password = document.getElementById('su-password').value;
            const confirmPassword = document.getElementById('su-confirm').value;

            if (!fullName || !email || !password) {
                showToast('Please fill in all required fields');
                return;
            }
            if (password.length < 6) {
                showToast('Password must be at least 6 characters');
                return;
            }
            if (password !== confirmPassword) {
                showToast('Passwords do not match');
                return;
            }

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });

            if (error) {
                showToast('Sign up failed: ' + error.message);
                return;
            }

            if (data.session) {
                // Email confirmation disabled — user is instantly logged in
                showToast('Account created! You are now signed in.');
                setTimeout(() => {
                    const ov = document.getElementById('accountOverlay');
                    if (ov) { ov.classList.remove('open'); document.body.style.overflow = ''; }
                }, 1200);
            } else {
                // Email confirmation is ON — guide them clearly
                showToast('✉️ Check your email and click the confirmation link, then sign in.');
                // Switch back to the login panel so they know to sign in after confirming
                setTimeout(() => {
                    const panelSignup = document.getElementById('panel-signup');
                    const panelLogin = document.getElementById('panel-login');
                    if (panelSignup) panelSignup.classList.remove('active');
                    if (panelLogin) panelLogin.classList.add('active');
                }, 1500);
            }
        });
    }

    /* --- GOOGLE OAUTH --- */
    document.querySelectorAll('.btn-google').forEach(btn => {
        btn.addEventListener('click', async () => {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
            if (error) showToast('Google sign-in failed: ' + error.message);
        });
    });

    // Run renderCart initially to load the cart from localStorage
    setTimeout(renderCart, 100);
})();

// --- AUTO-RUNNING CATEGORY SEPARATED INJECTION (STRICT 4-LIMIT) ---
async function initStorefront() {
    console.log("🚀 Script started: Fetching strictly separated categories...");

    const boysContainer = document.getElementById('boys-arrival-container');
    const womensContainer = document.getElementById('womens-arrival-container');

    // Stop if containers don't exist
    if (!boysContainer && !womensContainer) return; 

    try {
        // 1. FETCH CATEGORIES FIRST to map the Parent/Child relationships
        const { data: categories, error: catError } = await supabaseClient
            .from('categories')
            .select('*');
            
        if (catError) throw catError;

        let menCategoryIds = [];
        let womenCategoryIds = [];

        if (categories) {
            // Find Root Categories dynamically (handles "Men", "Men's", "Women", "Women's")
            const womenRoot = categories.find(c => {
                const name = (c.name || '').toLowerCase();
                return name === 'women' || name === "women's" || name === 'girls';
            });
            
            const menRoot = categories.find(c => {
                const name = (c.name || '').toLowerCase();
                return name === 'men' || name === "men's" || name === 'boys';
            });

            if (womenRoot) {
                womenCategoryIds = [womenRoot.id, ...categories.filter(c => c.parent_id === womenRoot.id).map(c => c.id)];
            }
            if (menRoot) {
                menCategoryIds = [menRoot.id, ...categories.filter(c => c.parent_id === menRoot.id).map(c => c.id)];
            }
        }

        // 2. FETCH LATEST PRODUCTS
        const { data: products, error: prodError } = await supabaseClient
            .from('products')
            .select('*, product_images(url, position)')
            .eq('is_active', true)
            .order('created_at', { ascending: false }); 

        if (prodError) throw prodError;

        // Clear containers to ensure no duplicates
        if (boysContainer) boysContainer.innerHTML = '';
        if (womensContainer) womensContainer.innerHTML = '';

        let mensCount = 0;
        let womensCount = 0;

        // 3. STRICT SEPARATION AND INJECTION
        (products || []).forEach(product => {
            const isMens = menCategoryIds.includes(product.category_id);
            const isWomens = womenCategoryIds.includes(product.category_id);

            // Determine if we are allowed to inject this product (Enforces the 4-limit cap)
            const injectMens = isMens && mensCount < 4;
            const injectWomens = isWomens && womensCount < 4;

            // If it doesn't belong to a category, OR if that category is already full, completely skip it!
            if (!injectMens && !injectWomens) return;

            // Extract unique color images from product.product_images
            const uniqueColorImages = [];
            const seenColors = new Set();
            (product.product_images || []).forEach(img => {
                const parts = img.url.split('#');
                const cleanUrl = parts[0];
                const color = parts[1] || 'Default';
                if (!seenColors.has(color)) {
                    seenColors.add(color);
                    uniqueColorImages.push({ color, url: cleanUrl });
                }
            });

            // Handle Image safely
            let imageUrl = 'assets/sleeping sis.png'; 
            if (uniqueColorImages.length > 0) {
                imageUrl = uniqueColorImages[0].url;
            } else if (product.product_images && product.product_images.length > 0) {
                product.product_images.sort((a, b) => (a.position || 0) - (b.position || 0));
                imageUrl = product.product_images[0].url || imageUrl;
                uniqueColorImages.push({ color: 'Default', url: imageUrl });
            } else {
                uniqueColorImages.push({ color: 'Default', url: imageUrl });
            }

            // Create thumbnails HTML
            const maxThumbs = 4;
            let thumbsHTML = '';
            uniqueColorImages.slice(0, maxThumbs).forEach((item, idx) => {
                const isActive = idx === 0;
                thumbsHTML += `
                    <img class="boys-card-thumb ${isActive ? 'active' : ''}" 
                         src="${item.url}" 
                         alt="${item.color}"
                         title="${item.color}"
                         onclick="event.preventDefault(); event.stopPropagation(); changeCardColor(this, '${item.color.replace(/'/g, "\\'")}', '${item.url}')">
                `;
            });

            if (uniqueColorImages.length > maxThumbs) {
                thumbsHTML += `
                    <span style="font-size: 11px; color: #666; align-self: center; font-weight: bold; margin-left: 2px;">
                        +${uniqueColorImages.length - maxThumbs}
                    </span>
                `;
            }

            // Sanitize text to prevent HTML errors
            const safeName = (product.name || 'Untitled').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeImage = imageUrl.replace(/'/g, "\\'");
            const comparePriceHTML = product.compare_at_price ? `<span style="text-decoration:line-through; font-size:12px; color:#888; margin-left:8px;">₹${product.compare_at_price}</span>` : '';
            
            // Build the card
            const cardHTML = `
                <div class="boys-card" 
                     data-product-id="${product.id}" 
                     data-product-name="${safeName}" 
                     data-product-price="${product.price || 0}" 
                     style="max-width: 280px; width: 100%; position: relative;">
                    <span class="boys-badge">NEW</span>
                    
                    <a href="product.html?slug=${product.slug || product.id}" style="text-decoration: none; color: inherit; display: block;">
                        <img class="boys-card-img" src="${imageUrl}" alt="Product Image">
                        <h3>${product.name || 'Untitled Product'}</h3>
                    </a>

                    <!-- Color Selector Thumbnails -->
                    <div class="boys-card-thumbs">
                        ${thumbsHTML}
                    </div>

                    <p class="boys-price">₹${product.price || 0} ${comparePriceHTML}</p>
                    
                    <button type="button" class="boys-card-add-btn btn-secondary" onclick="event.preventDefault(); event.stopPropagation(); addToCart('${product.id}', '${safeName}', ${product.price || 0}, '${safeImage}')">Add To Cart</button>
                </div>
            `;

            // Draw to screen
            if (injectMens && boysContainer) {
                boysContainer.innerHTML += cardHTML;
                mensCount++;
            } else if (injectWomens && womensContainer) {
                womensContainer.innerHTML += cardHTML;
                womensCount++;
            }
        });

        console.log(`🎨 Render Complete! Men's items: ${mensCount}/4 | Women's items: ${womensCount}/4`);

    } catch (err) {
        console.error("🔥 Error:", err);
    }
}

// --- COLOR SWITCHER ACTION ---
window.changeCardColor = function(thumbElement, colorName, imageUrl) {
    const card = thumbElement.closest('.boys-card');
    if (!card) return;

    // Update main image URL
    const mainImg = card.querySelector('.boys-card-img');
    if (mainImg) mainImg.src = imageUrl;

    // Remove active styling from all sibling thumbnails, and add to current one
    const thumbs = card.querySelectorAll('.boys-card-thumb');
    thumbs.forEach(t => {
        t.style.border = '1px solid #ddd';
        t.classList.remove('active');
    });
    thumbElement.style.border = '2px solid #111';
    thumbElement.classList.add('active');

    // Update the Add To Cart button action and parameters
    const addBtn = card.querySelector('.boys-card-add-btn');
    if (addBtn) {
        const prodId = card.getAttribute('data-product-id');
        const prodName = card.getAttribute('data-product-name');
        const prodPrice = card.getAttribute('data-product-price');
        
        let cartName = prodName;
        if (colorName && colorName !== 'Default' && colorName !== 'None') {
            cartName += ` - ${colorName}`;
        }
        
        // Escape quotes safely
        const escapedCartName = cartName.replace(/'/g, "\\'");
        const escapedImageUrl = imageUrl.replace(/'/g, "\\'");
        addBtn.setAttribute('onclick', `event.preventDefault(); event.stopPropagation(); addToCart('${prodId}', '${escapedCartName}', ${prodPrice}, '${escapedImageUrl}')`);
    }
};

if (document.readyState === "interactive" || document.readyState === "complete") {
    initStorefront();
} else {
    document.addEventListener('DOMContentLoaded', initStorefront);
}