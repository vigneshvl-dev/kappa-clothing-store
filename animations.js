/**
 * KAPPA CLOTHING STORE — Lenis + GSAP 120fps Engine & Scroll Animations
 */

(function () {
    "use strict";

    // 1. INITIALIZE GSAP & SCROLLTRIGGER
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
    }

    // 2. INITIALIZE LENIS SMOOTH SCROLL (LOCKED FOR 120FPS DISPLAY)
    let lenis = null;

    if (typeof Lenis !== "undefined") {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Smooth exponential decay
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 1.0,
            touchMultiplier: 1.5,
            infinite: false,
        });

        window.lenis = lenis;
        window.stopLenis = () => lenis && lenis.stop();
        window.startLenis = () => lenis && lenis.start();

        // Synchronize Lenis scroll position with GSAP ScrollTrigger
        if (typeof ScrollTrigger !== "undefined") {
            lenis.on("scroll", ScrollTrigger.update);
        }

        // Add Lenis RAF to GSAP Ticker for locked 120fps frame rendering
        if (typeof gsap !== "undefined") {
            gsap.ticker.add((time) => {
                lenis.raf(time * 1000);
            });
            // Disable lag smoothing for zero-latency high refresh rate displays (120Hz/120fps)
            gsap.ticker.lagSmoothing(0);
        } else {
            function raf(time) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
            requestAnimationFrame(raf);
        }
    }

    // 3. GSAP SCROLL ANIMATIONS ENGINES
    function initGSAPAnimations() {
        if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

        // Clean up pre-existing triggers on page re-init
        ScrollTrigger.getAll().forEach(t => t.kill());

        // --- A. HERO SECTION ENTRANCE & PARALLAX ---
        const heroSection = document.querySelector('.hero, .shop-hero, .about-hero, .contact-hero, .reels-hero');
        if (heroSection) {
            const heroContent = heroSection.querySelectorAll('.hero-title, .hero-tag, .hero-sub, .hero-btns, h1, .badge');
            if (heroContent.length > 0) {
                gsap.fromTo(heroContent, 
                    { y: 50, opacity: 0 },
                    { 
                        y: 0, 
                        opacity: 1, 
                        duration: 1, 
                        stagger: 0.12, 
                        ease: "power3.out",
                        delay: 0.1
                    }
                );
            }
        }

        // --- B. SECTION TITLES & HEADINGS ---
        const sectionTitles = document.querySelectorAll('.sec-head, .section-title, .shop-title, .about-title, h2');
        sectionTitles.forEach(title => {
            gsap.fromTo(title,
                { y: 35, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: title,
                        start: "top 88%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });

        // --- C. PRODUCT & CATEGORY CARDS (STAGGERED REVEAL) ---
        const cardContainers = document.querySelectorAll('.product-grid, .carousel-track, .category-grid, .shop-grid, .reels-grid, .boys-grid');
        cardContainers.forEach(container => {
            const cards = container.querySelectorAll('.product-card, .boys-card, .category-card, .reel-card, .feature-card');
            if (cards.length > 0) {
                gsap.fromTo(cards,
                    { y: 45, opacity: 0, scale: 0.96 },
                    {
                        y: 0,
                        opacity: 1,
                        scale: 1,
                        duration: 0.7,
                        stagger: 0.08,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: container,
                            start: "top 85%",
                            toggleActions: "play none none reverse"
                        }
                    }
                );
            }
        });

        // --- D. GENERIC REVEAL UTILITIES ---
        const reveals = document.querySelectorAll('.gsap-reveal');
        reveals.forEach(el => {
            gsap.fromTo(el,
                { y: 40, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: el,
                        start: "top 88%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });

        const slideLefts = document.querySelectorAll('.gsap-slide-left');
        slideLefts.forEach(el => {
            gsap.fromTo(el,
                { x: -50, opacity: 0 },
                {
                    x: 0,
                    opacity: 1,
                    duration: 0.85,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: el,
                        start: "top 85%"
                    }
                }
            );
        });

        const slideRights = document.querySelectorAll('.gsap-slide-right');
        slideRights.forEach(el => {
            gsap.fromTo(el,
                { x: 50, opacity: 0 },
                {
                    x: 0,
                    opacity: 1,
                    duration: 0.85,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: el,
                        start: "top 85%"
                    }
                }
            );
        });

        // --- E. BANNER & PROMO PARALLAX ---
        const promoBanners = document.querySelectorAll('.banner, .promo-banner, .cta-banner');
        promoBanners.forEach(banner => {
            const bg = banner.querySelector('img, .banner-bg');
            if (bg) {
                gsap.fromTo(bg,
                    { scale: 1.15 },
                    {
                        scale: 1.0,
                        ease: "none",
                        scrollTrigger: {
                            trigger: banner,
                            start: "top bottom",
                            end: "bottom top",
                            scrub: true
                        }
                    }
                );
            }
        });

        // --- F. FOOTER ANIMATION ---
        const footer = document.querySelector('footer, .footer');
        if (footer) {
            const footerEls = footer.querySelectorAll('.foot-col, .foot-bottom, .copyright');
            if (footerEls.length > 0) {
                gsap.fromTo(footerEls,
                    { y: 30, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.7,
                        stagger: 0.1,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: footer,
                            start: "top 90%"
                        }
                    }
                );
            }
        }

        // Refresh ScrollTrigger after DOM layout calculations
        setTimeout(() => {
            ScrollTrigger.refresh();
        }, 200);
    }

    // 4. MODAL & OVERLAY SCROLL LOCK HANDLERS
    function setupModalScrollLock() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                    const target = mutation.target;
                    const isVisible = target.classList.contains('active') || 
                                      target.classList.contains('open') || 
                                      target.style.display === 'block' || 
                                      target.style.display === 'flex';
                    if (target.classList.contains('overlay') || 
                        target.classList.contains('drawer') || 
                        target.classList.contains('modal') || 
                        target.classList.contains('mobile-menu')) {
                        if (isVisible) {
                            if (window.stopLenis) window.stopLenis();
                        } else {
                            if (window.startLenis) window.startLenis();
                        }
                    }
                }
            });
        });

        document.querySelectorAll('.overlay, .drawer, .modal, .mobile-menu, .cart-drawer, #quickViewOverlay, #searchModal').forEach(el => {
            observer.observe(el, { attributes: true });
        });
    }

    // Initialize on DOM Ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initGSAPAnimations();
            setupModalScrollLock();
        });
    } else {
        initGSAPAnimations();
        setupModalScrollLock();
    }

    // Re-trigger GSAP refresh on window load for lazy assets
    window.addEventListener("load", () => {
        if (typeof ScrollTrigger !== "undefined") {
            ScrollTrigger.refresh();
        }
    });

})();
