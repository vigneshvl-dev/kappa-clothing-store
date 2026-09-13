"use strict";

// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const supabaseClient = window.supabase.createClient(
    'https://ugphxapfbzcrauchwlef.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGh4YXBmYnpjcmF1Y2h3bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDE2NjQsImV4cCI6MjA5OTE3NzY2NH0.C9NiffVu_8sqPrXgOwCcXG1ok6atJLTg1Qt8N1_Kd38'
);

// ==========================================
// 1b. AUTO SESSION REFRESH (Fixes JWT expired)
// ==========================================
// Listen for auth state changes to auto-refresh tokens
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
        console.log('Session token refreshed successfully.');
    }
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        window.location.replace('index.html');
    }
});

/**
 * Ensures the Supabase session is fresh before performing write operations.
 * If the session is expired or missing, it attempts to refresh it.
 * Returns the refreshed session or null if refresh fails.
 */
async function ensureFreshSession() {
    let { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Try to refresh
        const { data, error } = await supabaseClient.auth.refreshSession();
        if (error || !data.session) {
            alert('Your session has expired. Please log in again.');
            window.location.replace('index.html');
            return null;
        }
        session = data.session;
    } else {
        // Check if the token is about to expire (within 60 seconds)
        const expiresAt = session.expires_at; // Unix timestamp in seconds
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && (expiresAt - now) < 60) {
            const { data, error } = await supabaseClient.auth.refreshSession();
            if (error || !data.session) {
                alert('Your session has expired. Please log in again.');
                window.location.replace('index.html');
                return null;
            }
            session = data.session;
        }
    }
    return session;
}

function generateSlug(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

// Global variables initialized at top level to prevent TDZ errors
let pendingImageFiles = [];

// ==========================================
// 2. DOM INITIALIZATION
// ==========================================
function runAdminInit() {
    try { initSidebar(); } catch (e) { console.error('initSidebar error:', e); }
    try { verifyAdmin(); } catch (e) { console.error('verifyAdmin error:', e); }
    try { initProductForm(); } catch (e) { console.error('initProductForm error:', e); }
    try { loadParentCategories(); } catch (e) { console.error('loadParentCategories error:', e); }
    try { initImagePreview(); } catch (e) { console.error('initImagePreview error:', e); }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAdminInit);
} else {
    runAdminInit();
}

// ==========================================
// 3. SPA ROUTER: Sidebar Logic
// ==========================================
window.switchAdminView = async function (targetName) {
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('dynamic-page-title');

    sidebarItems.forEach(nav => {
        if (nav.getAttribute('data-target') === targetName) nav.classList.add('active');
        else nav.classList.remove('active');
    });

    viewSections.forEach(view => view.classList.remove('active-view'));

    const targetView = document.getElementById(`view-${targetName}`);
    if (targetView) {
        targetView.classList.add('active-view');
        if (pageTitle) {
            const titleMap = {
                dashboard: 'Dashboard',
                orders: 'Orders',
                cancelled: 'Cancelled Orders',
                inventory: 'Inventory',
                products: 'Add Product',
                customers: 'Customers',
                categories: 'Categories',
                reviews: 'Reviews',
                homepage: 'Homepage Media',
                explore: 'Explore Cards',
                promocodes: 'Promo Codes',
                settings: 'Settings'
            };
            pageTitle.textContent = titleMap[targetName] || (targetName.charAt(0).toUpperCase() + targetName.slice(1));
        }

        // Scroll main content pane to top on view change
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;

        try {
            switch (targetName) {
                case 'dashboard': if (typeof loadDashboard === 'function') await loadDashboard(); break;
                case 'orders': if (typeof loadOrders === 'function') await loadOrders(); break;
                case 'cancelled': if (typeof loadCancelledOrders === 'function') await loadCancelledOrders(); break;
                case 'inventory': if (typeof loadInventory === 'function') await loadInventory(); break;
                case 'categories': if (typeof loadCategoriesList === 'function') await loadCategoriesList(); break;
                case 'reviews': if (typeof loadReviews === 'function') await loadReviews(); break;
                case 'customers': if (typeof loadCustomers === 'function') await loadCustomers(); break;
                case 'settings': if (typeof loadSettings === 'function') await loadSettings(); break;
                case 'products': clearProductForm(); break;
                case 'homepage': if (typeof loadHomepageSettings === 'function') await loadHomepageSettings(); break;
                case 'explore': if (typeof loadExploreCardsAdmin === 'function') await loadExploreCardsAdmin(); break;
                case 'promocodes': if (typeof loadPromoCodes === 'function') await loadPromoCodes(); break;
            }
        } catch (err) {
            console.error('Error loading view:', targetName, err);
        }
    }
};

function initSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetName = item.getAttribute('data-target');
            if (targetName) window.switchAdminView(targetName);
        });
    });
}

function clearProductForm() {
    const form = document.getElementById('add-product-form');
    if (!form) return;
    form.reset();
    document.getElementById('editing-product-id').value = '';
    document.getElementById('btn-submit-product').textContent = "Publish Product to Storefront";
    document.getElementById('stock-table-container').innerHTML = '';
    document.getElementById('prod-images').setAttribute('required', 'true');
    document.getElementById('existing-images-preview').innerHTML = '';
    document.getElementById('new-images-preview').innerHTML = '';

    pendingImageFiles = [];
}

// ==========================================
// 4. TRUE DATABASE SECURITY BOUNCER
// ==========================================
async function verifyAdmin() {
    const session = await ensureFreshSession();
    if (!session) { window.location.replace('index.html'); return; }

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        alert("Access Denied: Admin privileges required.");
        window.location.replace('index.html');
        return;
    }

    const adminName = document.getElementById('admin-name');
    const adminAvatar = document.getElementById('admin-avatar');
    if (adminName) adminName.textContent = profile.full_name || 'Admin User';
    if (adminAvatar && profile.full_name) adminAvatar.textContent = profile.full_name.charAt(0).toUpperCase();

    // Load dashboard stats on verify success
    await loadDashboard();
    updateSidebarOrderBadges();

    loadCategories();
}

// ==========================================
// 5. DATA LOADERS
// ==========================================
async function loadCategories() {
    const categorySelect = document.getElementById('prod-category');
    if (!categorySelect) return;

    const { data: categories, error } = await supabaseClient.from('categories').select('id, name, parent_id');
    if (error || !categories) return;

    categorySelect.innerHTML = `<option value="" disabled selected>Select Category</option>`;

    // Only show SUB-CATEGORIES (children with a parent_id) — not root parents like Men/Women
    const roots = categories.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
    const children = categories.filter(c => c.parent_id);

    roots.forEach(root => {
        const group = document.createElement('optgroup');
        group.label = root.name;

        // Allow selecting the main category itself
        const rootOption = document.createElement('option');
        rootOption.value = root.id;
        rootOption.textContent = `${root.name} (Main Category)`;
        group.appendChild(rootOption);

        const myChildren = children
            .filter(c => c.parent_id === root.id)
            .sort((a, b) => a.name.localeCompare(b.name));

        myChildren.forEach(child => {
            const childOption = document.createElement('option');
            childOption.value = child.id;
            childOption.textContent = child.name;
            group.appendChild(childOption);
        });
        categorySelect.appendChild(group);
    });
}

async function loadParentCategories() {
    const select = document.getElementById('parent-cat-select');
    if (!select) return;

    const { data, error } = await supabaseClient.from('categories').select('*').order('name', { ascending: true });
    if (error || !data) return;

    let html = '<option value="">No Parent (Root)</option>';
    const roots = data.filter(c => !c.parent_id);
    const children = data.filter(c => c.parent_id);

    roots.forEach(root => {
        html += `<option value="${root.id}" style="font-weight: bold;">${root.name}</option>`;
        const myChildren = children.filter(c => c.parent_id === root.id);
        myChildren.forEach(child => {
            html += `<option value="${child.id}">&nbsp;&nbsp;&nbsp;↳ ${child.name}</option>`;
        });
    });

    select.innerHTML = html;
}

// Track the currently selected category for "Add Product Here"
let _selectedCategoryId = null;
let _selectedCategoryIsRoot = false;

async function loadCategoriesList() {
    const container = document.getElementById('categories-list-container');
    if (!container) return;

    const { data, error } = await supabaseClient.from('categories').select('*');
    if (error) { container.innerHTML = '<p style="color:red;">Error loading categories.</p>'; return; }

    const roots = data.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
    const children = data.filter(c => c.parent_id);

    let html = '';
    roots.forEach(root => {
        const myChildren = children
            .filter(c => c.parent_id === root.id)
            .sort((a, b) => a.name.localeCompare(b.name));

        // Root row — clicking shows ALL products under this root
        html += `
        <div style="margin-bottom:6px;">
            <div class="cat-tree-row cat-tree-root" onclick="loadCategoryProducts('${root.id}', true, '${root.name.replace(/'/g, "\\'")}')"
                 style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:10px; background:#f7f7f7; cursor:pointer; transition:background 0.18s; border:1.5px solid transparent;"
                 onmouseover="this.style.background='#fffbea'; this.style.borderColor='#FFD700';"
                 onmouseout="this.style.background='#f7f7f7'; this.style.borderColor='transparent';">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:18px;">📁</span>
                    <strong style="font-size:14px;">${root.name}</strong>
                    <span style="font-size:11px; color:#999; font-style:italic;">General</span>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <span style="font-size:11px; color:#aaa;">${myChildren.length} sub-cats</span>
                    <button class="btn-delete" style="padding:3px 8px; font-size:11px;" onclick="event.stopPropagation(); deleteCategory('${root.id}')">✕</button>
                </div>
            </div>`;

        // Sub-category rows — clicking shows only that sub-cat's products + Add button
        myChildren.forEach(child => {
            html += `
            <div class="cat-tree-row cat-tree-child" onclick="loadCategoryProducts('${child.id}', false, '${child.name.replace(/'/g, "\\'")}')"
                 style="display:flex; align-items:center; justify-content:space-between; padding:8px 14px 8px 36px; border-radius:8px; cursor:pointer; transition:background 0.15s; border:1.5px solid transparent; margin-top:3px;"
                 onmouseover="this.style.background='#f0f9ff'; this.style.borderColor='#93c5fd';"
                 onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#aaa; font-size:13px;">↳</span>
                    <span style="font-size:13px; font-weight:600;">${child.name}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-delete" style="padding:3px 8px; font-size:11px;" onclick="event.stopPropagation(); deleteCategory('${child.id}')">✕</button>
                </div>
            </div>`;
        });

        html += `</div>`;
    });

    if (!html) html = '<p style="color:#aaa; text-align:center; padding:20px;">No categories yet.</p>';
    container.innerHTML = html;
}

