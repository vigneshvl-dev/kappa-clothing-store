/* ============================================================
   KAPPA — vanilla JS
   ============================================================ */
(() => {
    "use strict";

    /* ---------- DATA ---------- */
    const PRODUCTS = [
        { id: 1, cat: "Hoodies", name: "Blackout Hoodie", price: 2999, old: 3999, rating: 4.8, reviews: 132, sizes: ["S", "M", "L", "XL"], colors: ["#111", "#8a887f"], img: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=700&auto=format&fit=crop", tag: "NEW" },
        { id: 2, cat: "T-Shirts", name: "Sunfade Tee", price: 1299, old: null, rating: 4.6, reviews: 88, sizes: ["S", "M", "L", "XL", "XXL"], colors: ["#FFE066", "#fdfdfb"], img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=700&auto=format&fit=crop", tag: null },
        { id: 3, cat: "Oversized", name: "Concrete Tee", price: 1799, old: 2199, rating: 4.7, reviews: 64, sizes: ["M", "L", "XL"], colors: ["#111", "#FBCE07"], img: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=700&auto=format&fit=crop", tag: "SALE" },
        { id: 4, cat: "Jackets", name: "Nightrunner Jacket", price: 5499, old: null, rating: 4.9, reviews: 41, sizes: ["S", "M", "L"], colors: ["#111"], img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=700&auto=format&fit=crop", tag: "NEW" },
        { id: 5, cat: "Sneakers", name: "Vortex Sneakers", price: 4299, old: 5299, rating: 4.5, reviews: 210, sizes: ["7", "8", "9", "10"], colors: ["#fdfdfb", "#111"], img: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=700&auto=format&fit=crop", tag: "SALE" },
        { id: 6, cat: "Hoodies", name: "Ashfield Hoodie", price: 3199, old: null, rating: 4.4, reviews: 57, sizes: ["S", "M", "L", "XL"], colors: ["#8a887f"], img: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=700&auto=format&fit=crop", tag: null },
        { id: 7, cat: "Accessories", name: "Icon Cap", price: 899, old: null, rating: 4.3, reviews: 22, sizes: ["One Size"], colors: ["#111", "#FBCE07"], img: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=700&auto=format&fit=crop", tag: null },
        { id: 8, cat: "T-Shirts", name: "Skyline Tee", price: 1399, old: 1699, rating: 4.6, reviews: 73, sizes: ["S", "M", "L", "XL"], colors: ["#fdfdfb"], img: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?q=80&w=700&auto=format&fit=crop", tag: "SALE" },
    ];

    const CATEGORIES = [
        { name: "Men", img: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?q=80&w=400&auto=format&fit=crop" },
        { name: "Women", img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=400&auto=format&fit=crop" },
        { name: "Oversized", img: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=400&auto=format&fit=crop" },
        { name: "Hoodies", img: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400&auto=format&fit=crop" },
        { name: "T-Shirts", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop" },
        { name: "Accessories", img: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop" },
        { name: "Sneakers", img: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400&auto=format&fit=crop" },
    ];

    const LOOKBOOK = [
        { img: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=600&auto=format&fit=crop", cap: "Street Edit" },
        { img: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?q=80&w=600&auto=format&fit=crop", cap: "Sunfade" },
        { img: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?q=80&w=600&auto=format&fit=crop", cap: "Blackout" },
        { img: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop", cap: "Concrete Wave" },
        { img: "https://images.unsplash.com/photo-1512327646107-d5b74d5b1c5b?q=80&w=600&auto=format&fit=crop", cap: "Icon Series" },
        { img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop", cap: "Nightrunner" },
    ];

    const REVIEWS = [
        { name: "Aarav S.", loc: "Mumbai, IN", text: "Fit is incredible and the fabric feels genuinely premium. KAPPA nailed the oversized cut.", stars: 5 },
        { name: "Meera K.", loc: "Bengaluru, IN", text: "Fast delivery, easy returns, and the hoodie is on constant rotation. Worth every rupee.", stars: 5 },
        { name: "Devan R.", loc: "Kochi, IN", text: "Streetwear that doesn't feel generic. The Concrete Wave drop is my new favorite.", stars: 4 },
        { name: "Naomi P.", loc: "Delhi, IN", text: "Quality control is on point, stitching held up after months of wear.", stars: 5 },
        { name: "Kabir T.", loc: "Chennai, IN", text: "Checkout was smooth and sizing chart was spot on. Will shop again.", stars: 4 },
    ];

    const INSTA = [
        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1512327646107-d5b74d5b1c5b?q=80&w=400&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop",
    ];

    const fmt = n => "₹" + n.toLocaleString("en-IN");
    const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

    /* ---------- STATE ---------- */
    let cart = [];     // {id, size, qty}
    let wishlist = []; // [id]
    let discount = 0;

    /* ---------- LOADER ---------- */
    window.addEventListener("load", () => {
        const fill = document.getElementById("loaderFill");
        let p = 0;
        const iv = setInterval(() => {
            p += Math.random() * 18;
            if (p >= 100) { p = 100; clearInterval(iv); }
            fill.style.width = p + "%";
        }, 110);
        setTimeout(() => {
            document.getElementById("loader").classList.add("hide");
            document.body.style.overflow = "";
            revealCheck();
        }, 1200);
    });
    document.body.style.overflow = "hidden";

    /* ---------- CUSTOM CURSOR ---------- */
    const glow = document.getElementById("cursorGlow");
    const dot = document.getElementById("cursorDot");
    let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my;
    window.addEventListener("mousemove", e => {
        mx = e.clientX; my = e.clientY;
        dot.style.left = mx + "px"; dot.style.top = my + "px";
    });
    (function loop() {
        gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
        glow.style.left = gx + "px"; glow.style.top = gy + "px";
        requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, .cat-item, .look-item, .product-card").forEach(el => {
        el.addEventListener("mouseenter", () => dot.classList.add("grow"));
        el.addEventListener("mouseleave", () => dot.classList.remove("grow"));
    });

    /* ---------- SCROLL PROGRESS + NAVBAR HIDE ---------- */
    const progress = document.getElementById("scrollProgress");
    const navbar = document.getElementById("navbar");
    let lastY = 0;
    window.addEventListener("scroll", () => {
        const h = document.documentElement;
        const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
        if (progress) progress.style.width = scrolled + "%";

        const y = window.scrollY;
        if (y > lastY && y > 140) { navbar.classList.add("hide-nav"); }
        else { navbar.classList.remove("hide-nav"); }
        navbar.classList.toggle("scrolled", y > 40);
        lastY = y;
        revealCheck();
    }, { passive: true });

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
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobileMenu");
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("open");
        mobileMenu.classList.toggle("open");
    });
    mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
        hamburger.classList.remove("open"); mobileMenu.classList.remove("open");
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
        btn.addEventListener("mousemove", e => {
            const r = btn.getBoundingClientRect();
            const x = e.clientX - r.left - r.width / 2;
            const y = e.clientY - r.top - r.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
        });
        btn.addEventListener("mouseleave", () => { btn.style.transform = "translate(0,0)"; });
        btn.addEventListener("click", e => {
            const r = btn.getBoundingClientRect();
            const ripple = document.createElement("span");
            ripple.className = "ripple";
            ripple.style.left = (e.clientX - r.left) + "px";
            ripple.style.top = (e.clientY - r.top) + "px";
            ripple.style.width = ripple.style.height = Math.max(r.width, r.height) + "px";
            ripple.style.marginLeft = ripple.style.marginTop = -Math.max(r.width, r.height) / 2 + "px";
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

    function openOverlay(el) { el.classList.add("open"); document.body.style.overflow = "hidden"; }
    function closeOverlay(el) { el.classList.remove("open"); document.body.style.overflow = ""; }

    document.getElementById("cartBtn").addEventListener("click", () => openOverlay(cartOverlay));
    document.getElementById("bnavCart").addEventListener("click", () => openOverlay(cartOverlay));
    document.getElementById("cartClose").addEventListener("click", () => closeOverlay(cartOverlay));
    document.getElementById("wishBtn").addEventListener("click", () => openOverlay(wishOverlay));
    document.getElementById("bnavWish").addEventListener("click", () => openOverlay(wishOverlay));
    document.getElementById("wishClose").addEventListener("click", () => closeOverlay(wishOverlay));
    document.getElementById("searchBtn").addEventListener("click", () => { openOverlay(searchOverlay); document.getElementById("searchInput").focus(); });
    document.getElementById("bnavSearch").addEventListener("click", () => { openOverlay(searchOverlay); document.getElementById("searchInput").focus(); });
    document.getElementById("searchClose").addEventListener("click", () => closeOverlay(searchOverlay));
    [cartOverlay, wishOverlay, searchOverlay, qvOverlay].forEach(o => {
        o.addEventListener("click", e => { if (e.target === o) closeOverlay(o); });
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") [cartOverlay, wishOverlay, searchOverlay, qvOverlay].forEach(closeOverlay);
    });

    function addToCart(id, size) {
        const p = PRODUCTS.find(x => x.id === id);
        size = size || p.sizes[0];
        const existing = cart.find(c => c.id === id && c.size === size);
        if (existing) existing.qty++;
        else cart.push({ id, size, qty: 1 });
        renderCart();
        showToast(`${p.name} added to cart`);
    }

    function renderCart() {
        const wrap = document.getElementById("cartItems");
        document.getElementById("cartCount").textContent = cart.reduce((a, c) => a + c.qty, 0);
        if (!cart.length) {
            wrap.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Start adding icons.</div>`;
        } else {
            wrap.innerHTML = cart.map((c, idx) => {
                const p = PRODUCTS.find(x => x.id === c.id);
                return `
      <div class="cart-item">
        <img src="${p.img}" alt="${p.name}">
        <div class="ci-info">
          <div class="ci-name">${p.name}</div>
          <div class="ci-meta">Size ${c.size}</div>
          <div class="ci-qty">
            <button data-dec="${idx}">−</button>
            <span>${c.qty}</span>
            <button data-inc="${idx}">+</button>
          </div>
          <span class="ci-remove" data-remove="${idx}">Remove</span>
        </div>
        <div class="ci-price">${fmt(p.price * c.qty)}</div>
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
            return a + p.price * c.qty;
        }, 0);
        const shipCost = Number(document.getElementById("shipSelect").value);
        const discAmt = Math.round(subtotal * discount);
        const total = Math.max(subtotal - discAmt + (subtotal > 0 ? shipCost : 0), 0);
        document.getElementById("cartSubtotal").textContent = fmt(subtotal);
        document.getElementById("cartDiscount").textContent = "− " + fmt(discAmt);
        document.getElementById("cartShipping").textContent = subtotal > 0 ? fmt(shipCost) : fmt(0);
        document.getElementById("cartTotal").textContent = fmt(total);
    }
    document.getElementById("shipSelect").addEventListener("change", updateSummary);

    document.getElementById("promoApply").addEventListener("click", () => {
        const code = document.getElementById("promoInput").value.trim().toUpperCase();
        const msg = document.getElementById("promoMsg");
        if (code === "KAPPA10") { discount = 0.10; msg.textContent = "10% off applied ✓"; }
        else if (code === "KAPPA20") { discount = 0.20; msg.textContent = "20% off applied ✓"; }
        else { discount = 0; msg.textContent = code ? "Invalid code" : ""; }
        updateSummary();
    });

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
        document.getElementById("wishCount").textContent = wishlist.length;
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
      <span class="qv-cat">${p.cat}</span>
      <h2 class="qv-name">${p.name}</h2>
      <div class="qv-price">${fmt(p.price)} ${p.old ? `<span class="pc-old">${fmt(p.old)}</span>` : ''}</div>
      <p class="qv-desc">Engineered fabric, oversized silhouette, and a fit built for everyday movement. Part of the KAPPA icon lineup.</p>
      <div class="qv-label">Size</div>
      <div class="qv-sizes">${p.sizes.map((s, i) => `<div class="qv-size ${i === 0 ? 'active' : ''}" data-size="${s}">${s}</div>`).join('')}</div>
      <div class="qv-label">Color</div>
      <div class="qv-colors">${p.colors.map((c, i) => `<div class="qv-color ${i === 0 ? 'active' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')}</div>
      <div class="qv-label">Quantity</div>
      <div class="qv-qty">
        <button id="qvDec">−</button><span id="qvQty">1</span><button id="qvInc">+</button>
      </div>
      <button class="btn btn-primary full magnetic" id="qvAdd"><span>Add to Cart</span></button>
    </div>
  `;
        let qty = 1, size = p.sizes[0];
        panel.querySelectorAll(".qv-size").forEach(el => el.addEventListener("click", () => {
            panel.querySelectorAll(".qv-size").forEach(x => x.classList.remove("active"));
            el.classList.add("active"); size = el.dataset.size;
        }));
        panel.querySelectorAll(".qv-color").forEach(el => el.addEventListener("click", () => {
            panel.querySelectorAll(".qv-color").forEach(x => x.classList.remove("active"));
            el.classList.add("active");
        }));
        panel.querySelector("#qvInc").addEventListener("click", () => { qty++; panel.querySelector("#qvQty").textContent = qty; });
        panel.querySelector("#qvDec").addEventListener("click", () => { qty = Math.max(1, qty - 1); panel.querySelector("#qvQty").textContent = qty; });
        panel.querySelector("#qvAdd").addEventListener("click", () => {
            for (let i = 0; i < qty; i++) addToCart(id, size);
            closeOverlay(qvOverlay);
        });
        panel.querySelector("#qvClose").addEventListener("click", () => closeOverlay(qvOverlay));
        openOverlay(qvOverlay);
    }

    /* ---------- GLOBAL CLICK DELEGATION (product cards) ---------- */
    document.addEventListener("click", e => {
        const addId = e.target.dataset.add;
        const viewId = e.target.dataset.view;
        if (addId) addToCart(Number(addId));
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

    /* ---------- REELS AUTOPLAY, SLIDER & PAUSE ON SCROLL ---------- */
    const reelsContainer = document.getElementById("reels");
    if (reelsContainer) {
        const wrapper = reelsContainer.querySelector(".reels-wrapper");
        const cards = reelsContainer.querySelectorAll(".reel-card");
        const prevBtn = reelsContainer.querySelector(".reels-nav-btn.prev");
        const nextBtn = reelsContainer.querySelector(".reels-nav-btn.next");
        const videos = reelsContainer.querySelectorAll(".reel-video-element");
        
        let currentIndex = 1; // Start with the second video as active (centered)

        function updateSlider() {
            if (!wrapper || !cards.length) return;
            
            const containerWidth = reelsContainer.querySelector(".reels-slider-container").clientWidth;
            const activeCard = cards[currentIndex];
            const cardWidth = activeCard.clientWidth;
            const cardOffsetLeft = activeCard.offsetLeft;
            
            // Calculate translation value to center the active card
            const translateVal = (containerWidth / 2) - (cardOffsetLeft + cardWidth / 2);
            wrapper.style.transform = `translateX(${translateVal}px)`;
            
            // Update classes
            cards.forEach((card, idx) => {
                card.classList.remove("active", "prev", "next", "far-prev", "far-next");
                const diff = idx - currentIndex;
                if (diff === 0) {
                    card.classList.add("active");
                } else if (diff === -1) {
                    card.classList.add("prev");
                } else if (diff === 1) {
                    card.classList.add("next");
                } else if (diff <= -2) {
                    card.classList.add("far-prev");
                } else if (diff >= 2) {
                    card.classList.add("far-next");
                }
            });
        }

        // Click on navigation buttons
        if (prevBtn) {
            prevBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex - 1 + cards.length) % cards.length;
                updateSlider();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex + 1) % cards.length;
                updateSlider();
            });
        }

        // Click directly on side cards to center them
        cards.forEach((card, idx) => {
            card.addEventListener("click", () => {
                currentIndex = idx;
                updateSlider();
            });
        });

        // Initialize slider positioning
        // Use multiple triggers to ensure correct calculations as DOM renders and assets load
        setTimeout(updateSlider, 100);
        setTimeout(updateSlider, 500);
        setTimeout(updateSlider, 1500);
        window.addEventListener("load", updateSlider);
        window.addEventListener("resize", updateSlider);

        // intersection observer for video playback (simultaneous, muted)
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    videos.forEach(video => {
                        video.muted = true; // Ensure they are muted
                        video.play().catch(err => console.log("Autoplay prevented:", err));
                    });
                } else {
                    videos.forEach(video => {
                        video.pause();
                    });
                }
            });
        }, { threshold: 0.15 });
        observer.observe(reelsContainer);
    }

    /* ---------- INIT ---------- */
    renderCart();
    renderWishlist();
    revealCheck();

})();