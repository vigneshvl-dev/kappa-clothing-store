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
    try { if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges(); } catch (e) { console.error('updateSidebarOrderBadges error:', e); }
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
                recyclebin: 'Recycle Bin',
                inventory: 'Inventory',
                products: 'Add Product',
                customers: 'Customers',
                categories: 'Categories',
                reviews: 'Reviews',
                homepage: 'Homepage Media',
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
                case 'orders':
                    if (typeof loadOrders === 'function') await loadOrders();
                    markOrdersViewSeen('orders');
                    break;
                case 'cancelled':
                    if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
                    markOrdersViewSeen('cancelled');
                    break;
                case 'recyclebin':
                    if (typeof loadRecycleBin === 'function') await loadRecycleBin();
                    break;
                case 'inventory': if (typeof loadInventory === 'function') await loadInventory(); break;
                case 'categories': if (typeof loadCategoriesList === 'function') await loadCategoriesList(); break;
                case 'reviews': if (typeof loadReviews === 'function') await loadReviews(); break;
                case 'customers': if (typeof loadCustomers === 'function') await loadCustomers(); break;
                case 'settings': if (typeof loadSettings === 'function') await loadSettings(); break;
                case 'products': clearProductForm(); break;
                case 'homepage': if (typeof loadHomepageSettings === 'function') await loadHomepageSettings(); break;
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
        if (!item.getAttribute('onclick')) {
            item.addEventListener('click', (e) => {
                const targetName = item.getAttribute('data-target');
                if (targetName) window.switchAdminView(targetName);
            });
        }
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
        const myChildren = children
            .filter(c => c.parent_id === root.id)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (myChildren.length === 0) return; // skip root if no sub-cats

        const group = document.createElement('optgroup');
        group.label = root.name;

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
    addBtn.style.display = isRoot ? 'none' : 'inline-flex';
    listEl.innerHTML = '<p style="color:#aaa;">Loading...</p>';

    // Scroll panel into view
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // If root: get all children category IDs too
    let categoryIds = [categoryId];
    if (isRoot) {
        const { data: cats } = await supabaseClient.from('categories').select('id, parent_id');
        if (cats) {
            const childIds = cats.filter(c => c.parent_id === categoryId).map(c => c.id);
            categoryIds = [categoryId, ...childIds];
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
    if (!_selectedCategoryId || _selectedCategoryIsRoot) return;

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

            let tableHTML = `<table class="stock-table"><thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock Qty</th></tr></thead><tbody>`;
            finalColors.forEach(color => {
                finalSizes.forEach(size => {
                    let vStock = 10;
                    if (prodOverride && prodOverride.variants && prodOverride.variants[size]) {
                        vStock = Math.max(0, vStock - prodOverride.variants[size]);
                    }
                    tableHTML += `<tr class="variant-row" data-color="${color}" data-size="${size}">
                        <td><strong>${color}</strong></td><td><strong>${size}</strong></td>
                        <td><input type="text" class="stock-input variant-sku" placeholder="SKU"></td>
                        <td><input type="number" class="stock-input variant-stock" value="${vStock}" min="0" required></td>
                    </tr>`;
                });
            });
            tableHTML += `</tbody></table>`;
            stockTableContainer.innerHTML = tableHTML;
        });
    }

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

                if (editingId) {
                    targetProductId = editingId;
                    const { error: updateError } = await supabaseClient.from('products').update({
                        name: document.getElementById('prod-name').value.trim(),
                        slug: generateSlug(document.getElementById('prod-name').value.trim()),
                        description: document.getElementById('prod-desc').value.trim(),
                        price: parseFloat(document.getElementById('prod-price').value),
                        compare_at_price: parseFloat(document.getElementById('prod-compare-price').value) || null,
                        category_id: document.getElementById('prod-category').value,
                        stock_quantity: totalBaseStock
                    }).eq('id', editingId);

                    if (updateError) throw updateError;

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
                    const { data: newProduct, error: insertError } = await supabaseClient.from('products').insert([{
                        name: document.getElementById('prod-name').value.trim(),
                        slug: generateSlug(document.getElementById('prod-name').value.trim()),
                        description: document.getElementById('prod-desc').value.trim(),
                        price: parseFloat(document.getElementById('prod-price').value),
                        compare_at_price: parseFloat(document.getElementById('prod-compare-price').value) || null,
                        category_id: document.getElementById('prod-category').value,
                        stock_quantity: totalBaseStock,
                        is_active: true
                    }]).select().single();

                    if (insertError) throw insertError;
                    targetProductId = newProduct.id;

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

    document.getElementById('editing-product-id').value = data.id;
    document.getElementById('prod-name').value = data.name;
    document.getElementById('prod-category').value = data.category_id;
    document.getElementById('prod-price').value = data.price;
    document.getElementById('prod-compare-price').value = data.compare_at_price || '';
    document.getElementById('prod-desc').value = data.description || '';

    const stockTableContainer = document.getElementById('stock-table-container');
    if (data.product_variants && data.product_variants.length > 0) {
        const colors = [...new Set(data.product_variants.map(v => v.color).filter(c => c !== 'Default'))];
        const sizes = [...new Set(data.product_variants.map(v => v.size).filter(s => s !== 'Default'))];

        document.getElementById('variant-colors').value = colors.join(', ');
        document.getElementById('variant-sizes').value = sizes.join(', ');

        let overrides = {};
        try { overrides = JSON.parse(localStorage.getItem('kappa_stock_overrides') || '{}'); } catch (_) { }
        const prodOverride = overrides[String(data.id)] || null;

        let tableHTML = `<table class="stock-table"><thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock Qty</th></tr></thead><tbody>`;
        data.product_variants.forEach(variant => {
            let vStock = Number(variant.stock_quantity || 0);
            if (prodOverride && prodOverride.variants && prodOverride.variants[variant.size]) {
                vStock = Math.max(0, vStock - prodOverride.variants[variant.size]);
            }
            tableHTML += `<tr class="variant-row" data-color="${variant.color}" data-size="${variant.size}">
                <td><strong>${variant.color}</strong></td><td><strong>${variant.size}</strong></td>
                <td><input type="text" class="stock-input variant-sku" placeholder="SKU" value="${variant.sku || ''}"></td>
                <td><input type="number" class="stock-input variant-stock" value="${vStock}" min="0" required></td>
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
    content.innerHTML = "Loading...";

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
        content.innerHTML = "Error loading order.";
        return;
    }

    const currentStatus = (data.status || 'pending').toLowerCase();
    const isCancelled = currentStatus.includes('cancel');
    markOrdersSeen([orderId], isCancelled ? 'cancelled' : 'active');

    const cust = data.customer_details || {};
    const addr = data.shipping_address || {};
    const currentStatus = (data.status || 'pending').toLowerCase();
    const paymentStatus = (data.payment_status || 'pending').toLowerCase();
    const isPaid = paymentStatus === 'paid' || currentStatus === 'paid' || !!data.razorpay_payment_id;
    const rzpId = data.razorpay_payment_id || data.payment_id || '';
    const isCancelled = currentStatus.includes('cancel') || (data.status || '').toLowerCase().includes('cancel');
    const isReturned = currentStatus.includes('return') || (data.status || '').toLowerCase().includes('return');
    const refundInfo = data.refund_details || cust.refund_details || cust.cancellation_details || data.cancellation_details || null;
    const phoneClean = (cust.phone || '').replace(/[^0-9]/g, '').slice(-10);

    // Payment Banner
    let paymentBannerHtml = '';
    if (isCancelled) {
        paymentBannerHtml = `
            <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                    <div style="font-size: 15px; font-weight: 800; color: #b91c1c; display: flex; align-items: center; gap: 6px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        ORDER CANCELLED - REFUND / REPAYMENT DUE
                    </div>
                    <div style="font-size: 12px; color: #991b1b; margin-top: 3px;">
                        This order has been cancelled. Please repay <strong style="color: #b91c1c; font-size: 13px;">₹${data.total_amount}</strong> using customer's payment details below.
                    </div>
                </div>
                <span class="badge status-cancelled" style="font-size: 12px; padding: 6px 14px; background: #b91c1c; color: #fff; font-weight: 800; border-radius: 6px;">CANCELLED</span>
            </div>
        `;
    } else if (isPaid) {
        paymentBannerHtml = `
            <div style="background: #e8f8f0; border: 1px solid #a3e6be; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <div style="font-size: 14px; font-weight: 700; color: #1e7e44; display: flex; align-items: center; gap: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1e7e44"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        PAID VIA RAZORPAY
                    </div>
                    <div style="font-size: 12px; color: #2e6b45; margin-top: 3px;">
                        ${rzpId ? `Razorpay Payment ID: <strong style="font-family:monospace; background:rgba(255,255,255,0.6); padding:2px 5px; border-radius:4px;">${rzpId}</strong>` : 'Payment verified as Paid via Razorpay.'}
                    </div>
                </div>
                <span class="badge status-paid" style="font-size: 12px; padding: 6px 14px;">PAID</span>
            </div>
        `;
    } else {
        paymentBannerHtml = `
            <div style="background: #fff8ec; border: 1px solid #fbd38d; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <div style="font-size: 14px; font-weight: 700; color: #c05621; display: flex; align-items: center; gap: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#c05621"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        UNPAID / PENDING PAYMENT
                    </div>
                    <div style="font-size: 12px; color: #9c4221; margin-top: 3px;">
                        Payment has not been completed in Razorpay.
                    </div>
                </div>
                <span class="badge status-pending" style="font-size: 12px; padding: 6px 14px;">UNPAID</span>
            </div>
        `;
    }

    let repaymentSectionHtml = '';
    if (isCancelled || isReturned) {
        const hasCustomUpi = !!refundInfo?.upi_id;
        const hasBank = !!(refundInfo?.account_number && refundInfo?.ifsc);
        const upiId = refundInfo?.upi_id || (phoneClean ? phoneClean + '@upi' : '');
        const isRefundSettled = refundInfo?.refund_status === 'refunded' || currentStatus === 'refunded';

        let detailsInnerHtml = '';

        if (hasBank && (!hasCustomUpi || refundInfo?.method === 'Bank Transfer')) {
            // Bank Account Details
            detailsInnerHtml = `
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #1e40af; display: flex; align-items: center; gap: 6px;">
                            🏦 Bank Account Details (NEFT / IMPS)
                            <span style="font-size: 10px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Customer Provided</span>
                        </span>
                        <button type="button" onclick="copyRefundText('Account Holder: ${refundInfo.account_holder || cust.name || ''}\\nAccount No: ${refundInfo.account_number}\\nIFSC: ${refundInfo.ifsc}\\nBank: ${refundInfo.bank_name || ''}\\nAmount: ₹${data.total_amount}', this)" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer; color: #334155;">📋 Copy All Bank Info</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                        <div>
                            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Account Holder</div>
                            <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${refundInfo.account_holder || cust.name || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Bank Name</div>
                            <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${refundInfo.bank_name || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Account Number</div>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                <strong style="font-family: monospace; font-size: 14px; color: #0f172a; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #cbd5e1;">${refundInfo.account_number}</strong>
                                <button type="button" onclick="copyRefundText('${refundInfo.account_number}', this)" style="padding: 2px 8px; font-size: 11px; background: #334155; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Copy</button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">IFSC Code</div>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                <strong style="font-family: monospace; font-size: 14px; color: #0f172a; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #cbd5e1;">${refundInfo.ifsc}</strong>
                                <button type="button" onclick="copyRefundText('${refundInfo.ifsc}', this)" style="padding: 2px 8px; font-size: 11px; background: #334155; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Copy</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (upiId) {
            // UPI Details
            detailsInnerHtml = `
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #1e40af; display: flex; align-items: center; gap: 6px;">
                            ⚡ Customer UPI ID (Google Pay / PhonePe / Paytm / BHIM)
                            ${hasCustomUpi ? '<span style="font-size: 10px; background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Customer Provided</span>' : '<span style="font-size: 10px; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: 700;">From Customer Phone</span>'}
                        </span>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" onclick="copyRefundText('${upiId}', this)" style="background: #334155; color: #fff; border: none; padding: 5px 12px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer;">📋 Copy UPI ID</button>
                            <a href="upi://pay?pa=${upiId}&pn=${encodeURIComponent(cust.name || 'Customer')}&am=${data.total_amount}&cu=INR" style="background: #16a34a; color: #fff; text-decoration: none; padding: 5px 12px; border-radius: 5px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">⚡ Pay with UPI App</a>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px;">
                        <span style="font-family: monospace; font-size: 16px; font-weight: 800; color: #0f172a; background: #fff; border: 1.5px solid #cbd5e1; padding: 6px 14px; border-radius: 6px; letter-spacing: 0.5px;">${upiId}</span>
                    </div>
                </div>
            `;
        } else {
            detailsInnerHtml = `
                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px; margin-top: 10px; font-size: 12px; color: #92400e;">
                    ℹ️ Customer has not entered UPI or Bank details yet. You can click <strong>"Edit / Enter Refund Info"</strong> below to record their details, or message them on WhatsApp.
                </div>
            `;
        }

        let rzpSectionHtml = '';
        if (rzpId) {
            rzpSectionHtml = `
                <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <div style="font-size: 11px; color: #475569; font-weight: 700; text-transform: uppercase;">Original Razorpay Payment ID</div>
                        <div style="font-family: monospace; font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${rzpId}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" onclick="copyRefundText('${rzpId}', this)" style="background: #475569; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">Copy ID</button>
                        <a href="https://dashboard.razorpay.com/app/payments/${rzpId}" target="_blank" style="background: #2563eb; color: #fff; text-decoration: none; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">Refund via Razorpay ↗</a>
                    </div>
                </div>
            `;
        }

        let actionsToolbarHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1.5px solid #fee2e2; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${phoneClean ? `<a href="https://wa.me/91${phoneClean}?text=${encodeURIComponent('Hello ' + (cust.name || '') + ', regarding your refund of ₹' + data.total_amount + ' for Kappa Clothing order #' + data.id.toString().substring(0, 8) + '...')}" target="_blank" style="background: #25d366; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">💬 WhatsApp Customer</a>` : ''}
                    <button type="button" onclick="openAdminEditRefundModal('${data.id}')" style="background: #fff; border: 1.5px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">✏️ Edit / Enter Refund Info</button>
                </div>
                <div>
                    ${isRefundSettled ? `
                        <div style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 800;">
                            ✓ Refund Completed (${refundInfo?.refund_ref ? 'Ref: ' + refundInfo.refund_ref : new Date(refundInfo?.refunded_at || Date.now()).toLocaleDateString()})
                        </div>
                    ` : `
                        <button type="button" onclick="adminMarkOrderRefunded('${data.id}', ${data.total_amount})" style="background: #dc2626; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(220,38,38,0.3);">
                            ✅ Mark as Refunded / Repaid
                        </button>
                    `}
                </div>
            </div>
        `;

        repaymentSectionHtml = `
            <!-- CUSTOMER REPAYMENT / REFUND SECTION -->
            <div style="background: #fff; border: 2px solid #dc2626; border-radius: 10px; padding: 18px; margin-bottom: 25px; box-shadow: 0 4px 16px rgba(220, 38, 38, 0.08);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #fee2e2; padding-bottom: 12px; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 34px; height: 34px; border-radius: 8px; background: #fee2e2; display: flex; align-items: center; justify-content: center; color: #dc2626; font-size: 16px; font-weight: 800;">₹</div>
                        <div>
                            <div style="font-size: 15px; font-weight: 800; color: #991b1b; letter-spacing: 0.2px;">CUSTOMER REPAYMENT / REFUND DETAILS</div>
                            <div style="font-size: 12px; color: #7f1d1d; margin-top: 2px;">
                                Total to Repay: <strong style="color: #dc2626; font-size: 15px;">₹${data.total_amount}</strong>
                            </div>
                        </div>
                    </div>
                    <div>
                        ${isRefundSettled ? '<span class="badge status-paid" style="background:#16a34a; color:#fff; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px;">REFUND SETTLED</span>' : '<span class="badge status-cancelled" style="background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px;">REPAYMENT PENDING</span>'}
                    </div>
                </div>

                <!-- Reason & Date -->
                <div style="display: flex; gap: 16px; font-size: 12px; color: #475569; background: #fef2f2; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; flex-wrap: wrap;">
                    <div><strong>Cancellation Reason:</strong> ${refundInfo?.reason || 'Customer cancelled order'}</div>
                    ${refundInfo?.cancelled_at ? `<div><strong>Cancelled On:</strong> ${new Date(refundInfo.cancelled_at).toLocaleString()}</div>` : ''}
                </div>

                <!-- Specific Payment Destination -->
                ${detailsInnerHtml}

                <!-- Razorpay Original Info -->
                ${rzpSectionHtml}

                <!-- Action Toolbar -->
                ${actionsToolbarHtml}
            </div>
        `;
    }

    let htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
            
            <!-- 1. Payment Status Banner -->
            ${paymentBannerHtml}

            <!-- 2. Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px;">
                <div>
                    <div style="font-size: 20px; font-weight: 800; color: #111;">Order #${data.id.toString().substring(0, 8)}</div>
                    <div style="font-size: 13px; color: #777; margin-top: 2px;">Placed on: ${new Date(data.created_at).toLocaleString()}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; color: #888; text-transform: uppercase;">Total Amount</div>
                    <div style="font-size: 22px; font-weight: 800; color: #111;">₹${data.total_amount}</div>
                </div>
            </div>

            <!-- 3. Customer & Shipping Info (Side-by-Side Grid) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <!-- Customer Card -->
                <div style="background: #f8f9fa; border: 1px solid #eaeaea; border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Customer Info</h4>
                    <div style="font-size: 13px; line-height: 1.6;">
                        <div style="font-weight: 700; color: #111;">${cust.name || 'N/A'}</div>
                        <div><a href="mailto:${cust.email}" style="color: #3498db; text-decoration: none;">${cust.email || 'N/A'}</a></div>
                        <div style="color: #555;">📞 ${cust.phone || 'N/A'}</div>
                    </div>
                </div>

                <!-- Shipping Card -->
                <div style="background: #f8f9fa; border: 1px solid #eaeaea; border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Address</h4>
                    <div style="font-size: 13px; line-height: 1.6;">
                        <div style="font-weight: 700; color: #111;">${addr.address || 'N/A'}</div>
                        <div style="color: #555;">${addr.state || 'N/A'}</div>
                        <div style="color: #555;">Zip: ${addr.zip || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <!-- 3.5 Customer Repayment / Refund Section -->
            ${repaymentSectionHtml}

            <!-- 4. Products Ordered List with Images and Details side by side -->
            <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #111; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                Ordered Items Details
            </h4>
            
            <div style="display: flex; flex-direction: column; gap: 12px; max-height: 340px; overflow-y: auto; padding-right: 5px;">
    `;

    if (data.order_items && data.order_items.length > 0) {
        data.order_items.forEach(item => {
            const productName = item.products ? item.products.name : 'Unknown Product';
            const price = item.price_at_purchase || 0;
            const qty = item.quantity || 1;
            const size = item.size || 'N/A';
            const color = item.color || 'N/A';

            const imgUrl = item.image_url || (item.products?.product_images && item.products.product_images.length > 0 ? item.products.product_images[0].url : '');

            const imgElement = imgUrl ?
                `<img src="${imgUrl}" alt="${productName}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 8px; border: 1px solid #e0e0e0; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">` :
                `<div style="width: 75px; height: 75px; background: #f0f0f0; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #aaa; border: 1px dashed #ccc;">🛍️</div>`;

            htmlContent += `
                <div style="border: 1px solid #eaeaea; border-radius: 10px; padding: 14px; display: flex; align-items: center; gap: 16px; background: #fafafa;">
                    <!-- Image near details -->
                    ${imgElement}

                    <!-- Details (Color, Size, Qty, Name) near image -->
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 700; font-size: 15px; color: #111; margin-bottom: 6px; line-height: 1.3;">${productName}</div>
                        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 6px;">
                            <span class="item-tag tag-color" style="font-size: 12px; padding: 3px 8px; font-weight: 700;">Color: ${color}</span>
                            <span class="item-tag tag-size" style="font-size: 12px; padding: 3px 8px; font-weight: 700;">Size: ${size}</span>
                            <span class="item-tag tag-qty" style="font-size: 12px; padding: 3px 8px; font-weight: 700;">Qty: ${qty}</span>
                        </div>
                        <div style="font-size: 12px; color: #666;">Unit Price: <strong>₹${price}</strong></div>
                    </div>

                    <!-- Price Subtotal -->
                    <div style="text-align: right; flex-shrink: 0;">
                        <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: 600;">Total</div>
                        <div style="font-weight: 800; font-size: 16px; color: #111; margin-top: 2px;">₹${price * qty}</div>
                    </div>
                </div>
            `;
        });
    } else {
        htmlContent += '<div style="color: #e74c3c; padding: 15px; text-align: center; background: #fff5f5; border-radius: 8px;">No products found for this order.</div>';
    }

    htmlContent += `
            </div>
            <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; display: flex; justify-content: flex-end;">
                <button type="button" style="background: #dc2626; color: #fff; padding: 10px 18px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px;" onclick="deleteOrder('${data.id}')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete Order Permanently
                </button>
            </div>
        </div>
    `;

    content.innerHTML = htmlContent;
}

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
async function loadDashboard() {
    const revEl = document.getElementById('stat-revenue');
    const ordEl = document.getElementById('stat-orders');
    const prodEl = document.getElementById('stat-products');
    const custEl = document.getElementById('stat-customers');

    try {
        const { data: orders } = await supabaseClient.from('orders').select('total_amount, status');
        if (orders) {
            let totalRevenue = 0;
            let count = 0;
            orders.forEach(o => {
                const st = (o.status || '').toLowerCase().trim();
                if (st !== 'pending') {
                    count++;
                    if (!st.includes('cancel')) {
                        totalRevenue += (Number(o.total_amount) || 0);
                    }
                }
            });
            if (revEl) revEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
            if (ordEl) ordEl.textContent = count;
        }

        const { count: prodCount } = await supabaseClient.from('products').select('*', { count: 'exact', head: true });
        if (prodEl && prodCount !== null) prodEl.textContent = prodCount;

        const { count: custCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
        if (custEl && custCount !== null) custEl.textContent = custCount;

        updateSidebarOrderBadges();
    } catch (e) {
        console.error('Error loading dashboard metrics:', e);
    }
}

async function loadOrders() {
    const container = document.getElementById('view-orders');
    if (!container) return;
    const card = container.querySelector('.card') || container;
    card.innerHTML = '<p style="color:#666;">Loading orders...</p>';

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter out incomplete 'pending' and 'cancelled' orders so Orders view shows ONLY paid/active orders
        const validOrders = (orders || []).filter(ord => {
            const st = (ord.status || '').toLowerCase().trim();
            return st !== 'pending' && !st.includes('cancel');
        });

        if (validOrders.length === 0) {
            card.innerHTML = '<h2 class="card-title">Customer Orders</h2><p style="color:#888;">No customer orders found.</p>';
            return;
        }

        let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <h2 class="card-title" style="margin:0;">Customer Orders (${validOrders.length})</h2>
        </div>
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
                <thead>
                    <tr style="border-bottom:2px solid #eee; background:#fafafa;">
                        <th style="padding:12px;">Order ID</th>
                        <th style="padding:12px;">Customer</th>
                        <th style="padding:12px;">Date</th>
                        <th style="padding:12px;">Amount</th>
                        <th style="padding:12px;">Status</th>
                        <th style="padding:12px; text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        validOrders.forEach(ord => {
            const cust = ord.customer_details || {};
            const status = (ord.status || 'pending').toLowerCase();
            const orderIdShort = ord.id ? (ord.id.substring(0, 8) + '...') : 'N/A';
            const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

            let statusBadge = `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#fff3cd; color:#856404;">${status.toUpperCase()}</span>`;
            if (status.includes('cancel')) {
                statusBadge = `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#f8d7da; color:#721c24;">CANCELLED</span>`;
            } else if (status.includes('deliver')) {
                statusBadge = `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#d4edda; color:#155724;">DELIVERED</span>`;
            } else if (status.includes('shipped') || status.includes('dispatch')) {
                statusBadge = `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#cce5ff; color:#004085;">SHIPPED</span>`;
            } else if (status.includes('refund')) {
                statusBadge = `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#e2e3e5; color:#383d41;">REFUNDED</span>`;
            }

            html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px; font-family:monospace; font-weight:700; color:#111;">#${orderIdShort}</td>
                <td style="padding:12px;">
                    <div style="font-weight:600;">${cust.name || cust.full_name || 'Guest'}</div>
                    <div style="font-size:12px; color:#777;">${cust.phone || cust.email || ''}</div>
                </td>
                <td style="padding:12px; font-size:13px; color:#666;">${dateStr}</td>
                <td style="padding:12px; font-weight:700; color:#111;">₹${ord.total_amount || 0}</td>
                <td style="padding:12px;">${statusBadge}</td>
                <td style="padding:12px; text-align:right; white-space:nowrap;">
                    <button class="btn-secondary" style="padding:6px 12px; font-size:12px; cursor:pointer;" onclick="showOrderDetails('${ord.id}')">View Details</button>
                    <button class="btn-delete" style="padding:6px 12px; font-size:12px; background:#dc2626; color:#fff; border:none; border-radius:6px; cursor:pointer; margin-left:6px; font-weight:600;" onclick="deleteOrder('${ord.id}')">Delete</button>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
        card.innerHTML = html;

    } catch (e) {
        console.error('Error loading orders:', e);
        card.innerHTML = '<p style="color:red;">Error loading orders.</p>';
    }
}

// ── RECYCLE BIN STORAGE HELPERS ──
function getRecycleBinOrders() {
    try {
        return JSON.parse(localStorage.getItem('kappa_recycle_bin_orders') || '[]');
    } catch (_) {
        return [];
    }
}

function saveRecycleBinOrders(list) {
    try {
        localStorage.setItem('kappa_recycle_bin_orders', JSON.stringify(list || []));
    } catch (e) {
        console.error('Failed to save recycle bin orders:', e);
    }
}

// ── DELETE ORDER (MOVES TO RECYCLE BIN) ──
window.deleteOrder = async function (orderId) {
    if (!confirm(`Are you sure you want to delete order #${String(orderId).substring(0, 8)}?\nIt will be moved to the Recycle Bin where you can restore it anytime.`)) return;

    try {
        // Step 1: Fetch full order record + order_items before deleting from Supabase
        const { data: fullOrder } = await supabaseClient
            .from('orders')
            .select(`
                *,
                order_items (
                    quantity,
                    price_at_purchase,
                    size,
                    color,
                    image_url,
                    product_id,
                    products ( name, product_images ( url ) )
                )
            `)
            .eq('id', orderId)
            .single();

        if (fullOrder) {
            fullOrder.recycled_at = new Date().toISOString();
            const recycleList = getRecycleBinOrders();
            const filtered = recycleList.filter(item => String(item.id) !== String(orderId));
            filtered.unshift(fullOrder);
            saveRecycleBinOrders(filtered);
        }

        // Step 2: Delete order_items & order from Supabase
        await supabaseClient.from('order_items').delete().eq('order_id', orderId);
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) throw error;

        // Step 3: Remove from local storage cache if cached
        try {
            let cachedOrders = JSON.parse(localStorage.getItem('kappa_orders') || '[]');
            cachedOrders = cachedOrders.filter(o => String(o.id) !== String(orderId));
            localStorage.setItem('kappa_orders', JSON.stringify(cachedOrders));
        } catch (_) { }

        alert("♻️ Order moved to Recycle Bin! You can restore it anytime from the Recycle Bin menu.");

        // Refresh views & badges
        if (typeof loadOrders === 'function') await loadOrders();
        if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
        if (typeof loadDashboard === 'function') await loadDashboard();
        if (typeof loadRecycleBin === 'function') await loadRecycleBin();
        if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges();

        // Close details overlay if open for this order
        const overlay = document.getElementById('orderDetailsOverlay');
        if (overlay) overlay.style.display = 'none';

    } catch (err) {
        console.error("Error moving order to Recycle Bin:", err);
        alert("❌ Failed to delete order: " + (err.message || err));
    }
};

// ── CANCELLED ORDERS LOADER ──
async function loadCancelledOrders() {
    const container = document.getElementById('view-cancelled');
    if (!container) return;
    const card = container.querySelector('.card') || container;
    card.innerHTML = '<p style="color:#666;">Loading cancelled orders...</p>';

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter: Keep ONLY CANCELLED orders
        const cancelledOrders = (orders || []).filter(ord => {
            const st = (ord.status || '').toLowerCase().trim();
            return st.includes('cancel');
        });

        if (cancelledOrders.length === 0) {
            card.innerHTML = '<h2 class="card-title">Cancelled Orders</h2><p style="color:#888;">No cancelled orders found.</p>';
            return;
        }

        let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <h2 class="card-title" style="margin:0;">Cancelled Orders (${cancelledOrders.length})</h2>
        </div>
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
                <thead>
                    <tr style="border-bottom:2px solid #eee; background:#fafafa;">
                        <th style="padding:12px;">Order ID</th>
                        <th style="padding:12px;">Customer</th>
                        <th style="padding:12px;">Date</th>
                        <th style="padding:12px;">Amount</th>
                        <th style="padding:12px;">Status</th>
                        <th style="padding:12px; text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        cancelledOrders.forEach(ord => {
            const cust = ord.customer_details || {};
            const orderIdShort = ord.id ? (ord.id.substring(0, 8) + '...') : 'N/A';
            const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const refundInfo = ord.refund_details || cust.refund_details || null;
            const isRefunded = (ord.status || '').toLowerCase().includes('refund') || refundInfo?.refund_status === 'refunded';

            let statusBadge = isRefunded
                ? `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#e2e3e5; color:#383d41;">REFUNDED</span>`
                : `<span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; background:#f8d7da; color:#721c24;">CANCELLED</span>`;

            html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px; font-family:monospace; font-weight:700; color:#111;">#${orderIdShort}</td>
                <td style="padding:12px;">
                    <div style="font-weight:600;">${cust.name || cust.full_name || 'Guest'}</div>
                    <div style="font-size:12px; color:#777;">${cust.phone || cust.email || ''}</div>
                </td>
                <td style="padding:12px; font-size:13px; color:#666;">${dateStr}</td>
                <td style="padding:12px; font-weight:700; color:#111;">₹${ord.total_amount || 0}</td>
                <td style="padding:12px;">${statusBadge}</td>
                <td style="padding:12px; text-align:right; white-space:nowrap;">
                    <button class="btn-secondary" style="padding:6px 12px; font-size:12px; cursor:pointer;" onclick="showOrderDetails('${ord.id}')">View Details</button>
                    <button class="btn-delete" style="padding:6px 12px; font-size:12px; background:#dc2626; color:#fff; border:none; border-radius:6px; cursor:pointer; margin-left:6px; font-weight:600;" onclick="deleteOrder('${ord.id}')">Delete</button>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
        card.innerHTML = html;

    } catch (e) {
        console.error('Error loading cancelled orders:', e);
        card.innerHTML = '<p style="color:red;">Error loading cancelled orders.</p>';
    }
}

// ── RECYCLE BIN LOADER ──
async function loadRecycleBin() {
    const container = document.getElementById('view-recyclebin');
    if (!container) return;
    const card = container.querySelector('.card') || container;

    const recycleList = getRecycleBinOrders();

    if (recycleList.length === 0) {
        card.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:#888;">
                <div style="font-size:48px; margin-bottom:12px;">♻️</div>
                <h3 style="margin:0 0 8px 0; color:#333;">Recycle Bin is Empty</h3>
                <p style="margin:0; font-size:13px;">Deleted orders will appear here. You can restore them anytime to re-instate the order and products.</p>
            </div>`;
        return;
    }

    let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
        <h2 class="card-title" style="margin:0;">♻️ Recycle Bin (${recycleList.length})</h2>
        <span style="font-size:12px; color:#666;">Click "Restore Order" to put an order back into Supabase</span>
    </div>
    <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
            <thead>
                <tr style="border-bottom:2px solid #eee; background:#fafafa;">
                    <th style="padding:12px;">Recycled Date</th>
                    <th style="padding:12px;">Order ID</th>
                    <th style="padding:12px;">Customer</th>
                    <th style="padding:12px;">Items Summary</th>
                    <th style="padding:12px;">Status</th>
                    <th style="padding:12px;">Total</th>
                    <th style="padding:12px; text-align:right;">Actions</th>
                </tr>
            </thead>
            <tbody>`;

    recycleList.forEach(ord => {
        const cust = ord.customer_details || {};
        const orderIdShort = ord.id ? (String(ord.id).substring(0, 8) + '...') : 'N/A';
        const recycledDateStr = ord.recycled_at ? new Date(ord.recycled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
        const origStatus = (ord.status || 'paid').toUpperCase();

        let itemsHtml = '';
        if (ord.order_items && ord.order_items.length > 0) {
            itemsHtml = ord.order_items.map(item => {
                const name = item.products?.name || item.name || 'Product';
                const size = item.size || 'N/A';
                const color = item.color || 'N/A';
                const qty = item.quantity || 1;
                return `<div style="font-size:12px; line-height:1.4; color:#333; margin-bottom:2px;">• <strong>${name}</strong> (Qty: ${qty}, Size: ${size}, Color: ${color})</div>`;
            }).join('');
        } else {
            itemsHtml = '<span style="color:#999; font-size:12px;">No items details</span>';
        }

        html += `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px; font-size:12px; color:#666; white-space:nowrap;">${recycledDateStr}</td>
            <td style="padding:12px; font-family:monospace; font-weight:700; color:#111;">#${orderIdShort}</td>
            <td style="padding:12px;">
                <div style="font-weight:600;">${cust.name || cust.full_name || 'Guest'}</div>
                <div style="font-size:12px; color:#777;">${cust.phone || cust.email || ''}</div>
            </td>
            <td style="padding:12px; min-width:220px;">${itemsHtml}</td>
            <td style="padding:12px;"><span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${origStatus}</span></td>
            <td style="padding:12px; font-weight:700; color:#111;">₹${ord.total_amount || 0}</td>
            <td style="padding:12px; text-align:right; white-space:nowrap;">
                <button class="btn-secondary" style="padding:6px 12px; font-size:12px; cursor:pointer; background:#22c55e; color:#fff; border:none; border-radius:6px; font-weight:600; margin-right:6px;" onclick="restoreOrder('${ord.id}')">
                    ↺ Restore Order
                </button>
                <button class="btn-delete" style="padding:6px 12px; font-size:12px; background:#dc2626; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;" onclick="permanentlyDeleteRecycleOrder('${ord.id}')">
                    🗑 Delete
                </button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    card.innerHTML = html;
}

// ── RESTORE ORDER FROM RECYCLE BIN ──
window.restoreOrder = async function (orderId) {
    const recycleList = getRecycleBinOrders();
    const orderToRestore = recycleList.find(o => String(o.id) === String(orderId));

    if (!orderToRestore) {
        alert("❌ Order not found in Recycle Bin.");
        return;
    }

    if (!confirm(`Are you sure you want to RESTORE order #${String(orderId).substring(0, 8)} back to active/cancelled orders?`)) return;

    try {
        const { order_items, recycled_at, ...dbOrder } = orderToRestore;

        // 1. Re-insert order record into Supabase 'orders' table
        const { error: orderErr } = await supabaseClient.from('orders').insert([dbOrder]);
        if (orderErr) {
            console.warn("Insert order returned error, attempting upsert:", orderErr);
            const { error: upsertErr } = await supabaseClient.from('orders').upsert([dbOrder]);
            if (upsertErr) throw upsertErr;
        }

        // 2. Re-insert order_items into Supabase 'order_items' table
        if (order_items && order_items.length > 0) {
            const cleanItems = order_items.map(item => {
                const { products, ...rawItem } = item;
                return {
                    ...rawItem,
                    order_id: dbOrder.id
                };
            });
            await supabaseClient.from('order_items').insert(cleanItems);
        }

        // 3. Remove order from Recycle Bin local storage
        const updatedList = recycleList.filter(o => String(o.id) !== String(orderId));
        saveRecycleBinOrders(updatedList);

        alert("✅ Order restored successfully! It is now restored in Supabase.");

        // Refresh views
        if (typeof loadOrders === 'function') await loadOrders();
        if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
        if (typeof loadDashboard === 'function') await loadDashboard();
        if (typeof loadRecycleBin === 'function') await loadRecycleBin();
        if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges();

    } catch (err) {
        console.error("Error restoring order:", err);
        alert("❌ Failed to restore order: " + (err.message || err));
    }
};

// ── PERMANENTLY ERASE FROM RECYCLE BIN ──
window.permanentlyDeleteRecycleOrder = function (orderId) {
    if (!confirm(`⚠️ PERMANENT DELETE:\nAre you sure you want to permanently delete order #${String(orderId).substring(0, 8)} from the Recycle Bin?\nThis action cannot be undone.`)) return;

    const recycleList = getRecycleBinOrders();
    const updatedList = recycleList.filter(o => String(o.id) !== String(orderId));
    saveRecycleBinOrders(updatedList);

    alert("🗑 Order permanently deleted.");
    loadRecycleBin();
    updateSidebarOrderBadges();
};

// ── SIDEBAR NOTIFICATION BADGES & SEEN TRACKER ──
function getSeenOrdersSet() {
    try {
        return new Set(JSON.parse(localStorage.getItem('kappa_seen_orders_set') || '[]'));
    } catch (_) {
        return new Set();
    }
}

function getSeenCancelledSet() {
    try {
        return new Set(JSON.parse(localStorage.getItem('kappa_seen_cancelled_set') || '[]'));
    } catch (_) {
        return new Set();
    }
}

function markOrdersSeen(idsArray, type = 'active') {
    if (!idsArray || idsArray.length === 0) return;
    if (type === 'cancelled') {
        const set = getSeenCancelledSet();
        idsArray.forEach(id => set.add(String(id)));
        try { localStorage.setItem('kappa_seen_cancelled_set', JSON.stringify(Array.from(set))); } catch (_) { }
    } else {
        const set = getSeenOrdersSet();
        idsArray.forEach(id => set.add(String(id)));
        try { localStorage.setItem('kappa_seen_orders_set', JSON.stringify(Array.from(set))); } catch (_) { }
    }
    updateSidebarOrderBadges();
}

async function markOrdersViewSeen(type) {
    try {
        const { data: orders } = await supabaseClient.from('orders').select('id, status');
        if (orders) {
            const idsToMark = [];
            orders.forEach(o => {
                const st = (o.status || '').toLowerCase().trim();
                if (st !== 'pending') {
                    if (type === 'cancelled' && st.includes('cancel')) {
                        idsToMark.push(o.id);
                    } else if (type === 'orders' && !st.includes('cancel')) {
                        idsToMark.push(o.id);
                    }
                }
            });
            markOrdersSeen(idsToMark, type === 'cancelled' ? 'cancelled' : 'active');
        }
    } catch (e) {
        console.warn('Error marking view seen:', e);
    }
}

async function updateSidebarOrderBadges() {
    const ordersBadge = document.getElementById('nav-badge-orders');
    const cancelledBadge = document.getElementById('nav-badge-cancelled');
    const recycleBadge = document.getElementById('nav-badge-recyclebin');

    try {
        const { data: orders } = await supabaseClient.from('orders').select('id, status');
        if (orders) {
            const seenOrdersSet = getSeenOrdersSet();
            const seenCancelledSet = getSeenCancelledSet();
            let unseenActiveCount = 0;
            let unseenCancelledCount = 0;

            orders.forEach(o => {
                const st = (o.status || '').toLowerCase().trim();
                if (st !== 'pending') {
                    if (st.includes('cancel')) {
                        if (!seenCancelledSet.has(String(o.id))) {
                            unseenCancelledCount++;
                        }
                    } else {
                        if (!seenOrdersSet.has(String(o.id))) {
                            unseenActiveCount++;
                        }
                    }
                }
            });

            if (ordersBadge) {
                if (unseenActiveCount > 0) {
                    ordersBadge.textContent = unseenActiveCount;
                    ordersBadge.style.display = 'inline-flex';
                } else {
                    ordersBadge.style.display = 'none';
                }
            }

            if (cancelledBadge) {
                if (unseenCancelledCount > 0) {
                    cancelledBadge.textContent = unseenCancelledCount;
                    cancelledBadge.style.display = 'inline-flex';
                } else {
                    cancelledBadge.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.warn('Could not update order badges:', e);
    }

    if (recycleBadge) {
        const binCount = getRecycleBinOrders().length;
        if (binCount > 0) {
            recycleBadge.textContent = binCount;
            recycleBadge.style.display = 'inline-flex';
        } else {
            recycleBadge.style.display = 'none';
        }
    }
}