// Load products for a given category and show them in the right panel
window.loadCategoryProducts = async function (categoryId, isRoot, categoryName) {
    _selectedCategoryId = categoryId;
    _selectedCategoryIsRoot = isRoot;

    // Highlight the clicked row in the tree
    document.querySelectorAll('.cat-tree-row').forEach(el => el.classList.remove('active-cat'));
    document.querySelectorAll('.cat-tree-row').forEach(el => {
        const onclickAttr = el.getAttribute('onclick') || '';
        if (onclickAttr.includes(`'${categoryId}'`)) el.classList.add('active-cat');
    });

    const panel = document.getElementById('cat-products-panel');
    const title = document.getElementById('cat-products-title');
    const subtitle = document.getElementById('cat-products-subtitle');
    const listEl = document.getElementById('cat-products-list');
    const addBtn = document.getElementById('cat-add-product-btn');

    if (!panel) return;

    panel.style.display = 'block';
    title.textContent = categoryName;
    subtitle.textContent = isRoot ? 'Showing all products in this category and sub-categories' : 'Products in this sub-category';
    addBtn.style.display = 'inline-flex';
    listEl.innerHTML = '<p style="color:#aaa;">Loading...</p>';

    // Scroll panel into view
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // If root: get all children category IDs too (recursively)
    let categoryIds = [categoryId];
    if (isRoot) {
        const { data: cats } = await supabaseClient.from('categories').select('id, parent_id');
        if (cats) {
            const getDescendantIds = (cId) => {
                let ids = [cId];
                cats.forEach(c => {
                    if (c.parent_id === cId) {
                        ids = ids.concat(getDescendantIds(c.id));
                    }
                });
                return ids;
            };
            categoryIds = Array.from(new Set(getDescendantIds(categoryId)));
        }
    }

    // Fetch products for these category IDs
    const { data: products, error } = await supabaseClient
        .from('products')
        .select('id, name, price, slug, is_active, product_images(id, url, position)')
        .in('category_id', categoryIds)
        .order('created_at', { ascending: false });

    if (error) { listEl.innerHTML = '<p style="color:red;">Error loading products.</p>'; return; }
    if (!products || products.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#aaa;">
                <div style="font-size:40px; margin-bottom:12px;">📦</div>
                <p style="font-size:14px;">No products yet in <strong style="color:#111;">${categoryName}</strong></p>
                ${!isRoot ? '<p style="font-size:12px; margin-top:6px;">Click "+ Add Product Here" to get started.</p>' : ''}
            </div>`;
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
    products.forEach(prod => {
        const sortedImgs = (prod.product_images || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
        const coverImg = sortedImgs.length > 0 ? sortedImgs[0].url.split('#')[0] : '';
        const imgHtml = coverImg
            ? `<img src="${coverImg}" style="width:54px; height:64px; object-fit:cover; border-radius:8px; border:1px solid #eee; flex-shrink:0;">`
            : `<div style="width:54px; height:64px; background:#f0f0f0; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:20px;">🖼️</div>`;

        // Thumbnail strip (remaining images)
        let thumbStrip = '';
        if (sortedImgs.length > 1) {
            thumbStrip = `<div style="display:flex; gap:4px; margin-top:4px;">`;
            sortedImgs.slice(1, 5).forEach(img => {
                const cleanUrl = img.url.split('#')[0];
                thumbStrip += `<img src="${cleanUrl}" style="width:28px; height:34px; object-fit:cover; border-radius:4px; border:1px solid #eee;">`;
            });
            if (sortedImgs.length > 5) thumbStrip += `<span style="font-size:10px; color:#aaa; align-self:center;">+${sortedImgs.length - 5}</span>`;
            thumbStrip += `</div>`;
        }

        const statusBadge = prod.is_active
            ? `<span style="background:#e8f8f0; color:#1e7e44; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700;">ACTIVE</span>`
            : `<span style="background:#fff0f0; color:#c0392b; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700;">HIDDEN</span>`;

        html += `
        <div style="display:flex; align-items:flex-start; gap:14px; padding:12px 14px; background:#fafafa; border:1px solid #f0f0f0; border-radius:12px; transition:border-color 0.2s;"
             onmouseover="this.style.borderColor='#e0e0e0'" onmouseout="this.style.borderColor='#f0f0f0'">
            <div style="flex-shrink:0;">
                ${imgHtml}
                ${thumbStrip}
            </div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                    <strong style="font-size:14px; color:#111;">${prod.name}</strong>
                    ${statusBadge}
                </div>
                <div style="font-size:13px; color:#555; font-weight:600;">₹${prod.price}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
                <button class="btn-secondary" style="padding:5px 14px; font-size:12px; height:auto;" onclick="editProduct('${prod.id}')">
                    ✏️ Edit
                </button>
                <button class="btn-delete" style="padding:5px 12px; font-size:12px;" onclick="deleteProduct('${prod.id}')">
                    🗑️ Delete
                </button>
            </div>
        </div>`;
    });
    html += `</div>`;
    listEl.innerHTML = html;
};

// Navigate to Add Product form with this sub-category pre-selected
window.addProductInCategory = function () {
    if (!_selectedCategoryId) return;

    // Navigate to products view
    document.querySelectorAll('.sidebar-menu li').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active-view'));
    const prodNav = document.querySelector('.sidebar-menu li[data-target="products"]');
    if (prodNav) prodNav.classList.add('active');
    const prodView = document.getElementById('view-products');
    if (prodView) prodView.classList.add('active-view');
    document.getElementById('dynamic-page-title').textContent = 'Add Product';

    clearProductForm();

    // Pre-select the category
    setTimeout(() => {
        const select = document.getElementById('prod-category');
        if (select) {
            select.value = _selectedCategoryId;
            // If not found as a direct option, try to find it
            if (!select.value) {
                for (let opt of select.options) {
                    if (opt.value === _selectedCategoryId) { opt.selected = true; break; }
                }
            }
        }
    }, 100);

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.addCategory = async function () {
    const session = await ensureFreshSession();
    if (!session) return;

    const nameInput = document.getElementById('new-cat-name');
    const parentSelect = document.getElementById('parent-cat-select');
    const name = nameInput.value.trim();
    const parent_id = parentSelect.value || null;

    if (!name) return alert('Please enter a category name');

    // Generate slug using parent category name if selected to differentiate e.g. men-t-shirts vs women-t-shirts
    let baseSlug = generateSlug(name);
    if (!baseSlug) baseSlug = 'category';

    if (parent_id && parentSelect) {
        const selectedOpt = parentSelect.options[parentSelect.selectedIndex];
        if (selectedOpt && selectedOpt.textContent) {
            const parentName = selectedOpt.textContent.replace(/^[\s↳]+/, '').trim();
            if (parentName) {
                baseSlug = generateSlug(`${parentName}-${name}`);
            }
        }
    }

    let slug = baseSlug;

    // Check existing categories to ensure slug uniqueness
    try {
        const { data: existingCats } = await supabaseClient.from('categories').select('slug');
        if (existingCats && existingCats.length > 0) {
            const existingSlugs = new Set(existingCats.map(c => c.slug));
            let count = 1;
            while (existingSlugs.has(slug)) {
                slug = `${baseSlug}-${count}`;
                count++;
            }
        }
    } catch (e) {
        console.warn('Slug check error:', e);
    }

    // Try primary insert
    let { error } = await supabaseClient.from('categories').insert([{ name, slug, parent_id }]);

    // Fail-safe: If duplicate key constraint occurs on categories_slug_key, retry with guaranteed unique timestamp suffix
    if (error && error.message && error.message.includes('categories_slug_key')) {
        const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
        const retry = await supabaseClient.from('categories').insert([{ name, slug: uniqueSlug, parent_id }]);
        error = retry.error;
    }

    if (error) {
        alert('Error adding category: ' + error.message);
    } else {
        nameInput.value = '';
        await Promise.all([loadCategoriesList(), loadParentCategories(), loadCategories()]);
        // If there was a selected category open, refresh it
        if (_selectedCategoryId) {
            const panel = document.getElementById('cat-products-panel');
            if (panel && panel.style.display !== 'none') {
                const title = document.getElementById('cat-products-title');
                loadCategoryProducts(_selectedCategoryId, _selectedCategoryIsRoot, title ? title.textContent : '');
            }
        }
    }
};

window.deleteCategory = async function (id) {
    if (!confirm('Are you sure you want to delete this category? Products inside it will become uncategorized.')) return;
    const session = await ensureFreshSession();
    if (!session) return;

    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if (error) alert('Error deleting: ' + error.message);
    else {
        // If the deleted category was selected, hide the panel
        if (_selectedCategoryId === id) {
            _selectedCategoryId = null;
            const panel = document.getElementById('cat-products-panel');
            if (panel) panel.style.display = 'none';
        }
        loadCategoriesList(); loadCategories(); loadParentCategories();
    }
};

// ==========================================
// ORDER MANAGEMENT — CONSTANTS & HELPERS
// ==========================================
const ORDER_STAGES = ['incoming', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
const EXCEPTION_STAGES = ['cancelled', 'return_requested', 'returned', 'refunded'];

const STAGE_LABELS = {
    incoming: '🟡 Incoming',
    confirmed: '🔵 Confirmed',
    processing: '🟣 Processing',
    packed: '🟠 Packed',
    shipped: '🚚 Shipped',
    out_for_delivery: '🛵 Out for Delivery',
    delivered: '🟢 Delivered',
    cancelled: '🔴 Cancelled',
    return_requested: '↩️ Return Requested',
    returned: '📦 Returned',
    refunded: '💰 Refunded'
};

const STAGE_SHORT = {
    incoming: 'Incoming',
    confirmed: 'Confirmed',
    processing: 'Processing',
    packed: 'Packed',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    return_requested: 'Return Req.',
    returned: 'Returned',
    refunded: 'Refunded'
};

const DELIVERY_STATUS_LABELS = {
    not_shipped: 'Not Shipped',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered'
};

function getStageBadgeHtml(stage) {
    const cls = 'stage-' + (stage || 'incoming');
    const label = STAGE_SHORT[stage] || stage || 'Incoming';
    return `<span class="stage-badge ${cls}">${label}</span>`;
}

function getDeliveryChipHtml(deliveryDetails) {
    const ds = deliveryDetails?.delivery_status || 'not_shipped';
    const label = DELIVERY_STATUS_LABELS[ds] || 'Not Shipped';
    const cls = ds !== 'not_shipped' ? ds : '';
    return `<span class="delivery-chip ${cls}">${label}</span>`;
}

function getEtaHtml(deliveryDetails, createdAt) {
    if (deliveryDetails?.expected_delivery) {
        const d = new Date(deliveryDetails.expected_delivery);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<span class="eta-badge">📅 ${label}</span>`;
    }
    if (deliveryDetails?.eta_days) {
        return `<span class="eta-badge">⏱ ${deliveryDetails.eta_days}</span>`;
    }
    // default 2-4 days estimate from order date
    if (createdAt) {
        const base = new Date(createdAt);
        const from = new Date(base); from.setDate(from.getDate() + 2);
        const to = new Date(base); to.setDate(to.getDate() + 4);
        const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<span class="eta-badge" style="opacity:0.65">~${fmt(from)}–${fmt(to)}</span>`;
    }
    return '';
}

// Store fetched orders globally for filter/search
let _allFetchedOrders = [];
let _activeOrderFilter = 'all';

async function loadOrders() {
    const container = document.querySelector('#view-orders .card');

    const { data, error } = await supabaseClient
        .from('orders')
        .select(`
            *,
            order_items (
                quantity,
                price_at_purchase,
                size,
                color,
                image_url,
                products ( name, product_images ( url ) )
            )
        `)
        .order('created_at', { ascending: false });

    const paidOrders = (data || []).filter(order => {
        const currentStatus = (order.status || 'pending').toLowerCase();
        return currentStatus === 'paid' || currentStatus.includes('cancel') || currentStatus.includes('refund') || !!order.razorpay_payment_id;
    });

    _allFetchedOrders = paidOrders;
    const recycled = getRecycledOrders();
    renderOrdersView(paidOrders, recycled, _activeOrderFilter, '');
}

function renderOrdersView(orders, recycled, filterStage, searchQuery) {
    const container = document.querySelector('#view-orders .card');
    if (!container) return;

    // Compute stat counts
    const counts = {
        all: orders.length,
        incoming: orders.filter(o => !o.order_stage || o.order_stage === 'incoming').length,
        processing: orders.filter(o => o.order_stage === 'processing').length,
        packed: orders.filter(o => o.order_stage === 'packed').length,
        shipped: orders.filter(o => o.order_stage === 'shipped').length,
        out_for_delivery: orders.filter(o => o.order_stage === 'out_for_delivery').length,
        delivered: orders.filter(o => o.order_stage === 'delivered').length,
        cancelled: orders.filter(o => (o.status || '').toLowerCase().includes('cancel') || o.order_stage === 'cancelled').length,
    };

    // Summary cards
    let statsHtml = `
        <div class="order-stat-cards">
            <div class="order-stat-card ${filterStage === 'all' ? 'active-stat' : ''}" onclick="filterOrders('all')">
                <div class="stat-icon">📦</div>
                <div class="stat-label">Total Orders</div>
                <div class="stat-num">${counts.all}</div>
            </div>
            <div class="order-stat-card ${filterStage === 'incoming' ? 'active-stat' : ''}" onclick="filterOrders('incoming')">
                <div class="stat-icon">🟡</div>
                <div class="stat-label">Incoming</div>
                <div class="stat-num">${counts.incoming}</div>
            </div>
            <div class="order-stat-card ${filterStage === 'processing' ? 'active-stat' : ''}" onclick="filterOrders('processing')">
                <div class="stat-icon">🟣</div>
                <div class="stat-label">Processing</div>
                <div class="stat-num">${counts.processing}</div>
            </div>
            <div class="order-stat-card ${filterStage === 'out_for_delivery' ? 'active-stat' : ''}" onclick="filterOrders('out_for_delivery')">
                <div class="stat-icon">🛵</div>
                <div class="stat-label">Out for Del.</div>
                <div class="stat-num">${counts.out_for_delivery}</div>
            </div>
            <div class="order-stat-card ${filterStage === 'delivered' ? 'active-stat' : ''}" onclick="filterOrders('delivered')">
                <div class="stat-icon">🟢</div>
                <div class="stat-label">Delivered</div>
                <div class="stat-num">${counts.delivered}</div>
            </div>
            <div class="order-stat-card ${filterStage === 'cancelled' ? 'active-stat' : ''}" onclick="filterOrders('cancelled')">
                <div class="stat-icon">🔴</div>
                <div class="stat-label">Cancelled</div>
                <div class="stat-num">${counts.cancelled}</div>
            </div>
        </div>`;

    // Header + recycle bin button
    let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
            <h2 style="margin:0; font-size:20px; font-weight:800;">Orders</h2>
            <div style="display:flex; gap:10px;">
                <button class="btn-secondary" onclick="loadOrders()" style="padding:8px 16px; font-weight:700; background:#000; color:#fff; border-radius:8px; cursor:pointer;">
                    📦 Active Orders (${orders.length})
                </button>
                <button class="btn-secondary" onclick="renderRecycleBinView()" style="padding:8px 16px; font-weight:700; background:#f0f0f0; color:#333; border:1px solid #ddd; border-radius:8px; cursor:pointer;">
                    🗑️ Recycle Bin (${recycled.length})
                </button>
            </div>
        </div>`;

    // Filter tabs
    const allTabs = ['all', 'incoming', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    const tabLabels = { all: 'All', incoming: 'Incoming', confirmed: 'Confirmed', processing: 'Processing', packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
    let tabsHtml = `<div class="order-filter-tabs">`;
    allTabs.forEach(t => {
        tabsHtml += `<button class="order-filter-tab ${filterStage === t ? 'active-tab' : ''}" onclick="filterOrders('${t}')">${tabLabels[t]}</button>`;
    });
    tabsHtml += `</div>`;

    // Search bar
    let searchHtml = `
        <div class="order-search-bar">
            <input class="order-search-input" id="order-search-input" type="text" placeholder="🔍 Search by Order ID, Customer Name or Phone..." value="${searchQuery || ''}" oninput="searchOrders(this.value)">
        </div>`;

    // Apply filter + search
    let filtered = [...orders];
    if (filterStage && filterStage !== 'all') {
        if (filterStage === 'incoming') {
            filtered = filtered.filter(o => !o.order_stage || o.order_stage === 'incoming');
        } else if (filterStage === 'cancelled') {
            filtered = filtered.filter(o => (o.status || '').toLowerCase().includes('cancel') || o.order_stage === 'cancelled');
        } else {
            filtered = filtered.filter(o => o.order_stage === filterStage);
        }
    }
    if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(o => {
            const cust = o.customer_details || {};
            const idStr = (o.id || '').toString().toLowerCase();
            const name = (cust.name || '').toLowerCase();
            const phone = (cust.phone || '').replace(/\D/g, '');
            return idStr.includes(q) || name.includes(q) || phone.includes(q.replace(/\D/g, ''));
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = statsHtml + headerHtml + tabsHtml + searchHtml +
            `<div style="text-align:center; padding:50px 20px; color:#888;">
                <div style="font-size:40px; margin-bottom:12px;">🔍</div>
                <p style="font-size:15px;">No orders found for this filter.</p>
            </div>`;
        return;
    }

    // Build table
    let tableHtml = `
        <div style="overflow-x:auto;">
        <table class="stock-table" style="min-width:900px;">
            <thead>
                <tr>
                    <th style="white-space:nowrap;">Date</th>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Order Status</th>
                    <th>Delivery</th>
                    <th>ETA</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

    filtered.forEach(order => {
        const dateObj = new Date(order.created_at);
        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
            dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const currentStatus = (order.status || 'pending').toLowerCase();
        const paymentStatus = (order.payment_status || 'pending').toLowerCase();
        const isPaid = paymentStatus === 'paid' || currentStatus === 'paid' || !!order.razorpay_payment_id;
        const isCancelled = currentStatus.includes('cancel') || order.order_stage === 'cancelled';
        const refundInfo = order.refund_details || order.customer_details?.refund_details || null;
        const isSettled = refundInfo?.refund_status === 'refunded' || currentStatus === 'refunded';
        const cust = order.customer_details || {};
        const customerName = cust.name || cust.full_name || (order.user_id ? 'Registered' : 'Guest');
        const deliveryDetails = order.delivery_details || {};
        const orderStage = order.order_stage || (isCancelled ? 'cancelled' : 'incoming');
        const isRepayPending = isCancelled && !isSettled;

        // Payment badge
        let payBadge = '';
        if (isCancelled) {
            payBadge = isSettled
                ? `<span class="badge status-paid" style="font-size:10px; padding:3px 7px;">REFUNDED</span>`
                : `<span class="badge status-cancelled" style="font-size:10px; padding:3px 7px;">CANCELLED</span>
                   <div style="font-size:10px; color:#c0392b; font-weight:700; margin-top:2px;">⚠️ Repay ₹${order.total_amount}</div>`;
        } else if (isPaid) {
            payBadge = `<span class="badge status-paid" style="font-size:10px; padding:3px 7px;">PAID</span>`;
        } else {
            payBadge = `<span class="badge status-pending" style="font-size:10px; padding:3px 7px;">PENDING</span>`;
        }

        tableHtml += `<tr>
            <td style="white-space:nowrap; font-size:12px;"><small>${formattedDate}</small></td>
            <td><strong style="font-family:monospace; font-size:13px;">#${order.id.toString().substring(0, 8).toUpperCase()}</strong></td>
            <td>
                <div style="font-weight:600; font-size:13px; color:#111;">${customerName}</div>
                ${cust.phone ? `<div style="font-size:11px; color:#888;">${cust.phone}</div>` : ''}
            </td>
            <td><strong style="font-size:14px;">₹${order.total_amount}</strong></td>
            <td>${payBadge}</td>
            <td>${getStageBadgeHtml(orderStage)}</td>
            <td>${getDeliveryChipHtml(deliveryDetails)}</td>
            <td>${getEtaHtml(deliveryDetails, order.created_at)}</td>
            <td>
                <button class="btn-black" onclick="showOrderDetails('${order.id}')" style="${isRepayPending ? 'background:#c0392b; color:#fff;' : ''}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    ${isRepayPending ? 'View & Repay' : 'View Details'}
                </button>
                <button class="btn-black" onclick="deleteOrder('${order.id}')" style="background:#c0392b; margin-top:4px; width:100%;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path></svg>
                    Delete
                </button>
            </td>
        </tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = statsHtml + headerHtml + tabsHtml + searchHtml + tableHtml;
}

// Filter tabs handler
window.filterOrders = function(stage) {
    _activeOrderFilter = stage;
    const searchVal = document.getElementById('order-search-input')?.value || '';
    renderOrdersView(_allFetchedOrders, getRecycledOrders(), stage, searchVal);
};

// Search handler
window.searchOrders = function(query) {
    renderOrdersView(_allFetchedOrders, getRecycledOrders(), _activeOrderFilter, query);
};




window.updateOrderStatus = async function (orderId, newStatus) {
    try {
        console.log(`Updating order ${orderId} status in Supabase to: ${newStatus}`);
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) {
            console.error("Error updating order status:", error);
            alert("Error updating status: " + error.message);
        } else {
            console.log("Order status updated successfully in Supabase!");
            await loadOrders();
        }
    } catch (err) {
        console.error("Failed to update status:", err);
        alert("Failed to update status: " + err.message);
    }
};

// ==========================================
// RECYCLE BIN STORAGE & RESTORE LOGIC
// ==========================================
const RECYCLE_BIN_KEY = 'kappa_recycled_orders_v1';

function getRecycledOrders() {
    try {
        return JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]');
    } catch (_) {
        return [];
    }
}

function saveRecycledOrders(list) {
    try {
        localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(list));
    } catch (_) { }
}

window.renderRecycleBinView = function () {
    const container = document.querySelector('#view-orders .card') || document.getElementById('view-orders');
    if (!container) return;

    const recycled = getRecycledOrders();

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <h2 style="margin:0;">Orders</h2>
            <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn-secondary" onclick="loadOrders()" style="padding:8px 16px; font-weight:700; background:#f0f0f0; color:#333; border:1px solid #ddd; border-radius:8px; cursor:pointer;">
                    📦 Active Orders
                </button>
                <button class="btn-secondary" onclick="renderRecycleBinView()" style="padding:8px 16px; font-weight:700; background:#000; color:#fff; border-radius:8px; cursor:pointer;">
                    🗑️ Recycle Bin (${recycled.length})
                </button>
                ${recycled.length > 0 ? `
                    <button class="btn-delete" onclick="emptyRecycleBin()" style="padding:8px 14px; font-weight:700; border-radius:8px; cursor:pointer;">
                        🧹 Empty Bin
                    </button>
                ` : ''}
            </div>
        </div>`;

    if (recycled.length === 0) {
        html += `
            <div style="text-align:center; padding:50px 20px; color:#888;">
                <div style="font-size:48px; margin-bottom:12px;">🗑️</div>
                <h3 style="color:#333; margin-bottom:6px;">Recycle Bin is Empty</h3>
                <p style="font-size:13px;">When you delete an order, it will be stored here temporarily so you can restore it if needed.</p>
            </div>`;
        container.innerHTML = html;
        return;
    }

    html += `
        <table class="stock-table">
            <thead>
                <tr>
                    <th>Deleted Date</th>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>`;

    recycled.forEach(order => {
        const deletedDate = order.deletedAt ? new Date(order.deletedAt).toLocaleString() : 'N/A';
        const itemsCount = (order.order_items || []).length;
        const customerName = order.customer_details?.full_name || order.shipping_address?.full_name || (order.user_id ? "Registered Customer" : "Guest");

        html += `
            <tr>
                <td style="white-space:nowrap;"><small>${deletedDate}</small></td>
                <td><strong>#${(order.id || '').toString().substring(0, 8)}</strong></td>
                <td>${customerName}</td>
                <td><span class="item-tag tag-qty">${itemsCount} item(s)</span></td>
                <td><strong>₹${order.total_amount || 0}</strong></td>
                <td>
                    <div style="display:flex; gap:6px; flex-direction:column;">
                        <button class="btn-secondary" onclick="restoreOrder('${order.id}')" style="background:#27ae60; color:#fff; border:none; padding:6px 12px; font-weight:700; border-radius:6px; cursor:pointer;">
                            ♻️ Restore Order
                        </button>
                        <button class="btn-delete" onclick="permanentlyDeleteRecycledOrder('${order.id}')" style="padding:6px 12px; font-size:11px;">
                            ❌ Delete Permanently
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
};

window.restoreOrder = async function (orderId) {
    const recycled = getRecycledOrders();
    const target = recycled.find(o => String(o.id) === String(orderId));
    if (!target) return alert("Order not found in Recycle Bin.");

    if (!confirm(`♻️ Restore order #${(target.id || '').toString().substring(0, 8)} back to active orders?`)) return;

    try {
        const orderPayload = {
            id: target.id,
            user_id: target.user_id || null,
            status: target.status || 'pending',
            total_amount: target.total_amount || 0,
            customer_details: target.customer_details || null,
            shipping_address: target.shipping_address || null,
            payment_status: target.payment_status || 'pending',
            razorpay_payment_id: target.razorpay_payment_id || null,
            created_at: target.created_at || new Date().toISOString()
        };

        const { error: orderError } = await supabaseClient.from('orders').upsert([orderPayload]);
        if (orderError) throw new Error("Orders restore error: " + orderError.message);

        if (target.order_items && target.order_items.length > 0) {
            const itemsPayload = target.order_items.map(item => ({
                order_id: target.id,
                product_id: item.product_id || null,
                quantity: item.quantity || 1,
                price_at_purchase: item.price_at_purchase || 0,
                size: item.size || null,
                color: item.color || null,
                image_url: item.image_url || null
            }));
            const { error: itemsError } = await supabaseClient.from('order_items').insert(itemsPayload);
            if (itemsError) console.warn("Items restore note:", itemsError.message);
        }

        const updatedBin = recycled.filter(o => String(o.id) !== String(orderId));
        saveRecycledOrders(updatedBin);

        alert(`✅ Order #${(target.id || '').toString().substring(0, 8)} restored successfully!`);
        await loadOrders();
    } catch (err) {
        console.error("Restore failed:", err);
        alert("❌ Failed to restore order: " + err.message);
    }
};

window.permanentlyDeleteRecycledOrder = function (orderId) {
    if (!confirm("⚠️ Permanently remove this order from Recycle Bin? This cannot be undone.")) return;
    const recycled = getRecycledOrders();
    const updated = recycled.filter(o => String(o.id) !== String(orderId));
    saveRecycledOrders(updated);
    renderRecycleBinView();
};

window.emptyRecycleBin = function () {
    if (!confirm("⚠️ Are you sure you want to empty the Recycle Bin? All deleted orders will be permanently removed.")) return;
    saveRecycledOrders([]);
    renderRecycleBinView();
};

window.deleteOrder = async function (orderId) {
    if (!confirm(`⚠️ Move order #${orderId.toString().substring(0, 8)} to Recycle Bin? You can restore it anytime.`)) return;

    try {
        // Fetch full order data before deleting so it can be restored from Recycle Bin
        const { data: fullOrder } = await supabaseClient
            .from('orders')
            .select(`
                *,
                order_items (*)
            `)
            .eq('id', orderId)
            .single();

        if (fullOrder) {
            const recycled = getRecycledOrders();
            fullOrder.deletedAt = new Date().toISOString();
            const filtered = recycled.filter(o => String(o.id) !== String(orderId));
            filtered.unshift(fullOrder);
            saveRecycledOrders(filtered);
        }

        // Step 1: Try deleting client-side first
        const { data: itemsDeleted, error: itemsError } = await supabaseClient
            .from('order_items')
            .delete()
            .eq('order_id', orderId)
            .select();

        const { data: orderDeleted, error: orderError } = await supabaseClient
            .from('orders')
            .delete()
            .eq('id', orderId)
            .select();

        if (!orderError && orderDeleted && orderDeleted.length > 0) {
            alert('🗑️ Order moved to Recycle Bin! You can restore it anytime from the top of Orders.');
            await loadOrders();
            return;
        }

        // Fallback to backend server API delete
        console.log("Client-side delete restricted by RLS or not found. Retrying via secure backend API...");
        const apiOrigin = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000'
            ? 'http://localhost:3000'
            : '';

        const res = await fetch(`${apiOrigin}/api/delete-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
        });

        if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            alert("❌ Error deleting order: " + (result.error || "Permission Denied"));
        } else {
            alert('🗑️ Order moved to Recycle Bin! You can restore it anytime.');
            await loadOrders();
        }
    } catch (err) {
        console.error("Failed to delete order:", err);
        alert("❌ Failed to delete order: " + err.message);
    }
};

async function loadReviews() {
    const container = document.querySelector('#view-reviews .card');
    const { data } = await supabaseClient.from('reviews').select(`id, rating, comment, products(name)`);
    let html = `<h2>Customer Reviews</h2>`;
    if (!data || data.length === 0) { html += `<p>No reviews yet.</p>`; }
    else {
        data.forEach(r => html += `
            <div class="review-card" style="padding:15px; border: 1px solid #eee; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>${r.products?.name || 'Product'}</strong> <span>${r.rating} Stars</span>
                </div>
                <p style="font-style: italic;">"${r.comment}"</p>
                <button class="btn-delete" onclick="deleteReview('${r.id}')" style="margin-top:10px;">Delete</button>
            </div>`);
    }
    container.innerHTML = html;
}

window.deleteReview = async function (reviewId) {
    if (!confirm("Are you sure you want to delete this review?")) return;
    const { error } = await supabaseClient.from('reviews').delete().eq('id', reviewId);
    if (error) alert("Error deleting review: " + error.message);
    else { alert("Review deleted successfully!"); loadReviews(); }
}

async function loadCustomers() {
    const container = document.querySelector('#view-customers .card');
    if (!container) return;

    container.innerHTML = '<h2>Registered Customers</h2><p style="color:#666;">Loading customer profiles...</p>';

    const { data: profiles, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<h2>Registered Customers</h2><p style="color:red;">Error loading customers: ${error.message}</p>`;
        return;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0;">Registered Customers</h2>
            <span style="background:#FFD700; color:#111; padding:6px 14px; border-radius:20px; font-weight:bold; font-size:13px;">Total: ${profiles ? profiles.length : 0} Users</span>
        </div>
        <div style="overflow-x:auto;">
            <table class="stock-table" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8f9fa; text-align:left; border-bottom:2px solid #eee;">
                        <th style="padding:12px 16px;">Customer Name</th>
                        <th style="padding:12px 16px;">Phone</th>
                        <th style="padding:12px 16px;">Role</th>
                        <th style="padding:12px 16px;">Joined Date</th>
                        <th style="padding:12px 16px;">User ID</th>
                    </tr>
                </thead>
                <tbody>`;

    if (!profiles || profiles.length === 0) {
        html += `<tr><td colspan="5" style="padding:24px; text-align:center; color:#888;">No registered customers found in database.</td></tr>`;
    } else {
        profiles.forEach(u => {
            const joinedDate = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const roleBadge = u.role === 'admin'
                ? `<span style="background:#e74c3c; color:white; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:bold; text-transform:uppercase;">ADMIN</span>`
                : `<span style="background:#2ecc71; color:white; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:bold; text-transform:uppercase;">CUSTOMER</span>`;

            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:12px 16px; font-weight:600; color:#111;">${u.full_name || 'N/A'}</td>
                    <td style="padding:12px 16px; color:#555;">${u.phone || 'N/A'}</td>
                    <td style="padding:12px 16px;">${roleBadge}</td>
                    <td style="padding:12px 16px; color:#666; font-size:13px;">${joinedDate}</td>
                    <td style="padding:12px 16px; font-family:monospace; font-size:11px; color:#888;">${u.id || 'N/A'}</td>
                </tr>`;
        });
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

async function loadSettings() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', session.user.id).single();
        if (profile) document.getElementById('settings-admin-name').textContent = profile.full_name;
    }
}

window.logoutAdmin = async function () {
    if (!confirm("Are you sure you want to logout?")) return;
    await supabaseClient.auth.signOut();
    window.location.replace('index.html');
}

// ==========================================
// 6. PRODUCT FORM (ADD / EDIT LOGIC)
// ==========================================

// pendingImageFiles initialized at global scope above 

function initImagePreview() {
    const fileInput = document.getElementById('prod-images');
    if (!fileInput) return;

    fileInput.addEventListener('change', function () {
        pendingImageFiles = Array.from(this.files);
        renderPendingImages();
    });
}

window.renderPendingImages = function () {
    const fileInput = document.getElementById('prod-images');
    const newPreviewContainer = document.getElementById('new-images-preview');
    newPreviewContainer.innerHTML = '';

    const editingId = document.getElementById('editing-product-id').value;
    const existingContainer = document.getElementById('existing-images-preview');
    const hasExisting = existingContainer ? existingContainer.innerHTML.trim() !== '' : false;

    if (pendingImageFiles.length > 0) {
        const header = document.createElement('div');
        header.style = "width:100%; font-size: 13px; color: #666; margin-bottom: 5px;";
        header.textContent = "New Images Ready to Upload:";
        newPreviewContainer.appendChild(header);

        pendingImageFiles.forEach((file, index) => {
            const wrapper = document.createElement('div');
            wrapper.style = "position: relative; width: 105px; border: 2px dashed #ccc; border-radius: 6px; padding: 4px; display: inline-block; margin-right: 10px; margin-bottom: 10px; background: #fff; vertical-align: top;";

            const imgBox = document.createElement('div');
            imgBox.style = "position: relative; width: 100%; height: 85px; overflow: hidden; border-radius: 4px;";

            const img = document.createElement('img');
            img.style = "width: 100%; height: 100%; object-fit: cover; border-radius: 4px;";

            const isCover = (!editingId || !hasExisting) && index === 0;
            let badgeHTML = isCover ? '<div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:9px; text-align:center; padding:2px; font-weight:bold; z-index: 5;">COVER</div>' : '';

            let makeCoverBtn = (!isCover && (!editingId || !hasExisting)) ?
                `<button type="button" onclick="setPendingAsCover(${index})" style="position:absolute; bottom:2px; left:2px; right:2px; background:#f1c40f; color:#000; border:none; border-radius:3px; font-size:9px; padding:2px 0; cursor:pointer; z-index: 10; font-weight:bold;">Set Cover</button>` : '';

            let btnHTML = `<button type="button" onclick="removePendingImage(${index})" style="position:absolute; top:2px; right:2px; background:#e74c3c; color:white; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:11px; line-height:1; display:flex; align-items:center; justify-content:center; z-index: 10;">&times;</button>`;

            imgBox.innerHTML = badgeHTML + makeCoverBtn + btnHTML;
            imgBox.insertBefore(img, imgBox.firstChild);

            // Color tag input for this image
            const colorInput = document.createElement('input');
            colorInput.type = "text";
            colorInput.placeholder = "Color (e.g. Red)";
            colorInput.className = "pending-image-color admin-input";
            colorInput.dataset.index = index;
            colorInput.style = "width: 100%; font-size: 10px; padding: 4px 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px; height: 26px;";
            colorInput.value = file._colorTag || '';
            colorInput.addEventListener('input', (e) => {
                file._colorTag = e.target.value.trim();
            });

            wrapper.appendChild(imgBox);
            wrapper.appendChild(colorInput);

            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(file);

            newPreviewContainer.appendChild(wrapper);
        });
    } else {
        fileInput.value = "";
        if (!hasExisting) fileInput.setAttribute('required', 'true');
    }
}

window.setPendingAsCover = function (index) {
    if (index === 0) return;
    const temp = pendingImageFiles[0];
    pendingImageFiles[0] = pendingImageFiles[index];
    pendingImageFiles[index] = temp;

    const dt = new DataTransfer();
    pendingImageFiles.forEach(file => dt.items.add(file));
    document.getElementById('prod-images').files = dt.files;
    renderPendingImages();
}

window.removePendingImage = function (index) {
    pendingImageFiles.splice(index, 1);
    const dt = new DataTransfer();
    pendingImageFiles.forEach(file => dt.items.add(file));
    document.getElementById('prod-images').files = dt.files;
    renderPendingImages();
}

