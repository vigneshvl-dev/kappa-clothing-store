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
    initSidebar();
    verifyAdmin();
    initProductForm(); 
    loadParentCategories(); 
    initImagePreview(); 
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
    document.getElementById('add-product-form').reset();
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

    const roots = categories.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
    const children = categories.filter(c => c.parent_id);

    roots.forEach(root => {
        const group = document.createElement('optgroup');
        group.label = root.name;

        const rootOption = document.createElement('option');
        rootOption.value = root.id;
        rootOption.textContent = `${root.name} (General)`;
        group.appendChild(rootOption);

        const myChildren = children.filter(c => c.parent_id === root.id).sort((a, b) => a.name.localeCompare(b.name));
        myChildren.forEach(child => {
            const childOption = document.createElement('option');
            childOption.value = child.id;
            childOption.textContent = `↳ ${child.name}`;
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

async function loadCategoriesList() {
    const container = document.getElementById('categories-list-container');
    if(!container) return;
    
    const { data, error } = await supabaseClient.from('categories').select('*');
    if (error) { container.innerHTML = "Error loading categories."; return; }

    const roots = data.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
    const children = data.filter(c => c.parent_id);

    let html = `<table class="stock-table"><thead><tr><th>Name</th><th>Slug</th><th>Action</th></tr></thead><tbody>`;
    
    roots.forEach(root => {
        html += `<tr><td><strong>${root.name}</strong></td><td>${root.slug}</td>
            <td><button class="btn-secondary" style="padding: 5px 10px; height: 30px;" onclick="deleteCategory('${root.id}')">Delete</button></td></tr>`;

        const myChildren = children.filter(c => c.parent_id === root.id).sort((a, b) => a.name.localeCompare(b.name));
        myChildren.forEach(child => {
            html += `<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;↳ ${child.name}</td><td>${child.slug}</td>
            <td><button class="btn-secondary" style="padding: 5px 10px; height: 30px;" onclick="deleteCategory('${child.id}')">Delete</button></td></tr>`;
        });
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

window.addCategory = async function() {
    const nameInput = document.getElementById('new-cat-name');
    const parentSelect = document.getElementById('parent-cat-select');
    const name = nameInput.value.trim();
    const parent_id = parentSelect.value || null; 
    
    if (!name) return alert("Please enter a category name");
    const slug = generateSlug(name);
    const { error } = await supabaseClient.from('categories').insert([{ name, slug, parent_id }]);

    if (error) { alert("Error adding category: " + error.message); } 
    else {
        nameInput.value = '';
        loadCategoriesList(); 
        loadParentCategories();
        loadCategories();
    }
}

window.deleteCategory = async function(id) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if (error) alert("Error deleting: " + error.message);
    else { loadCategoriesList(); loadCategories(); loadParentCategories(); }
}

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
            wrapper.style = "position: relative; width: 85px; height: 85px; border: 2px dashed #ccc; border-radius: 6px; overflow: hidden; padding: 2px; display: inline-block; margin-right: 10px; margin-bottom: 10px;";
            
            const img = document.createElement('img');
            img.style = "width: 100%; height: 100%; object-fit: cover; border-radius: 4px;";
            
            const isCover = (!editingId || !hasExisting) && index === 0;
            let badgeHTML = isCover ? '<div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:10px; text-align:center; padding:3px; font-weight:bold; z-index: 5;">COVER</div>' : '';
            
            let makeCoverBtn = (!isCover && (!editingId || !hasExisting)) ? 
                `<button type="button" onclick="setPendingAsCover(${index})" style="position:absolute; bottom:2px; left:2px; right:2px; background:#f1c40f; color:#000; border:none; border-radius:3px; font-size:10px; padding:3px 0; cursor:pointer; z-index: 10; font-weight:bold;">Set Cover</button>` : '';

            let btnHTML = `<button type="button" onclick="removePendingImage(${index})" style="position:absolute; top:2px; right:2px; background:#e74c3c; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; z-index: 10;">&times;</button>`;

            wrapper.innerHTML = badgeHTML + makeCoverBtn + btnHTML;
            wrapper.insertBefore(img, wrapper.firstChild);

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
                    const filesArray = Array.from(fileInput.files); 

                    for (const [index, file] of filesArray.entries()) {
                        const filePath = `${targetProductId}/${Date.now()}_${file.name}`;
                        const { error: uploadError } = await supabaseClient.storage.from('product-images').upload(filePath, file);
                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabaseClient.storage.from('product-images').getPublicUrl(filePath);
                        
                        imageRows.push({ product_id: targetProductId, url: publicUrl, position: startingImagePosition + index });
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
        .select('id, name, price, category_id, product_images(url)')
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

        const imgUrl = (prod.product_images && prod.product_images.length > 0) ? prod.product_images[0].url : '';
        const imgTag = imgUrl ? `<img src="${imgUrl}" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover;">` : `<div style="width: 45px; height: 45px; background: #eee; border-radius: 6px;"></div>`;

        // Inject data-attributes for live filtering
        html += `<tr class="inv-row" data-cat="${prod.category_id}" data-parent="${parentId}" style="border-bottom: 1px solid #f9f9f9;">
            <td style="padding: 10px 0;">${imgTag}</td>
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
    if (!confirm("Are you sure you want to delete this product? This cannot be undone.")) return;
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) alert("Error deleting product: " + error.message);
    else { alert("Product deleted successfully!"); loadInventory(); loadDashboard(); }
}

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
            const badge = isCover ? '<div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:10px; text-align:center; padding:3px; font-weight:bold; z-index:5;">COVER</div>' : '';
            
            const makeCoverBtn = !isCover ? `<button type="button" onclick="setExistingAsCover('${img.id}', '${data.id}')" style="position:absolute; bottom:2px; left:2px; right:2px; background:#f1c40f; color:#000; border:none; border-radius:3px; font-size:10px; padding:3px 0; cursor:pointer; z-index:10; font-weight:bold;">Set Cover</button>` : '';
            
            imgHtml += `
            <div style="position: relative; width: 85px; height: 85px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; display: inline-block; margin-right: 10px; margin-bottom: 10px;">
                <img src="${img.url}" style="width: 100%; height: 100%; object-fit: cover;">
                ${badge}
                ${makeCoverBtn}
                <button type="button" onclick="deleteProductImage('${img.id}', '${img.url}', '${data.id}')" style="position:absolute; top:2px; right:2px; background:#e74c3c; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; z-index:10;">&times;</button>
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