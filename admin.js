"use strict";

// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const supabaseClient = window.supabase.createClient(
    'https://ugphxapfbzcrauchwlef.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGh4YXBmYnpjcmF1Y2h3bGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDE2NjQsImV4cCI6MjA5OTE3NzY2NH0.C9NiffVu_8sqPrXgOwCcXG1ok6atJLTg1Qt8N1_Kd38'
);

function generateSlug(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

// ==========================================
// 2. DOM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    try { initSidebar(); } catch(e) { console.error('initSidebar error:', e); }
    try { verifyAdmin(); } catch(e) { console.error('verifyAdmin error:', e); }
    try { initProductForm(); } catch(e) { console.error('initProductForm error:', e); }
    try { loadParentCategories(); } catch(e) { console.error('loadParentCategories error:', e); }
    try { initImagePreview(); } catch(e) { console.error('initImagePreview error:', e); }
});

// ==========================================
// 3. SPA ROUTER: Sidebar Logic
// ==========================================
function initSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('dynamic-page-title');

    sidebarItems.forEach(item => {
        item.addEventListener('click', async () => {
            sidebarItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            viewSections.forEach(view => view.classList.remove('active-view'));

            const targetName = item.getAttribute('data-target');
            const targetView = document.getElementById(`view-${targetName}`);
            
            if (targetView) {
                targetView.classList.add('active-view');
                if (pageTitle) pageTitle.textContent = targetName.charAt(0).toUpperCase() + targetName.slice(1);
                
                switch(targetName) {
                    case 'dashboard': await loadDashboard(); break;
                    case 'orders': await loadOrders(); break;
                    case 'inventory': await loadInventory(); break; 
                    case 'categories': await loadCategoriesList(); break;
                    case 'reviews': await loadReviews(); break;
                    case 'customers': await loadCustomers(); break;
                    case 'settings': await loadSettings(); break;
                    case 'products': clearProductForm(); break; 
                }
            }
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
    const { data: { session } } = await supabaseClient.auth.getSession();
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
    if(adminName) adminName.textContent = profile.full_name || 'Admin User';
    if(adminAvatar && profile.full_name) adminAvatar.textContent = profile.full_name.charAt(0).toUpperCase();
    
    // Load dashboard stats on verify success
    await loadDashboard();

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
    if(!select) return;
    
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
window.loadCategoryProducts = async function(categoryId, isRoot, categoryName) {
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
window.addProductInCategory = function() {
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

window.addCategory = async function() {
    const nameInput = document.getElementById('new-cat-name');
    const parentSelect = document.getElementById('parent-cat-select');
    const name = nameInput.value.trim();
    const parent_id = parentSelect.value || null;

    if (!name) return alert('Please enter a category name');

    // Generate slug using parent category name if selected to differentiate e.g. men-t-shirts vs women-t-shirts
    let baseSlug = generateSlug(name);
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

    // Check existing categories to ensure slug uniqueness and prevent duplicate key violations
    const { data: existingCats } = await supabaseClient.from('categories').select('slug');
    if (existingCats && existingCats.length > 0) {
        const existingSlugs = new Set(existingCats.map(c => c.slug));
        let count = 1;
        while (existingSlugs.has(slug)) {
            slug = `${baseSlug}-${count}`;
            count++;
        }
    }

    const { error } = await supabaseClient.from('categories').insert([{ name, slug, parent_id }]);

    if (error) { alert('Error adding category: ' + error.message); }
    else {
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

window.deleteCategory = async function(id) {
    if (!confirm('Are you sure you want to delete this category? Products inside it will become uncategorized.')) return;
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

    if (error) { 
        console.error(error);
        return; 
    }

    if (!data || data.length === 0) { 
        container.innerHTML = `<h2>Orders</h2><p>No orders found.</p>`; 
        return; 
    }

    let html = `<h2>Orders</h2>
                <table class="stock-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Ordered Items (Name, Size, Color, Qty)</th>
                            <th>Payment Status</th>
                            <th>Total</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>`;
    
    data.forEach(order => {
        const dateObj = new Date(order.created_at);
        const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const currentStatus = (order.status || 'pending').toLowerCase();
        const paymentStatus = (order.payment_status || 'pending').toLowerCase();
        const isPaid = paymentStatus === 'paid' || currentStatus === 'paid' || !!order.razorpay_payment_id;
        const rzpId = order.razorpay_payment_id || order.payment_id || '';

        // Build items summary HTML
        let itemsSummaryHtml = '';
        if (order.order_items && order.order_items.length > 0) {
            itemsSummaryHtml = order.order_items.map(item => {
                const name = item.products?.name || 'Product';
                const size = item.size || 'N/A';
                const color = item.color || 'N/A';
                const qty = item.quantity || 1;
                const img = item.image_url || item.products?.product_images?.[0]?.url;
                const imgHtml = img ? `<img src="${img}" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid #ddd; flex-shrink:0;">` : '';
                return `<div style="margin-bottom:8px; font-size:12px; line-height:1.4; display:flex; align-items:center; gap:8px;">
                    ${imgHtml}
                    <div>
                        <strong style="color:#111; font-size:13px;">${name}</strong>
                        <div style="margin-top:2px; display:flex; gap:4px; flex-wrap:wrap;">
                            <span class="item-tag tag-qty">Qty: ${qty}</span>
                            <span class="item-tag tag-size">Size: ${size}</span>
                            <span class="item-tag tag-color">Color: ${color}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            itemsSummaryHtml = '<span style="color:#999; font-size:12px;">No items recorded</span>';
        }

        let paymentStatusHtml = '';
        if (isPaid) {
            paymentStatusHtml = `<span class="badge status-paid">PAID</span>
            <div style="font-size:11px; color:#27ae60; font-weight:bold; margin-top:4px; display:flex; align-items:center; gap:3px;">
                💳 Paid in Razorpay
            </div>`;
            if (rzpId) {
                paymentStatusHtml += `<div style="font-size:10px; color:#555; font-family:monospace; margin-top:2px;">Txn: ${rzpId}</div>`;
            }
        } else {
            paymentStatusHtml = `<span class="badge status-pending">PENDING</span>
            <div style="font-size:11px; color:#e67e22; font-weight:bold; margin-top:4px;">⚠️ Unpaid (Razorpay)</div>`;
        }
        
        html += `<tr>
                 <td style="white-space:nowrap;"><small>${formattedDate}</small></td>
                 <td><strong>#${order.id.toString().substring(0, 8)}</strong></td>
                 <td>${order.user_id ? "Registered" : "Guest"}</td>
                 <td style="min-width:240px;">${itemsSummaryHtml}</td>
                 <td>${paymentStatusHtml}</td>
                 <td><strong>₹${order.total_amount}</strong></td>
                 <td>
                    <button class="btn-black" onclick="showOrderDetails('${order.id}')">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        View Details
                    </button>
                    <div>
                        <select class="action-select" onchange="updateOrderStatus('${order.id}', this.value)" style="font-size: 11px; padding:4px; margin-top:2px; border-radius:4px; border:1px solid #ccc; width:100%;">
                            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="shipped" ${currentStatus === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${currentStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                    </div>
                 </td>
                 </tr>`;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

window.updateOrderStatus = async function(orderId, newStatus) {
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

async function loadDashboard() {
    const { data: orders } = await supabaseClient.from('orders').select('total_amount');
    const { count: prodCount } = await supabaseClient.from('products').select('*', { count: 'exact', head: true });
    const { count: custCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer');
    
    if (orders) {
        document.getElementById('stat-orders').textContent = orders.length;
        document.getElementById('stat-revenue').textContent = `₹${orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0).toLocaleString()}`;
    }
    document.getElementById('stat-products').textContent = prodCount || 0;
    document.getElementById('stat-customers').textContent = custCount || 0;
}

async function loadReviews() {
    const container = document.querySelector('#view-reviews .card');
    const { data } = await supabaseClient.from('reviews').select(`id, rating, comment, products(name)`);
    let html = `<h2>Customer Reviews</h2>`;
    if(!data || data.length === 0) { html += `<p>No reviews yet.</p>`; } 
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

window.deleteReview = async function(reviewId) {
    if (!confirm("Are you sure you want to delete this review?")) return;
    const { error } = await supabaseClient.from('reviews').delete().eq('id', reviewId);
    if (error) alert("Error deleting review: " + error.message);
    else { alert("Review deleted successfully!"); loadReviews(); }
}

async function loadCustomers() {
    const container = document.querySelector('#view-customers .card');
    const { data } = await supabaseClient.from('profiles').select('*').eq('role', 'customer');
    let html = `<h2>Registered Customers</h2><table class="stock-table"><thead><tr><th>Name</th></tr></thead><tbody>`;
    if(data) data.forEach(u => html += `<tr><td>${u.full_name || 'N/A'}</td></tr>`);
    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function loadSettings() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', session.user.id).single();
        if(profile) document.getElementById('settings-admin-name').textContent = profile.full_name;
    }
}

window.logoutAdmin = async function() {
    if (!confirm("Are you sure you want to logout?")) return;
    await supabaseClient.auth.signOut();
    window.location.replace('index.html');
}

// ==========================================
// 6. PRODUCT FORM (ADD / EDIT LOGIC)
// ==========================================

let pendingImageFiles = []; 

function initImagePreview() {
    const fileInput = document.getElementById('prod-images');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', function() {
        pendingImageFiles = Array.from(this.files);
        renderPendingImages();
    });
}

window.renderPendingImages = function() {
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

window.setPendingAsCover = function(index) {
    if (index === 0) return;
    const temp = pendingImageFiles[0];
    pendingImageFiles[0] = pendingImageFiles[index];
    pendingImageFiles[index] = temp;
    
    const dt = new DataTransfer();
    pendingImageFiles.forEach(file => dt.items.add(file));
    document.getElementById('prod-images').files = dt.files;
    renderPendingImages();
}

window.removePendingImage = function(index) {
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

            let tableHTML = `<table class="stock-table"><thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock Qty</th></tr></thead><tbody>`;
            finalColors.forEach(color => {
                finalSizes.forEach(size => {
                    tableHTML += `<tr class="variant-row" data-color="${color}" data-size="${size}">
                        <td><strong>${color}</strong></td><td><strong>${size}</strong></td>
                        <td><input type="text" class="stock-input variant-sku" placeholder="SKU"></td>
                        <td><input type="number" class="stock-input variant-stock" value="10" min="0" required></td>
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

    // 2. Fetch all products
    const { data, error } = await supabaseClient
        .from('products')
        .select('id, name, price, category_id, product_images(id, url, position)')
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = "<p>Error loading products.</p>"; return; }
    if (!data || data.length === 0) { container.innerHTML = "<p>No products published yet.</p>"; return; }

    let html = `<table class="stock-table" id="inventory-table" style="width: 100%; text-align: left; border-collapse: collapse;">
        <thead>
            <tr style="border-bottom: 1px solid #eee;">
                <th style="padding-bottom: 10px;">Image</th>
                <th style="padding-bottom: 10px;">Product Name</th>
                <th style="padding-bottom: 10px;">Category</th>
                <th style="padding-bottom: 10px;">Price</th>
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
                    <div style="position:relative; display:inline-block;" title="${colorLabel || 'Image ' + (idx+1)}">
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
window.filterInventory = function() {
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

window.deleteProduct = async function(id) {
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

window.updateImageColor = async function(imageId, cleanUrl, newColorTag) {
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

window.deleteProductImage = async function(imageId, imageUrl, productId) {
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
    } catch(err) {
        alert("Error deleting image: " + err.message);
    }
}

window.setExistingAsCover = async function(imageId, productId) {
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
    } catch(err) {
        alert("Error setting cover: " + err.message);
    }
}

window.editProduct = async function(id) {
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

        let tableHTML = `<table class="stock-table"><thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock Qty</th></tr></thead><tbody>`;
        data.product_variants.forEach(variant => {
            tableHTML += `<tr class="variant-row" data-color="${variant.color}" data-size="${variant.size}">
                <td><strong>${variant.color}</strong></td><td><strong>${variant.size}</strong></td>
                <td><input type="text" class="stock-input variant-sku" placeholder="SKU" value="${variant.sku || ''}"></td>
                <td><input type="number" class="stock-input variant-stock" value="${variant.stock_quantity}" min="0" required></td>
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

window.showOrderDetails = async function(orderId) {
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

    const cust = data.customer_details || {};
    const addr = data.shipping_address || {};
    const currentStatus = (data.status || 'pending').toLowerCase();
    const paymentStatus = (data.payment_status || 'pending').toLowerCase();
    const isPaid = paymentStatus === 'paid' || currentStatus === 'paid' || !!data.razorpay_payment_id;
    const rzpId = data.razorpay_payment_id || data.payment_id || '';

    // Payment Banner
    let paymentBannerHtml = '';
    if (isPaid) {
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
        </div>
    `;
    
    content.innerHTML = htmlContent;
}