function initProductForm() {
    const btnGenerateVariants = document.getElementById('btn-generate-variants');
    const stockTableContainer = document.getElementById('stock-table-container');
    const addProductForm = document.getElementById('add-product-form');

    if (btnGenerateVariants) {
        btnGenerateVariants.addEventListener('click', () => {
            const colors = document.getElementById('variant-colors').value.split(',').map(c => c.trim()).filter(c => c !== "");
            const sizes = document.getElementById('variant-sizes').value.split(',').map(s => s.trim()).filter(s => s !== "");
            if (colors.length === 0 && sizes.length === 0) return;

            const finalColors = colors.length > 0 ? colors : ['Default'];
            const finalSizes = sizes.length > 0 ? sizes : ['Default'];

            let overrides = {};
            try { overrides = JSON.parse(localStorage.getItem('kappa_stock_overrides') || '{}'); } catch (_) { }
            const editingId = document.getElementById('editing-product-id')?.value;
            const prodOverride = editingId ? (overrides[String(editingId)] || null) : null;

            let tableHTML = `<table class="stock-table"><thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock Qty</th><th style="text-align:center;">Action</th></tr></thead><tbody>`;
            finalColors.forEach(color => {
                finalSizes.forEach(size => {
                    let vStock = 10;
                    if (prodOverride && prodOverride.variants && prodOverride.variants[size]) {
                        vStock = Math.max(0, vStock - prodOverride.variants[size]);
                    }
                    tableHTML += `<tr class="variant-row" data-color="${color}" data-size="${size}">
                        <td><strong>${color}</strong></td>
                        <td><strong>${size}</strong></td>
                        <td><input type="text" class="stock-input variant-sku" placeholder="SKU"></td>
                        <td><input type="number" class="stock-input variant-stock" value="${vStock}" min="0" required></td>
                        <td style="text-align:center;">
                            <button type="button" class="btn-delete" style="padding:4px 10px; font-size:12px; background:#fff0f0; color:#e53e3e; border:1px solid #fed7d7; border-radius:6px; cursor:pointer;" onclick="removeVariantRow(this)" title="Delete Variant">
                                ✕
                            </button>
                        </td>
                    </tr>`;
                });
            });
            tableHTML += `</tbody></table>`;
            stockTableContainer.innerHTML = tableHTML;
        });
    }

    window.removeVariantRow = function (btn) {
        const row = btn.closest('tr');
        if (!row) return;
        row.remove();
        const tableContainer = document.getElementById('stock-table-container');
        const remainingRows = tableContainer ? tableContainer.querySelectorAll('.variant-row') : [];
        if (remainingRows.length === 0 && tableContainer) {
            tableContainer.innerHTML = '<p style="color:#aaa; text-align:center; padding:15px; font-style:italic;">No variants. Click "Generate Variant Matrix" to add colors & sizes.</p>';
        }
    };

    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.textContent = "Processing...";
            submitBtn.disabled = true;

            try {
                const editingId = document.getElementById('editing-product-id').value;
                const variantRows = document.querySelectorAll('.variant-row');
                let totalBaseStock = 0;
                variantRows.forEach(row => totalBaseStock += parseInt(row.querySelector('.variant-stock').value) || 0);

                let targetProductId;
                let startingImagePosition = 0;

                const tagVal = (document.getElementById('prod-tag')?.value || 'NEW').trim().toUpperCase();
                const rawDesc = document.getElementById('prod-desc').value.trim();
                const cleanDesc = rawDesc.replace(/\s*\[TAG:[^\]]+\]/gi, '').trim();
                const finalDesc = tagVal ? `${cleanDesc} [TAG:${tagVal}]` : cleanDesc;

                if (editingId) {
                    targetProductId = editingId;
                    const updateObj = {
                        name: document.getElementById('prod-name').value.trim(),
                        slug: generateSlug(document.getElementById('prod-name').value.trim()),
                        description: finalDesc,
                        price: parseFloat(document.getElementById('prod-price').value),
                        compare_at_price: parseFloat(document.getElementById('prod-compare-price').value) || null,
                        category_id: document.getElementById('prod-category').value,
                        stock_quantity: totalBaseStock
                    };
                    try { updateObj.tag = tagVal; } catch (_) {}

                    let { error: updateError } = await supabaseClient.from('products').update(updateObj).eq('id', editingId);
                    if (updateError && updateError.message && updateError.message.includes('tag')) {
                        delete updateObj.tag;
                        const retry = await supabaseClient.from('products').update(updateObj).eq('id', editingId);
                        updateError = retry.error;
                    }

                    if (updateError) throw updateError;

                    // Store tag locally as fallback
                    try {
                        const tagsMap = JSON.parse(localStorage.getItem('kappa_product_tags') || '{}');
                        tagsMap[String(editingId)] = tagVal;
                        localStorage.setItem('kappa_product_tags', JSON.stringify(tagsMap));
                    } catch (_) {}

                    await supabaseClient.from('product_variants').delete().eq('product_id', editingId);

                    if (variantRows.length > 0) {
                        const variantsToInsert = Array.from(variantRows).map(row => ({
                            product_id: editingId,
                            color: row.getAttribute('data-color'),
                            size: row.getAttribute('data-size'),
                            sku: row.querySelector('.variant-sku').value.trim() || null,
                            stock_quantity: parseInt(row.querySelector('.variant-stock').value)
                        }));
                        await supabaseClient.from('product_variants').insert(variantsToInsert);
                    }

                    const { data: existingImgs } = await supabaseClient.from('product_images').select('position').eq('product_id', editingId).order('position', { ascending: false }).limit(1);
                    if (existingImgs && existingImgs.length > 0) {
                        startingImagePosition = existingImgs[0].position + 1;
                    }

                } else {
                    const insertObj = {
                        name: document.getElementById('prod-name').value.trim(),
                        slug: generateSlug(document.getElementById('prod-name').value.trim()),
                        description: finalDesc,
                        price: parseFloat(document.getElementById('prod-price').value),
                        compare_at_price: parseFloat(document.getElementById('prod-compare-price').value) || null,
                        category_id: document.getElementById('prod-category').value,
                        stock_quantity: totalBaseStock,
                        is_active: true
                    };
                    try { insertObj.tag = tagVal; } catch (_) {}

                    let { data: newProduct, error: insertError } = await supabaseClient.from('products').insert([insertObj]).select().single();
                    if (insertError && insertError.message && insertError.message.includes('tag')) {
                        delete insertObj.tag;
                        const retry = await supabaseClient.from('products').insert([insertObj]).select().single();
                        insertError = retry.error;
                        newProduct = retry.data;
                    }

                    if (insertError) throw insertError;
                    targetProductId = newProduct.id;

                    // Store tag locally as fallback
                    try {
                        const tagsMap = JSON.parse(localStorage.getItem('kappa_product_tags') || '{}');
                        tagsMap[String(targetProductId)] = tagVal;
                        localStorage.setItem('kappa_product_tags', JSON.stringify(tagsMap));
                    } catch (_) {}

                    if (variantRows.length > 0) {
                        const variantsToInsert = Array.from(variantRows).map(row => ({
                            product_id: targetProductId,
                            color: row.getAttribute('data-color'),
                            size: row.getAttribute('data-size'),
                            sku: row.querySelector('.variant-sku').value.trim() || null,
                            stock_quantity: parseInt(row.querySelector('.variant-stock').value)
                        }));
                        await supabaseClient.from('product_variants').insert(variantsToInsert);
                    }
                }

                const fileInput = document.getElementById('prod-images');
                if (fileInput && fileInput.files.length > 0) {
                    const imageRows = [];

                    for (const [index, file] of pendingImageFiles.entries()) {
                        const filePath = `${targetProductId}/${Date.now()}_${file.name}`;
                        const { error: uploadError } = await supabaseClient.storage.from('product-images').upload(filePath, file);
                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabaseClient.storage.from('product-images').getPublicUrl(filePath);

                        let finalUrl = publicUrl;
                        if (file._colorTag) {
                            finalUrl += `#${file._colorTag}`;
                        }

                        imageRows.push({ product_id: targetProductId, url: finalUrl, position: startingImagePosition + index });
                    }
                    await supabaseClient.from('product_images').insert(imageRows);
                }

                alert(editingId ? "Product updated successfully!" : "Product published successfully!");
                try {
                    localStorage.removeItem("kappa_cached_products");
                } catch (e) { }
                clearProductForm();

            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                submitBtn.textContent = document.getElementById('editing-product-id').value ? "Save Changes" : "Publish Product to Storefront";
                submitBtn.disabled = false;
            }
        });
    }
}

// ==========================================
// 7. INVENTORY MANAGEMENT (UPDATED FOR CATEGORIES)
// ==========================================
async function loadInventory() {
    const container = document.getElementById('inventory-list-container');
    const filterSelect = document.getElementById('inventory-filter');
    if (!container) return;

    // 1. Fetch Categories to build the Hierarchy Map
    const { data: categories, error: catError } = await supabaseClient.from('categories').select('*');
    let catMap = {};
    let hierarchyMap = {};

    if (categories && !catError) {
        categories.forEach(c => catMap[c.id] = c);

        // Build "Parent ↳ Child" strings
        categories.forEach(c => {
            if (c.parent_id && catMap[c.parent_id]) {
                hierarchyMap[c.id] = `${catMap[c.parent_id].name} ↳ ${c.name}`;
            } else {
                hierarchyMap[c.id] = c.name;
            }
        });

        // Populate the dropdown filter cleanly
        if (filterSelect && filterSelect.options.length <= 1) {
            const roots = categories.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
            const children = categories.filter(c => c.parent_id);

            roots.forEach(root => {
                const group = document.createElement('optgroup');
                group.label = root.name;

                const rootOpt = document.createElement('option');
                rootOpt.value = root.id;
                rootOpt.textContent = `${root.name} (All)`;
                group.appendChild(rootOpt);

                const myChildren = children.filter(c => c.parent_id === root.id).sort((a, b) => a.name.localeCompare(b.name));
                myChildren.forEach(child => {
                    const childOpt = document.createElement('option');
                    childOpt.value = child.id;
                    childOpt.textContent = `↳ ${child.name}`;
                    group.appendChild(childOpt);
                });
                filterSelect.appendChild(group);
            });
        }
    }

    // 2. Fetch all products with stock and variants
    const { data, error } = await supabaseClient
        .from('products')
        .select('id, name, price, stock_quantity, category_id, product_images(id, url, position), product_variants(id, size, color, stock_quantity)')
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = "<p>Error loading products.</p>"; return; }
    if (!data || data.length === 0) { container.innerHTML = "<p>No products published yet.</p>"; return; }

    let overrides = {};
    try {
        overrides = JSON.parse(localStorage.getItem('kappa_stock_overrides') || '{}');
    } catch (_) { overrides = {}; }

    let html = `<table class="stock-table" id="inventory-table" style="width: 100%; text-align: left; border-collapse: collapse;">
        <thead>
            <tr style="border-bottom: 1px solid #eee;">
                <th style="padding-bottom: 10px;">Image</th>
                <th style="padding-bottom: 10px;">Product Name</th>
                <th style="padding-bottom: 10px;">Category</th>
                <th style="padding-bottom: 10px;">Price</th>
                <th style="padding-bottom: 10px;">Stock Status</th>
                <th style="padding-bottom: 10px; text-align: right;">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    data.forEach(prod => {
        // Resolve full category string (e.g., "Women ↳ Tops")
        const catDisplay = hierarchyMap[prod.category_id] || 'Uncategorized';

        // Find the parent ID for filtering logic
        let parentId = '';
        if (catMap[prod.category_id] && catMap[prod.category_id].parent_id) {
            parentId = catMap[prod.category_id].parent_id;
        }

        // Calculate dynamic stock with overrides
        const pid = String(prod.id);
        const prodOverride = overrides[pid] || null;
        let totalStock = 0;
        let variantStockList = [];

        if (prod.product_variants && prod.product_variants.length > 0) {
            prod.product_variants.forEach(v => {
                let vQty = Number(v.stock_quantity || 0);
                if (prodOverride && prodOverride.variants && prodOverride.variants[v.size]) {
                    vQty = Math.max(0, vQty - prodOverride.variants[v.size]);
                }
                totalStock += vQty;
                if (v.size && v.size !== 'Default') {
                    variantStockList.push(`${v.size}: <strong>${vQty}</strong>`);
                }
            });
        } else {
            totalStock = Number(prod.stock_quantity || 0);
            if (prodOverride && prodOverride.totalDeducted) {
                totalStock = Math.max(0, totalStock - prodOverride.totalDeducted);
            }
        }

        let stockBadgeHtml = '';
        if (totalStock <= 0) {
            stockBadgeHtml = `<span class="badge" style="background:#ffebee; color:#c62828; font-weight:700; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffcdd2;">🔴 Out of Stock (0)</span>`;
        } else if (totalStock <= 5) {
            stockBadgeHtml = `<span class="badge" style="background:#fff8e1; color:#f57f17; font-weight:700; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffe082;">🟡 Low Stock (${totalStock})</span>`;
        } else {
            stockBadgeHtml = `<span class="badge" style="background:#e8f5e9; color:#2e7d32; font-weight:700; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #c8e6c9;">🟢 In Stock (${totalStock})</span>`;
        }

        const variantSummary = variantStockList.length > 0
            ? `<div style="font-size: 11px; color: #666; margin-top: 4px; line-height: 1.4;">${variantStockList.join(' &bull; ')}</div>`
            : '';

        // Sort images by position and build thumbnail strip
        const sortedImages = (prod.product_images || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));

        let imgStripHTML = '';
        if (sortedImages.length === 0) {
            imgStripHTML = `<div style="width: 48px; height: 56px; background: #eee; border-radius: 6px; display:inline-block;"></div>`;
        } else {
            imgStripHTML = `<div style="display:flex; gap:4px; align-items:center; flex-wrap:nowrap;">`;
            const maxShow = 4;
            sortedImages.slice(0, maxShow).forEach((img, idx) => {
                const cleanUrl = img.url.split('#')[0];
                const colorLabel = img.url.split('#')[1] || '';
                const isCover = idx === 0;
                imgStripHTML += `
                    <div style="position:relative; display:inline-block;" title="${colorLabel || 'Image ' + (idx + 1)}">
                        <img src="${cleanUrl}" 
                             style="width:${isCover ? '52px' : '38px'}; height:${isCover ? '62px' : '46px'}; object-fit:cover; border-radius:5px; border:${isCover ? '2px solid #111' : '1px solid #ddd'}; cursor:pointer; transition:transform 0.15s ease;"
                             onmouseover="this.style.transform='scale(1.12)'" 
                             onmouseout="this.style.transform='scale(1)'">
                        ${isCover ? '<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);color:#fff;font-size:8px;text-align:center;border-radius:0 0 4px 4px;padding:1px;">COVER</span>' : ''}
                    </div>`;
            });
            if (sortedImages.length > maxShow) {
                imgStripHTML += `<span style="font-size:11px;color:#777;font-weight:bold;">+${sortedImages.length - maxShow}</span>`;
            }
            imgStripHTML += `</div>`;
        }

        // Inject data-attributes for live filtering
        html += `<tr class="inv-row" data-cat="${prod.category_id}" data-parent="${parentId}" style="border-bottom: 1px solid #f9f9f9;">
            <td style="padding: 10px 4px;">${imgStripHTML}</td>
            <td><strong>${prod.name}</strong></td>
            <td><span class="badge" style="background:#f1f1f1; color:#333; font-weight:bold; font-size: 12px; padding: 4px 8px; border-radius: 4px;">${catDisplay}</span></td>
            <td>₹${prod.price}</td>
            <td>
                ${stockBadgeHtml}
                ${variantSummary}
            </td>
            <td style="text-align: right;">
                <button class="btn-secondary" style="padding: 6px 12px; margin-right: 8px; cursor: pointer;" onclick="editProduct('${prod.id}')">Edit</button>
                <button class="btn-delete" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="deleteProduct('${prod.id}')">Delete</button>
            </td>
        </tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// NEW: Live filter logic for the dropdown
