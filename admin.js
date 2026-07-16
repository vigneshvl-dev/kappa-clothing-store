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
                    case 'categories': await loadCategoriesList(); break;
                    case 'reviews': await loadReviews(); break;
                    case 'customers': await loadCustomers(); break;
                    case 'settings': await loadSettings(); break;
                }
            }
        });
    });
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

// UPDATED: Uses <optgroup> for clean UI
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
    
    const { data } = await supabaseClient
        .from('categories')
        .select('id, name')
        .is('parent_id', null);
    
    select.innerHTML = '<option value="">No Parent (Root)</option>';
    if (data) {
        data.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
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
    else {
        loadCategoriesList();
        loadCategories();
        loadParentCategories();
    }
}

async function loadOrders() {
    const container = document.querySelector('#view-orders .card');
    const { data } = await supabaseClient.from('orders').select('id, status, total_amount, profiles(full_name)').order('created_at', { ascending: false });
    if(!data || data.length === 0) { container.innerHTML = `<h2>Orders</h2><p>No orders found.</p>`; return; }

    let html = `<h2>Orders</h2><table class="stock-table"><thead><tr><th>User</th><th>Status</th><th>Total</th><th>Action</th></tr></thead><tbody>`;
    data.forEach(order => {
        html += `<tr><td>${order.profiles?.full_name || 'Guest'}</td>
                 <td><span class="badge status-${order.status}">${order.status}</span></td>
                 <td>₹${order.total_amount}</td>
                 <td><select class="action-select" onchange="updateOrderStatus('${order.id}', this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    </select></td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function updateOrderStatus(orderId, newStatus) {
    const { error } = await supabaseClient.from('orders').update({ status: newStatus }).eq('id', orderId);
    if(error) alert("Error updating status");
    else loadOrders();
}

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

// UPDATED: Added debugging logs to troubleshoot silent failures
window.deleteReview = async function(reviewId) {
    console.log("Delete button clicked for ID:", reviewId);
    if (!confirm("Are you sure you want to delete this review?")) return;
    
    const { data, error } = await supabaseClient
        .from('reviews')
        .delete()
        .eq('id', reviewId);

    if (error) {
        console.error("Supabase Delete Error:", error);
        alert("Error deleting review: " + error.message);
    } else {
        console.log("Delete successful:", data);
        alert("Review deleted successfully!");
        loadReviews();
    }
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
        const nameDisplay = document.getElementById('settings-admin-name');
        if(nameDisplay && profile) nameDisplay.textContent = profile.full_name;
    }
}

window.logoutAdmin = async function() {
    if (!confirm("Are you sure you want to logout?")) return;
    await supabaseClient.auth.signOut();
    window.location.replace('index.html');
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
            submitBtn.textContent = "Uploading...";
            submitBtn.disabled = true;

            try {
                const variantRows = document.querySelectorAll('.variant-row');
                let totalBaseStock = 0;
                variantRows.forEach(row => totalBaseStock += parseInt(row.querySelector('.variant-stock').value) || 0);

                const { data: newProduct } = await supabaseClient.from('products').insert([{
                    name: document.getElementById('prod-name').value.trim(),
                    slug: generateSlug(document.getElementById('prod-name').value.trim()),
                    description: document.getElementById('prod-desc').value.trim(),
                    price: parseFloat(document.getElementById('prod-price').value),
                    compare_at_price: parseFloat(document.getElementById('prod-compare-price').value) || null,
                    category_id: document.getElementById('prod-category').value,
                    stock_quantity: totalBaseStock,
                    is_active: true
                }]).select().single();

                if (variantRows.length > 0) {
                    const variantsToInsert = Array.from(variantRows).map(row => ({
                        product_id: newProduct.id,
                        color: row.getAttribute('data-color'),
                        size: row.getAttribute('data-size'),
                        sku: row.querySelector('.variant-sku').value.trim() || null,
                        stock_quantity: parseInt(row.querySelector('.variant-stock').value)
                    }));
                    await supabaseClient.from('product_variants').insert(variantsToInsert);
                }

             // --- UPLOAD IMAGES START ---
const fileInput = document.getElementById('prod-images');
if (fileInput && fileInput.files.length > 0) {
    const imageRows = [];
    const filesArray = Array.from(fileInput.files); 

    for (const [index, file] of filesArray.entries()) {
        // Generate a unique path for the storage bucket
        const filePath = `${newProduct.id}/${Date.now()}_${file.name}`;
        
        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabaseClient.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('product-images')
            .getPublicUrl(filePath);

        // 3. Prepare data for insertion (including the position)
        imageRows.push({
            product_id: newProduct.id,
            url: publicUrl,
            position: index // 0 for the first image, 1 for the second, etc.
        });
    }

    // 4. Insert into the database
    await supabaseClient.from('product_images').insert(imageRows);
}
// --- UPLOAD IMAGES END ---

                alert("Success!");
                addProductForm.reset();
                stockTableContainer.innerHTML = '';
            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                submitBtn.textContent = "Publish Product to Storefront";
                submitBtn.disabled = false;
            }
        });
    }
}