window.filterInventory = function () {
    const filterVal = document.getElementById('inventory-filter').value;
    const rows = document.querySelectorAll('.inv-row');

    rows.forEach(row => {
        if (filterVal === 'all') {
            row.style.display = '';
        } else {
            const catId = row.getAttribute('data-cat');
            const parentId = row.getAttribute('data-parent');

            // Show if it matches exactly, OR if the filter is a Parent and this product belongs to its Child
            if (catId === filterVal || parentId === filterVal) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

window.deleteProduct = async function (id) {
    if (!confirm("Are you sure you want to PERMANENTLY delete this product? This action cannot be undone.")) return;
    try {
        // 1. Delete associated child table records
        await supabaseClient.from('product_images').delete().eq('product_id', id);
        await supabaseClient.from('product_variants').delete().eq('product_id', id);
        await supabaseClient.from('cart_items').delete().eq('product_id', id);
        await supabaseClient.from('wishlists').delete().eq('product_id', id);
        await supabaseClient.from('reviews').delete().eq('product_id', id);

        // 2. Unlink or delete order_items rows for this product
        await supabaseClient.from('order_items').update({ product_id: null }).eq('product_id', id);
        await supabaseClient.from('order_items').delete().eq('product_id', id);

        // 3. HARD DELETE product from products table
        const { error } = await supabaseClient.from('products').delete().eq('id', id);

        if (error) {
            throw error;
        }

        alert("Product deleted permanently!");

        if (typeof loadInventory === 'function') loadInventory();
        if (typeof loadDashboard === 'function') loadDashboard();

        // Refresh category products panel if it's open
        if (_selectedCategoryId) {
            const panel = document.getElementById('cat-products-panel');
            if (panel && panel.style.display !== 'none') {
                const title = document.getElementById('cat-products-title');
                loadCategoryProducts(_selectedCategoryId, _selectedCategoryIsRoot, title ? title.textContent : '');
            }
        }
    } catch (err) {
        alert("Error deleting product: " + err.message);
    }
}

window.updateImageColor = async function (imageId, cleanUrl, newColorTag) {
    const trimmedColor = (newColorTag || '').trim();
    const newUrl = trimmedColor ? `${cleanUrl}#${trimmedColor}` : cleanUrl;

    try {
        const { error } = await supabaseClient
            .from('product_images')
            .update({ url: newUrl })
            .eq('id', imageId);

        if (error) {
            console.error("Error updating image color:", error);
            alert("Failed to update color tag: " + error.message);
        } else {
            console.log(`Updated image ${imageId} color tag to: ${trimmedColor}`);
        }
    } catch (err) {
        console.error("Error updating image color:", err);
    }
};

window.deleteProductImage = async function (imageId, imageUrl, productId) {
    if (!confirm("Remove this image?")) return;
    try {
        const urlParts = imageUrl.split('/product-images/');
        if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabaseClient.storage.from('product-images').remove([filePath]);
        }
        const { error } = await supabaseClient.from('product_images').delete().eq('id', imageId);
        if (error) throw error;
        editProduct(productId);
    } catch (err) {
        alert("Error deleting image: " + err.message);
    }
}

window.setExistingAsCover = async function (imageId, productId) {
    if (!confirm("Set this image as the new cover?")) return;
    try {
        const { data: images } = await supabaseClient.from('product_images').select('*').eq('product_id', productId).order('position', { ascending: true });

        if (images && images.length > 0) {
            const currentCover = images[0];
            const targetImage = images.find(img => img.id === imageId);

            if (currentCover && targetImage && currentCover.id !== targetImage.id) {
                await supabaseClient.from('product_images').update({ position: targetImage.position }).eq('id', currentCover.id);
                await supabaseClient.from('product_images').update({ position: currentCover.position }).eq('id', targetImage.id);
            }
        }
        editProduct(productId);
    } catch (err) {
        alert("Error setting cover: " + err.message);
    }
}

window.editProduct = async function (id) {
    const { data, error } = await supabaseClient
        .from('products')
        .select(`*, product_variants (*), product_images (*)`)
        .eq('id', id)
        .single();

    if (error || !data) { alert("Error fetching product details."); return; }

    if (data.product_images) {
        data.product_images.sort((a, b) => a.position - b.position);
    }

    document.querySelectorAll('.sidebar-menu li').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active-view'));

    document.querySelector('.sidebar-menu li[data-target="products"]').classList.add('active');
    document.getElementById('view-products').classList.add('active-view');
    document.getElementById('dynamic-page-title').textContent = "Edit Product";

    let rawDesc = data.description || '';
    let extractedTag = data.tag;
    if (rawDesc.includes('[TAG:')) {
        const match = rawDesc.match(/\[TAG:([^\]]+)\]/i);
        if (match && match[1]) extractedTag = match[1].trim().toUpperCase();
        rawDesc = rawDesc.replace(/\s*\[TAG:[^\]]+\]/gi, '').trim();
    }

    document.getElementById('editing-product-id').value = data.id;
    document.getElementById('prod-name').value = data.name;
    document.getElementById('prod-category').value = data.category_id;
    document.getElementById('prod-price').value = data.price;
    document.getElementById('prod-compare-price').value = data.compare_at_price || '';
    document.getElementById('prod-desc').value = rawDesc;

    let tagMap = {};
    try { tagMap = JSON.parse(localStorage.getItem('kappa_product_tags') || '{}'); } catch (_) {}
    const prodTagEl = document.getElementById('prod-tag');
    if (prodTagEl) {
        prodTagEl.value = extractedTag || tagMap[String(data.id)] || 'NEW';
    }

    const stockTableContainer = document.getElementById('stock-table-container');
    if (data.product_variants && data.product_variants.length > 0) {
        const colors = [...new Set(data.product_variants.map(v => v.color).filter(c => c !== 'Default'))];
        const sizes = [...new Set(data.product_variants.map(v => v.size).filter(s => s !== 'Default'))];

        document.getElementById('variant-colors').value = colors.join(', ');
        document.getElementById('variant-sizes').value = sizes.join(', ');

        let overrides = {};
        try { overrides = JSON.parse(localStorage.getItem('kappa_stock_overrides') || '{}'); } catch (_) { }
        const prodOverride = overrides[String(data.id)] || null;

        let tableHTML = `<table class="stock-table"><thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock Qty</th><th style="text-align:center;">Action</th></tr></thead><tbody>`;
        data.product_variants.forEach(variant => {
            let vStock = Number(variant.stock_quantity || 0);
            if (prodOverride && prodOverride.variants && prodOverride.variants[variant.size]) {
                vStock = Math.max(0, vStock - prodOverride.variants[variant.size]);
            }
            tableHTML += `<tr class="variant-row" data-color="${variant.color}" data-size="${variant.size}">
                <td><strong>${variant.color}</strong></td>
                <td><strong>${variant.size}</strong></td>
                <td><input type="text" class="stock-input variant-sku" placeholder="SKU" value="${variant.sku || ''}"></td>
                <td><input type="number" class="stock-input variant-stock" value="${vStock}" min="0" required></td>
                <td style="text-align:center;">
                    <button type="button" class="btn-delete" style="padding:4px 10px; font-size:12px; background:#fff0f0; color:#e53e3e; border:1px solid #fed7d7; border-radius:6px; cursor:pointer;" onclick="removeVariantRow(this)" title="Delete Variant">
                        ✕
                    </button>
                </td>
            </tr>`;
        });
        tableHTML += `</tbody></table>`;
        stockTableContainer.innerHTML = tableHTML;
    } else {
        document.getElementById('variant-colors').value = '';
        document.getElementById('variant-sizes').value = '';
        stockTableContainer.innerHTML = '';
    }

    const existingImagesDiv = document.getElementById('existing-images-preview');
    const fileInput = document.getElementById('prod-images');

    if (data.product_images && data.product_images.length > 0) {
        let imgHtml = '<div style="width:100%; font-size: 13px; color: #666; margin-bottom: 5px;">Currently Uploaded Images:</div>';

        data.product_images.forEach((img, index) => {
            const isCover = index === 0;
            const badge = isCover ? '<div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:9px; text-align:center; padding:2px; font-weight:bold; z-index:5;">COVER</div>' : '';

            const makeCoverBtn = !isCover ? `<button type="button" onclick="setExistingAsCover('${img.id}', '${data.id}')" style="position:absolute; bottom:2px; left:2px; right:2px; background:#f1c40f; color:#000; border:none; border-radius:3px; font-size:9px; padding:2px 0; cursor:pointer; z-index:10; font-weight:bold;">Set Cover</button>` : '';

            const parts = img.url.split('#');
            const cleanUrl = parts[0];
            const colorTag = parts[1] || '';

            imgHtml += `
            <div style="position: relative; width: 105px; border: 1px solid #ccc; border-radius: 6px; padding: 4px; display: inline-block; margin-right: 10px; margin-bottom: 10px; background: #fff; vertical-align: top;">
                <div style="position: relative; width: 100%; height: 85px; overflow: hidden; border-radius: 4px;">
                    <img src="${cleanUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    ${badge}
                    ${makeCoverBtn}
                    <button type="button" onclick="deleteProductImage('${img.id}', '${img.url}', '${data.id}')" style="position:absolute; top:2px; right:2px; background:#e74c3c; color:white; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:11px; line-height:1; display:flex; align-items:center; justify-content:center; z-index:10;">&times;</button>
                </div>
                <input type="text" placeholder="Color (e.g. Red)" value="${colorTag}" 
                       onchange="updateImageColor('${img.id}', '${cleanUrl}', this.value)" 
                       style="width: 100%; font-size: 10px; padding: 4px 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px; height: 26px;">
            </div>`;
        });
        existingImagesDiv.innerHTML = imgHtml;
        fileInput.removeAttribute('required');
    } else {
        existingImagesDiv.innerHTML = '';
        fileInput.setAttribute('required', 'true');
    }

    fileInput.value = '';
    pendingImageFiles = [];
    document.getElementById('new-images-preview').innerHTML = '';

    document.getElementById('btn-submit-product').textContent = "Save Changes";
    window.scrollTo(0, 0);
}

window.showOrderDetails = async function (orderId) {
    const overlay = document.getElementById('orderDetailsOverlay');
    const content = document.getElementById('orderDetailsContent');

    overlay.style.display = 'flex';
    content.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">
        <div style="font-size:30px; margin-bottom:10px;">⏳</div>
        <div>Loading order details...</div>
    </div>`;

    const { data, error } = await supabaseClient
        .from('orders')
        .select(`
            *,
            order_items (
                quantity,
                price_at_purchase,
                size,
                color,
                image_url,
                products ( name, product_images ( url ) )
            )
        `)
        .eq('id', orderId)
        .single();

    if (error || !data) {
        content.innerHTML = '<p style="color:red; padding:20px;">Error loading order details.</p>';
        return;
    }

    const cust = data.customer_details || {};
    const addr = data.shipping_address || {};
    const currentStatus = (data.status || 'pending').toLowerCase();
    const paymentStatus = (data.payment_status || 'pending').toLowerCase();
    const isPaid = paymentStatus === 'paid' || currentStatus === 'paid' || !!data.razorpay_payment_id;
    const rzpId = data.razorpay_payment_id || data.payment_id || '';
    const isCancelled = currentStatus.includes('cancel') || (data.order_stage || '') === 'cancelled';
    const isReturned = currentStatus.includes('return') || ['return_requested','returned'].includes(data.order_stage || '');
    const refundInfo = data.refund_details || cust.refund_details || cust.cancellation_details || data.cancellation_details || null;
    const phoneClean = (cust.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const orderStage = data.order_stage || (isCancelled ? 'cancelled' : 'incoming');
    const stageHistory = Array.isArray(data.stage_history) ? data.stage_history : [];
    const deliveryDetails = data.delivery_details || {};

    // ── 1. PAYMENT BANNER ──────────────────────────────────────────────────────
    let paymentBannerHtml = '';
    if (isCancelled) {
        paymentBannerHtml = `
            <div style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:10px; padding:14px 16px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <div>
                    <div style="font-size:14px; font-weight:800; color:#b91c1c; display:flex; align-items:center; gap:6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        ORDER CANCELLED — REFUND DUE
                    </div>
                    <div style="font-size:12px; color:#991b1b; margin-top:3px;">Repay <strong>₹${data.total_amount}</strong> using customer's payment details below.</div>
                </div>
                <span class="badge status-cancelled" style="font-size:12px; padding:5px 12px;">CANCELLED</span>
            </div>`;
    } else if (isPaid) {
        paymentBannerHtml = `
            <div style="background:#e8f8f0; border:1px solid #a3e6be; border-radius:10px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between;">
                <div>
                    <div style="font-size:13px; font-weight:700; color:#1e7e44; display:flex; align-items:center; gap:6px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1e7e44"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        PAID VIA RAZORPAY
                    </div>
                    <div style="font-size:11px; color:#2e6b45; margin-top:2px;">${rzpId ? `Txn ID: <strong style="font-family:monospace;">${rzpId}</strong>` : 'Payment verified.'}</div>
                </div>
                <span class="badge status-paid" style="font-size:12px; padding:5px 12px;">PAID</span>
            </div>`;
    } else {
        paymentBannerHtml = `
            <div style="background:#fff8ec; border:1px solid #fbd38d; border-radius:10px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between;">
                <div style="font-size:13px; font-weight:700; color:#c05621;">⚠️ UNPAID / PENDING PAYMENT</div>
                <span class="badge status-pending" style="font-size:12px; padding:5px 12px;">UNPAID</span>
            </div>`;
    }

    // ── 2. ORDER HEADER ────────────────────────────────────────────────────────
    const placedDate = new Date(data.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid #f0f0f0; flex-wrap:wrap; gap:10px;">
            <div>
                <div style="font-size:22px; font-weight:800; color:#111; font-family:monospace; letter-spacing:0.5px;">Order #${data.id.toString().substring(0,8).toUpperCase()}</div>
                <div style="font-size:12px; color:#888; margin-top:3px;">Placed on: ${placedDate}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Total Amount</div>
                <div style="font-size:24px; font-weight:800; color:#111;">₹${data.total_amount}</div>
            </div>
        </div>`;

    // ── 3. ORDER STATUS TIMELINE ───────────────────────────────────────────────
    const isException = EXCEPTION_STAGES.includes(orderStage);
    let timelineHtml = `<div class="order-detail-section">
        <div class="order-detail-section-title">📍 Order Status Timeline</div>`;

    if (isException) {
        const excLabel = STAGE_LABELS[orderStage] || orderStage;
        timelineHtml += `<div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fef2f2; border-radius:8px; border:1px solid #fecaca;">
            <div class="step-dot exception" style="width:28px; height:28px; border-radius:50%; background:#fee2e2; border:2px solid #dc2626; display:flex; align-items:center; justify-content:center; color:#dc2626; font-weight:800; font-size:12px; flex-shrink:0;">!</div>
            <div>
                <div style="font-weight:700; color:#dc2626; font-size:14px;">${excLabel}</div>
                ${stageHistory.length > 0 ? `<div style="font-size:11px; color:#999; margin-top:2px;">${new Date(stageHistory[stageHistory.length-1]?.timestamp || Date.now()).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>` : ''}
            </div>
        </div>`;
    } else {
        timelineHtml += `<div class="order-timeline">`;
        ORDER_STAGES.forEach((stage, idx) => {
            const stageIdx = ORDER_STAGES.indexOf(orderStage);
            let stepClass = '';
            if (idx < stageIdx) stepClass = 'done';
            else if (idx === stageIdx) stepClass = 'current';
            const histEntry = stageHistory.find(h => h.stage === stage);
            const timeLabel = histEntry ? new Date(histEntry.timestamp).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '';
            const dotIcon = idx < stageIdx ? '✓' : (idx === stageIdx ? '●' : '○');
            const shortLabels = { incoming:'Incoming', confirmed:'Confirmed', processing:'Processing', packed:'Packed', shipped:'Shipped', out_for_delivery:'Out for Del.', delivered:'Delivered' };
            timelineHtml += `
                <div class="timeline-step ${stepClass}">
                    <div class="step-dot">${dotIcon}</div>
                    <div class="step-label">${shortLabels[stage] || stage}</div>
                    ${timeLabel ? `<div class="step-time">${timeLabel}</div>` : '<div class="step-time">&nbsp;</div>'}
                </div>`;
        });
        timelineHtml += `</div>`;
    }
    timelineHtml += `</div>`;

    // ── 4. UPDATE ORDER STAGE ──────────────────────────────────────────────────
    const allStages = [...ORDER_STAGES, ...EXCEPTION_STAGES];
    let stageOptions = allStages.map(s => `<option value="${s}" ${s === orderStage ? 'selected' : ''}>${STAGE_LABELS[s] || s}</option>`).join('');

    // Build rich WhatsApp message with product names & clean details (no image links)
    const _waItems   = (data.order_items && data.order_items.length > 0) ? data.order_items : [];
    const _waNames   = _waItems.length > 0
        ? _waItems.map(i => (i.products?.name || i.name || 'Product') + (i.size && i.size !== 'N/A' ? ' (' + i.size + ')' : '')).join(', ')
        : 'Your order';
    const _waShortId = data.id.toString().substring(0, 8).toUpperCase();
    const _waStatus  = STAGE_LABELS[orderStage] || orderStage;
    const _waNotifyMsg = [
        `Hi ${cust.name || 'there'}!`,
        ``,
        `Your KAPPA Clothing order has been updated!`,
        ``,
        `Order ID: #${_waShortId}`,
        `Status: ${_waStatus}`,
        `Items: ${_waNames}`,
        `Total: Rs. ${data.total_amount}`,
        ``,
        `Thank you for shopping with KAPPA!`,
        `For any queries, reply to this message.`
    ].join('\n');

    let updateStageHtml = `
        <div class="order-action-bar">
            <div style="font-size:12px; font-weight:700; color:#555; white-space:nowrap;">Update Stage:</div>
            <select class="stage-select" id="stage-select-${data.id}">${stageOptions}</select>
            <button class="btn-update-stage" onclick="updateOrderStage('${data.id}', document.getElementById('stage-select-${data.id}').value)">
                ✅ Update Status
            </button>
            ${phoneClean ? `<a href="https://wa.me/91${phoneClean}?text=${encodeURIComponent(_waNotifyMsg)}" target="_blank" class="btn-whatsapp-notify">💬 Notify Customer</a>` : ''}
            <button type="button" onclick="openNotifyCustomerModal('${data.id}')" style="background:#fff; border:1.5px solid #cbd5e1; color:#334155; padding:7px 13px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Edit message before sending">
                ✏️ Edit Message
            </button>
        </div>`;

    // ── 5. CUSTOMER + SHIPPING GRID ────────────────────────────────────────────
    let custGridHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
            <div class="order-detail-section" style="margin-bottom:0;">
                <div class="order-detail-section-title">👤 Customer Info</div>
                <div style="font-size:14px; font-weight:700; color:#111; margin-bottom:4px;">${cust.name || 'N/A'}</div>
                <div style="font-size:13px; color:#555; margin-bottom:3px;">
                    ${cust.email ? `<a href="mailto:${cust.email}" style="color:#3498db; text-decoration:none;">${cust.email}</a>` : 'No email'}
                </div>
                <div style="font-size:13px; color:#555; margin-bottom:6px;">📞 ${cust.phone || 'N/A'}</div>
                ${phoneClean ? `
                    <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                        <a href="https://wa.me/91${phoneClean}?text=${encodeURIComponent(_waNotifyMsg)}" target="_blank" class="btn-whatsapp-notify" style="font-size:11px; padding:5px 10px;">💬 WhatsApp</a>
                        <button type="button" onclick="openNotifyCustomerModal('${data.id}')" style="background:#f8fafc; border:1px solid #cbd5e1; color:#334155; font-size:11px; padding:5px 10px; border-radius:6px; font-weight:700; cursor:pointer;">✏️ Edit</button>
                    </div>` : ''}
            </div>
            <div class="order-detail-section" style="margin-bottom:0;">
                <div class="order-detail-section-title">📍 Delivery Address</div>
                <div style="font-size:13px; color:#111; line-height:1.7;">
                    <div style="font-weight:700;">${addr.full_name || cust.name || 'N/A'}</div>
                    <div>${addr.address || addr.line1 || 'N/A'}</div>
                    ${addr.line2 ? `<div>${addr.line2}</div>` : ''}
                    <div>${[addr.city, addr.state].filter(Boolean).join(', ') || 'N/A'}</div>
                    <div>PIN: ${addr.zip || addr.pincode || 'N/A'}</div>
                </div>
            </div>
        </div>`;

    // ── 6. DELIVERY DETAILS SECTION ────────────────────────────────────────────
    const etaOptions = ['2-4 days','3-5 days','5-7 days','7-10 days','Custom'].map(v => `<option value="${v}" ${deliveryDetails.eta_days===v?'selected':''}>${v}</option>`).join('');
    let deliveryHtml = `
        <div class="order-detail-section">
            <div class="order-detail-section-title">🚚 Delivery Details</div>
            <div class="delivery-form-grid">
                <div>
                    <label class="delivery-form-label">Delivery Partner</label>
                    <input list="del-partners-list-${data.id}" class="delivery-form-input" id="del-partner-${data.id}" type="text" placeholder="e.g. India Post, Delhivery, DTDC..." value="${deliveryDetails.partner || ''}">
                    <datalist id="del-partners-list-${data.id}">
                        <option value="India Post">India Post (Speed Post / Parcel)</option>
                        <option value="India Post (Speed Post)">India Post (Speed Post)</option>
                        <option value="Delhivery">Delhivery</option>
                        <option value="DTDC">DTDC</option>
                        <option value="Bluedart">Bluedart</option>
                        <option value="Ekart Logistics">Ekart Logistics</option>
                        <option value="Shadowfax">Shadowfax</option>
                        <option value="Xpressbees">Xpressbees</option>
                        <option value="Professional Couriers">The Professional Couriers</option>
                        <option value="ST Courier">ST Courier</option>
                        <option value="Amazon Shipping">Amazon Shipping</option>
                    </datalist>
                </div>
                <div>
                    <label class="delivery-form-label">Tracking ID / AWB / Consignment No.</label>
                    <input class="delivery-form-input" id="del-tracking-${data.id}" type="text" placeholder="e.g. EM123456789IN or 1234567890" value="${deliveryDetails.tracking_id || ''}">
                </div>
                <div>
                    <label class="delivery-form-label">Expected Delivery Date</label>
                    <input class="delivery-form-input" id="del-eta-date-${data.id}" type="date" value="${deliveryDetails.expected_delivery || ''}">
                </div>
                <div>
                    <label class="delivery-form-label">Delivery ETA Message (shown to customer)</label>
                    <input class="delivery-form-input" id="del-eta-days-${data.id}" type="text"
                        placeholder="e.g. 2-4 working days, 3-5 business days..."
                        value="${deliveryDetails.eta_days || ''}">
                </div>
                <div>
                    <label class="delivery-form-label">Shipping Charge (₹)</label>
                    <input class="delivery-form-input" id="del-charge-${data.id}" type="number" placeholder="0" value="${deliveryDetails.shipping_charge || ''}">
                </div>
                <div>
                    <label class="delivery-form-label">Tracking URL (optional)</label>
                    <input class="delivery-form-input" id="del-track-url-${data.id}" type="url" placeholder="https://..." value="${deliveryDetails.tracking_url || ''}">
                </div>
            </div>
            <button class="btn-save-delivery" onclick="saveDeliveryDetails('${data.id}')">
                💾 Save Delivery Info
            </button>
            ${deliveryDetails.tracking_id ? `<a href="${deliveryDetails.tracking_url || '#'}" target="_blank" style="margin-top:10px; margin-left:10px; display:inline-flex; align-items:center; gap:5px; padding:8px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; font-size:12px; font-weight:700; color:#334155; text-decoration:none;">🔍 Track Shipment</a>` : ''}
        </div>`;

    // ── 7. PAYMENT INFO ────────────────────────────────────────────────────────
    let paymentInfoHtml = `
        <div class="order-detail-section">
            <div class="order-detail-section-title">💳 Payment Information</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; font-size:13px;">
                <div>
                    <div style="font-size:11px; color:#888; font-weight:600; text-transform:uppercase; margin-bottom:3px;">Status</div>
                    <div>${isPaid ? '<span class="badge status-paid" style="font-size:11px;">PAID</span>' : '<span class="badge status-pending" style="font-size:11px;">UNPAID</span>'}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#888; font-weight:600; text-transform:uppercase; margin-bottom:3px;">Method</div>
                    <div style="font-weight:700;">${data.payment_method || 'Razorpay'}</div>
                </div>
                <div>
                    <div style="font-size:11px; color:#888; font-weight:600; text-transform:uppercase; margin-bottom:3px;">Amount Paid</div>
                    <div style="font-weight:800; font-size:16px;">₹${data.total_amount}</div>
                </div>
            </div>
            ${rzpId ? `<div style="margin-top:10px; padding:10px 12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">Razorpay Transaction ID</div>
                    <div style="font-family:monospace; font-size:13px; font-weight:800; color:#0f172a; margin-top:2px;">${rzpId}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="copyRefundText('${rzpId}', this)" style="background:#475569; color:#fff; border:none; padding:5px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:600;">Copy ID</button>
                    <a href="https://dashboard.razorpay.com/app/payments/${rzpId}" target="_blank" style="background:#2563eb; color:#fff; text-decoration:none; padding:5px 12px; border-radius:5px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">Razorpay ↗</a>
                </div>
            </div>` : ''}
        </div>`;

    // ── 8. ORDER ITEMS ─────────────────────────────────────────────────────────
    let itemsHtml = `
        <div class="order-detail-section">
            <div class="order-detail-section-title">🛍️ Ordered Items</div>
            <div style="display:flex; flex-direction:column; gap:10px; max-height:320px; overflow-y:auto; padding-right:4px;">`;

    if (data.order_items && data.order_items.length > 0) {
        let subtotal = 0;
        data.order_items.forEach(item => {
            const productName = item.products?.name || 'Unknown Product';
            const price = item.price_at_purchase || 0;
            const qty = item.quantity || 1;
            const size = item.size || 'N/A';
            const color = item.color || 'N/A';
            const lineTotal = price * qty;
            subtotal += lineTotal;
            const imgUrl = item.image_url || item.products?.product_images?.[0]?.url;
            const imgEl = imgUrl
                ? `<img src="${imgUrl}" alt="${productName}" style="width:72px; height:72px; object-fit:cover; border-radius:8px; border:1px solid #e5e7eb; flex-shrink:0;">`
                : `<div style="width:72px; height:72px; background:#f0f0f0; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:22px; color:#aaa;">🛍️</div>`;
            itemsHtml += `
                <div style="border:1px solid #eaeaea; border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:14px; background:#fafafa;">
                    ${imgEl}
                    <div style="flex-grow:1;">
                        <div style="font-weight:700; font-size:14px; color:#111; margin-bottom:5px;">${productName}</div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
                            <span class="item-tag tag-color">Color: ${color}</span>
                            <span class="item-tag tag-size">Size: ${size}</span>
                            <span class="item-tag tag-qty">Qty: ${qty}</span>
                        </div>
                        <div style="font-size:12px; color:#666;">Unit: <strong>₹${price}</strong></div>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <div style="font-size:10px; color:#888; text-transform:uppercase; font-weight:600;">Total</div>
                        <div style="font-weight:800; font-size:16px; color:#111;">₹${lineTotal}</div>
                    </div>
                </div>`;
        });
        itemsHtml += `
            <div style="display:flex; justify-content:flex-end; padding-top:8px; border-top:1px solid #f0f0f0; margin-top:4px;">
                <div style="font-size:15px; font-weight:800; color:#111;">Grand Total: ₹${data.total_amount}</div>
            </div>`;
    } else {
        itemsHtml += `<div style="color:#e74c3c; padding:15px; text-align:center; background:#fff5f5; border-radius:8px;">No products found for this order.</div>`;
    }
    itemsHtml += `</div></div>`;

    // ── 9. REFUND / REPAYMENT SECTION (existing logic preserved) ───────────────
    let repaymentSectionHtml = '';
    if (isCancelled || isReturned) {
        const hasCustomUpi = !!refundInfo?.upi_id;
        const hasBank = !!(refundInfo?.account_number && refundInfo?.ifsc);
        const upiId = refundInfo?.upi_id || (phoneClean ? phoneClean + '@upi' : '');
        const isRefundSettled = refundInfo?.refund_status === 'refunded' || currentStatus === 'refunded';

        let detailsInnerHtml = '';
        if (hasBank && (!hasCustomUpi || refundInfo?.method === 'Bank Transfer')) {
            detailsInnerHtml = `
                <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-top:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                        <span style="font-size:13px; font-weight:700; color:#1e40af;">🏦 Bank Account Details (NEFT / IMPS)</span>
                        <button onclick="copyRefundText('Account Holder: ${refundInfo.account_holder || cust.name || ''}\\nAccount No: ${refundInfo.account_number}\\nIFSC: ${refundInfo.ifsc}\\nBank: ${refundInfo.bank_name || ''}\\nAmount: ₹${data.total_amount}', this)" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 10px; border-radius:5px; font-size:11px; font-weight:700; cursor:pointer; color:#334155;">📋 Copy All</button>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                        <div><div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">Account Holder</div><div style="font-weight:700; color:#0f172a; margin-top:2px;">${refundInfo.account_holder || cust.name || 'N/A'}</div></div>
                        <div><div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">Bank Name</div><div style="font-weight:700; color:#0f172a; margin-top:2px;">${refundInfo.bank_name || 'N/A'}</div></div>
                        <div>
                            <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">Account Number</div>
                            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                <strong style="font-family:monospace; font-size:14px; color:#0f172a; background:#fff; padding:2px 8px; border-radius:4px; border:1px solid #cbd5e1;">${refundInfo.account_number}</strong>
                                <button onclick="copyRefundText('${refundInfo.account_number}', this)" style="padding:2px 8px; font-size:11px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">Copy</button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">IFSC Code</div>
                            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                <strong style="font-family:monospace; font-size:14px; color:#0f172a; background:#fff; padding:2px 8px; border-radius:4px; border:1px solid #cbd5e1;">${refundInfo.ifsc}</strong>
                                <button onclick="copyRefundText('${refundInfo.ifsc}', this)" style="padding:2px 8px; font-size:11px; background:#334155; color:#fff; border:none; border-radius:4px; cursor:pointer;">Copy</button>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else if (upiId) {
            detailsInnerHtml = `
                <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-top:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                        <span style="font-size:13px; font-weight:700; color:#1e40af;">⚡ UPI ID ${hasCustomUpi ? '(Customer Provided)' : '(From Phone)'}</span>
                        <div style="display:flex; gap:8px;">
                            <button onclick="copyRefundText('${upiId}', this)" style="background:#334155; color:#fff; border:none; padding:5px 12px; border-radius:5px; font-size:11px; font-weight:700; cursor:pointer;">📋 Copy UPI</button>
                            <a href="upi://pay?pa=${upiId}&pn=${encodeURIComponent(cust.name||'Customer')}&am=${data.total_amount}&cu=INR" style="background:#16a34a; color:#fff; text-decoration:none; padding:5px 12px; border-radius:5px; font-size:11px; font-weight:700;">⚡ Pay via UPI</a>
                        </div>
                    </div>
                    <span style="font-family:monospace; font-size:16px; font-weight:800; color:#0f172a; background:#fff; border:1.5px solid #cbd5e1; padding:6px 14px; border-radius:6px; display:inline-block;">${upiId}</span>
                </div>`;
        } else {
            detailsInnerHtml = `<div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:12px 14px; margin-top:10px; font-size:12px; color:#92400e;">ℹ️ Customer has not entered UPI or Bank details. Click "Edit Refund Info" below to record their details.</div>`;
        }

        const isRefundSettledBool = isRefundSettled;
        repaymentSectionHtml = `
            <div style="background:#fff; border:2px solid #dc2626; border-radius:10px; padding:18px; margin-bottom:16px; box-shadow:0 4px 16px rgba(220,38,38,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #fee2e2; padding-bottom:12px; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:34px; height:34px; border-radius:8px; background:#fee2e2; display:flex; align-items:center; justify-content:center; color:#dc2626; font-size:16px; font-weight:800;">₹</div>
                        <div>
                            <div style="font-size:14px; font-weight:800; color:#991b1b;">CUSTOMER REPAYMENT / REFUND DETAILS</div>
                            <div style="font-size:12px; color:#7f1d1d; margin-top:1px;">Total to Repay: <strong style="color:#dc2626; font-size:14px;">₹${data.total_amount}</strong></div>
                        </div>
                    </div>
                    ${isRefundSettledBool ? '<span class="badge status-paid" style="background:#16a34a; color:#fff; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px;">REFUND SETTLED</span>' : '<span class="badge status-cancelled" style="background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px;">REPAYMENT PENDING</span>'}
                </div>
                <div style="display:flex; gap:16px; font-size:12px; color:#475569; background:#fef2f2; padding:8px 12px; border-radius:6px; margin-bottom:12px; flex-wrap:wrap;">
                    <div><strong>Reason:</strong> ${refundInfo?.reason || 'Customer cancelled order'}</div>
                    ${refundInfo?.cancelled_at ? `<div><strong>Cancelled On:</strong> ${new Date(refundInfo.cancelled_at).toLocaleString()}</div>` : ''}
                </div>
                ${detailsInnerHtml}
                ${rzpId ? `<div style="background:#f1f5f9; border-radius:8px; padding:12px 16px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;"><div><div style="font-size:10px; color:#475569; font-weight:700; text-transform:uppercase;">Razorpay Payment ID</div><div style="font-family:monospace; font-size:13px; font-weight:800; color:#0f172a; margin-top:2px;">${rzpId}</div></div><div style="display:flex; gap:8px;"><button onclick="copyRefundText('${rzpId}', this)" style="background:#475569; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:600;">Copy ID</button><a href="https://dashboard.razorpay.com/app/payments/${rzpId}" target="_blank" style="background:#2563eb; color:#fff; text-decoration:none; padding:5px 12px; border-radius:4px; font-size:11px; font-weight:700;">Refund via Razorpay ↗</a></div></div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1.5px solid #fee2e2; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${phoneClean ? (() => {
                            const _refWaMsg = [
                                `Hello ${cust.name || 'there'},`,
                                ``,
                                `Regarding your KAPPA Clothing order cancellation:`,
                                ``,
                                `Order ID: #${data.id.toString().substring(0,8).toUpperCase()}`,
                                `Refund Amount: Rs. ${data.total_amount}`,
                                ``,
                                `Your refund will be processed to your provided UPI/Bank account within 2-4 working days.`,
                                ``,
                                `Thank you for your patience. - KAPPA Team`
                            ].join('\n');
                            return `<a href="https://wa.me/91${phoneClean}?text=${encodeURIComponent(_refWaMsg)}" target="_blank" class="btn-whatsapp-notify">💬 WhatsApp Customer</a>`;
                        })() : ''}
                        <button onclick="openNotifyCustomerModal('${data.id}')" style="background:#fff; border:1.5px solid #cbd5e1; color:#334155; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">✏️ Edit Message</button>
                        <button onclick="openAdminEditRefundModal('${data.id}')" style="background:#fff; border:1.5px solid #cbd5e1; color:#334155; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">💳 Edit Refund Info</button>
                    </div>
                    <div>
                        ${isRefundSettledBool ? `<div style="display:inline-flex; align-items:center; gap:6px; background:#dcfce7; color:#15803d; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800;">✓ Refund Completed (${refundInfo?.refund_ref ? 'Ref: ' + refundInfo.refund_ref : new Date(refundInfo?.refunded_at||Date.now()).toLocaleDateString()})</div>`
                        : `<button onclick="adminMarkOrderRefunded('${data.id}', ${data.total_amount})" style="background:#dc2626; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(220,38,38,0.3);">✅ Mark as Refunded / Repaid</button>`}
                    </div>
                </div>
            </div>`;
    }

    // ── 10. FOOTER ACTIONS ─────────────────────────────────────────────────────
    let footerHtml = `
        <div style="margin-top:20px; padding-top:16px; border-top:1px solid #eee; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <button onclick="document.getElementById('orderDetailsOverlay').style.display='none'" style="background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; padding:9px 18px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">✕ Close</button>
            <button onclick="deleteOrder('${data.id}')" style="background:#dc2626; color:#fff; padding:9px 18px; border:none; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Move to Recycle Bin
            </button>
        </div>`;

    // ── ASSEMBLE ────────────────────────────────────────────────────────────────
    // ── ASSEMBLE ────────────────────────────────────────────────────────────────
    if (isCancelled) {
        const shortId = data.id.toString().substring(0,8).toUpperCase();
        const currentReason = refundInfo?.reason || 'Customer Request';
        let reasonOptionsHtml = CANCELLATION_REASONS.map(r => `
            <option value="${r}" ${r === currentReason ? 'selected' : ''}>${r}</option>
        `).join('');
        if (!CANCELLATION_REASONS.includes(currentReason)) {
            reasonOptionsHtml += `<option value="${currentReason}" selected>${currentReason}</option>`;
        }

        const cancelledDateStr = refundInfo?.cancelled_at 
            ? new Date(refundInfo.cancelled_at).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
            : placedDate;

        let refStatus = (refundInfo?.refund_status || '').toLowerCase().trim();
        if (!refStatus) {
            if (currentStatus.includes('refund') || orderStage === 'refunded') refStatus = 'refunded';
            else if (!isPaid) refStatus = 'no_refund';
            else refStatus = 'pending';
        }

        let refundBadgeHtml = '';
        if (refStatus === 'pending') refundBadgeHtml = `<span class="refund-badge pending">Pending</span>`;
        else if (refStatus === 'processing') refundBadgeHtml = `<span class="refund-badge processing">Processing</span>`;
        else if (refStatus === 'refunded') refundBadgeHtml = `<span class="refund-badge refunded">Refunded</span>`;
        else refundBadgeHtml = `<span class="refund-badge no-refund">No Refund Required</span>`;

        let custRefundBox = '';
        if (refundInfo?.upi_id || refundInfo?.method === 'UPI') {
            const upi = refundInfo.upi_id || (phoneClean ? phoneClean + '@upi' : '');
            custRefundBox = `
                <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px; margin-top:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:11px; font-weight:800; color:#0369a1; text-transform:uppercase;">Customer Refund Payment Account</div>
                            <div style="font-size:15px; font-weight:800; color:#0c4a6e; font-family:monospace; margin-top:2px;">📱 UPI ID: ${upi || 'Not provided'}</div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            ${upi ? `<button onclick="copyTextToClipboard('${upi}', this)" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">📋 Copy UPI ID</button>` : ''}
                            ${phoneClean ? `<a href="https://wa.me/91${phoneClean}?text=${encodeURIComponent('Hello ' + (cust.name||'') + ', regarding your refund of ₹' + data.total_amount + ' for Kappa Clothing order #' + shortId + '...')}" target="_blank" class="btn-whatsapp-notify" style="padding:6px 12px; font-size:12px;">💬 WhatsApp</a>` : ''}
                        </div>
                    </div>
                </div>`;
        } else if (refundInfo?.account_number || refundInfo?.method === 'Bank Transfer') {
            const accNum = refundInfo.account_number || '';
            const ifsc = refundInfo.ifsc || '';
            const holder = refundInfo.account_holder || cust.name || '';
            const bank = refundInfo.bank_name || '';
            const bankText = `Bank: ${bank}\nHolder: ${holder}\nAccount: ${accNum}\nIFSC: ${ifsc}`;

            custRefundBox = `
                <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px; margin-top:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:11px; font-weight:800; color:#0369a1; text-transform:uppercase;">Customer Bank Account Details</div>
                            <div style="font-size:13px; color:#0c4a6e; margin-top:4px; line-height:1.5;">
                                <div><strong>Holder:</strong> ${holder}</div>
                                <div><strong>Account No:</strong> <span style="font-family:monospace; font-weight:700;">${accNum}</span></div>
                                <div><strong>IFSC Code:</strong> <span style="font-family:monospace; font-weight:700;">${ifsc}</span></div>
                                ${bank ? `<div><strong>Bank:</strong> ${bank}</div>` : ''}
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="copyTextToClipboard(\`${bankText}\`, this)" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">📋 Copy Bank Info</button>
                        </div>
                    </div>
                </div>`;
        } else {
            custRefundBox = `
                <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:10px; padding:12px 14px; margin-top:10px; font-size:12px; color:#92400e; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>ℹ️ Customer has not entered UPI or Bank details.</div>
                    <button onclick="openAdminEditRefundModal('${data.id}')" style="background:#d97706; color:#fff; border:none; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">✏️ Edit Refund Info</button>
                </div>`;
        }

        content.innerHTML = `
            <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#333;">
                <div style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="font-size:12px; font-weight:800; color:#dc2626; text-transform:uppercase; letter-spacing:1px;">CANCELLED ORDER</div>
                        <div style="font-size:24px; font-weight:800; color:#0f172a; font-family:monospace; margin-top:2px;">#${shortId}</div>
                        <div style="font-size:12px; color:#991b1b; margin-top:2px;">Placed on: ${placedDate}</div>
                    </div>
                    <span class="badge status-cancelled" style="font-size:12px; padding:6px 14px; border-radius:20px;">CANCELLED</span>
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px;">
                    <div style="font-size:14px; font-weight:800; color:#0f172a; border-bottom:1.5px solid #f1f5f9; padding-bottom:10px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                        👤 Customer
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:13px; color:#334155;">
                        <div><strong>Name:</strong> ${cust.name || cust.full_name || 'Guest'}</div>
                        <div><strong>Phone:</strong> ${cust.phone || 'N/A'}</div>
                        <div><strong>Email:</strong> ${cust.email || 'N/A'}</div>
                        <div style="grid-column:1/-1;"><strong>Delivery Address:</strong> ${addr.address_line1 || cust.address || ''} ${addr.city || ''} ${addr.state || ''} ${addr.pincode || ''}</div>
                    </div>
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px;">
                    <div style="font-size:14px; font-weight:800; color:#0f172a; border-bottom:1.5px solid #f1f5f9; padding-bottom:10px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                        🛍️ Order Items
                    </div>
                    ${itemsHtml}
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px;">
                    <div style="font-size:14px; font-weight:800; color:#0f172a; border-bottom:1.5px solid #f1f5f9; padding-bottom:10px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                        ❌ Cancellation Details
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:13px; color:#334155;">
                        <div>
                            <strong>Reason:</strong>
                            <select onchange="updateOrderCancellationReason('${data.id}', this.value)" style="margin-left:6px; padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px; font-weight:600; background:#fff; color:#334155; cursor:pointer;">
                                ${reasonOptionsHtml}
                            </select>
                        </div>
                        <div><strong>Cancelled By:</strong> ${refundInfo?.cancelled_by || 'Customer'}</div>
                        <div><strong>Cancelled On:</strong> ${cancelledDateStr}</div>
                        <div style="grid-column:1/-1;"><strong>Remarks:</strong> ${refundInfo?.remarks || 'Customer requested cancellation'}</div>
                    </div>
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px;">
                    <div style="font-size:14px; font-weight:800; color:#0f172a; border-bottom:1.5px solid #f1f5f9; padding-bottom:10px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                        💳 Payment Info
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; font-size:13px; color:#334155;">
                        <div><strong>Order Amount:</strong> <span style="font-weight:800; font-size:15px; color:#0f172a;">₹${data.total_amount}</span></div>
                        <div><strong>Payment Status:</strong> ${isPaid ? '<span class="badge status-paid" style="font-size:11px;">PAID</span>' : '<span class="badge status-pending" style="font-size:11px;">UNPAID</span>'}</div>
                        <div><strong>Payment Method:</strong> ${cust.payment_method || data.payment_method || (data.razorpay_payment_id ? 'Razorpay / UPI' : 'COD')}</div>
                        ${rzpId ? `<div><strong>Txn ID:</strong> <span style="font-family:monospace;">${rzpId}</span></div>` : ''}
                    </div>
                </div>

                <div style="background:#fff; border:2px solid #38bdf8; border-radius:12px; padding:18px; margin-bottom:16px; box-shadow:0 4px 12px rgba(56,189,248,0.08);">
                    <div style="font-size:14px; font-weight:800; color:#0369a1; border-bottom:1.5px solid #e0f2fe; padding-bottom:10px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span>💰 Refund & Customer Payment Details</span>
                        ${refundBadgeHtml}
                    </div>
                    <div style="display:flex; gap:16px; font-size:13px; color:#334155; margin-bottom:10px; flex-wrap:wrap;">
                        <div><strong>Refund Amount:</strong> <span style="font-weight:800; font-size:16px; color:#dc2626;">₹${data.total_amount}</span></div>
                        <div><strong>Refund Status:</strong> <strong style="text-transform:uppercase;">${refStatus}</strong></div>
                        ${refundInfo?.refund_ref ? `<div><strong>Ref/UTR:</strong> <span style="font-family:monospace; font-weight:700;">${refundInfo.refund_ref}</span></div>` : ''}
                    </div>
                    ${custRefundBox}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px; flex-wrap:wrap; gap:10px;">
                    <button onclick="document.getElementById('orderDetailsOverlay').style.display='none'; if (typeof loadCancelledOrders === 'function') loadCancelledOrders();" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:9px 18px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">
                        ← Back to Cancelled Orders
                    </button>
                    <div style="display:flex; gap:10px;">
                        <button onclick="openAdminEditRefundModal('${data.id}')" style="background:#fff; border:1.5px solid #cbd5e1; color:#334155; padding:9px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">
                            ✏️ Edit Refund Info
                        </button>
                        <button onclick="openProcessRefundModal('${data.id}')" style="background:#0f172a; color:#fff; border:none; padding:9px 20px; border-radius:8px; font-weight:800; cursor:pointer; font-size:13px; box-shadow:0 4px 12px rgba(15,23,42,0.25);">
                            💳 Process Refund
                        </button>
                    </div>
                </div>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#333;">
            ${paymentBannerHtml}
            ${headerHtml}
            ${timelineHtml}
            ${updateStageHtml}
            ${repaymentSectionHtml}
            ${custGridHtml}
            ${deliveryHtml}
            ${paymentInfoHtml}
            ${itemsHtml}
            ${footerHtml}
        </div>`;
};

// ── UPDATE ORDER STAGE ──────────────────────────────────────────────────────────
window.updateOrderStage = async function (orderId, newStage) {
    if (!newStage) return alert('Please select a stage.');
    const btn = event?.target;
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

    try {
        // Fetch current history
        const { data: ord } = await supabaseClient.from('orders').select('stage_history').eq('id', orderId).single();
        const existing = Array.isArray(ord?.stage_history) ? ord.stage_history : [];
        const newEntry = { stage: newStage, timestamp: new Date().toISOString() };
        const updatedHistory = [...existing.filter(h => h.stage !== newStage), newEntry];

        const { error } = await supabaseClient.from('orders').update({
            order_stage: newStage,
            stage_history: updatedHistory
        }).eq('id', orderId);

        if (error) throw error;

        // Reload detail panel and orders list
        await showOrderDetails(orderId);
        await loadOrders();

    } catch (err) {
        console.error('Error updating order stage:', err);
        alert('Failed to update stage: ' + (err.message || err));
        if (btn) { btn.textContent = '✅ Update Status'; btn.disabled = false; }
    }
};

// ── SAVE DELIVERY DETAILS ───────────────────────────────────────────────────────
window.saveDeliveryDetails = async function (orderId) {
    const partner   = document.getElementById(`del-partner-${orderId}`)?.value.trim() || '';
    const tracking  = document.getElementById(`del-tracking-${orderId}`)?.value.trim() || '';
    const etaDate   = document.getElementById(`del-eta-date-${orderId}`)?.value || '';
    const etaDays   = document.getElementById(`del-eta-days-${orderId}`)?.value || '';
    const charge    = document.getElementById(`del-charge-${orderId}`)?.value || '';
    const trackUrl  = document.getElementById(`del-track-url-${orderId}`)?.value.trim() || '';

    let finalTrackUrl = trackUrl;
    if (!finalTrackUrl && tracking) {
        const pLow = partner.toLowerCase();
        if (pLow.includes('india post') || pLow.includes('indpost') || pLow.includes('speed post')) {
            finalTrackUrl = 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';
        } else if (pLow.includes('delhivery')) {
            finalTrackUrl = `https://www.delhivery.com/track/package/${tracking}`;
        } else if (pLow.includes('dtdc')) {
            finalTrackUrl = 'https://www.dtdc.in/tracking/shipment-tracking.asp';
        } else if (pLow.includes('bluedart')) {
            finalTrackUrl = 'https://www.bluedart.com/tracking';
        } else if (pLow.includes('xpressbees')) {
            finalTrackUrl = 'https://www.xpressbees.com/shipment/tracking';
        }
    }

    const deliveryDetails = {
        partner,
        tracking_id: tracking,
        expected_delivery: etaDate,
        eta_days: etaDays,
        shipping_charge: charge ? parseFloat(charge) : null,
        tracking_url: finalTrackUrl,
        delivery_status: tracking ? 'shipped' : 'not_shipped',
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient.from('orders').update({ delivery_details: deliveryDetails }).eq('id', orderId);
        if (error) throw error;

        // Auto-advance stage to 'shipped' if tracking added and stage is still early
        if (tracking) {
            const { data: ord } = await supabaseClient.from('orders').select('order_stage, stage_history').eq('id', orderId).single();
            const earlyStages = ['incoming', 'confirmed', 'processing', 'packed'];
            if (earlyStages.includes(ord?.order_stage)) {
                const existing = Array.isArray(ord.stage_history) ? ord.stage_history : [];
                const newEntry = { stage: 'shipped', timestamp: new Date().toISOString() };
                await supabaseClient.from('orders').update({
                    order_stage: 'shipped',
                    stage_history: [...existing.filter(h => h.stage !== 'shipped'), newEntry]
                }).eq('id', orderId);
            }
        }

        alert('✅ Delivery details saved!');
        await showOrderDetails(orderId);
        await loadOrders();
    } catch (err) {
        console.error('Error saving delivery details:', err);
        alert('Failed to save delivery details: ' + (err.message || err));
    }
};


// ── CUSTOMER REFUND / REPAYMENT HELPERS ──
window.copyRefundText = function (text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            const orig = btn.innerHTML;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        }
    }).catch(() => {
        alert(text);
    });
};

window.openAdminEditRefundModal = async function (orderId) {
    const modal = document.getElementById('adminRefundEditModal');
    if (!modal) return;
    document.getElementById('adminRefundOrderId').value = orderId;

    try {
        const { data: ord } = await supabaseClient.from('orders').select('customer_details, refund_details').eq('id', orderId).single();
        const cust = ord?.customer_details || {};
        const refund = ord?.refund_details || cust.refund_details || {};

        const methodSelect = document.getElementById('adminRefundMethodSelect');
        const upiInput = document.getElementById('adminUpiInput');
        const accHolder = document.getElementById('adminAccHolder');
        const accNum = document.getElementById('adminAccNum');
        const accIfsc = document.getElementById('adminAccIfsc');
        const bankName = document.getElementById('adminBankName');

        if (refund.method === 'Bank Transfer' || (refund.account_number && !refund.upi_id)) {
            if (methodSelect) methodSelect.value = 'Bank Transfer';
        } else {
            if (methodSelect) methodSelect.value = 'UPI';
        }

        if (upiInput) upiInput.value = refund.upi_id || (cust.phone ? cust.phone.replace(/[^0-9]/g, '').slice(-10) + '@upi' : '');
        if (accHolder) accHolder.value = refund.account_holder || cust.name || '';
        if (accNum) accNum.value = refund.account_number || '';
        if (accIfsc) accIfsc.value = refund.ifsc || '';
        if (bankName) bankName.value = refund.bank_name || '';

        toggleAdminRefundFields();
    } catch (e) {
        console.warn('Could not prefill refund modal:', e);
    }

    modal.style.display = 'flex';
};

window.toggleAdminRefundFields = function () {
    const method = document.getElementById('adminRefundMethodSelect')?.value || 'UPI';
    const upiDiv = document.getElementById('adminUpiFields');
    const bankDiv = document.getElementById('adminBankFields');
    if (method === 'UPI') {
        if (upiDiv) upiDiv.style.display = 'block';
        if (bankDiv) bankDiv.style.display = 'none';
    } else {
        if (upiDiv) upiDiv.style.display = 'none';
        if (bankDiv) bankDiv.style.display = 'flex';
    }
};

window.saveAdminRefundDetails = async function (e) {
    if (e) e.preventDefault();
    const orderId = document.getElementById('adminRefundOrderId')?.value;
    if (!orderId) return;

    const method = document.getElementById('adminRefundMethodSelect')?.value || 'UPI';
    let refundPayload = {
        method: method,
        updated_by_admin: true,
        updated_at: new Date().toISOString()
    };

    if (method === 'UPI') {
        const upi = document.getElementById('adminUpiInput')?.value.trim();
        if (!upi) {
            alert('Please enter a UPI ID.');
            return;
        }
        refundPayload.upi_id = upi;
    } else {
        const holder = document.getElementById('adminAccHolder')?.value.trim();
        const accNum = document.getElementById('adminAccNum')?.value.trim();
        const ifsc = document.getElementById('adminAccIfsc')?.value.trim().toUpperCase();
        const bName = document.getElementById('adminBankName')?.value.trim();

        if (!holder || !accNum || !ifsc) {
            alert('Please provide Account Holder Name, Account Number, and IFSC Code.');
            return;
        }
        refundPayload.account_holder = holder;
        refundPayload.account_number = accNum;
        refundPayload.ifsc = ifsc;
        refundPayload.bank_name = bName;
    }

    try {
        const { data: ord } = await supabaseClient.from('orders').select('customer_details, refund_details').eq('id', orderId).single();
        const cust = ord?.customer_details || {};
        const existingRefund = ord?.refund_details || cust.refund_details || {};
        const mergedRefund = { ...existingRefund, ...refundPayload };
        const updatedCust = { ...cust, refund_details: mergedRefund };

        try {
            await supabaseClient.from('orders').update({
                customer_details: updatedCust,
                refund_details: mergedRefund
            }).eq('id', orderId);
        } catch (_) {
            await supabaseClient.from('orders').update({
                customer_details: updatedCust
            }).eq('id', orderId);
        }

        document.getElementById('adminRefundEditModal').style.display = 'none';
        alert('Customer refund details saved successfully!');
        showOrderDetails(orderId);
        loadOrders();
    } catch (err) {
        console.error('Error saving refund details:', err);
        alert('Error saving refund details: ' + (err.message || err));
    }
};

window.adminMarkOrderRefunded = async function (orderId, amount) {
    const refId = prompt(`Confirm Repayment of ₹${amount}?\nEnter Refund UTR / Reference ID / Transaction ID (optional):`, 'UPI-' + Date.now().toString().slice(-6));
    if (refId === null) return;

    try {
        const { data: ord } = await supabaseClient.from('orders').select('customer_details, refund_details').eq('id', orderId).single();
        const cust = ord?.customer_details || {};
        const refund = ord?.refund_details || cust.refund_details || {};

        const updatedRefund = {
            ...refund,
            refund_status: 'refunded',
            refunded_at: new Date().toISOString(),
            refund_ref: refId || 'Manual Refund'
        };

        const updatedCust = {
            ...cust,
            refund_details: updatedRefund
        };

        try {
            await supabaseClient.from('orders').update({
                status: 'refunded',
                customer_details: updatedCust,
                refund_details: updatedRefund
            }).eq('id', orderId);
        } catch (_) {
            await supabaseClient.from('orders').update({
                status: 'refunded',
                customer_details: updatedCust
            }).eq('id', orderId);
        }

        alert(`Refund of ₹${amount} recorded as completed! Reference: ${refId || 'Manual'}`);
        showOrderDetails(orderId);
        loadOrders();
    } catch (err) {
        console.error('Error recording refund:', err);
        alert('Failed to mark order as refunded: ' + (err.message || err));
    }
};

// ==========================================
// 12. PROMO CODES LOGIC
// ==========================================
let activePromoCodes = [];

async function loadPromoCodes() {
    const container = document.getElementById('promocodes-list-container');
    if (!container) return;
    container.innerHTML = '<p>Loading promo codes...</p>';
    try {
        const response = await fetch('https://ugphxapfbzcrauchwlef.supabase.co/storage/v1/object/public/product-images/promocodes.json?t=' + Date.now());
        if (response.ok) {
            activePromoCodes = await response.json();
        } else {
            activePromoCodes = [];
        }
    } catch (err) {
        console.error("Failed to load promo codes:", err);
        activePromoCodes = [];
    }
    renderPromoCodes();
}

function renderPromoCodes() {
    const container = document.getElementById('promocodes-list-container');
    if (!container) return;
    if (!activePromoCodes || activePromoCodes.length === 0) {
        container.innerHTML = '<p>No active promo codes.</p>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Discount Amount (₹)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    activePromoCodes.forEach((promo, index) => {
        html += `
            <tr>
                <td><strong>${promo.code}</strong></td>
                <td>₹${promo.amount}</td>
                <td>
                    <button class="btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deletePromoCode(${index})">Delete</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

window.addPromoCode = async function () {
    const codeInput = document.getElementById('new-promo-code');
    const amountInput = document.getElementById('new-promo-amount');
    const code = codeInput.value.trim().toUpperCase();
    const amount = Number(amountInput.value);

    if (!code || amount <= 0) {
        alert("Please provide a valid code and amount.");
        return;
    }
    if (activePromoCodes.find(p => p.code === code)) {
        alert("Promo code already exists!");
        return;
    }

    activePromoCodes.push({ code, amount });

    try {
        const configBlob = new Blob([JSON.stringify(activePromoCodes, null, 2)], { type: 'application/json' });
        const { error } = await supabaseClient.storage.from('product-images').upload('promocodes.json', configBlob, {
            upsert: true,
            cacheControl: '0'
        });

        if (error) throw error;
        codeInput.value = '';
        amountInput.value = '';
        renderPromoCodes();
        setTimeout(() => alert('✅ Promo code added successfully!'), 50);
    } catch (err) {
        console.error("Failed to save promo code:", err);
        alert("❌ Error saving promo code: " + err.message);
        activePromoCodes.pop();
    }
};

window.deletePromoCode = async function (index) {
    if (!confirm("Are you sure you want to delete this promo code?")) return;

    const removed = activePromoCodes.splice(index, 1)[0];

    try {
        const configBlob = new Blob([JSON.stringify(activePromoCodes, null, 2)], { type: 'application/json' });
        const { error } = await supabaseClient.storage.from('product-images').upload('promocodes.json', configBlob, {
            upsert: true,
            cacheControl: '0'
        });

        if (error) throw error;
        renderPromoCodes();
    } catch (err) {
        console.error("Failed to delete promo code:", err);
        alert("❌ Error deleting promo code: " + err.message);
        activePromoCodes.splice(index, 0, removed); // revert
    }
};

// ── LIVE STOCK SYNC FOR ADMIN PANEL ──
window.addEventListener('storage', (e) => {
    if (e.key === 'kappa_stock_overrides' || e.key === 'kappa_cached_products' || e.key === 'kappa_orders') {
        if (typeof loadInventory === 'function') {
            loadInventory();
        }
    }
});

// ==========================================
// 13. CUSTOMERS, REVIEWS & SETTINGS LOADERS
// ==========================================
async function loadCustomers() {
    const container = document.getElementById('view-customers');
    if (!container) return;
    const card = container.querySelector('.card') || container;
    card.innerHTML = '<p style="color:#666;">Loading customers...</p>';
    try {
        const { data: profiles, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (!profiles || profiles.length === 0) {
            card.innerHTML = '<h2 class="card-title">Customers</h2><p style="color:#888;">No registered customers found yet.</p>';
            return;
        }
        let html = `
        <h2 class="card-title" style="margin-bottom:20px;">Customer Accounts (${profiles.length})</h2>
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
                <thead>
                    <tr style="border-bottom:2px solid #eee; background:#fafafa;">
                        <th style="padding:12px;">Customer</th>
                        <th style="padding:12px;">Email</th>
                        <th style="padding:12px;">Phone</th>
                        <th style="padding:12px;">Role</th>
                    </tr>
                </thead>
                <tbody>`;
        profiles.forEach(p => {
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:12px; font-weight:600;">${p.full_name || 'Guest User'}</td>
                    <td style="padding:12px;">${p.email || 'N/A'}</td>
                    <td style="padding:12px;">${p.phone || 'N/A'}</td>
                    <td style="padding:12px;"><span style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; background:${p.role === 'admin' ? '#FFD700' : '#e5e7eb'}; color:#111;">${(p.role || 'customer').toUpperCase()}</span></td>
                </tr>`;
        });
        html += `</tbody></table></div>`;
        card.innerHTML = html;
    } catch (e) {
        console.error('Error loading customers:', e);
        card.innerHTML = '<p style="color:red;">Error loading customer list.</p>';
    }
}

async function loadReviews() {
    const container = document.getElementById('view-reviews');
    if (!container) return;
    const card = container.querySelector('.card') || container;
    card.innerHTML = '<p style="color:#666;">Loading customer reviews...</p>';
    try {
        const { data: reviews, error } = await supabaseClient.from('product_reviews').select('*, products(name)').order('created_at', { ascending: false });
        if (error || !reviews || reviews.length === 0) {
            card.innerHTML = '<h2 class="card-title">Customer Reviews</h2><p style="color:#888;">No product reviews submitted yet.</p>';
            return;
        }
        let html = `
        <h2 class="card-title" style="margin-bottom:20px;">Customer Reviews (${reviews.length})</h2>
        <div style="display:flex; flex-direction:column; gap:16px;">`;
        reviews.forEach(r => {
            const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
            html += `
            <div style="border:1px solid #eee; border-radius:10px; padding:16px; background:#fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="font-size:15px;">${r.customer_name || 'Anonymous Customer'}</strong>
                        <span style="color:#FFD700; margin-left:8px; font-size:16px;">${stars}</span>
                    </div>
                    <span style="font-size:12px; color:#999;">${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p style="font-size:13px; color:#555; margin-bottom:6px;">Product: <strong>${r.products?.name || 'Storefront Item'}</strong></p>
                <p style="font-size:14px; color:#222; margin:0;">"${r.comment || r.review_text || ''}"</p>
            </div>`;
        });
        html += `</div>`;
        card.innerHTML = html;
    } catch (e) {
        console.error('Error loading reviews:', e);
        card.innerHTML = '<h2 class="card-title">Customer Reviews</h2><p style="color:#888;">No reviews yet.</p>';
    }
}

async function loadSettings() {
    const adminNameSpan = document.getElementById('settings-admin-name');
    if (!adminNameSpan) return;
    const session = await supabaseClient.auth.getSession();
    if (session?.data?.session?.user) {
        adminNameSpan.textContent = session.data.session.user.email || 'Admin User';
    } else {
        adminNameSpan.textContent = 'Admin User';
    }
}

// ==========================================
// 14. DASHBOARD & ORDERS LOADERS
// ==========================================

// Global state for sales timeframe & live orders cache
let currentSalesTimeframe = '6months';
let allLiveOrdersForDashboard = [];

function computeSalesChartData(timeframeKey, orders) {
    const list = Array.isArray(orders) ? orders : [];
    const now = new Date();

    const getOrderAmt = (o) => {
        const st = (o.status || '').toLowerCase().trim();
        const stage = (o.order_stage || '').toLowerCase().trim();
        if (stage === 'cancelled' || st.includes('cancel')) return 0;
        return Number(o.total_amount || 0);
    };

    let labels = [];
    let values = [];
    let orderCounts = [];

    if (timeframeKey === 'today') {
        labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
        values = [0, 0, 0, 0, 0, 0];
        orderCounts = [0, 0, 0, 0, 0, 0];
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        list.forEach(o => {
            if (!o.created_at) return;
            const d = new Date(o.created_at);
            if (d >= todayStart && d <= now) {
                const hour = d.getHours();
                const slotIdx = Math.min(5, Math.floor(hour / 4));
                values[slotIdx] += getOrderAmt(o);
                orderCounts[slotIdx]++;
            }
        });
    } else if (timeframeKey === '7days') {
        labels = [];
        values = [];
        orderCounts = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const y = d.getFullYear();
            const m = d.getMonth();
            const dayNum = d.getDate();
            const dayStart = new Date(y, m, dayNum, 0, 0, 0);
            const dayEnd = new Date(y, m, dayNum, 23, 59, 59, 999);

            labels.push(dayNames[d.getDay()]);
            let dayRev = 0;
            let dayOrders = 0;
            list.forEach(o => {
                if (!o.created_at) return;
                const od = new Date(o.created_at);
                if (od >= dayStart && od <= dayEnd) {
                    dayRev += getOrderAmt(o);
                    dayOrders++;
                }
            });
            values.push(dayRev);
            orderCounts.push(dayOrders);
        }
    } else if (timeframeKey === '30days') {
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        values = [0, 0, 0, 0];
        orderCounts = [0, 0, 0, 0];
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        list.forEach(o => {
            if (!o.created_at) return;
            const od = new Date(o.created_at);
            if (od >= thirtyDaysAgo && od <= now) {
                const diffDays = Math.floor((od - thirtyDaysAgo) / (24 * 60 * 60 * 1000));
                const weekIdx = Math.min(3, Math.floor(diffDays / 7.5));
                values[weekIdx] += getOrderAmt(o);
                orderCounts[weekIdx]++;
            }
        });
    } else if (timeframeKey === 'thisyear') {
        labels = ['Jan-Feb', 'Mar-Apr', 'May-Jun', 'Jul-Aug', 'Sep-Oct', 'Nov-Dec'];
        values = [0, 0, 0, 0, 0, 0];
        orderCounts = [0, 0, 0, 0, 0, 0];
        const currentYear = now.getFullYear();

        list.forEach(o => {
            if (!o.created_at) return;
            const od = new Date(o.created_at);
            if (od.getFullYear() === currentYear) {
                const month = od.getMonth();
                const biIdx = Math.min(5, Math.floor(month / 2));
                values[biIdx] += getOrderAmt(o);
                orderCounts[biIdx]++;
            }
        });
    } else {
        // Default: 6months
        labels = [];
        values = [];
        orderCounts = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = d.getMonth();
            const y = d.getFullYear();
            const mStart = new Date(y, m, 1);
            const mEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);

            labels.push(monthNames[m]);
            let mRev = 0;
            let mOrders = 0;
            list.forEach(o => {
                if (!o.created_at) return;
                const od = new Date(o.created_at);
                if (od >= mStart && od <= mEnd) {
                    mRev += getOrderAmt(o);
                    mOrders++;
                }
            });
            values.push(mRev);
            orderCounts.push(mOrders);
        }
    }

    const totalRev = values.reduce((a, b) => a + b, 0);
    const totalOrdersInPeriod = orderCounts.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...values, 0);
    const peakIdx = values.indexOf(maxVal);
    const peakLabel = (maxVal > 0 && peakIdx !== -1)
        ? `₹${maxVal.toLocaleString('en-IN')} (${labels[peakIdx]})`
        : '—';
    const avgOrderVal = totalOrdersInPeriod > 0
        ? `₹${Math.round(totalRev / totalOrdersInPeriod).toLocaleString('en-IN')}`
        : '₹0';

    return {
        labels,
        values,
        orders: orderCounts,
        total: `₹${totalRev.toLocaleString('en-IN')}`,
        peak: peakLabel,
        avg: avgOrderVal,
        totalOrders: totalOrdersInPeriod
    };
}

window.changeSalesTimeframe = function(timeframe, btn) {
    currentSalesTimeframe = timeframe;
    document.querySelectorAll('#salesTimeFilters .dash-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderSalesChart(timeframe);
};

window.switchAdminOrdersFilter = async function(stage) {
    await window.switchAdminView('orders');
    if (typeof window.filterOrders === 'function') {
        window.filterOrders(stage);
    }
};

async function loadDashboard() {
    try {
        let liveRevenue = 0;
        let liveOrdersCount = 0;
        let livePaidTotal = 0;
        let liveStatusCounts = {
            incoming: 0,
            processing: 0,
            packed: 0,
            on_the_way: 0,
            delivered: 0,
            cancelled: 0
        };

        // 1. Fetch live orders from Supabase (100% real database)
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('id, total_amount, status, order_stage, created_at');

        allLiveOrdersForDashboard = Array.isArray(orders) ? orders : [];

        if (allLiveOrdersForDashboard.length > 0) {
            allLiveOrdersForDashboard.forEach(o => {
                liveOrdersCount++;
                const st = (o.status || '').toLowerCase().trim();
                const stage = (o.order_stage || '').toLowerCase().trim();
                const amt = Number(o.total_amount || 0);

                if (st === 'paid' || st === 'confirmed' || st === 'delivered') {
                    liveRevenue += amt;
                    livePaidTotal += amt;
                }

                // Map to distribution bucket
                if (stage === 'cancelled' || st.includes('cancel')) {
                    liveStatusCounts.cancelled++;
                } else if (stage === 'delivered' || st.includes('deliver')) {
                    liveStatusCounts.delivered++;
                } else if (stage === 'shipped' || stage === 'out_for_delivery' || (st.includes('out') && st.includes('delivery'))) {
                    liveStatusCounts.on_the_way++;
                } else if (stage === 'packed') {
                    liveStatusCounts.packed++;
                } else if (stage === 'processing') {
                    liveStatusCounts.processing++;
                } else {
                    liveStatusCounts.incoming++;
                }
            });
        }

        // 2. Fetch products and customers counts (100% real database)
        const { count: prodCount } = await supabaseClient.from('products').select('*', { count: 'exact', head: true });
        const { count: custCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });

        // 3. Real database figures (No mock/dummy offsets)
        const finalRevenue = liveRevenue;
        const finalOrders = liveOrdersCount;
        const finalProducts = prodCount || 0;
        const finalCustomers = custCount || 0;

        // 4. Update Top Summary Cards
        const elRev = document.getElementById('dash-revenue');
        if (elRev) elRev.textContent = `₹${finalRevenue.toLocaleString('en-IN')}`;

        const elOrd = document.getElementById('dash-orders');
        if (elOrd) elOrd.textContent = finalOrders;

        const elProd = document.getElementById('dash-products');
        if (elProd) elProd.textContent = finalProducts;

        const elCust = document.getElementById('dash-customers');
        if (elCust) elCust.textContent = finalCustomers;

        // Legacy compatibility
        const legRev = document.getElementById('stat-revenue');
        if (legRev) legRev.textContent = `₹${finalRevenue.toLocaleString('en-IN')}`;
        const legOrd = document.getElementById('stat-orders');
        if (legOrd) legOrd.textContent = finalOrders;
        const legProd = document.getElementById('stat-products');
        if (legProd) legProd.textContent = finalProducts;
        const legCust = document.getElementById('stat-customers');
        if (legCust) legCust.textContent = finalCustomers;

        // 5. Calculate Order Status Donut distribution (100% real live counts)
        const statusDistribution = {
            delivered: liveStatusCounts.delivered,
            on_the_way: liveStatusCounts.on_the_way,
            processing: liveStatusCounts.processing,
            incoming: liveStatusCounts.incoming,
            packed: liveStatusCounts.packed,
            cancelled: liveStatusCounts.cancelled
        };

        const totalDistOrders = liveOrdersCount;

        // Render Donut Chart
        renderOrderDonutChart(statusDistribution, totalDistOrders);

        // 6. Render Sales Overview Chart
        renderSalesChart(currentSalesTimeframe);

        // 7. Update Bottom Management Cards (100% real live counts)
        const pendingCount = statusDistribution.incoming + statusDistribution.processing;
        const cancelledCount = statusDistribution.cancelled;
        const paymentTotal = livePaidTotal;

        const elPending = document.getElementById('dash-bottom-pending');
        if (elPending) elPending.textContent = pendingCount;

        const elCancelled = document.getElementById('dash-bottom-cancelled');
        if (elCancelled) elCancelled.textContent = cancelledCount;

        const elBottomProd = document.getElementById('dash-bottom-products');
        if (elBottomProd) elBottomProd.textContent = finalProducts;

        const elPayments = document.getElementById('dash-bottom-payments');
        if (elPayments) elPayments.textContent = `₹${paymentTotal.toLocaleString('en-IN')}`;

        updateSidebarOrderBadges();
    } catch (e) {
        console.error('Error loading dashboard metrics:', e);
    }
}

// ── RENDER SALES OVERVIEW SVG GRAPH (100% Real Order Data) ──
window.renderSalesChart = function(timeframeKey) {
    const container = document.getElementById('salesChartContainer');
    if (!container) return;

    const data = computeSalesChartData(timeframeKey, allLiveOrdersForDashboard);

    // Update strip values
    const totEl = document.getElementById('sales-period-total');
    if (totEl) totEl.textContent = data.total;
    const peakEl = document.getElementById('sales-peak-month');
    if (peakEl) peakEl.textContent = data.peak;
    const avgEl = document.getElementById('sales-avg-order');
    if (avgEl) avgEl.textContent = data.avg;
    const ordersEl = document.getElementById('sales-period-orders');
    if (ordersEl) ordersEl.textContent = data.totalOrders;

    const W = 620;
    const H = 220;
    const paddingLeft = 55;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 35;

    const chartW = W - paddingLeft - paddingRight;
    const chartH = H - paddingTop - paddingBottom;

    const maxVal = Math.max(...data.values, 0);
    const ceiling = maxVal > 0 ? Math.ceil(maxVal * 1.25) : 100;
    const minVal = 0;
    const range = ceiling - minVal || 1;

    // Calculate (x, y) coordinates for data points
    const points = data.values.map((v, i) => {
        const x = paddingLeft + (i / Math.max(1, data.values.length - 1)) * chartW;
        const y = paddingTop + chartH - ((v - minVal) / range) * chartH;
        return { x, y, val: v, label: data.labels[i], orders: data.orders[i] };
    });

    // Build smooth cubic Bezier curve
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cp1x = p0.x + (p1.x - p0.x) / 2.5;
        const cp1y = p0.y;
        const cp2x = p1.x - (p1.x - p0.x) / 2.5;
        const cp2y = p1.y;
        pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    // Closed path for area gradient fill
    const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`;

    // Horizontal grid lines & Y labels (5 lines)
    let gridLinesHtml = '';
    const ticksCount = 5;
    for (let i = 0; i < ticksCount; i++) {
        const lineY = paddingTop + (i / (ticksCount - 1)) * chartH;
        const tickVal = Math.round(ceiling * (1 - i / (ticksCount - 1)));
        const tickLabel = tickVal >= 1000 ? `₹${(tickVal / 1000).toFixed(tickVal % 1000 === 0 ? 0 : 1)}K` : `₹${tickVal}`;
        gridLinesHtml += `
            <line x1="${paddingLeft}" y1="${lineY}" x2="${W - paddingRight}" y2="${lineY}" stroke="#f1f5f9" stroke-width="1.2" stroke-dasharray="4,4" />
            <text x="${paddingLeft - 8}" y="${lineY + 4}" text-anchor="end" font-size="11" font-weight="600" fill="#94a3b8">${tickLabel}</text>
        `;
    }

    // X axis labels
    let xLabelsHtml = '';
    points.forEach(p => {
        xLabelsHtml += `
            <text x="${p.x}" y="${H - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="#64748b">${p.label}</text>
        `;
    });

    // Data points & interactive hover targets
    let dataPointsHtml = '';
    points.forEach((p, idx) => {
        dataPointsHtml += `
            <g class="chart-point-group" data-idx="${idx}" style="cursor: pointer;">
                <circle cx="${p.x}" cy="${p.y}" r="5.5" fill="#ffffff" stroke="#eab308" stroke-width="3" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />
                <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" class="point-hit-area" />
                <title>${p.label}: ₹${p.val.toLocaleString('en-IN')} (${p.orders} orders)</title>
            </g>
        `;
    });

    container.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; overflow:visible;" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="salesGoldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FFD700" stop-opacity="0.45" />
                    <stop offset="100%" stop-color="#FFD700" stop-opacity="0.02" />
                </linearGradient>
            </defs>
            <!-- Gridlines -->
            ${gridLinesHtml}
            <!-- Area Gradient Fill -->
            <path d="${areaD}" fill="url(#salesGoldGradient)" />
            <!-- Line Stroke -->
            <path d="${pathD}" fill="none" stroke="#eab308" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            <!-- X Axis Labels -->
            ${xLabelsHtml}
            <!-- Data Points -->
            ${dataPointsHtml}
        </svg>
    `;
};

// ── RENDER ORDER STATUS DONUT CHART (100% Real Live Distribution) ──
window.renderOrderDonutChart = function(counts, total) {
    const wrap = document.getElementById('donutChartWrap');
    const legend = document.getElementById('donutLegendContainer');
    if (!wrap || !legend) return;

    const segments = [
        { key: 'delivered', label: 'Delivered', count: counts.delivered || 0, color: '#10b981' },
        { key: 'on_the_way', label: 'On the Way', count: counts.on_the_way || 0, color: '#0284c7' },
        { key: 'processing', label: 'Processing', count: counts.processing || 0, color: '#8b5cf6' },
        { key: 'incoming', label: 'Incoming', count: counts.incoming || 0, color: '#f59e0b' },
        { key: 'packed', label: 'Packed', count: counts.packed || 0, color: '#f97316' },
        { key: 'cancelled', label: 'Cancelled', count: counts.cancelled || 0, color: '#ef4444' }
    ];

    const safeTotal = total > 0 ? total : 1;
    const R = 54;
    const C = 2 * Math.PI * R; // ~339.29

    let cumulativePct = 0;
    let svgSlicesHtml = '';
    let legendHtml = '';

    segments.forEach(s => {
        const pct = total > 0 ? (s.count / safeTotal) : 0;
        const arcLength = pct * C;
        const offset = cumulativePct * C;

        if (s.count > 0) {
            svgSlicesHtml += `
                <circle cx="80" cy="80" r="${R}"
                    fill="transparent"
                    stroke="${s.color}"
                    stroke-width="20"
                    stroke-dasharray="${arcLength} ${C}"
                    stroke-dashoffset="${-offset}"
                    transform="rotate(-90 80 80)"
                    style="transition: stroke-width 0.2s, opacity 0.2s;"
                >
                    <title>${s.label}: ${s.count} orders (${Math.round(pct * 100)}%)</title>
                </circle>
            `;
        }

        cumulativePct += pct;

        const pctFormatted = total > 0 ? Math.round(pct * 100) : 0;
        legendHtml += `
            <div class="donut-legend-row" onclick="switchAdminOrdersFilter('${s.key}')" title="Filter by ${s.label}">
                <div class="donut-legend-left">
                    <span class="donut-legend-dot" style="background:${s.color};"></span>
                    <span>${s.label}</span>
                </div>
                <div class="donut-legend-right">
                    <span class="donut-legend-count">${s.count}</span>
                    <span class="donut-legend-pct">${pctFormatted}%</span>
                </div>
            </div>
        `;
    });

    wrap.innerHTML = `
        <svg viewBox="0 0 160 160" style="width:100%; height:100%;" preserveAspectRatio="xMidYMid meet">
            <!-- Background ring -->
            <circle cx="80" cy="80" r="${R}" fill="transparent" stroke="#f1f5f9" stroke-width="20" />
            <!-- Status Segments -->
            ${svgSlicesHtml}
            <!-- Center Label -->
            <circle cx="80" cy="80" r="42" fill="#ffffff" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.06))" />
            <text x="80" y="76" text-anchor="middle" font-size="22" font-weight="800" fill="#0f172a">${total}</text>
            <text x="80" y="93" text-anchor="middle" font-size="9" font-weight="800" fill="#94a3b8" letter-spacing="0.5">ORDERS</text>
        </svg>
    `;

    legend.innerHTML = legendHtml;
};


// ── DELETE ORDER PERMANENTLY ──
window.deleteOrder = async function (orderId) {
    if (!confirm("Are you sure you want to PERMANENTLY delete this order? This action cannot be undone.")) return;
    try {
        // 1. Delete associated order_items
        await supabaseClient.from('order_items').delete().eq('order_id', orderId);

        // 2. Delete order row
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) throw error;

        // 3. Remove from local storage cache if cached
        try {
            let cachedOrders = JSON.parse(localStorage.getItem('kappa_orders') || '[]');
            cachedOrders = cachedOrders.filter(o => String(o.id) !== String(orderId));
            localStorage.setItem('kappa_orders', JSON.stringify(cachedOrders));
        } catch (_) { }

        alert("✅ Order deleted successfully!");

        // Refresh views
        if (typeof loadOrders === 'function') await loadOrders();
        if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
        if (typeof loadDashboard === 'function') await loadDashboard();
        if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges();

        // Close details overlay if open for this order
        const overlay = document.getElementById('orderDetailsOverlay');
        if (overlay) overlay.style.display = 'none';

    } catch (err) {
        console.error("Error deleting order:", err);
        alert("❌ Failed to delete order: " + (err.message || err));
    }
};

// ==========================================
// CANCELLED ORDERS & REFUND MANAGEMENT MODULE
// ==========================================
let currentCancelledFilter = 'all';
let currentCancelledSearch = '';
let cachedCancelledOrdersList = [];

const CANCELLATION_REASONS = [
    'Customer changed mind',
    'Wrong size',
    'Wrong product ordered',
    'Product unavailable',
    'Delivery delay',
    'Payment issue',
    'Duplicate order',
    'Other'
];

window.filterCancelledOrders = function (filterType) {
    currentCancelledFilter = filterType;
    renderCancelledOrdersView();
};

window.searchCancelledOrders = function (query) {
    currentCancelledSearch = (query || '').toLowerCase().trim();
    renderCancelledOrdersView();
};

window.copyTextToClipboard = function (text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '✓ Copied!';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        } else {
            alert('Copied to clipboard!');
        }
    }).catch(err => {
        console.error('Clipboard write error:', err);
        alert('Copy details:\n' + text);
    });
};

async function loadCancelledOrders() {
    const container = document.getElementById('view-cancelled');
    if (!container) return;
    container.innerHTML = '<div style="padding:40px; text-align:center; color:#666;"><div style="font-size:32px; margin-bottom:10px;">⏳</div><div>Loading cancelled orders & refund requests...</div></div>';

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter: Keep CANCELLED or REFUNDED orders
        cachedCancelledOrdersList = (orders || []).filter(ord => {
            const st = (ord.status || '').toLowerCase().trim();
            const stg = (ord.order_stage || '').toLowerCase().trim();
            return st.includes('cancel') || st.includes('refund') || stg === 'cancelled' || stg === 'refunded';
        });

        renderCancelledOrdersView();
    } catch (e) {
        console.error('Error loading cancelled orders:', e);
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#dc2626;">❌ Error loading cancelled orders.</div>';
    }
}

function parseOrderRefundDetails(ord) {
    const cust = ord.customer_details || {};
    const refundInfo = ord.refund_details || cust.refund_details || ord.cancellation_details || {};
    const isPaid = (ord.payment_status || '').toLowerCase() === 'paid' || (ord.status || '').toLowerCase().includes('paid') || !!ord.razorpay_payment_id;
    
    let refStatus = (refundInfo.refund_status || '').toLowerCase().trim();
    if (!refStatus) {
        if ((ord.status || '').toLowerCase().includes('refund') || (ord.order_stage || '') === 'refunded') {
            refStatus = 'refunded';
        } else if (!isPaid) {
            refStatus = 'no_refund';
        } else {
            refStatus = 'pending';
        }
    }

    const cancelledBy = refundInfo.cancelled_by || (ord.cancelled_by_admin ? 'Admin' : 'Customer');

    return {
        cust,
        refundInfo,
        isPaid,
        refStatus,
        cancelledBy
    };
}

function renderCancelledOrdersView() {
    const container = document.getElementById('view-cancelled');
    if (!container) return;

    const allOrders = cachedCancelledOrdersList || [];

    let totalCancelledCount = allOrders.length;
    let refundPendingCount = 0;
    let refundedCount = 0;
    let customerCancelledCount = 0;
    let adminCancelledCount = 0;
    let totalCancelledValue = 0;

    allOrders.forEach(ord => {
        const { refStatus, cancelledBy } = parseOrderRefundDetails(ord);
        totalCancelledValue += Number(ord.total_amount || 0);

        if (refStatus === 'pending' || refStatus === 'processing') {
            refundPendingCount++;
        } else if (refStatus === 'refunded') {
            refundedCount++;
        }

        if (cancelledBy.toLowerCase() === 'admin') {
            adminCancelledCount++;
        } else {
            customerCancelledCount++;
        }
    });

    // Apply Filter Tab
    let filtered = allOrders.filter(ord => {
        const { refStatus, cancelledBy } = parseOrderRefundDetails(ord);
        if (currentCancelledFilter === 'customer') {
            return cancelledBy.toLowerCase() !== 'admin';
        } else if (currentCancelledFilter === 'admin') {
            return cancelledBy.toLowerCase() === 'admin';
        } else if (currentCancelledFilter === 'pending') {
            return refStatus === 'pending' || refStatus === 'processing';
        } else if (currentCancelledFilter === 'refunded') {
            return refStatus === 'refunded';
        }
        return true;
    });

    // Apply Search
    if (currentCancelledSearch) {
        filtered = filtered.filter(ord => {
            const cust = ord.customer_details || {};
            const idMatch = (ord.id || '').toLowerCase().includes(currentCancelledSearch);
            const nameMatch = (cust.name || cust.full_name || '').toLowerCase().includes(currentCancelledSearch);
            const phoneMatch = (cust.phone || '').toLowerCase().includes(currentCancelledSearch);
            const emailMatch = (cust.email || '').toLowerCase().includes(currentCancelledSearch);
            return idMatch || nameMatch || phoneMatch || emailMatch;
        });
    }

    // Summary Cards Grid HTML
    const cardsHtml = `
        <div class="cancelled-summary-grid">
            <div class="cancelled-summary-card">
                <div class="cancelled-card-icon red">❌</div>
                <div class="cancelled-card-info">
                    <span class="cancelled-card-label">Cancelled Orders</span>
                    <span class="cancelled-card-val">${totalCancelledCount}</span>
                </div>
            </div>
            <div class="cancelled-summary-card">
                <div class="cancelled-card-icon orange">⏳</div>
                <div class="cancelled-card-info">
                    <span class="cancelled-card-label">Refund Pending</span>
                    <span class="cancelled-card-val">${refundPendingCount}</span>
                </div>
            </div>
            <div class="cancelled-summary-card">
                <div class="cancelled-card-icon green">✅</div>
                <div class="cancelled-card-info">
                    <span class="cancelled-card-label">Refunded</span>
                    <span class="cancelled-card-val">${refundedCount}</span>
                </div>
            </div>
            <div class="cancelled-summary-card">
                <div class="cancelled-card-icon purple">💰</div>
                <div class="cancelled-card-info">
                    <span class="cancelled-card-label">Cancelled Value</span>
                    <span class="cancelled-card-val">₹${totalCancelledValue.toLocaleString('en-IN')}</span>
                </div>
            </div>
        </div>
    `;

    // Filters Toolbar HTML
    const toolbarHtml = `
        <div class="cancelled-filters-toolbar">
            <div class="cancelled-pills-group">
                <div class="cancelled-pill ${currentCancelledFilter === 'all' ? 'active' : ''}" onclick="filterCancelledOrders('all')">
                    All <span class="cancelled-pill-count">${totalCancelledCount}</span>
                </div>
                <div class="cancelled-pill ${currentCancelledFilter === 'customer' ? 'active' : ''}" onclick="filterCancelledOrders('customer')">
                    Customer Cancelled <span class="cancelled-pill-count">${customerCancelledCount}</span>
                </div>
                <div class="cancelled-pill ${currentCancelledFilter === 'admin' ? 'active' : ''}" onclick="filterCancelledOrders('admin')">
                    Admin Cancelled <span class="cancelled-pill-count">${adminCancelledCount}</span>
                </div>
                <div class="cancelled-pill ${currentCancelledFilter === 'pending' ? 'active' : ''}" onclick="filterCancelledOrders('pending')">
                    Refund Pending <span class="cancelled-pill-count">${refundPendingCount}</span>
                </div>
                <div class="cancelled-pill ${currentCancelledFilter === 'refunded' ? 'active' : ''}" onclick="filterCancelledOrders('refunded')">
                    Refunded <span class="cancelled-pill-count">${refundedCount}</span>
                </div>
            </div>
            <div class="cancelled-search-box">
                <span class="cancelled-search-icon">🔍</span>
                <input type="text" class="cancelled-search-input" placeholder="Search Order ID / Customer..." value="${currentCancelledSearch}" oninput="searchCancelledOrders(this.value)">
            </div>
        </div>
    `;

    // Table Rows HTML
    let tableRowsHtml = '';
    if (filtered.length === 0) {
        tableRowsHtml = `<tr><td colspan="9" style="padding:40px; text-align:center; color:#888;">No cancelled orders found.</td></tr>`;
    } else {
        filtered.forEach(ord => {
            const { cust, refundInfo, isPaid, refStatus } = parseOrderRefundDetails(ord);
            const shortId = ord.id ? ord.id.substring(0, 8).toUpperCase() : 'N/A';
            const orderDateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A';
            const cancelledDateStr = refundInfo.cancelled_at || ord.updated_at
                ? new Date(refundInfo.cancelled_at || ord.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : orderDateStr;
            const currentReason = refundInfo.reason || 'Customer Request';

            const payMethodStr = cust.payment_method || ord.payment_method || (ord.razorpay_payment_id ? 'Razorpay' : 'UPI/COD');
            const payBadge = isPaid
                ? `<span style="background:#dcfce7; color:#15803d; padding:4px 9px; border-radius:12px; font-size:11px; font-weight:700;">Paid (${payMethodStr})</span>`
                : `<span style="background:#f1f5f9; color:#64748b; padding:4px 9px; border-radius:12px; font-size:11px; font-weight:700;">Unpaid (${payMethodStr})</span>`;

            let reasonOptionsHtml = CANCELLATION_REASONS.map(r => `
                <option value="${r}" ${r === currentReason ? 'selected' : ''}>${r}</option>
            `).join('');
            if (!CANCELLATION_REASONS.includes(currentReason)) {
                reasonOptionsHtml += `<option value="${currentReason}" selected>${currentReason}</option>`;
            }

            let refundBadgeHtml = '';
            if (refStatus === 'pending') {
                refundBadgeHtml = `<span class="refund-badge pending">Pending</span>`;
            } else if (refStatus === 'processing') {
                refundBadgeHtml = `<span class="refund-badge processing">Processing</span>`;
            } else if (refStatus === 'refunded') {
                refundBadgeHtml = `<span class="refund-badge refunded">Refunded</span>`;
            } else {
                refundBadgeHtml = `<span class="refund-badge no-refund">No Refund Required</span>`;
            }

            tableRowsHtml += `
                <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s;" onmouseenter="this.style.background='#fafafa'" onmouseleave="this.style.background='transparent'">
                    <td style="padding:14px 12px; font-family:monospace; font-weight:800; color:#0f172a; font-size:13px;">
                        <a href="javascript:void(0)" onclick="showOrderDetails('${ord.id}')" style="color:#0f172a; text-decoration:none; border-bottom:1px dashed #94a3b8;">#${shortId}</a>
                    </td>
                    <td style="padding:14px 12px;">
                        <div style="font-weight:700; color:#0f172a; font-size:13px;">${cust.name || cust.full_name || 'Guest'}</div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">${cust.phone || cust.email || ''}</div>
                    </td>
                    <td style="padding:14px 12px; font-size:13px; color:#475569; font-weight:500;">${orderDateStr}</td>
                    <td style="padding:14px 12px; font-size:13px; color:#475569; font-weight:500;">${cancelledDateStr}</td>
                    <td style="padding:14px 12px; font-weight:800; color:#0f172a; font-size:14px;">₹${ord.total_amount || 0}</td>
                    <td style="padding:14px 12px;">${payBadge}</td>
                    <td style="padding:14px 12px;">
                        <select onchange="updateOrderCancellationReason('${ord.id}', this.value)" style="padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px; background:#fff; font-weight:600; color:#334155; cursor:pointer;">
                            ${reasonOptionsHtml}
                        </select>
                    </td>
                    <td style="padding:14px 12px;">${refundBadgeHtml}</td>
                    <td style="padding:14px 12px; text-align:right; white-space:nowrap;">
                        <button class="btn-secondary" style="padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer;" onclick="showOrderDetails('${ord.id}')">View</button>
                        <button style="padding:6px 12px; font-size:12px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer; margin-left:6px;" onclick="openProcessRefundModal('${ord.id}')">Process Refund</button>
                    </td>
                </tr>
            `;
        });
    }

    const tableHtml = `
        <div class="card" style="padding:0; overflow:hidden; border-radius:14px; border:1px solid #eef0f3; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="border-bottom:2px solid #e2e8f0; background:#f8fafc; color:#475569; font-weight:700; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">
                            <th style="padding:14px 12px;">Order ID</th>
                            <th style="padding:14px 12px;">Customer</th>
                            <th style="padding:14px 12px;">Order Date</th>
                            <th style="padding:14px 12px;">Cancelled Date</th>
                            <th style="padding:14px 12px;">Amount</th>
                            <th style="padding:14px 12px;">Payment</th>
                            <th style="padding:14px 12px;">Cancellation Reason</th>
                            <th style="padding:14px 12px;">Refund</th>
                            <th style="padding:14px 12px; text-align:right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h2 style="font-size:22px; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:8px;">
                    ❌ Cancelled Orders
                </h2>
                <p style="font-size:13px; color:#64748b; margin-top:4px;">Manage cancelled orders, track refund statuses, and issue customer refunds.</p>
            </div>
        </div>
        ${cardsHtml}
        ${toolbarHtml}
        ${tableHtml}
    `;
}

window.openProcessRefundModal = async function (orderId) {
    const modal = document.getElementById('adminProcessRefundModal');
    if (!modal) return;
    document.getElementById('processRefundOrderId').value = orderId;

    const summaryDiv = document.getElementById('processRefundOrderSummary');
    const custDiv = document.getElementById('processRefundCustomerDetails');
    const statusSelect = document.getElementById('processRefundStatusSelect');
    const refInput = document.getElementById('processRefundRefInput');
    const notesInput = document.getElementById('processRefundNotesInput');

    if (summaryDiv) summaryDiv.innerHTML = '<p style="color:#666;">Loading order details...</p>';
    if (custDiv) custDiv.innerHTML = '';

    modal.style.display = 'flex';

    try {
        const { data: ord, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error || !ord) throw new Error('Order not found');

        const { cust, refundInfo, isPaid, refStatus } = parseOrderRefundDetails(ord);
        const shortId = ord.id ? ord.id.substring(0, 8).toUpperCase() : 'N/A';
        const amount = ord.total_amount || 0;

        summaryDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a; font-family:monospace;">Order #${shortId}</div>
                    <div style="font-size:13px; color:#475569; margin-top:2px;">Customer: <strong>${cust.name || cust.full_name || 'Guest'}</strong> (${cust.phone || cust.email || 'N/A'})</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase;">Refund Amount</div>
                    <div style="font-size:22px; font-weight:800; color:#dc2626;">₹${amount}</div>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:10px; font-size:12px; color:#475569; flex-wrap:wrap; background:#ffffff; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0;">
                <div><strong>Payment Status:</strong> ${isPaid ? '<span style="color:#16a34a; font-weight:700;">PAID</span>' : '<span style="color:#dc2626; font-weight:700;">UNPAID</span>'}</div>
                <div><strong>Payment Method:</strong> ${cust.payment_method || ord.payment_method || (ord.razorpay_payment_id ? 'Razorpay' : 'UPI / COD')}</div>
                ${ord.razorpay_payment_id ? `<div><strong>Razorpay Txn:</strong> <span style="font-family:monospace;">${ord.razorpay_payment_id}</span></div>` : ''}
            </div>
        `;

        let custDetailHtml = '';
        if (refundInfo.upi_id || refundInfo.method === 'UPI') {
            const upi = refundInfo.upi_id || (cust.phone ? cust.phone.replace(/[^0-9]/g, '').slice(-10) + '@upi' : '');
            custDetailHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="font-size:11px; font-weight:800; color:#0369a1; text-transform:uppercase; letter-spacing:0.5px;">Customer Refund Payment Account</div>
                        <div style="font-size:15px; font-weight:800; color:#0c4a6e; font-family:monospace; margin-top:3px;">
                            📱 UPI ID: ${upi || 'Not entered yet'}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${upi ? `<button type="button" onclick="copyTextToClipboard('${upi}', this)" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">📋 Copy UPI ID</button>` : ''}
                        ${cust.phone ? `<a href="https://wa.me/91${cust.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent('Hello ' + (cust.name || '') + ', regarding your refund of ₹' + amount + ' for Kappa Clothing order #' + shortId + '...')}" target="_blank" class="btn-whatsapp-notify" style="padding:6px 12px; font-size:12px;">💬 WhatsApp</a>` : ''}
                    </div>
                </div>
            `;
        } else if (refundInfo.account_number || refundInfo.method === 'Bank Transfer') {
            const accNum = refundInfo.account_number || '';
            const ifsc = refundInfo.ifsc || '';
            const holder = refundInfo.account_holder || cust.name || '';
            const bank = refundInfo.bank_name || '';
            const bankText = `Bank: ${bank}\nHolder: ${holder}\nAccount: ${accNum}\nIFSC: ${ifsc}`;

            custDetailHtml = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="font-size:11px; font-weight:800; color:#0369a1; text-transform:uppercase; letter-spacing:0.5px;">Customer Bank Account Details</div>
                        <div style="font-size:13px; color:#0c4a6e; margin-top:4px; line-height:1.5;">
                            <div><strong>Holder:</strong> ${holder}</div>
                            <div><strong>Account No:</strong> <span style="font-family:monospace; font-weight:700;">${accNum}</span></div>
                            <div><strong>IFSC Code:</strong> <span style="font-family:monospace; font-weight:700;">${ifsc}</span></div>
                            ${bank ? `<div><strong>Bank:</strong> ${bank}</div>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="copyTextToClipboard(\`${bankText}\`, this)" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">📋 Copy Bank Info</button>
                    </div>
                </div>
            `;
        } else {
            custDetailHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="font-size:13px; color:#b45309; font-weight:600;">
                        ⚠️ Customer has not provided UPI ID or Bank details yet.
                    </div>
                    <button type="button" onclick="openAdminEditRefundModal('${ord.id}')" style="background:#d97706; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">
                        ✏️ Enter Payment Details
                    </button>
                </div>
            `;
        }

        custDiv.innerHTML = custDetailHtml;

        if (statusSelect) {
            if (['pending', 'processing', 'refunded', 'no_refund'].includes(refStatus)) {
                statusSelect.value = refStatus;
            } else {
                statusSelect.value = isPaid ? 'pending' : 'no_refund';
            }
        }
        if (refInput) refInput.value = refundInfo.refund_ref || '';
        if (notesInput) notesInput.value = refundInfo.remarks || '';

        toggleProcessRefundFields();
    } catch (e) {
        console.error('Error loading process refund modal:', e);
        if (summaryDiv) summaryDiv.innerHTML = '<p style="color:red;">Failed to load order for refund processing.</p>';
    }
};

window.toggleProcessRefundFields = function () {
    const status = document.getElementById('processRefundStatusSelect')?.value;
    const refDiv = document.getElementById('processRefundRefDiv');
    if (refDiv) {
        if (status === 'refunded') {
            refDiv.style.display = 'block';
        } else {
            refDiv.style.display = 'none';
        }
    }
};

window.saveProcessRefund = async function (e) {
    if (e) e.preventDefault();
    const orderId = document.getElementById('processRefundOrderId')?.value;
    if (!orderId) return;

    const status = document.getElementById('processRefundStatusSelect')?.value || 'pending';
    const refId = document.getElementById('processRefundRefInput')?.value.trim() || '';
    const notes = document.getElementById('processRefundNotesInput')?.value.trim() || '';

    try {
        const { data: ord } = await supabaseClient.from('orders').select('*').eq('id', orderId).single();
        if (!ord) throw new Error('Order not found');

        const cust = ord.customer_details || {};
        const existingRefund = ord.refund_details || cust.refund_details || {};

        const updatedRefund = {
            ...existingRefund,
            refund_status: status,
            refund_ref: refId || existingRefund.refund_ref || (status === 'refunded' ? 'Manual Refund' : ''),
            refunded_at: status === 'refunded' ? (existingRefund.refunded_at || new Date().toISOString()) : existingRefund.refunded_at,
            remarks: notes || existingRefund.remarks || ''
        };

        const updatedCust = {
            ...cust,
            refund_details: updatedRefund
        };

        const updatePayload = {
            customer_details: updatedCust,
            refund_details: updatedRefund
        };

        if (status === 'refunded') {
            updatePayload.status = 'refunded';
            updatePayload.order_stage = 'refunded';
        } else {
            updatePayload.status = 'cancelled';
            updatePayload.order_stage = 'cancelled';
        }

        try {
            await supabaseClient.from('orders').update(updatePayload).eq('id', orderId);
        } catch (_) {
            delete updatePayload.refund_details;
            await supabaseClient.from('orders').update(updatePayload).eq('id', orderId);
        }

        document.getElementById('adminProcessRefundModal').style.display = 'none';
        alert(`Refund status updated to "${status.toUpperCase()}"!`);

        if (typeof showOrderDetails === 'function' && document.getElementById('orderDetailsOverlay')?.style.display !== 'none') {
            await showOrderDetails(orderId);
        }
        await loadCancelledOrders();
        if (typeof loadOrders === 'function') await loadOrders();
    } catch (err) {
        console.error('Error saving process refund:', err);
        alert('Failed to save refund status: ' + (err.message || err));
    }
};

window.updateOrderCancellationReason = async function (orderId, newReason) {
    if (!orderId || !newReason) return;
    try {
        const { data: ord } = await supabaseClient.from('orders').select('*').eq('id', orderId).single();
        if (!ord) return;

        const cust = ord.customer_details || {};
        const existingRefund = ord.refund_details || cust.refund_details || {};

        const updatedRefund = {
            ...existingRefund,
            reason: newReason,
            cancelled_at: existingRefund.cancelled_at || new Date().toISOString()
        };

        const updatedCust = {
            ...cust,
            refund_details: updatedRefund
        };

        try {
            await supabaseClient.from('orders').update({
                customer_details: updatedCust,
                refund_details: updatedRefund
            }).eq('id', orderId);
        } catch (_) {
            await supabaseClient.from('orders').update({
                customer_details: updatedCust
            }).eq('id', orderId);
        }

        alert(`Cancellation reason updated to "${newReason}"`);
        await loadCancelledOrders();
    } catch (e) {
        console.error('Error updating cancellation reason:', e);
        alert('Error updating cancellation reason: ' + (e.message || e));
    }
};

// ── SIDEBAR NOTIFICATION BADGES ──
async function updateSidebarOrderBadges() {
    const ordersBadge = document.getElementById('nav-badge-orders');
    const cancelledBadge = document.getElementById('nav-badge-cancelled');

    try {
        const { data: orders } = await supabaseClient.from('orders').select('status');
        if (orders) {
            let activeCount = 0;
            let cancelledCount = 0;

            orders.forEach(o => {
                const st = (o.status || '').toLowerCase().trim();
                if (st !== 'pending') {
                    if (st.includes('cancel')) {
                        cancelledCount++;
                    } else {
                        activeCount++;
                    }
                }
            });

            if (ordersBadge) {
                if (activeCount > 0) {
                    ordersBadge.textContent = activeCount;
                    ordersBadge.style.display = 'inline-flex';
                } else {
                    ordersBadge.style.display = 'none';
                }
            }

            if (cancelledBadge) {
                if (cancelledCount > 0) {
                    cancelledBadge.textContent = cancelledCount;
                    cancelledBadge.style.display = 'inline-flex';
                } else {
                    cancelledBadge.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.warn('Could not update sidebar badges:', e);
    }
}

// ==========================================
// EXPLORE CARDS CMS ADMIN CONTROLLER
// ==========================================
let currentAdminExploreCards = [];
let tempSelectedProductIds = [];
let allStoreProductsForPicker = [];

async function loadExploreCardsAdmin() {
    const tbody = document.getElementById('explore-cards-admin-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="padding:30px; text-align:center; color:#888;">Loading explore cards...</td></tr>';

    await populateExploreCategoriesDropdown();

    let cards = [];
    try {
        const { data, error } = await supabaseClient
            .from('explore_cards')
            .select('*')
            .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) cards = data;
    } catch (e) { }

    if (cards.length === 0) {
        try {
            const local = JSON.parse(localStorage.getItem('kappa_explore_cards') || '[]');
            cards = local;
        } catch (e) { }
    }

    if (cards.length === 0) {
        cards = [
            {
                id: 'demo-1',
                title: 'BEST SELLER',
                subtitle: 'denim',
                tag_label: 'Men >',
                image_url: 'assets/mens_denim_banner.png',
                selection_type: 'collection',
                collection_id: 'best_sellers',
                button_text: 'SHOP NOW',
                display_order: 1,
                is_active: true
            },
            {
                id: 'demo-2',
                title: 'PANTS &',
                subtitle: 'trousers',
                tag_label: 'Men >',
                image_url: 'assets/duplicate.png',
                selection_type: 'category',
                destination_url: 'pants',
                button_text: 'SHOP NOW',
                display_order: 2,
                is_active: true
            },
            {
                id: 'demo-3',
                title: 'TRENDING',
                subtitle: 'shirts',
                tag_label: 'Men >',
                image_url: 'assets/Frame 4.webp',
                selection_type: 'category',
                destination_url: 'shirts',
                button_text: 'SHOP NOW',
                display_order: 3,
                is_active: true
            },
            {
                id: 'demo-4',
                title: 'NEW',
                subtitle: 'arrivals',
                tag_label: 'Women >',
                image_url: 'assets/WOMENFASHION.png',
                selection_type: 'collection',
                collection_id: 'new_arrivals',
                button_text: 'SHOP NOW',
                display_order: 4,
                is_active: true
            }
        ];
        localStorage.setItem('kappa_explore_cards', JSON.stringify(cards));
    }

    currentAdminExploreCards = cards.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    renderExploreCardsAdminTable(currentAdminExploreCards);
}

let allCategoriesDataAdmin = [];

async function populateExploreCategoriesDropdown() {
    const select = document.getElementById('explore-form-category-id');
    const mainCatSelect = document.getElementById('explore-form-main-category-id');
    if (!select) return;

    try {
        const { data, error } = await supabaseClient.from('categories').select('*').order('name', { ascending: true });
        if (error || !data) return;

        allCategoriesDataAdmin = data;

        const roots = data.filter(c => !c.parent_id);
        const children = data.filter(c => c.parent_id);

        // Populate Main Parent Category Dropdown
        if (mainCatSelect) {
            let mainHtml = '<option value="">All Main Categories</option>';
            roots.forEach(r => {
                mainHtml += `<option value="${r.id}">${r.name}</option>`;
            });
            mainCatSelect.innerHTML = mainHtml;
        }

        // Populate Sub-Category Dropdown grouped by Main Parent Category
        let html = '<option value="">Select Sub-Category</option>';
        roots.forEach(root => {
            html += `<option value="${root.id}" style="font-weight:bold; background:#f0f0f0;">📁 ALL ${root.name.toUpperCase()}</option>`;
            const myChildren = children.filter(c => c.parent_id === root.id);
            if (myChildren.length > 0) {
                html += `<optgroup label="${root.name}">`;
                myChildren.forEach(child => {
                    html += `<option value="${child.id}" data-parent="${root.id}">${root.name} ↳ ${child.name}</option>`;
                });
                html += `</optgroup>`;
            }
        });

        const orphanChildren = children.filter(c => !roots.some(r => r.id === c.parent_id));
        if (orphanChildren.length > 0) {
            html += `<optgroup label="Other Categories">`;
            orphanChildren.forEach(c => {
                html += `<option value="${c.id}">${c.name}</option>`;
            });
            html += `</optgroup>`;
        }

        select.innerHTML = html;

        const pickerCatSelect = document.getElementById('picker-category-filter');
        if (pickerCatSelect) {
            pickerCatSelect.innerHTML = '<option value="">All Categories</option>' + data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch (e) { }
}

window.onExploreMainCategoryChange = function () {
    const mainCatSelect = document.getElementById('explore-form-main-category-id');
    const subCatSelect = document.getElementById('explore-form-category-id');
    const tagInput = document.getElementById('explore-form-tag');

    if (!mainCatSelect || !subCatSelect) return;
    const selectedMainId = mainCatSelect.value;

    if (selectedMainId && allCategoriesDataAdmin.length > 0) {
        const mainObj = allCategoriesDataAdmin.find(c => c.id === selectedMainId);
        if (mainObj) {
            if (tagInput) tagInput.value = `${mainObj.name} >`;
            updateExplorePreview();
        }

        // Filter subcategory dropdown to options under this main category
        for (let option of subCatSelect.options) {
            const parentId = option.getAttribute('data-parent');
            if (!option.value) {
                option.style.display = 'block';
            } else if (option.value === selectedMainId || parentId === selectedMainId) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        }
    } else {
        for (let option of subCatSelect.options) {
            option.style.display = 'block';
        }
    }
};

window.onExploreSubCategoryChange = function () {
    const subCatSelect = document.getElementById('explore-form-category-id');
    const mainCatSelect = document.getElementById('explore-form-main-category-id');
    const tagInput = document.getElementById('explore-form-tag');

    if (!subCatSelect) return;
    const selectedSubId = subCatSelect.value;
    if (!selectedSubId || allCategoriesDataAdmin.length === 0) return;

    const subObj = allCategoriesDataAdmin.find(c => c.id === selectedSubId);
    if (subObj) {
        if (subObj.parent_id && mainCatSelect) {
            mainCatSelect.value = subObj.parent_id;
            const parentObj = allCategoriesDataAdmin.find(c => c.id === subObj.parent_id);
            if (parentObj && tagInput && (!tagInput.value || tagInput.value === 'Explore >')) {
                tagInput.value = `${parentObj.name} >`;
            }
        } else if (!subObj.parent_id && mainCatSelect) {
            mainCatSelect.value = subObj.id;
            if (tagInput && (!tagInput.value || tagInput.value === 'Explore >')) {
                tagInput.value = `${subObj.name} >`;
            }
        }
        updateExplorePreview();
    }
};

function renderExploreCardsAdminTable(cards) {
    const tbody = document.getElementById('explore-cards-admin-tbody');
    if (!tbody) return;

    if (cards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:30px; text-align:center; color:#888;">No explore cards created yet. Click "+ Create Explore" to add one.</td></tr>';
        return;
    }

    let html = '';
    cards.forEach((card, idx) => {
        const img = card.image_url || 'assets/mens_denim_banner.png';
        const isPublished = card.is_active !== false;

        let targetDetail = 'General';
        if (card.selection_type === 'category') {
            if (card.category_id && allCategoriesDataAdmin.length > 0) {
                const catObj = allCategoriesDataAdmin.find(c => c.id === card.category_id);
                if (catObj) {
                    if (catObj.parent_id) {
                        const parentCat = allCategoriesDataAdmin.find(c => c.id === catObj.parent_id);
                        targetDetail = parentCat ? `<strong>${parentCat.name}</strong> ↳ ${catObj.name}` : catObj.name;
                    } else {
                        targetDetail = `<strong>${catObj.name}</strong> (Main)`;
                    }
                } else {
                    targetDetail = card.destination_url || 'Category';
                }
            } else {
                targetDetail = card.destination_url || card.title || 'Category';
            }
        }
        else if (card.selection_type === 'collection') targetDetail = `Collection: ${card.collection_id || 'new_arrivals'}`;
        else if (card.selection_type === 'specific_products') targetDetail = `${(card.product_ids || []).length} Selected Products`;
        else if (card.selection_type === 'sale') targetDetail = 'Sale Items';
        else if (card.selection_type === 'custom_url') targetDetail = card.destination_url || 'URL';

        html += `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px;">
                <div style="width:48px; height:58px; border-radius:6px; overflow:hidden; background:#eee; border:1px solid #ddd;">
                    <img src="${img}" style="width:100%; height:100%; object-fit:cover;" alt="Card Image">
                </div>
            </td>
            <td style="padding:12px;">
                <strong style="font-size:14px; display:block; text-transform:uppercase; color:#111;">${card.title}</strong>
                <span style="font-size:12px; color:#d97706; font-family:serif; font-style:italic;">${card.subtitle || ''}</span>
                <span style="display:block; font-size:10px; color:#888;">${card.tag_label || 'Explore >'}</span>
            </td>
            <td style="padding:12px;">
                <span style="background:#eef2ff; color:#4f46e5; font-size:11px; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase; display:inline-block;">${card.selection_type || 'category'}</span>
            </td>
            <td style="padding:12px; font-size:12px; color:#555;">
                ${targetDetail}
            </td>
            <td style="padding:12px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-weight:700; font-size:13px;">${card.display_order || idx + 1}</span>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <button onclick="reorderExploreCard('${card.id}', -1)" style="border:none; background:#eee; font-size:9px; cursor:pointer; padding:1px 4px; border-radius:2px;">▲</button>
                        <button onclick="reorderExploreCard('${card.id}', 1)" style="border:none; background:#eee; font-size:9px; cursor:pointer; padding:1px 4px; border-radius:2px;">▼</button>
                    </div>
                </div>
            </td>
            <td style="padding:12px;">
                <button onclick="toggleExploreCardStatus('${card.id}')" style="border:none; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; background:${isPublished ? '#dcfce7; color:#15803d' : '#f3f4f6; color:#6b7280'};">
                    ${isPublished ? 'Published' : 'Draft'}
                </button>
            </td>
            <td style="padding:12px; text-align:right;">
                <div style="display:flex; justify-content:flex-end; gap:6px;">
                    <button onclick="openExploreModal('${card.id}')" style="background:#f0f9ff; color:#0284c7; border:none; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Edit</button>
                    <button onclick="duplicateExploreCard('${card.id}')" style="background:#fef3c7; color:#d97706; border:none; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Duplicate</button>
                    <button onclick="deleteExploreCard('${card.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Delete</button>
                </div>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

window.openExploreModal = function (cardId) {
    const modal = document.getElementById('explore-modal');
    if (!modal) return;

    document.getElementById('explore-card-form').reset();
    document.getElementById('explore-form-id').value = '';
    document.getElementById('explore-modal-title').textContent = cardId ? 'EDIT EXPLORE CARD' : 'CREATE EXPLORE CARD';
    tempSelectedProductIds = [];

    if (cardId) {
        const card = currentAdminExploreCards.find(c => c.id === cardId);
        if (card) {
            document.getElementById('explore-form-id').value = card.id;
            document.getElementById('explore-form-title').value = card.title || '';
            document.getElementById('explore-form-subtitle').value = card.subtitle || '';
            document.getElementById('explore-form-tag').value = card.tag_label || 'Explore >';
            document.getElementById('explore-form-btn-text').value = card.button_text || 'SHOP NOW';
            document.getElementById('explore-form-order').value = card.display_order || 1;
            document.getElementById('explore-form-status').value = (card.is_active !== false).toString();
            document.getElementById('explore-form-image-url').value = card.image_url || '';

            const radio = document.querySelector(`input[name="selection_type"][value="${card.selection_type || 'category'}"]`);
            if (radio) radio.checked = true;

            if (card.category_id) {
                document.getElementById('explore-form-category-id').value = card.category_id;
                if (allCategoriesDataAdmin.length > 0) {
                    const catObj = allCategoriesDataAdmin.find(c => c.id === card.category_id);
                    if (catObj && catObj.parent_id) {
                        const mainEl = document.getElementById('explore-form-main-category-id');
                        if (mainEl) mainEl.value = catObj.parent_id;
                    } else if (catObj && !catObj.parent_id) {
                        const mainEl = document.getElementById('explore-form-main-category-id');
                        if (mainEl) mainEl.value = catObj.id;
                    }
                }
            }
            if (card.main_category_id) {
                const mainEl = document.getElementById('explore-form-main-category-id');
                if (mainEl) mainEl.value = card.main_category_id;
            }

            if (card.collection_id) document.getElementById('explore-form-collection-id').value = card.collection_id;
            if (card.destination_url) document.getElementById('explore-form-destination-url').value = card.destination_url;

            const displayModeRadio = document.querySelector(`input[name="explore_display_mode"][value="${card.display_mode || 'cover'}"]`);
            if (displayModeRadio) displayModeRadio.checked = true;

            tempSelectedProductIds = card.product_ids || [];
        }
    } else {
        document.getElementById('explore-form-order').value = currentAdminExploreCards.length + 1;
    }

    toggleExploreSelectionFields();
    updateExplorePreview();
    updateSelectedProdTagsUI();
    modal.style.display = 'flex';
};

window.closeExploreModal = function () {
    const modal = document.getElementById('explore-modal');
    if (modal) modal.style.display = 'none';
};

window.toggleExploreSelectionFields = function () {
    const type = document.querySelector('input[name="selection_type"]:checked')?.value || 'category';
    document.querySelectorAll('.explore-type-field').forEach(el => el.style.display = 'none');

    if (type === 'category') document.getElementById('field-explore-category').style.display = 'block';
    else if (type === 'collection') document.getElementById('field-explore-collection').style.display = 'block';
    else if (type === 'specific_products') document.getElementById('field-explore-products').style.display = 'block';
    else if (type === 'custom_url') document.getElementById('field-explore-custom-url').style.display = 'block';
};

window.updateExplorePreview = function (overrideUrl) {
    const title = document.getElementById('explore-form-title')?.value || 'TRENDING SHIRTS';
    const subtitle = document.getElementById('explore-form-subtitle')?.value || 'shirts';
    const tag = document.getElementById('explore-form-tag')?.value || 'Explore >';
    const btnText = document.getElementById('explore-form-btn-text')?.value || 'SHOP NOW';

    const fileInput = document.getElementById('explore-form-image-file');
    const previewFileUrl = fileInput && fileInput._previewObjectUrl ? fileInput._previewObjectUrl : null;
    let inputUrl = document.getElementById('explore-form-image-url')?.value.trim();
    if (inputUrl && inputUrl.startsWith('blob:')) inputUrl = '';

    let imgUrl = overrideUrl || previewFileUrl || inputUrl || 'assets/mens_denim_banner.png';
    const displayMode = document.querySelector('input[name="explore_display_mode"]:checked')?.value || 'cover';

    const prevTitle = document.getElementById('explore-prev-title');
    const prevSub = document.getElementById('explore-prev-subtitle');
    const prevTag = document.getElementById('explore-prev-tag');
    const prevBtn = document.getElementById('explore-prev-btn');
    const prevImg = document.getElementById('explore-prev-img');

    if (prevTitle) prevTitle.textContent = title.toUpperCase();
    if (prevSub) prevSub.textContent = subtitle;
    if (prevTag) prevTag.textContent = tag;
    if (prevBtn) prevBtn.textContent = btnText;
    if (prevImg) {
        prevImg.src = imgUrl;
        prevImg.style.objectFit = displayMode;
    }
};
window.previewExploreImageFile = async function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        input._previewObjectUrl = URL.createObjectURL(file);
        input.croppedBlob = null; // Use original pristine uncompressed file
        updateExplorePreview(input._previewObjectUrl);
        if (typeof getImageMetadata === 'function') {
            const meta = await getImageMetadata(file);
            const badge = document.getElementById('explore-img-meta-badge');
            if (badge && meta) {
                badge.innerHTML = `<span class="img-meta-pill" style="display:inline-flex; align-items:center; gap:5px; background:#1e293b; color:#f8fafc; font-size:10px; font-weight:600; padding:2px 8px; border-radius:10px; margin-top:4px; border:1px solid #334155;">📷 ${meta.width}×${meta.height} px • ${meta.size} • <strong style="color:#fbbf24;">${meta.format}</strong></span>`;
                badge.style.display = 'block';
            }
        }
    }
};
window.saveExploreCardForm = async function (e) {
    e.preventDefault();
    const submitBtn = document.getElementById('explore-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving Explore Card...';
    submitBtn.disabled = true;
    try {
        const id = document.getElementById('explore-form-id').value;
        const title = document.getElementById('explore-form-title').value.trim();
        const subtitle = document.getElementById('explore-form-subtitle').value.trim();
        const tag_label = document.getElementById('explore-form-tag').value.trim() || 'Explore >';
        const button_text = document.getElementById('explore-form-btn-text').value.trim() || 'SHOP NOW';
        const display_order = parseInt(document.getElementById('explore-form-order').value) || 1;
        const is_active = document.getElementById('explore-form-status').value === 'true';
        const selection_type = document.querySelector('input[name="selection_type"]:checked')?.value || 'category';
        const category_id = document.getElementById('explore-form-category-id')?.value || null;
        const main_category_id = document.getElementById('explore-form-main-category-id')?.value || null;
        const collection_id = document.getElementById('explore-form-collection-id')?.value || 'new_arrivals';
        const destination_url = document.getElementById('explore-form-destination-url')?.value.trim() || '';
        const display_mode = document.querySelector('input[name="explore_display_mode"]:checked')?.value || 'cover';
        let image_url = document.getElementById('explore-form-image-url').value.trim();
        if (image_url.startsWith('blob:')) image_url = '';
        const imageFileInput = document.getElementById('explore-form-image-file');
        const rawFile = imageFileInput ? imageFileInput.files[0] : null;
        const croppedBlob = imageFileInput ? imageFileInput.croppedBlob : null;
        const imageFile = croppedBlob ? new File([croppedBlob], rawFile ? rawFile.name : "explore_card.png", { type: croppedBlob.type || "image/png" }) : rawFile;
        if (imageFile) {
            try {
                image_url = await uploadHomepageFile(imageFile, 'explore_card');
            } catch (err) {
                console.error('Error uploading explore card image:', err);
                alert('Could not upload image to Storage: ' + (err.message || err));
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }
        }
        if (!image_url) {
            image_url = 'assets/mens_denim_banner.png';
        }
        const cardData = {
            title,
            subtitle,
            tag_label,
            button_text,
            display_order,
            is_active,
            selection_type,
            category_id,
            main_category_id,
            collection_id,
            product_ids: tempSelectedProductIds,
            destination_url,
            image_url,
            display_mode,
            updated_at: new Date().toISOString()
        };
        let savedCard = null;
        if (id && !id.startsWith('demo-')) {
            const { data, error } = await supabaseClient
                .from('explore_cards')
                .update(cardData)
                .eq('id', id)
                .select()
                .single();

            if (!error && data) savedCard = data;
        } else {
            const { data, error } = await supabaseClient
                .from('explore_cards')
                .insert([cardData])
                .select()
                .single();

            if (!error && data) savedCard = data;
        }
        let localCards = JSON.parse(localStorage.getItem('kappa_explore_cards') || '[]');
        if (id) {
            const idx = localCards.findIndex(c => c.id === id);
            if (idx >= 0) localCards[idx] = { ...localCards[idx], ...cardData };
            else localCards.push({ id: savedCard ? savedCard.id : 'card_' + Date.now(), ...cardData });
        } else {
            localCards.push({ id: savedCard ? savedCard.id : 'card_' + Date.now(), ...cardData });
        }
        localStorage.setItem('kappa_explore_cards', JSON.stringify(localCards));

        try {
            if (currentHomepageConfig) {
                currentHomepageConfig.exploreCards = localCards;
                const configBlob = new Blob([JSON.stringify(currentHomepageConfig, null, 2)], { type: 'application/json' });
                await supabaseClient.storage.from('product-images').upload('homepage_settings.json', configBlob, { upsert: true, cacheControl: '0' });
            }
        } catch (e) { }

        alert('✅ Explore Card saved successfully!');
        closeExploreModal();
        await loadExploreCardsAdmin();

    } catch (err) {
        console.error('Error saving explore card:', err);
        alert('❌ Error saving card: ' + err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
};
window.deleteExploreCard = async function (cardId) {
    if (!confirm('Are you sure you want to delete this Explore Card?')) return;

    try {
        if (cardId && !cardId.startsWith('demo-')) {
            await supabaseClient.from('explore_cards').delete().eq('id', cardId);
        }
        let local = JSON.parse(localStorage.getItem('kappa_explore_cards') || '[]');
        local = local.filter(c => c.id !== cardId);
        localStorage.setItem('kappa_explore_cards', JSON.stringify(local));

        await loadExploreCardsAdmin();
    } catch (e) {
        alert('Error deleting card: ' + e.message);
    }
};
window.duplicateExploreCard = async function (cardId) {
    const card = currentAdminExploreCards.find(c => c.id === cardId);
    if (!card) return;

    const dupData = {
        ...card,
        id: 'card_' + Date.now(),
        title: card.title + ' (Copy)',
        display_order: (card.display_order || 1) + 1,
        is_active: false
    };

    let local = JSON.parse(localStorage.getItem('kappa_explore_cards') || '[]');
    local.push(dupData);
    localStorage.setItem('kappa_explore_cards', JSON.stringify(local));

    await loadExploreCardsAdmin();
};

window.toggleExploreCardStatus = async function (cardId) {
    const card = currentAdminExploreCards.find(c => c.id === cardId);
    if (!card) return;

    const newStatus = !(card.is_active !== false);
    card.is_active = newStatus;

    if (cardId && !cardId.startsWith('demo-')) {
        await supabaseClient.from('explore_cards').update({ is_active: newStatus }).eq('id', cardId);
    }

    let local = JSON.parse(localStorage.getItem('kappa_explore_cards') || '[]');
    const idx = local.findIndex(c => c.id === cardId);
    if (idx >= 0) local[idx].is_active = newStatus;
    localStorage.setItem('kappa_explore_cards', JSON.stringify(local));

    renderExploreCardsAdminTable(currentAdminExploreCards);
};

window.reorderExploreCard = async function (cardId, delta) {
    const idx = currentAdminExploreCards.findIndex(c => c.id === cardId);
    if (idx < 0) return;

    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= currentAdminExploreCards.length) return;

    const curr = currentAdminExploreCards[idx];
    const other = currentAdminExploreCards[targetIdx];

    const tempOrder = curr.display_order || (idx + 1);
    curr.display_order = other.display_order || (targetIdx + 1);
    other.display_order = tempOrder;

    currentAdminExploreCards.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    localStorage.setItem('kappa_explore_cards', JSON.stringify(currentAdminExploreCards));

    renderExploreCardsAdminTable(currentAdminExploreCards);
};
window.openProductPickerModal = async function () {
    const modal = document.getElementById('explore-product-picker-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('picker-products-list').innerHTML = '<p style="color:#888; grid-column:span 2; text-align:center;">Loading store products...</p>';

    const { data: prods } = await supabaseClient.from('products').select('id, name, price, category_id, product_images(url)').eq('is_active', true);
    allStoreProductsForPicker = prods || [];
    filterPickerProducts();
};
window.closeProductPickerModal = function () {
    const modal = document.getElementById('explore-product-picker-modal');
    if (modal) modal.style.display = 'none';
    updateSelectedProdTagsUI();
};
window.filterPickerProducts = function () {
    const query = (document.getElementById('picker-search-input')?.value || '').toLowerCase().trim();
    const catId = document.getElementById('picker-category-filter')?.value || '';
    const listEl = document.getElementById('picker-products-list');
    if (!listEl) return;
    let filtered = allStoreProductsForPicker.filter(p => {
        if (catId && p.category_id !== catId) return false;
        if (query && !p.name.toLowerCase().includes(query)) return false;
        return true;
    });
    if (filtered.length === 0) {
        listEl.innerHTML = '<p style="color:#888; grid-column:span 2; text-align:center; padding:20px;">No products match your filter.</p>';
        return;
    }
    let html = '';
    filtered.forEach(p => {
        const isChecked = tempSelectedProductIds.includes(p.id);
        const img = (p.product_images && p.product_images.length > 0) ? p.product_images[0].url : 'assets/mens_denim_banner.png';
        html += `
        <div onclick="toggleProductInPicker('${p.id}')" style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid ${isChecked ? '#111' : '#eee'}; background:${isChecked ? '#fdfdfd' : '#fff'}; cursor:pointer; transition:all 0.15s;">
            <input type="checkbox" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; pointer-events:none;">
            <img src="${img}" style="width:40px; height:48px; object-fit:cover; border-radius:4px;" alt="${p.name}">
            <div style="flex:1; overflow:hidden;">
                <strong style="font-size:12px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#111;">${p.name}</strong>
                <span style="font-size:11px; color:#666;">₹${p.price}</span>
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
    document.getElementById('picker-selected-count').textContent = tempSelectedProductIds.length;
};
window.toggleProductInPicker = function (prodId) {
    if (tempSelectedProductIds.includes(prodId)) {
        tempSelectedProductIds = tempSelectedProductIds.filter(id => id !== prodId);
    } else {
        tempSelectedProductIds.push(prodId);
    }
    filterPickerProducts();
};
function updateSelectedProdTagsUI() {
    const countEl = document.getElementById('explore-selected-prod-count');
    const tagsEl = document.getElementById('explore-selected-prod-tags');
    if (countEl) countEl.textContent = tempSelectedProductIds.length;
    if (!tagsEl) return;
    if (tempSelectedProductIds.length === 0) {
        tagsEl.innerHTML = '<span style="font-size:11px; color:#888;">No products selected yet.</span>';
        return;
    }
    let html = '';
    tempSelectedProductIds.forEach(id => {
        const prod = allStoreProductsForPicker.find(p => p.id === id);
        const name = prod ? prod.name : id.slice(0, 8);
        html += `
        <span style="background:#e5e7eb; color:#1f2937; font-size:11px; font-weight:600; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
            ${name}
            <button type="button" onclick="removeTempSelectedProduct('${id}')" style="border:none; background:none; cursor:pointer; font-weight:bold; color:#6b7280; font-size:12px; padding:0;">&times;</button>
        </span>`;
    });
    tagsEl.innerHTML = html;
}
window.removeTempSelectedProduct = function (id) {
    tempSelectedProductIds = tempSelectedProductIds.filter(pId => pId !== id);
    updateSelectedProdTagsUI();
};
window.loadExploreCardsAdmin = loadExploreCardsAdmin;

// ── CUSTOMER NOTIFICATION WHATSAPP MODAL LOGIC ──
let currentNotifyOrderData = null;

window.openNotifyCustomerModal = async function (orderId) {
    if (!orderId) return;
    try {
        const modal = document.getElementById('adminNotifyMessageModal');
        if (!modal) {
            alert('Notification modal element not found.');
            return;
        }

        // Fetch order details
        let order = null;
        if (Array.isArray(window.currentOrdersData)) {
            order = window.currentOrdersData.find(o => o.id === orderId);
        }
        if (!order) {
            const { data, error } = await supabaseClient
                .from('orders')
                .select('*, order_items(*, products(*, product_images(*)))')
                .eq('id', orderId)
                .single();
            if (error || !data) throw error || new Error('Order not found');
            order = data;
        }

        currentNotifyOrderData = order;

        const cust = order.customer_details || {};
        const rawPhone = cust.phone || '';
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-10);
        const shortId = order.id.toString().substring(0, 8).toUpperCase();
        const stage = order.order_stage || order.status || 'incoming';
        const stageLabel = (typeof STAGE_LABELS !== 'undefined' && STAGE_LABELS[stage]) ? STAGE_LABELS[stage] : stage;

        document.getElementById('adminNotifyOrderId').value = orderId;
        document.getElementById('adminNotifyPhoneInput').value = cleanPhone;

        const summaryEl = document.getElementById('adminNotifySummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div><strong>Order:</strong> #${shortId}</div>
                    <div><strong>Customer:</strong> ${cust.name || 'N/A'}</div>
                    <div><strong>Stage:</strong> <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">${stageLabel.toUpperCase()}</span></div>
                    <div><strong>Total:</strong> Rs. ${order.total_amount}</div>
                </div>
            `;
        }

        const templateSelect = document.getElementById('adminNotifyTemplateSelect');
        if (templateSelect) {
            if (stage === 'cancelled' || order.status === 'cancelled') {
                templateSelect.value = 'cancellation_refund';
            } else if (order.delivery_details?.tracking_id) {
                templateSelect.value = 'tracking_dispatch';
            } else {
                templateSelect.value = 'status_update';
            }
        }

        applyAdminNotifyTemplate();
        modal.style.display = 'flex';
    } catch (err) {
        console.error('Error opening notify modal:', err);
        alert('Failed to load order details: ' + (err.message || err));
    }
};

window.closeAdminNotifyModal = function () {
    const modal = document.getElementById('adminNotifyMessageModal');
    if (modal) modal.style.display = 'none';
};

window.applyAdminNotifyTemplate = function () {
    if (!currentNotifyOrderData) return;

    const templateType = document.getElementById('adminNotifyTemplateSelect')?.value || 'status_update';
    const order = currentNotifyOrderData;
    const cust = order.customer_details || {};
    const shortId = order.id.toString().substring(0, 8).toUpperCase();
    const stage = order.order_stage || order.status || 'incoming';
    const stageLabel = (typeof STAGE_LABELS !== 'undefined' && STAGE_LABELS[stage]) ? STAGE_LABELS[stage] : stage;

    const items = (order.order_items && order.order_items.length > 0) ? order.order_items : [];
    const itemNames = items.length > 0
        ? items.map(i => (i.products?.name || i.name || 'Product') + (i.size && i.size !== 'N/A' ? ' (' + i.size + ')' : '')).join(', ')
        : 'Your order items';

    const del = order.delivery_details || {};
    const trackingId = del.tracking_id || '';
    const courier = del.partner || 'Standard Courier';
    const eta = del.eta_days || '2-4 working days';

    let msg = '';

    if (templateType === 'status_update') {
        msg = [
            `Hi ${cust.name || 'there'}!`,
            ``,
            `Your KAPPA Clothing order has been updated!`,
            ``,
            `Order ID: #${shortId}`,
            `Status: ${stageLabel}`,
            `Items: ${itemNames}`,
            `Total: Rs. ${order.total_amount}`,
            ``,
            `Thank you for shopping with KAPPA!`,
            `For any queries, reply to this message.`
        ].join('\n');
    } else if (templateType === 'tracking_dispatch') {
        msg = [
            `Hi ${cust.name || 'there'}!`,
            ``,
            `Great news! Your KAPPA Clothing order #${shortId} has been dispatched.`,
            ``,
            `Courier Partner: ${courier}`,
            trackingId ? `Tracking ID: ${trackingId}` : `Tracking ID: Will be updated shortly`,
            `Estimated Delivery: ${eta}`,
            `Items: ${itemNames}`,
            ``,
            `Thank you for shopping with KAPPA!`,
            `For any tracking help, reply to this message.`
        ].join('\n');
    } else if (templateType === 'delivery_eta') {
        msg = [
            `Hi ${cust.name || 'there'}!`,
            ``,
            `Regarding your KAPPA Clothing order #${shortId}:`,
            ``,
            `Estimated Delivery: ${eta}`,
            `Current Status: ${stageLabel}`,
            `Total Amount: Rs. ${order.total_amount}`,
            ``,
            `Thank you for choosing KAPPA! We are ensuring fast and safe delivery.`
        ].join('\n');
    } else if (templateType === 'cancellation_refund') {
        msg = [
            `Hello ${cust.name || 'there'},`,
            ``,
            `Regarding your KAPPA Clothing order cancellation:`,
            ``,
            `Order ID: #${shortId}`,
            `Refund Amount: Rs. ${order.total_amount}`,
            ``,
            `Your refund will be processed to your provided UPI/Bank account within 2-4 working days.`,
            ``,
            `Thank you for your patience. - KAPPA Team`
        ].join('\n');
    } else if (templateType === 'custom') {
        msg = `Hi ${cust.name || 'there'},\n\nRegarding your KAPPA Clothing order #${shortId}:\n\n`;
    }

    const textarea = document.getElementById('adminNotifyMessageText');
    if (textarea) textarea.value = msg;
};

window.copyNotifyMessageText = function () {
    const textarea = document.getElementById('adminNotifyMessageText');
    if (!textarea || !textarea.value) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert('Message copied to clipboard!');
    }).catch(() => {
        textarea.select();
        document.execCommand('copy');
        alert('Message copied to clipboard!');
    });
};

window.sendAdminNotifyWhatsApp = function () {
    const phoneInput = document.getElementById('adminNotifyPhoneInput');
    const textarea = document.getElementById('adminNotifyMessageText');

    const phone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').slice(-10) : '';
    const text = textarea ? textarea.value.trim() : '';

    if (!phone) {
        alert('Please enter a valid 10-digit customer mobile number.');
        return;
    }
    if (!text) {
        alert('Please enter a message to send.');
        return;
    }

    const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
};