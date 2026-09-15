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
    try { initRealtimeOrdersAndNotifications(); } catch (e) { console.error('initRealtimeOrdersAndNotifications error:', e); }
    try { if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges(); } catch (e) {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAdminInit);
} else {
    runAdminInit();
}

// ==========================================
// 3. SPA ROUTER: Sidebar & Mobile Nav Logic
// ==========================================
window.switchAdminView = async function (targetName) {
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('dynamic-page-title');

    sidebarItems.forEach(nav => {
        if (nav.getAttribute('data-target') === targetName) nav.classList.add('active');
        else nav.classList.remove('active');
    });

    mobileNavItems.forEach(btn => {
        if (btn.getAttribute('data-target') === targetName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    viewSections.forEach(view => view.classList.remove('active-view'));

    const targetView = document.getElementById(`view-${targetName}`);
    if (targetView) {
        targetView.classList.add('active-view');
        if (pageTitle) {
            const titleMap = {
                dashboard: 'Dashboard',
                notifications: 'Notifications',
                orders: 'Orders',
                cancelled: 'Cancelled Orders',
                recyclebin: 'Recycle Bin',
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
        window.scrollTo(0, 0);

        try {
            switch (targetName) {
                case 'dashboard':
                    if (typeof loadDashboard === 'function') await loadDashboard();
                    if (typeof updateMobileNotificationUI === 'function') updateMobileNotificationUI();
                    break;
                case 'notifications':
                    if (typeof updateMobileNotificationUI === 'function') updateMobileNotificationUI();
                    break;
                case 'orders':
                    if (typeof markOrdersAsSeen === 'function' && Array.isArray(_allFetchedOrders) && _allFetchedOrders.length > 0) {
                        markOrdersAsSeen(_allFetchedOrders.map(o => o.id));
                    } else {
                        const ob = document.getElementById('nav-badge-orders');
                        if (ob) { ob.textContent = '0'; ob.style.display = 'none'; }
                    }
                    if (typeof loadOrders === 'function') await loadOrders();
                    break;
                case 'cancelled':
                    if (typeof markCancelledOrdersAsSeen === 'function' && Array.isArray(cachedCancelledOrdersList) && cachedCancelledOrdersList.length > 0) {
                        markCancelledOrdersAsSeen(cachedCancelledOrdersList.map(o => o.id));
                    } else {
                        const cb = document.getElementById('nav-badge-cancelled');
                        if (cb) { cb.textContent = '0'; cb.style.display = 'none'; }
                    }
                    if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
                    break;
                case 'recyclebin':
                    if (typeof renderRecycleBinView === 'function') renderRecycleBinView();
                    break;
                case 'inventory': if (typeof loadInventory === 'function') await loadInventory(); break;
                case 'categories': if (typeof loadCategoriesList === 'function') await loadCategoriesList(); break;
                case 'reviews': if (typeof loadReviews === 'function') await loadReviews(); break;
                case 'customers': if (typeof loadCustomers === 'function') await loadCustomers(); break;
                case 'settings': if (typeof loadSettings === 'function') await loadSettings(); break;
                case 'products': clearProductForm(); initProductForm(); break;
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

// clearProductForm is defined later in the file with the full implementation (line ~1888)
// This stub prevents errors from the switchAdminView binding above
function clearProductForm() {
    // Will be overridden by the full implementation below
    // Proxy call — actual logic is in the full clearProductForm defined after initProductForm
    const editIdEl = document.getElementById('editing-product-id');
    if (editIdEl) editIdEl.value = '';
    const submitBtn = document.getElementById('btn-submit-product');
    if (submitBtn) submitBtn.textContent = 'Add Product';
    pendingImageFiles = [];
}

window.loadDashboard = async function () {
    try {
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('id, total_amount, status, order_stage, payment_status, razorpay_payment_id, created_at');

        let totalRev = 0;
        let totalOrdersCount = 0;
        if (orders) {
            totalOrdersCount = orders.length;
            orders.forEach(o => {
                const st = (o.status || '').toLowerCase();
                const stage = (o.order_stage || '').toLowerCase();
                if (!st.includes('cancel') && !st.includes('refund') && stage !== 'cancelled') {
                    totalRev += (parseFloat(o.total_amount) || 0);
                }
            });
        }

        const { count: prodCount } = await supabaseClient
            .from('products')
            .select('id', { count: 'exact', head: true });

        const { count: custCount } = await supabaseClient
            .from('profiles')
            .select('id', { count: 'exact', head: true });

        const revEl = document.getElementById('dash-revenue');
        const ordersEl = document.getElementById('dash-orders');
        const prodEl = document.getElementById('dash-products');
        const custEl = document.getElementById('dash-customers');

        if (revEl) revEl.textContent = `₹${totalRev.toLocaleString('en-IN')}`;
        if (ordersEl) ordersEl.textContent = totalOrdersCount;
        if (prodEl) prodEl.textContent = prodCount || 0;
        if (custEl) custEl.textContent = custCount || 0;

        // Populate bottom action cards
        if (orders) {
            const pendingCount = orders.filter(o => !o.order_stage || o.order_stage === 'incoming').length;
            const cancelledCount = orders.filter(o => {
                const st = (o.status || '').toLowerCase();
                return st.includes('cancel') || o.order_stage === 'cancelled';
            }).length;
            const paidRev = orders.reduce((sum, o) => {
                const st = (o.status || '').toLowerCase();
                return (st === 'paid' || o.payment_status === 'paid' || o.razorpay_payment_id)
                    ? sum + (parseFloat(o.total_amount) || 0) : sum;
            }, 0);

            const pendEl = document.getElementById('dash-bottom-pending');
            const cancEl = document.getElementById('dash-bottom-cancelled');
            const prodBotEl = document.getElementById('dash-bottom-products');
            const payEl = document.getElementById('dash-bottom-payments');
            if (pendEl) pendEl.textContent = pendingCount;
            if (cancEl) cancEl.textContent = cancelledCount;
            if (prodBotEl) prodBotEl.textContent = prodCount || 0;
            if (payEl) payEl.textContent = `₹${paidRev.toLocaleString('en-IN')}`;

            renderDonutChart(orders);
            renderSalesChart(orders, '6months');
        }

        if (typeof updateMobileNotificationUI === 'function') {
            updateMobileNotificationUI();
        }
    } catch (e) {
        console.warn('Error loading dashboard stats:', e);
    }
};

// ==========================================
// SIDEBAR ORDER BADGES (was missing — caused verifyAdmin crash)
// ==========================================
async function updateSidebarOrderBadges() {
    try {
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('id, status, order_stage')
            .order('created_at', { ascending: false })
            .limit(200);
        if (!orders) return;

        const newOrders = orders.filter(o => {
            const stage = (o.order_stage || '').toLowerCase();
            return stage === 'incoming' || !stage;
        });
        const cancelledOrders = orders.filter(o => {
            const st = (o.status || '').toLowerCase();
            const stage = (o.order_stage || '').toLowerCase();
            return st.includes('cancel') || stage === 'cancelled';
        });

        const ob = document.getElementById('nav-badge-orders');
        const cb = document.getElementById('nav-badge-cancelled');
        const mhb = document.getElementById('mobile-header-notif-badge');
        if (ob) { ob.textContent = newOrders.length; ob.style.display = newOrders.length > 0 ? '' : 'none'; }
        if (cb) { cb.textContent = cancelledOrders.length; cb.style.display = cancelledOrders.length > 0 ? '' : 'none'; }
        const total = newOrders.length + cancelledOrders.length;
        if (mhb) { mhb.textContent = total; mhb.style.display = total > 0 ? '' : 'none'; }
    } catch (e) { console.warn('updateSidebarOrderBadges error:', e); }
}

// ==========================================
// SALES CHART & ORDER STATUS DONUT
// ==========================================
let _dashAllOrders = [];

window.changeSalesTimeframe = function (timeframe, btnEl) {
    document.querySelectorAll('#salesTimeFilters .dash-filter-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderSalesChart(_dashAllOrders, timeframe);
};

window.switchAdminOrdersFilter = function (stage) {
    switchAdminView('orders');
    setTimeout(() => { if (typeof filterOrders === 'function') filterOrders(stage); }, 600);
};

function renderSalesChart(orders, timeframe) {
    _dashAllOrders = orders || [];
    const container = document.getElementById('salesChartContainer');
    if (!container) return;
    const now = new Date();
    let labels = [], buckets = [];
    const clean = orders.filter(o => {
        const st = (o.status || '').toLowerCase(), stage = (o.order_stage || '').toLowerCase();
        return !st.includes('cancel') && !st.includes('refund') && stage !== 'cancelled';
    });
    if (timeframe === 'today') {
        for (let h = 0; h < 24; h++) { labels.push(h===0?'12am':h<12?h+'am':h===12?'12pm':(h-12)+'pm'); buckets.push(0); }
        clean.forEach(o => { const d=new Date(o.created_at); if(d.toDateString()===now.toDateString()) buckets[d.getHours()]+=parseFloat(o.total_amount)||0; });
    } else if (timeframe === '7days') {
        for (let i=6;i>=0;i--) { const d=new Date(now); d.setDate(d.getDate()-i); labels.push(d.toLocaleDateString('en-IN',{weekday:'short'})); buckets.push(0); }
        clean.forEach(o => { const d=new Date(o.created_at),diff=Math.floor((now-d)/86400000); if(diff>=0&&diff<7) buckets[6-diff]+=parseFloat(o.total_amount)||0; });
    } else if (timeframe === '30days') {
        for (let i=29;i>=0;i--) { const d=new Date(now); d.setDate(d.getDate()-i); labels.push(i%5===0?d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}):''); buckets.push(0); }
        clean.forEach(o => { const d=new Date(o.created_at),diff=Math.floor((now-d)/86400000); if(diff>=0&&diff<30) buckets[29-diff]+=parseFloat(o.total_amount)||0; });
    } else if (timeframe === 'thisyear') {
        ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach(m => { labels.push(m); buckets.push(0); });
        clean.forEach(o => { const d=new Date(o.created_at); if(d.getFullYear()===now.getFullYear()) buckets[d.getMonth()]+=parseFloat(o.total_amount)||0; });
    } else {
        const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        for (let i=5;i>=0;i--) { const d=new Date(now.getFullYear(),now.getMonth()-i,1); labels.push(mn[d.getMonth()]); buckets.push(0); }
        clean.forEach(o => { const d=new Date(o.created_at); for(let i=5;i>=0;i--){const ref=new Date(now.getFullYear(),now.getMonth()-i,1);if(d.getFullYear()===ref.getFullYear()&&d.getMonth()===ref.getMonth()){buckets[5-i]+=parseFloat(o.total_amount)||0;break;}} });
    }
    const tot=buckets.reduce((s,v)=>s+v,0), peakI=buckets.indexOf(Math.max(...buckets));
    const peak=buckets[peakI]>0?(labels[peakI]||'—'):'—';
    const pOrds=clean.filter(o=>{ const d=new Date(o.created_at);
        if(timeframe==='today') return d.toDateString()===now.toDateString();
        if(timeframe==='7days') return (now-d)/86400000<7;
        if(timeframe==='30days') return (now-d)/86400000<30;
        if(timeframe==='thisyear') return d.getFullYear()===now.getFullYear();
        return d>=new Date(now.getFullYear(),now.getMonth()-5,1);
    }).length;
    const avg=pOrds>0?Math.round(tot/pOrds):0;
    const ptEl=document.getElementById('sales-period-total'); if(ptEl) ptEl.textContent=`₹${tot.toLocaleString('en-IN')}`;
    const pmEl=document.getElementById('sales-peak-month'); if(pmEl) pmEl.textContent=peak;
    const aoEl=document.getElementById('sales-avg-order'); if(aoEl) aoEl.textContent=`₹${avg.toLocaleString('en-IN')}`;
    const poEl=document.getElementById('sales-period-orders'); if(poEl) poEl.textContent=pOrds;
    const maxV=Math.max(...buckets,1),W=600,H=160,PL=48,PB=32,PT=10,PR=10,cW=W-PL-PR,cH=H-PB-PT,n=buckets.length,bW=Math.max(4,Math.floor((cW/n)*0.6)),gap=cW/n;
    let grid='',yL='',bars='',xL='';
    for(let i=0;i<=4;i++){const y=PT+cH-(i/4)*cH,v=Math.round((i/4)*maxV),lt=v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`;
        grid+=`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
        yL+=`<text x="${PL-4}" y="${y+4}" text-anchor="end" font-size="9" fill="#aaa">${lt}</text>`;}
    buckets.forEach((v,i)=>{const x=PL+i*gap+gap/2-bW/2,bH=v>0?Math.max(3,(v/maxV)*cH):0,y=PT+cH-bH,isMx=v===Math.max(...buckets)&&v>0;
        bars+=`<rect x="${x}" y="${y}" width="${bW}" height="${bH}" rx="3" fill="${isMx?'#FFD700':'#111'}" opacity="${v>0?'0.85':'0.1'}"><title>₹${v.toLocaleString('en-IN')}</title></rect>`;
        if(labels[i]) xL+=`<text x="${PL+i*gap+gap/2}" y="${H-4}" text-anchor="middle" font-size="9" fill="#888">${labels[i]}</text>`;});
    container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">${grid}${yL}${bars}${xL}<line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+cH}" stroke="#eee" stroke-width="1"/></svg>`;
}

function renderDonutChart(orders) {
    const wrap=document.getElementById('donutChartWrap'), legend=document.getElementById('donutLegendContainer');
    if(!wrap||!legend) return;
    const counts={}, colors={incoming:'#FFD700',confirmed:'#3B82F6',processing:'#8B5CF6',packed:'#F97316',shipped:'#06B6D4',out_for_delivery:'#EC4899',delivered:'#16A34A',cancelled:'#EF4444',return_requested:'#F59E0B',returned:'#6B7280',refunded:'#9CA3AF'};
    orders.forEach(o=>{const s=o.order_stage||((o.status||'').toLowerCase().includes('cancel')?'cancelled':'incoming'); counts[s]=(counts[s]||0)+1;});
    const total=Object.values(counts).reduce((s,v)=>s+v,0);
    if(!total){wrap.innerHTML='<div style="text-align:center;padding:30px;color:#aaa;font-size:13px;">No orders yet</div>';legend.innerHTML='';return;}
    const R=54,r=34,cx=70,cy=70; let sa=-Math.PI/2, paths='';
    const ents=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    ents.forEach(([stage,count])=>{const ang=(count/total)*2*Math.PI,ea=sa+ang;
        const x1=cx+R*Math.cos(sa),y1=cy+R*Math.sin(sa),x2=cx+R*Math.cos(ea),y2=cy+R*Math.sin(ea);
        const ix1=cx+r*Math.cos(sa),iy1=cy+r*Math.sin(sa),ix2=cx+r*Math.cos(ea),iy2=cy+r*Math.sin(ea);
        const lg=ang>Math.PI?1:0,col=colors[stage]||'#ccc';
        paths+=`<path d="M${x1},${y1} A${R},${R} 0 ${lg},1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${lg},0 ${ix1},${iy1} Z" fill="${col}" opacity="0.9"><title>${stage}: ${count}</title></path>`;
        sa=ea;});
    wrap.innerHTML=`<svg viewBox="0 0 140 140" style="width:140px;height:140px;" xmlns="http://www.w3.org/2000/svg">${paths}<text x="${cx}" y="${cy-6}" text-anchor="middle" font-size="18" font-weight="700" fill="#111">${total}</text><text x="${cx}" y="${cy+10}" text-anchor="middle" font-size="9" fill="#888">Orders</text></svg>`;
    legend.innerHTML=ents.map(([stage,count])=>{const col=colors[stage]||'#ccc',lbl=stage.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),pct=Math.round((count/total)*100);
        return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0;"></span><span style="font-size:12px;color:#555;flex:1;">${lbl}</span><span style="font-size:12px;font-weight:700;color:#111;">${count}</span><span style="font-size:11px;color:#aaa;">(${pct}%)</span></div>`;}).join('');
}

// ==========================================
// 4. TRUE DATABASE SECURITY BOUNCER
// ==========================================
const AUTHORIZED_ADMIN_EMAIL = 'kappatvm@gmail.com';

async function verifyAdmin() {
    const session = await ensureFreshSession();
    if (!session || !session.user) { 
        window.location.replace('index.html'); 
        return; 
    }

    const userEmail = (session.user.email || '').trim().toLowerCase();
    if (userEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        alert(`Access Denied: Only ${AUTHORIZED_ADMIN_EMAIL} is authorized to access the Admin Panel.`);
        window.location.replace('index.html');
        return;
    }

    let profile = null;
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('role, full_name')
            .eq('id', session.user.id)
            .maybeSingle();

        profile = data;

        if (!profile) {
            const fallbackName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Admin';
            await supabaseClient.from('profiles').upsert([{
                id: session.user.id,
                role: 'admin',
                full_name: fallbackName,
                email: session.user.email
            }]);
            profile = { role: 'admin', full_name: fallbackName };
        } else if (profile.role !== 'admin') {
            await supabaseClient.from('profiles').update({ role: 'admin' }).eq('id', session.user.id);
            profile.role = 'admin';
        }
    } catch (err) {
        console.warn('verifyAdmin profile check warning:', err);
    }

    const adminName = document.getElementById('admin-name');
    const adminAvatar = document.getElementById('admin-avatar');
    const displayName = profile?.full_name || session.user.email?.split('@')[0] || 'Admin User';
    if (adminName) adminName.textContent = displayName;
    if (adminAvatar) adminAvatar.textContent = displayName.charAt(0).toUpperCase();

    // Load dashboard stats on verify success
    if (typeof loadDashboard === 'function') {
        await loadDashboard();
    }
    if (typeof updateSidebarOrderBadges === 'function') {
        updateSidebarOrderBadges();
        setInterval(updateSidebarOrderBadges, 15000);
    }

    if (typeof loadCategories === 'function') {
        loadCategories();
    }
}

// ==========================================
// 5. DATA LOADERS
// ==========================================
let allAdminCategories = [];

async function loadCategories() {
    try {
        const { data: categories, error } = await supabaseClient
            .from('categories')
            .select('id, name, parent_id, slug')
            .order('name', { ascending: true });

        if (error || !categories) return;

        allAdminCategories = categories;
        window.allAdminCategories = categories;

        if (typeof handleGenderChange === 'function') {
            handleGenderChange();
        }
    } catch (err) {
        console.warn('Error loading categories:', err);
    }
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

let cachedCancelledOrdersList = [];

window.loadCancelledOrders = async function () {
    const container = document.querySelector('#view-cancelled .card');
    if (container) container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;">Loading cancelled orders...</div>';

    let { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    const all = data || [];
    const cancelled = all.filter(o => {
        const st = (o.status || '').toLowerCase();
        const stage = (o.order_stage || '').toLowerCase();
        if (stage === 'recycled' || st === 'recycled') return false;
        return st.includes('cancel') || stage === 'cancelled' || st.includes('refund');
    });

    cachedCancelledOrdersList = cancelled;

    if (cancelled.length === 0) {
        if (container) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px 20px; color:#888;">
                    <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
                    <h3 style="font-size:16px; color:#333; margin-bottom:4px;">No Cancelled Orders</h3>
                    <p style="font-size:13px;">There are currently no cancelled or refunded orders.</p>
                </div>`;
        }
        return;
    }

    renderOrdersView(cancelled, getRecycledOrders(), 'cancelled', '', container);
};

async function loadOrders() {
    const container = document.querySelector('#view-orders .card');
    if (container) container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;">Loading orders...</div>';

    let { data, error } = await supabaseClient
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

    // Fallback if relational join query fails
    if (error || !data || data.length === 0) {
        const fallback = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (fallback.data) {
            data = fallback.data;
        }
    }

    const allOrders = (data || []).filter(o => o.order_stage !== 'recycled' && o.status !== 'recycled');
    _allFetchedOrders = allOrders;

    if (typeof markOrdersAsSeen === 'function') {
        markOrdersAsSeen(allOrders.map(o => o.id));
    }
    const recycled = getRecycledOrders();
    renderOrdersView(allOrders, recycled, _activeOrderFilter || 'all', '');
}

function renderOrdersView(orders, recycled, filterStage, searchQuery, targetContainer) {
    const container = targetContainer || document.querySelector('#view-orders .card');
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
                <button class="btn-secondary" onclick="switchAdminView('recyclebin')" style="padding:8px 16px; font-weight:700; background:#f0f0f0; color:#333; border:1px solid #ddd; border-radius:8px; cursor:pointer;">
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

    // Build Desktop Table
    let tableHtml = `
        <div style="overflow-x:auto;" class="desktop-table-wrap">
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
        const customerName = cust.name || cust.full_name || (order.user_id ? 'Registered Customer' : 'Guest');
        const deliveryDetails = order.delivery_details || {};
        const orderStage = order.order_stage || (isCancelled ? 'cancelled' : 'incoming');
        const isRepayPending = isCancelled && !isSettled;
        const shortId = '#' + order.id.toString().substring(0, 8).toUpperCase();

        // Desktop Payment badge
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
            <td><strong style="font-family:monospace; font-size:13px;">${shortId}</strong></td>
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
                ${(!isPaid && !isCancelled) ? `
                <button class="btn-black" onclick="markOrderAsPaid('${order.id}')" style="background:#16a34a; margin-top:4px; width:100%;">
                    ✓ Mark as Paid
                </button>` : ''}
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
window.filterOrders = function (stage) {
    _activeOrderFilter = stage;
    const searchVal = document.getElementById('order-search-input')?.value || '';
    renderOrdersView(_allFetchedOrders, getRecycledOrders(), stage, searchVal);
};

// Search handler
window.searchOrders = function (query) {
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
    if (typeof updateSidebarOrderBadges === 'function') {
        updateSidebarOrderBadges();
    }
}

// ==========================================
// SEEN ORDERS & BADGES SYSTEM
// ==========================================
const SEEN_ORDERS_KEY = 'kappa_seen_order_ids_v1';
const SEEN_CANCELLED_KEY = 'kappa_seen_cancelled_order_ids_v1';

function getSeenOrderIds() {
    try { return JSON.parse(localStorage.getItem(SEEN_ORDERS_KEY) || '[]'); } catch (_) { return []; }
}
function saveSeenOrderIds(list) {
    try { localStorage.setItem(SEEN_ORDERS_KEY, JSON.stringify(list)); } catch (_) { }
}

function getSeenCancelledOrderIds() {
    try { return JSON.parse(localStorage.getItem(SEEN_CANCELLED_KEY) || '[]'); } catch (_) { return []; }
}
function saveSeenCancelledOrderIds(list) {
    try { localStorage.setItem(SEEN_CANCELLED_KEY, JSON.stringify(list)); } catch (_) { }
}

window.markOrdersAsSeen = function (orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return;
    const seen = new Set(getSeenOrderIds());
    orderIds.forEach(id => seen.add(String(id)));
    saveSeenOrderIds(Array.from(seen));

    const badge = document.getElementById('nav-badge-orders');
    if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
};

window.markCancelledOrdersAsSeen = function (orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return;
    const seen = new Set(getSeenCancelledOrderIds());
    orderIds.forEach(id => seen.add(String(id)));
    saveSeenCancelledOrderIds(Array.from(seen));

    const badge = document.getElementById('nav-badge-cancelled');
    if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
};

window.updateSidebarOrderBadges = async function () {
    try {
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('id, status, order_stage');

        if (orders) {
            const seenOrders = new Set(getSeenOrderIds());
            const seenCancelled = new Set(getSeenCancelledOrderIds());

            // Active (new/processing) orders unseen count
            const activeUnseen = orders.filter(o => {
                const st = (o.status || '').toLowerCase();
                const stage = (o.order_stage || '').toLowerCase();
                if (stage === 'recycled' || st === 'recycled') return false;
                if (stage === 'cancelled' || st.includes('cancel') || st.includes('refund')) return false;
                return !seenOrders.has(String(o.id));
            });

            // Cancelled orders unseen count
            const cancelledUnseen = orders.filter(o => {
                const st = (o.status || '').toLowerCase();
                const stage = (o.order_stage || '').toLowerCase();
                if (stage === 'recycled' || st === 'recycled') return false;
                if (stage === 'cancelled' || st.includes('cancel') || st.includes('refund')) {
                    return !seenCancelled.has(String(o.id));
                }
                return false;
            });

            // Recycled count
            const dbRecycledCount = orders.filter(o => o.order_stage === 'recycled' || o.status === 'recycled').length;
            const localRecycledCount = getRecycledOrders().length;
            const totalRecycled = Math.max(dbRecycledCount, localRecycledCount);

            // Update Orders Badge
            const ob = document.getElementById('nav-badge-orders');
            if (ob) {
                if (document.getElementById('view-orders')?.classList.contains('active-view')) {
                    ob.textContent = '0';
                    ob.style.display = 'none';
                } else if (activeUnseen.length > 0) {
                    ob.textContent = activeUnseen.length;
                    ob.style.display = 'inline-block';
                } else {
                    ob.textContent = '0';
                    ob.style.display = 'none';
                }
            }

            // Update Cancelled Orders Badge
            const cb = document.getElementById('nav-badge-cancelled');
            if (cb) {
                if (document.getElementById('view-cancelled')?.classList.contains('active-view')) {
                    cb.textContent = '0';
                    cb.style.display = 'none';
                } else if (cancelledUnseen.length > 0) {
                    cb.textContent = cancelledUnseen.length;
                    cb.style.display = 'inline-block';
                } else {
                    cb.textContent = '0';
                    cb.style.display = 'none';
                }
            }

            // Update Recycle Bin Badge
            const rb = document.getElementById('nav-badge-recyclebin');
            if (rb) {
                if (totalRecycled > 0) {
                    rb.textContent = totalRecycled;
                    rb.style.display = 'inline-block';
                } else {
                    rb.textContent = '0';
                    rb.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.warn('updateSidebarOrderBadges error:', e);
    }
};

window.renderRecycleBinView = async function (targetContainer) {
    const container = targetContainer || document.querySelector('#view-recyclebin .card') || document.querySelector('#view-orders .card') || document.getElementById('view-recyclebin') || document.getElementById('view-orders');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">Loading Recycle Bin...</div>';

    // Fetch recycled orders from Supabase DB
    let dbRecycled = [];
    try {
        const { data } = await supabaseClient
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
            .eq('order_stage', 'recycled')
            .order('updated_at', { ascending: false });

        if (data) dbRecycled = data;
    } catch (_) {}

    // Merge with localStorage recycled orders (unique by ID)
    const localRecycled = getRecycledOrders();
    const map = new Map();

    dbRecycled.forEach(o => map.set(String(o.id), o));
    localRecycled.forEach(o => {
        if (!map.has(String(o.id))) map.set(String(o.id), o);
    });

    const recycled = Array.from(map.values());
    saveRecycledOrders(recycled); // Sync local cache

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div>
                <h2 style="margin:0; font-size:20px; font-weight:800;">🗑️ Recycle Bin</h2>
                <p style="font-size:12px; color:#888; margin-top:2px;">Temporarily stored deleted orders — restore back to active orders anytime or remove permanently.</p>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <button class="btn-secondary" onclick="switchAdminView('orders')" style="padding:8px 16px; font-weight:700; background:#f0f0f0; color:#333; border:1px solid #ddd; border-radius:8px; cursor:pointer;">
                    📦 Back to Active Orders
                </button>
                <button class="btn-secondary" onclick="renderRecycleBinView()" style="padding:8px 16px; font-weight:700; background:#000; color:#fff; border-radius:8px; cursor:pointer;">
                    🔄 Refresh Bin (${recycled.length})
                </button>
                ${recycled.length > 0 ? `
                    <button class="btn-delete" onclick="emptyRecycleBin()" style="padding:8px 14px; font-weight:700; border-radius:8px; cursor:pointer; background:#dc2626; color:#fff; border:none;">
                        🧹 Empty Bin
                    </button>
                ` : ''}
            </div>
        </div>`;

    if (recycled.length === 0) {
        html += `
            <div style="text-align:center; padding:60px 20px; color:#888;">
                <div style="font-size:52px; margin-bottom:12px;">🗑️</div>
                <h3 style="color:#333; margin-bottom:6px; font-size:18px;">Recycle Bin is Empty</h3>
                <p style="font-size:13px; max-width:400px; margin:0 auto 18px; color:#666;">When you delete an order from the Orders list, it gets safely moved here so you can restore it anytime.</p>
                <button class="btn-secondary" onclick="switchAdminView('orders')" style="padding:9px 18px; font-weight:700; background:#000; color:#fff; border-radius:8px; cursor:pointer;">
                    View Active Orders
                </button>
            </div>`;
        container.innerHTML = html;
        return;
    }

    html += `
        <div style="overflow-x:auto;">
        <table class="stock-table" style="width:100%; border-collapse:collapse; min-width:850px;">
            <thead>
                <tr style="background:#fafafa; border-bottom:2px solid #eee;">
                    <th style="padding:12px;">Deleted Date</th>
                    <th style="padding:12px;">Order ID</th>
                    <th style="padding:12px;">Customer</th>
                    <th style="padding:12px;">Items</th>
                    <th style="padding:12px;">Total</th>
                    <th style="padding:12px; text-align:right;">Actions</th>
                </tr>
            </thead>
            <tbody>`;

    recycled.forEach(order => {
        const deletedDate = order.deletedAt || order.updated_at
            ? new Date(order.deletedAt || order.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'N/A';
        const itemsCount = Array.isArray(order.items) ? order.items.length : (Array.isArray(order.order_items) ? order.order_items.length : 1);
        const customerName = order.customer_details?.name || order.customer_details?.full_name || order.shipping_address?.full_name || (order.user_id ? "Registered Customer" : "Guest");
        const customerPhone = order.customer_details?.phone || '';
        const shortId = (order.id || '').toString().substring(0, 8).toUpperCase();

        html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="white-space:nowrap; padding:12px; font-size:12px;"><small style="color:#64748b;">${deletedDate}</small></td>
                <td style="padding:12px;"><strong style="font-family:monospace; font-size:13px;">#${shortId}</strong></td>
                <td style="padding:12px;">
                    <div style="font-weight:600; color:#111;">${customerName}</div>
                    ${customerPhone ? `<div style="font-size:11px; color:#888;">${customerPhone}</div>` : ''}
                </td>
                <td style="padding:12px;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${itemsCount} item(s)</span></td>
                <td style="padding:12px;"><strong style="font-size:14px; color:#111;">₹${Number(order.total_amount || 0).toLocaleString('en-IN')}</strong></td>
                <td style="padding:12px; text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                        <button class="btn-secondary" onclick="restoreOrder('${order.id}')" style="background:#16a34a; color:#fff; border:none; padding:7px 14px; font-weight:700; border-radius:6px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
                            ♻️ Restore
                        </button>
                        <button class="btn-delete" onclick="permanentlyDeleteRecycledOrder('${order.id}')" style="padding:7px 12px; font-size:12px; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:6px; font-weight:700; cursor:pointer;">
                            ❌ Delete Permanently
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
};

window.restoreOrder = async function (orderId) {
    const shortId = String(orderId).substring(0, 8).toUpperCase();
    if (!confirm(`♻️ Restore order #${shortId} back to active orders?`)) return;

    try {
        // Update in Supabase back to 'incoming'
        const { error } = await supabaseClient
            .from('orders')
            .update({ order_stage: 'incoming', updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (error) throw error;

        // Remove from local storage
        const localRecycled = getRecycledOrders();
        const updatedBin = localRecycled.filter(o => String(o.id) !== String(orderId));
        saveRecycledOrders(updatedBin);

        alert(`✅ Order #${shortId} restored successfully!`);
        await renderRecycleBinView();
        if (typeof loadOrders === 'function') await loadOrders();
    } catch (err) {
        console.error("Restore failed:", err);
        alert("❌ Failed to restore order: " + (err.message || err));
    }
};

window.permanentlyDeleteRecycledOrder = async function (orderId) {
    const shortId = String(orderId).substring(0, 8).toUpperCase();
    if (!confirm(`⚠️ Permanently remove order #${shortId} from Recycle Bin? This CANNOT be undone.`)) return;

    try {
        // Delete order items child rows
        await supabaseClient.from('order_items').delete().eq('order_id', orderId);

        // Delete order row from Supabase
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) {
            // Try backend API fallback
            const apiOrigin = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' ? 'http://localhost:3000' : '';
            await fetch(`${apiOrigin}/api/delete-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
        }

        // Remove from local storage
        const localRecycled = getRecycledOrders();
        const updatedBin = localRecycled.filter(o => String(o.id) !== String(orderId));
        saveRecycledOrders(updatedBin);

        alert(`🗑️ Order #${shortId} permanently deleted.`);
        await renderRecycleBinView();
    } catch (err) {
        console.error("Permanent delete failed:", err);
        alert("❌ Failed to permanently delete order: " + (err.message || err));
    }
};

window.emptyRecycleBin = async function () {
    if (!confirm("⚠️ Are you sure you want to empty the Recycle Bin? All deleted orders will be permanently removed.")) return;

    try {
        // Fetch all recycled orders from DB
        const { data } = await supabaseClient.from('orders').select('id').eq('order_stage', 'recycled');
        if (data && data.length > 0) {
            for (const o of data) {
                await supabaseClient.from('order_items').delete().eq('order_id', o.id);
                await supabaseClient.from('orders').delete().eq('id', o.id);
            }
        }
        saveRecycledOrders([]);
        alert("🧹 Recycle Bin emptied successfully!");
        await renderRecycleBinView();
    } catch (err) {
        console.error("Error emptying recycle bin:", err);
        alert("❌ Error emptying recycle bin: " + (err.message || err));
    }
};

window.deleteOrder = async function (orderId) {
    const shortId = String(orderId).substring(0, 8).toUpperCase();
    if (!confirm(`⚠️ Move order #${shortId} to Recycle Bin? You can view or restore it anytime in the 🗑️ Recycle Bin tab.`)) return;

    try {
        // Close modal if open
        const modal = document.getElementById('orderDetailsOverlay');
        if (modal) modal.style.display = 'none';

        // 1. Soft delete in Supabase by setting order_stage = 'recycled'
        const { error: updateErr } = await supabaseClient
            .from('orders')
            .update({ order_stage: 'recycled', updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updateErr) {
            console.warn("Supabase update error during soft delete:", updateErr);
        }

        // Also fallback backup in localStorage
        let orderToRecycle = null;
        if (Array.isArray(_allFetchedOrders)) {
            orderToRecycle = _allFetchedOrders.find(o => String(o.id) === String(orderId));
        }
        if (!orderToRecycle && typeof cachedCancelledOrdersList !== 'undefined' && Array.isArray(cachedCancelledOrdersList)) {
            orderToRecycle = cachedCancelledOrdersList.find(o => String(o.id) === String(orderId));
        }
        if (!orderToRecycle) {
            const { data: fetched } = await supabaseClient
                .from('orders')
                .select('*, order_items(*)')
                .eq('id', orderId)
                .maybeSingle();
            orderToRecycle = fetched;
        }

        if (orderToRecycle) {
            const recycled = getRecycledOrders();
            const cloned = JSON.parse(JSON.stringify(orderToRecycle));
            cloned.order_stage = 'recycled';
            cloned.deletedAt = new Date().toISOString();
            const filtered = recycled.filter(o => String(o.id) !== String(orderId));
            filtered.unshift(cloned);
            saveRecycledOrders(filtered);
        }

        alert(`🗑️ Order #${shortId} moved to Recycle Bin!\nYou can view or restore it anytime from the 🗑️ Recycle Bin menu.`);

        if (document.getElementById('view-cancelled')?.classList.contains('active-view')) {
            await loadCancelledOrders();
        } else if (document.getElementById('view-recyclebin')?.classList.contains('active-view')) {
            await renderRecycleBinView();
        } else {
            await loadOrders();
        }
        if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges();

    } catch (err) {
        console.error("Failed to delete order:", err);
        alert("❌ Failed to delete order: " + (err.message || err));
    }
};

/* ============ ADMIN REVIEWS SYSTEM ============ */
window.allAdminReviewsData = [];

window.loadReviews = async function () {
    const listContainer = document.getElementById('admin-reviews-list-container');
    if (listContainer) {
        listContainer.innerHTML = '<p style="color:#666; text-align:center; padding:30px 0;">Loading customer reviews...</p>';
    }

    try {
        let reviews = [];
        // Fetch from product_reviews joined with product info
        const { data: prData, error: prErr } = await supabaseClient
            .from('product_reviews')
            .select('*, products(id, name, slug, product_images(url))')
            .order('created_at', { ascending: false });

        if (!prErr && prData) {
            reviews = prData;
        } else {
            // Fallback to reviews table
            const { data: revData } = await supabaseClient
                .from('reviews')
                .select('*, products(id, name, slug, product_images(url))')
                .order('created_at', { ascending: false });
            if (revData) reviews = revData;
        }

        window.allAdminReviewsData = reviews || [];

        // Compute Metrics
        const total = window.allAdminReviewsData.length;
        let avg = 0;
        let fiveStarCount = 0;
        let approvedCount = 0;

        if (total > 0) {
            const sum = window.allAdminReviewsData.reduce((acc, r) => {
                const star = Math.min(5, Math.max(1, parseInt(r.rating || 5, 10)));
                if (star === 5) fiveStarCount++;
                if (r.is_approved !== false) approvedCount++;
                return acc + star;
            }, 0);
            avg = (sum / total).toFixed(1);
        }

        // Update stats elements
        const totalEl = document.getElementById('admin-reviews-total');
        const avgEl = document.getElementById('admin-reviews-avg');
        const starsSub = document.getElementById('admin-reviews-stars-sub');
        const fiveStarEl = document.getElementById('admin-reviews-five-star');
        const approvedEl = document.getElementById('admin-reviews-approved-count');

        if (totalEl) totalEl.innerText = total;
        if (avgEl) avgEl.innerHTML = `${avg} <span style="font-size:18px; color:#FFD700;">★</span>`;
        if (starsSub) starsSub.innerText = total > 0 ? ('★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg))) : '★★★★★';
        if (fiveStarEl) fiveStarEl.innerText = fiveStarCount;
        if (approvedEl) approvedEl.innerText = `${approvedCount} / ${total}`;

        filterAdminReviews();
    } catch (err) {
        console.error('Error loading admin reviews:', err);
        if (listContainer) {
            listContainer.innerHTML = '<p style="color:#e53e3e; text-align:center; padding:30px 0;">Failed to load reviews.</p>';
        }
    }
};

window.filterAdminReviews = function () {
    const searchVal = document.getElementById('admin-reviews-search')?.value?.trim().toLowerCase() || '';
    const starVal = document.getElementById('admin-reviews-star-filter')?.value || 'all';

    let filtered = window.allAdminReviewsData || [];

    if (starVal !== 'all') {
        const targetStar = parseInt(starVal, 10);
        filtered = filtered.filter(r => parseInt(r.rating || 5, 10) === targetStar);
    }

    if (searchVal) {
        filtered = filtered.filter(r => {
            const prodName = (r.products?.name || '').toLowerCase();
            const custName = (r.customer_name || r.reviewer_name || '').toLowerCase();
            const custEmail = (r.customer_email || '').toLowerCase();
            const text = (r.review_text || r.comment || '').toLowerCase();
            const title = (r.review_title || '').toLowerCase();
            return prodName.includes(searchVal) || custName.includes(searchVal) || custEmail.includes(searchVal) || text.includes(searchVal) || title.includes(searchVal);
        });
    }

    renderAdminReviewsList(filtered);
};

window.renderAdminReviewsList = function (reviews) {
    const container = document.getElementById('admin-reviews-list-container');
    if (!container) return;

    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#888;">
                <div style="font-size:32px; color:#FFD700; margin-bottom:8px;">★</div>
                <h3 style="font-size:16px; color:#333; margin-bottom:4px;">No reviews found</h3>
                <p style="font-size:13px;">No customer reviews match your search or filter criteria.</p>
            </div>
        `;
        return;
    }

    const html = `
        <div style="display:flex; flex-direction:column; gap:14px;">
            ${reviews.map(r => {
        const prodName = r.products?.name || 'Storefront Product';
        const prodSlug = r.products?.slug || '';
        const prodLink = prodSlug ? `product.html?slug=${prodSlug}` : '#';
        const imgs = r.products?.product_images || [];
        const imgUrl = imgs.length > 0 ? imgs[0].url : 'assets/Frame 1.jpg';
        const reviewer = r.customer_name || r.reviewer_name || 'Customer';
        const email = r.customer_email || 'No email provided';
        const initial = reviewer.charAt(0).toUpperCase() || 'C';
        const rating = Math.min(5, Math.max(1, parseInt(r.rating || 5, 10)));
        const starStr = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        const isApproved = r.is_approved !== false;
        const title = r.review_title ? `<div style="font-weight:700; font-size:14px; color:#111; margin-bottom:4px;">${escapeHtmlAdmin(r.review_title)}</div>` : '';
        const comment = r.review_text || r.comment || '';
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

        return `
                    <div style="border:1px solid #eee; border-radius:10px; padding:18px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                            <!-- Reviewer and Product Info -->
                            <div style="display:flex; gap:12px; align-items:center;">
                                <div style="width:40px; height:40px; border-radius:50%; background:#111; color:#FFD700; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; flex-shrink:0;">
                                    ${initial}
                                </div>
                                <div>
                                    <div style="font-weight:700; font-size:14px; color:#111;">${escapeHtmlAdmin(reviewer)}</div>
                                    <div style="font-size:12px; color:#888;">${escapeHtmlAdmin(email)} • <span style="color:#555;">${dateStr}</span></div>
                                </div>
                            </div>

                            <!-- Rating & Moderation Status -->
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="color:#FFB800; font-size:18px; letter-spacing:1px;">${starStr}</span>
                                <span style="display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; ${isApproved ? 'background:#e8f5e9; color:#2e7d32;' : 'background:#fff3e0; color:#e65100;'}">
                                    ${isApproved ? 'Approved' : 'Hidden'}
                                </span>
                            </div>
                        </div>

                        <!-- Product Link Pill -->
                        <div style="display:flex; align-items:center; gap:10px; background:#f9f9f9; padding:8px 12px; border-radius:8px; border:1px solid #f0f0f0;">
                            <img src="${imgUrl}" alt="${prodName}" style="width:32px; height:36px; border-radius:4px; object-fit:cover;" onerror="this.src='assets/Frame 1.jpg'">
                            <div style="font-size:12px; color:#555;">
                                Product: <a href="${prodLink}" target="_blank" style="font-weight:700; color:#111; text-decoration:underline;">${escapeHtmlAdmin(prodName)}</a>
                            </div>
                        </div>

                        <!-- Review Text -->
                        <div>
                            ${title}
                            <p style="font-size:13.5px; color:#333; line-height:1.6; margin:0;">"${escapeHtmlAdmin(comment)}"</p>
                        </div>

                        <!-- Actions -->
                        <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid #f5f5f5; padding-top:10px; margin-top:2px;">
                            <button type="button" class="btn-secondary" onclick="toggleAdminReviewApproval('${r.id}', ${isApproved})" style="padding:6px 12px; font-size:12px; border-radius:6px; cursor:pointer;">
                                ${isApproved ? 'Hide Review' : '✓ Approve Review'}
                            </button>
                            <button type="button" class="btn-delete" onclick="deleteAdminReview('${r.id}')" style="padding:6px 14px; font-size:12px; border-radius:6px; cursor:pointer;">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    container.innerHTML = html;
};

window.toggleAdminReviewApproval = async function (reviewId, currentStatus) {
    const newStatus = !currentStatus;
    try {
        const { error: e1 } = await supabaseClient.from('product_reviews').update({ is_approved: newStatus }).eq('id', reviewId);
        if (e1) {
            await supabaseClient.from('reviews').update({ is_approved: newStatus }).eq('id', reviewId);
        }
        loadReviews();
    } catch (err) {
        console.error('Error toggling approval:', err);
        alert('Failed to update status');
    }
};

window.deleteAdminReview = async function (reviewId) {
    if (!confirm('Are you sure you want to permanently delete this review?')) return;
    try {
        const { error: e1 } = await supabaseClient.from('product_reviews').delete().eq('id', reviewId);
        if (e1) {
            await supabaseClient.from('reviews').delete().eq('id', reviewId);
        }
        alert('Review deleted successfully');
        loadReviews();
    } catch (err) {
        console.error('Error deleting review:', err);
        alert('Failed to delete review: ' + err.message);
    }
};

window.deleteReview = window.deleteAdminReview;

function escapeHtmlAdmin(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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

// ==========================================
// ADVANCED PRODUCT MANAGEMENT & VARIANTS MODULE
// ==========================================

const GENDER_CATEGORIES = {
    'Men': ['Shirts', 'T-Shirts', 'Pants', 'Jeans', 'Trousers', 'Shorts', 'Jackets', 'Hoodies'],
    'Women': ['Tops', 'T-Shirts', 'Shirts', 'Pants', 'Jeans', 'Trousers', 'Dresses', 'Skirts', 'Jackets', 'Hoodies'],
    'Unisex': ['Shirts', 'T-Shirts', 'Pants', 'Jeans', 'Trousers', 'Shorts', 'Jackets', 'Hoodies', 'Dresses', 'Skirts'],
    'Kids': ['Shirts', 'T-Shirts', 'Pants', 'Jeans', 'Trousers', 'Shorts', 'Jackets', 'Hoodies', 'Dresses', 'Skirts']
};

const CATEGORY_SIZES = {
    'Pants': ['28', '30', '32', '34', '36', '38', '40'],
    'Jeans': ['28', '30', '32', '34', '36', '38', '40'],
    'Trousers': ['28', '30', '32', '34', '36', '38', '40'],
    'Default': ['XS', 'S', 'M', 'L', 'XL', 'XXL']
};

const DEFAULT_SHIPPING_POLICY = `• Free Shipping on orders above ₹4000.
• Standard dispatch within 24-48 business hours.
• Delivery within 2-5 business days across India via Shiprocket courier partners.
• Real-time SMS and WhatsApp tracking updates.`;

const DEFAULT_LEGAL_METROLOGY = {
    origin: 'India',
    marketedBy: 'KAPPA Clothing Store, Mahatma Gandhi Rd, Pazhavangadi, Thiruvananthapuram, Kerala 695023.',
    support: 'kappatvm@gmail.com | +91 62386 16662',
    netQty: '1 Unit. All prices inclusive of all taxes.'
};

let currentDefaultImageFile = null;
let currentDefaultImageUrl = '';
let currentDefaultHoverImageFile = null;
let currentDefaultHoverImageUrl = '';
let colorVariantsData = [];

window.handleBadgeSelectChange = function () {
    const sel = document.getElementById('prod-badge-select');
    const customInput = document.getElementById('prod-badge-custom');
    if (!sel) return;
    if (sel.value === 'CUSTOM') {
        if (customInput) customInput.style.display = 'inline-block';
    } else {
        if (customInput) customInput.style.display = 'none';
    }
    updateBadgePreview();
};

window.updateBadgePreview = function () {
    const sel = document.getElementById('prod-badge-select');
    const customInput = document.getElementById('prod-badge-custom');
    const preview = document.getElementById('badge-live-preview');
    if (!preview) return;

    let badgeText = 'NEW';
    if (sel) {
        if (sel.value === 'CUSTOM') {
            badgeText = (customInput?.value || '').trim() || 'CUSTOM';
        } else if (sel.value === 'NONE') {
            badgeText = '';
        } else {
            badgeText = sel.value;
        }
    }

    if (!badgeText) {
        preview.textContent = 'NO BADGE';
        preview.style.background = '#e2e8f0';
        preview.style.color = '#64748b';
    } else {
        preview.textContent = badgeText.toUpperCase();
        preview.style.background = '#111';
        preview.style.color = '#fff';
    }
};

window.resetShippingPolicyToDefault = function () {
    const el = document.getElementById('prod-shipping-policy');
    if (el) el.value = DEFAULT_SHIPPING_POLICY;
};

window.resetLegalMetrologyToDefault = function () {
    const originEl = document.getElementById('prod-origin');
    const marketedEl = document.getElementById('prod-marketed-by');
    const supportEl = document.getElementById('prod-customer-support');
    const netQtyEl = document.getElementById('prod-net-qty');

    if (originEl) originEl.value = DEFAULT_LEGAL_METROLOGY.origin;
    if (marketedEl) marketedEl.value = DEFAULT_LEGAL_METROLOGY.marketedBy;
    if (supportEl) supportEl.value = DEFAULT_LEGAL_METROLOGY.support;
    if (netQtyEl) netQtyEl.value = DEFAULT_LEGAL_METROLOGY.netQty;
};

function getSelectedProductBadge() {
    const sel = document.getElementById('prod-badge-select');
    const customInput = document.getElementById('prod-badge-custom');
    if (!sel) return 'NEW';
    if (sel.value === 'CUSTOM') {
        return (customInput?.value || '').trim() || 'NEW';
    }
    if (sel.value === 'NONE') return '';
    return sel.value || 'NEW';
}

function initProductForm() {
    colorVariantsData = [];
    addColorVariant({
        colorName: 'Black',
        colorCode: '#000000',
        frontImg: '',
        backImg: '',
        sizes: { 'S': 5, 'M': 10, 'L': 12, 'XL': 8, 'XXL': 3 },
        minStock: 5
    });
    resetShippingPolicyToDefault();
    resetLegalMetrologyToDefault();
    updateBadgePreview();
    populateProductCategoryDropdown();
}

window.populateProductCategoryDropdown = async function (selectedVal = '') {
    const catSelect = document.getElementById('prod-category');
    if (!catSelect) return;

    if (!window.allAdminCategories || window.allAdminCategories.length === 0) {
        try {
            const { data } = await supabaseClient
                .from('categories')
                .select('id, name, parent_id, slug')
                .order('name', { ascending: true });
            if (data && Array.isArray(data)) {
                window.allAdminCategories = data;
                allAdminCategories = data;
            }
        } catch (_) { }
    }

    const allCats = window.allAdminCategories || [];
    const gender = (document.getElementById('prod-gender')?.value || '').trim();

    let html = `<option value="" disabled ${!selectedVal ? 'selected' : ''}>Select Category ▼</option>`;

    if (allCats.length > 0) {
        const roots = allCats.filter(c => !c.parent_id);
        const children = allCats.filter(c => c.parent_id);

        // 1. If a gender is selected and matches a root, show that root's categories prominently first
        if (gender) {
            const matchingRoot = roots.find(r => r.name.toLowerCase() === gender.toLowerCase());
            if (matchingRoot) {
                const rootChildren = children.filter(c => c.parent_id === matchingRoot.id);
                if (rootChildren.length > 0) {
                    html += `<optgroup label="Categories for ${matchingRoot.name}">`;
                    rootChildren.forEach(cat => {
                        const isSel = (selectedVal === cat.name || selectedVal === cat.id);
                        html += `<option value="${cat.name}" data-id="${cat.id}" ${isSel ? 'selected' : ''}>${cat.name}</option>`;
                    });
                    html += `</optgroup>`;
                }
            }
        }

        // 2. Render ALL categories from Categories tab organized by Parent Category
        roots.forEach(r => {
            const myChildren = children.filter(c => c.parent_id === r.id);
            html += `<optgroup label="${r.name}">`;
            const isRootSel = (selectedVal === r.name || selectedVal === r.id);
            html += `<option value="${r.name}" data-id="${r.id}" ${isRootSel ? 'selected' : ''}>${r.name} (Main Category)</option>`;

            myChildren.forEach(c => {
                const isChildSel = (selectedVal === c.name || selectedVal === c.id);
                html += `<option value="${c.name}" data-id="${c.id}" ${isChildSel ? 'selected' : ''}>${c.name}</option>`;
            });
            html += `</optgroup>`;
        });

        // 3. Standalone categories without parent
        const orphans = children.filter(c => !roots.some(r => r.id === c.parent_id));
        if (orphans.length > 0) {
            html += `<optgroup label="Other Categories">`;
            orphans.forEach(c => {
                const isOrphanSel = (selectedVal === c.name || selectedVal === c.id);
                html += `<option value="${c.name}" data-id="${c.id}" ${isOrphanSel ? 'selected' : ''}>${c.name}</option>`;
            });
            html += `</optgroup>`;
        }
    } else {
        // Fallback default list if no categories created yet
        const defaultCats = ['Shirts', 'T-Shirts', 'Pants', 'Jeans', 'Trousers', 'Shorts', 'Jackets', 'Hoodies', 'Dresses', 'Skirts'];
        defaultCats.forEach(cat => {
            const isSel = (selectedVal === cat);
            html += `<option value="${cat}" ${isSel ? 'selected' : ''}>${cat}</option>`;
        });
    }

    catSelect.innerHTML = html;
    if (selectedVal) {
        catSelect.value = selectedVal;
    }
    updateLiveProductSummary();
};

window.handleGenderChange = function () {
    const currentVal = document.getElementById('prod-category')?.value || '';
    populateProductCategoryDropdown(currentVal);
};

window.handleCategoryChange = function () {
    renderAllColorVariants();
    updateLiveProductSummary();
};

window.generateAutoSKU = function () {
    const gender = (document.getElementById('prod-gender')?.value || 'GEN').substring(0, 3).toUpperCase();
    const cat = (document.getElementById('prod-category')?.value || 'CAT').substring(0, 3).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const sku = `KAPPA-${gender}-${cat}-${randomNum}`;
    const skuInput = document.getElementById('prod-sku');
    if (skuInput) skuInput.value = sku;
    updateLiveProductSummary();
};

window.calculateDiscountAndSummary = function () {
    const origPrice = parseFloat(document.getElementById('prod-compare-price')?.value) || 0;
    const sellPrice = parseFloat(document.getElementById('prod-price')?.value) || 0;
    const discountBadge = document.getElementById('prod-discount-badge');

    if (origPrice > 0 && sellPrice > 0 && origPrice > sellPrice) {
        const discountPct = Math.round(((origPrice - sellPrice) / origPrice) * 100);
        if (discountBadge) {
            discountBadge.textContent = `${discountPct}% OFF`;
            discountBadge.style.display = 'flex';
        }
    } else {
        if (discountBadge) discountBadge.textContent = '0% OFF';
    }
    updateLiveProductSummary();
};

window.handleDefaultImageUpload = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    currentDefaultImageFile = file;

    const reader = new FileReader();
    reader.onload = function (evt) {
        currentDefaultImageUrl = evt.target.result;
        const previewImg = document.getElementById('default-image-preview');
        const previewName = document.getElementById('default-image-name');
        const container = document.getElementById('default-image-preview-container');

        if (previewImg) previewImg.src = currentDefaultImageUrl;
        if (previewName) previewName.textContent = file.name;
        if (container) container.style.display = 'flex';
    };
    reader.readAsDataURL(file);
};

window.removeDefaultImage = function () {
    currentDefaultImageFile = null;
    currentDefaultImageUrl = '';
    const container = document.getElementById('default-image-preview-container');
    const input = document.getElementById('prod-default-image-input');
    if (container) container.style.display = 'none';
    if (input) input.value = '';
};


window.addColorVariant = function (initialData = null) {
    const defaultSizesObj = getActiveSizeSystem().reduce((acc, sz) => { acc[sz] = 5; return acc; }, {});
    const newVariant = initialData || {
        colorName: '',
        colorCode: '#000000',
        frontImg: '',
        backImg: '',
        sizes: defaultSizesObj,
        minStock: 5
    };
    colorVariantsData.push(newVariant);
    renderAllColorVariants();
    updateLiveProductSummary();
};

window.removeColorVariant = function (index) {
    colorVariantsData.splice(index, 1);
    renderAllColorVariants();
    updateLiveProductSummary();
};

function getActiveSizeSystem() {
    const category = document.getElementById('prod-category')?.value || '';
    if (['Pants', 'Jeans', 'Trousers'].includes(category)) {
        return CATEGORY_SIZES['Pants'];
    }
    return CATEGORY_SIZES['Default'];
}

function renderAllColorVariants() {
    const container = document.getElementById('color-variants-list');
    if (!container) return;

    if (colorVariantsData.length === 0) {
        colorVariantsData = [{
            colorName: 'Black',
            colorCode: '#000000',
            frontImg: '',
            backImg: '',
            sizes: { 'S': 5, 'M': 10, 'L': 12, 'XL': 8, 'XXL': 3 },
            minStock: 5
        }];
    }

    const availableSizes = getActiveSizeSystem();

    let html = '';
    colorVariantsData.forEach((variant, vIdx) => {
        let sizeCheckboxesHtml = availableSizes.map(sz => {
            const isChecked = variant.sizes && variant.sizes[sz] !== undefined && variant.sizes[sz] !== null;
            return `
                <label class="size-checkbox-pill ${isChecked ? 'checked' : ''}" id="pill-variant-${vIdx}-${sz}">
                    <input type="checkbox" style="display:none;" ${isChecked ? 'checked' : ''} onchange="toggleVariantSize(${vIdx}, '${sz}', this.checked)">
                    <span>${sz}</span>
                </label>
            `;
        }).join('');

        let stockInputsHtml = '';
        availableSizes.forEach(sz => {
            const isChecked = variant.sizes && variant.sizes[sz] !== undefined && variant.sizes[sz] !== null;
            if (isChecked) {
                const stockVal = variant.sizes[sz] !== undefined ? variant.sizes[sz] : 0;
                stockInputsHtml += `
                    <div class="variant-stock-item">
                        <label>Size ${sz}</label>
                        <input type="number" value="${stockVal}" min="0" oninput="updateVariantStock(${vIdx}, '${sz}', this.value)">
                    </div>
                `;
            }
        });

        if (!stockInputsHtml) {
            stockInputsHtml = `<div style="font-size:12px; color:#888; font-style:italic; grid-column:1/-1;">Check size boxes above to enter stock.</div>`;
        }

        html += `
            <div class="variant-card" id="variant-card-${vIdx}">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:14px; font-weight:800; color:#0f172a; font-family:monospace; background:#f1f5f9; padding:4px 10px; border-radius:6px;">COLOR VARIANT ${vIdx + 1}</span>
                    </div>
                    ${colorVariantsData.length > 1 ? `<button type="button" onclick="removeColorVariant(${vIdx})" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">[ Remove Variant ]</button>` : ''}
                </div>

                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; margin-bottom:16px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">Color Name *</label>
                        <input type="text" class="admin-input" placeholder="e.g. Black, White, Navy Blue" value="${variant.colorName || ''}" oninput="updateVariantColorName(${vIdx}, this.value)" required style="font-weight:600;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">Color Code</label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="color" value="${variant.colorCode || '#000000'}" onchange="updateVariantColorCode(${vIdx}, this.value)" style="height:42px; width:54px; padding:2px; border-radius:8px; border:1px solid #cbd5e1; cursor:pointer;">
                            <span style="font-family:monospace; font-size:12px; font-weight:700; color:#475569;" id="color-hex-label-${vIdx}">${variant.colorCode || '#000000'}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:18px; background:#fafafa; border:1px solid #f1f5f9; padding:14px; border-radius:10px;">
                    <label style="display:block; font-size:12px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                        🖼️ Variant Image
                    </label>
                    <p style="font-size:11px; color:#64748b; margin:0 0 10px;">Photo of product in this color.</p>
                    <div>
                        ${variant.frontImg ? `
                            <div style="position:relative; width:100px; height:100px; border-radius:8px; overflow:hidden; border:2px solid #0f172a;">
                                <img src="${variant.frontImg}" style="width:100%; height:100%; object-fit:cover;">
                                <button type="button" onclick="removeVariantImage(${vIdx}, 'front')" style="position:absolute; top:4px; right:4px; background:#dc2626; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                            </div>
                        ` : `
                            <label class="img-upload-box">
                                <input type="file" accept="image/*" style="display:none;" onchange="handleVariantImageUpload(${vIdx}, 'front', event)">
                                <span style="font-size:20px; margin-bottom:4px;">📷</span>
                                <span style="font-size:12px; font-weight:700; color:#0f172a;">+ Upload Color Image</span>
                            </label>
                        `}
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:12px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px;">
                        📦 Inventory & Sizes
                    </label>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">Select available sizes:</div>
                    
                    <div class="size-pill-group">
                        ${sizeCheckboxesHtml}
                    </div>

                    <div class="variant-stock-grid">
                        ${stockInputsHtml}
                    </div>

                    <div style="margin-top:12px; display:flex; align-items:center; gap:10px;">
                        <label style="font-size:12px; font-weight:700; color:#475569;">Minimum Stock Alert Threshold:</label>
                        <input type="number" value="${variant.minStock || 5}" min="1" style="width:80px; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-weight:700;" oninput="updateVariantMinStock(${vIdx}, this.value)">
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.updateVariantColorName = function (vIdx, val) {
    if (colorVariantsData[vIdx]) {
        colorVariantsData[vIdx].colorName = val;
        updateLiveProductSummary();
    }
};

window.updateVariantColorCode = function (vIdx, val) {
    if (colorVariantsData[vIdx]) {
        colorVariantsData[vIdx].colorCode = val;
        const hexLabel = document.getElementById(`color-hex-label-${vIdx}`);
        if (hexLabel) hexLabel.textContent = val;
    }
};

window.updateVariantMinStock = function (vIdx, val) {
    if (colorVariantsData[vIdx]) {
        colorVariantsData[vIdx].minStock = parseInt(val) || 5;
    }
};

window.toggleVariantSize = function (vIdx, size, isChecked) {
    if (!colorVariantsData[vIdx]) return;
    if (!colorVariantsData[vIdx].sizes) colorVariantsData[vIdx].sizes = {};

    if (isChecked) {
        if (colorVariantsData[vIdx].sizes[size] === undefined) {
            colorVariantsData[vIdx].sizes[size] = 5;
        }
    } else {
        delete colorVariantsData[vIdx].sizes[size];
    }

    renderAllColorVariants();
    updateLiveProductSummary();
};

window.updateVariantStock = function (vIdx, size, val) {
    if (colorVariantsData[vIdx] && colorVariantsData[vIdx].sizes) {
        colorVariantsData[vIdx].sizes[size] = parseInt(val) || 0;
        updateLiveProductSummary();
    }
};

window.handleVariantImageUpload = function (vIdx, type, event) {
    const file = event.target.files[0];
    if (!file || !colorVariantsData[vIdx]) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        if (type === 'front') colorVariantsData[vIdx].frontImg = e.target.result;
        else if (type === 'back') colorVariantsData[vIdx].backImg = e.target.result;

        renderAllColorVariants();
        updateAdminInteractivePreview();
    };
    reader.readAsDataURL(file);
};

window.removeVariantImage = function (vIdx, type) {
    if (colorVariantsData[vIdx]) {
        if (type === 'front') colorVariantsData[vIdx].frontImg = '';
        else if (type === 'back') colorVariantsData[vIdx].backImg = '';

        renderAllColorVariants();
        updateAdminInteractivePreview();
    }
};

window.updateLiveProductSummary = function () {
    const name = document.getElementById('prod-name')?.value.trim() || '—';
    const gender = document.getElementById('prod-gender')?.value || '';
    const cat = document.getElementById('prod-category')?.value || '';
    const sellPrice = parseFloat(document.getElementById('prod-price')?.value) || 0;
    const comparePrice = parseFloat(document.getElementById('prod-compare-price')?.value) || 0;
    const status = document.querySelector('input[name="prod-status"]:checked')?.value || 'Active';

    const sumNameEl = document.getElementById('summary-prod-name');
    if (sumNameEl) sumNameEl.textContent = name;

    const sumCatEl = document.getElementById('summary-prod-cat');
    if (sumCatEl) sumCatEl.textContent = (gender && cat) ? `${gender} → ${cat}` : (gender || cat || '—');

    const sumPriceEl = document.getElementById('summary-prod-price');
    if (sumPriceEl) {
        if (sellPrice > 0) {
            let pStr = `₹${sellPrice}`;
            if (comparePrice > sellPrice) {
                const pct = Math.round(((comparePrice - sellPrice) / comparePrice) * 100);
                pStr += ` (MRP: ₹${comparePrice} | ${pct}% OFF)`;
            }
            sumPriceEl.textContent = pStr;
        } else {
            sumPriceEl.textContent = '—';
        }
    }

    const sumColorsEl = document.getElementById('summary-prod-colors');
    if (sumColorsEl) sumColorsEl.textContent = colorVariantsData.length;

    let allSizesSet = new Set();
    let totalStockSum = 0;

    colorVariantsData.forEach(v => {
        if (v.sizes) {
            Object.keys(v.sizes).forEach(sz => {
                allSizesSet.add(sz);
                totalStockSum += (parseInt(v.sizes[sz]) || 0);
            });
        }
    });

    const sumSizesEl = document.getElementById('summary-prod-sizes');
    if (sumSizesEl) {
        sumSizesEl.textContent = allSizesSet.size > 0 ? Array.from(allSizesSet).join(', ') : 'None';
    }

    const sumStockEl = document.getElementById('summary-prod-stock');
    if (sumStockEl) {
        sumStockEl.textContent = totalStockSum;
    }

    const sumStatusEl = document.getElementById('summary-prod-status');
    if (sumStatusEl) {
        sumStatusEl.textContent = status;
        if (status === 'Active') sumStatusEl.style.background = '#16a34a';
        else if (status === 'Draft') sumStatusEl.style.background = '#d97706';
        else if (status === 'Out of Stock') sumStatusEl.style.background = '#dc2626';
        else sumStatusEl.style.background = '#64748b';
    }
};

window.cancelProductForm = function () {
    clearProductForm();
    if (typeof switchAdminView === 'function') {
        switchAdminView('inventory');
    }
};

window.saveProductAsDraft = function () {
    const draftRadio = document.querySelector('input[name="prod-status"][value="Draft"]');
    if (draftRadio) draftRadio.checked = true;
    saveProductForm();
};

window.saveProductForm = async function (e) {
    if (e) e.preventDefault();

    const submitBtn = document.getElementById('btn-submit-product');
    const name = document.getElementById('prod-name')?.value.trim();
    const gender = document.getElementById('prod-gender')?.value;
    const category = document.getElementById('prod-category')?.value;
    const subCategory = document.getElementById('prod-subcategory')?.value || '';
    const sku = document.getElementById('prod-sku')?.value.trim();
    const sellPrice = parseFloat(document.getElementById('prod-price')?.value);
    const comparePrice = parseFloat(document.getElementById('prod-compare-price')?.value) || null;
    const desc = document.getElementById('prod-desc')?.value.trim() || '';
    const status = document.querySelector('input[name="prod-status"]:checked')?.value || 'Active';
    const isAvailable = document.getElementById('prod-is-available')?.checked ?? true;
    const tax = document.getElementById('prod-tax')?.value || '5%';

    const badge = getSelectedProductBadge();
    const shippingPolicy = document.getElementById('prod-shipping-policy')?.value.trim() || DEFAULT_SHIPPING_POLICY;
    const origin = document.getElementById('prod-origin')?.value.trim() || DEFAULT_LEGAL_METROLOGY.origin;
    const netQty = document.getElementById('prod-net-qty')?.value.trim() || DEFAULT_LEGAL_METROLOGY.netQty;
    const marketedBy = document.getElementById('prod-marketed-by')?.value.trim() || DEFAULT_LEGAL_METROLOGY.marketedBy;
    const support = document.getElementById('prod-customer-support')?.value.trim() || DEFAULT_LEGAL_METROLOGY.support;

    const legalMetrologyObj = { origin, netQty, marketedBy, support };
    const legalMetrologyJson = JSON.stringify(legalMetrologyObj);

    if (!name || !gender || !category || !sku || isNaN(sellPrice)) {
        alert("Please fill in required fields: Product Name, Gender, Category, SKU, and Selling Price.");
        return;
    }

    if (colorVariantsData.length === 0) {
        alert("Please add at least ONE Color Variant.");
        return;
    }

    for (let i = 0; i < colorVariantsData.length; i++) {
        const v = colorVariantsData[i];
        if (!v.colorName || !v.colorName.trim()) {
            alert(`Please enter Color Name for Variant ${i + 1}.`);
            return;
        }
        const sizeKeys = Object.keys(v.sizes || {});
        if (sizeKeys.length === 0) {
            alert(`Please select at least ONE size for Variant "${v.colorName}".`);
            return;
        }
    }

    if (submitBtn) {
        submitBtn.textContent = 'Saving Product...';
        submitBtn.disabled = true;
    }

    try {
        const editingId = document.getElementById('editing-product-id')?.value;

        let totalStockSum = 0;
        colorVariantsData.forEach(v => {
            if (v.sizes) {
                Object.values(v.sizes).forEach(qty => totalStockSum += (parseInt(qty) || 0));
            }
        });

        const encShipping = encodeURIComponent(shippingPolicy);
        const encOrigin = encodeURIComponent(origin);
        const encNetQty = encodeURIComponent(netQty);
        const encMarketed = encodeURIComponent(marketedBy);
        const encSupport = encodeURIComponent(support);
        const encTag = encodeURIComponent(badge);

        const metadataTag = `[META:gender=${gender}|subcat=${subCategory}|tax=${tax}|tag=${encTag}|shipping=${encShipping}|origin=${encOrigin}|netqty=${encNetQty}|marketed=${encMarketed}|support=${encSupport}]`;
        const finalDesc = `${desc} ${metadataTag}`.trim();

        const catSelect = document.getElementById('prod-category');
        const selectedOpt = catSelect ? catSelect.options[catSelect.selectedIndex] : null;
        let resolvedCatId = selectedOpt?.getAttribute('data-id') || null;

        if (!resolvedCatId && window.allAdminCategories) {
            const found = window.allAdminCategories.find(c => c.name.toLowerCase() === (category || '').toLowerCase() || c.id === category);
            if (found) resolvedCatId = found.id;
        }

        const prodDataObj = {
            name: name,
            slug: generateSlug(name),
            description: finalDesc,
            price: sellPrice,
            compare_at_price: comparePrice,
            category_id: resolvedCatId,
            stock_quantity: totalStockSum,
            sku: sku,
            is_active: status === 'Active' && isAvailable,
            tag: badge,
            shipping_policy: shippingPolicy,
            legal_metrology: legalMetrologyJson
        };

        let targetProductId = editingId;

        if (editingId) {
            const { error: updateErr } = await supabaseClient.from('products').update(prodDataObj).eq('id', editingId);
            if (updateErr) {
                // If column doesn't exist in Supabase yet, retry without tag/shipping/metrology columns
                const { tag, shipping_policy, legal_metrology, ...fallbackObj } = prodDataObj;
                const { error: fbErr } = await supabaseClient.from('products').update(fallbackObj).eq('id', editingId);
                if (fbErr) throw fbErr;
            }
        } else {
            let res = await supabaseClient.from('products').insert([prodDataObj]).select().single();
            if (res.error) {
                // Fallback insert if columns don't exist
                const { tag, shipping_policy, legal_metrology, ...fallbackObj } = prodDataObj;
                res = await supabaseClient.from('products').insert([fallbackObj]).select().single();
                if (res.error) throw res.error;
            }
            targetProductId = res.data.id;
        }

        if (targetProductId) {
            await supabaseClient.from('product_variants').delete().eq('product_id', targetProductId);

            const variantsToInsert = [];
            colorVariantsData.forEach(v => {
                Object.keys(v.sizes || {}).forEach(sz => {
                    variantsToInsert.push({
                        product_id: targetProductId,
                        color: v.colorName.trim(),
                        size: sz,
                        stock_quantity: parseInt(v.sizes[sz]) || 0,
                        sku: `${sku}-${v.colorName.substring(0, 3).toUpperCase()}-${sz}`
                    });
                });
            });

            if (variantsToInsert.length > 0) {
                await supabaseClient.from('product_variants').insert(variantsToInsert);
            }

            const imagesToInsert = [];

            if (currentDefaultImageUrl) {
                imagesToInsert.push({
                    product_id: targetProductId,
                    url: currentDefaultImageUrl,
                    position: 0
                });
            }

            colorVariantsData.forEach((v, idx) => {
                if (v.frontImg) {
                    imagesToInsert.push({
                        product_id: targetProductId,
                        url: `${v.frontImg}#${v.colorName}`,
                        position: idx + 1
                    });
                }
            });

            if (imagesToInsert.length > 0) {
                await supabaseClient.from('product_images').delete().eq('product_id', targetProductId);
                await supabaseClient.from('product_images').insert(imagesToInsert);
            }

            try {
                const richVariantsStore = JSON.parse(localStorage.getItem('kappa_rich_variants') || '{}');
                richVariantsStore[String(targetProductId)] = {
                    gender: gender,
                    category: category,
                    subCategory: subCategory,
                    tax: tax,
                    tag: badge,
                    shipping_policy: shippingPolicy,
                    legal_metrology: legalMetrologyObj,
                    variants: colorVariantsData
                };
                localStorage.setItem('kappa_rich_variants', JSON.stringify(richVariantsStore));

                const tagsStore = JSON.parse(localStorage.getItem('kappa_product_tags') || '{}');
                tagsStore[String(targetProductId)] = badge;
                localStorage.setItem('kappa_product_tags', JSON.stringify(tagsStore));
            } catch (_) { }
        }

        alert(editingId ? "✓ Product updated successfully" : "✓ Product added successfully");

        clearProductForm();
        if (typeof switchAdminView === 'function') switchAdminView('inventory');
        if (typeof loadInventory === 'function') await loadInventory();

    } catch (err) {
        console.error("Error saving product:", err);
        alert("❌ Error saving product: " + (err.message || err));
    } finally {
        if (submitBtn) {
            submitBtn.textContent = document.getElementById('editing-product-id')?.value ? "Save Product Changes" : "Add Product";
            submitBtn.disabled = false;
        }
    }
};

function clearProductForm() {
    const editIdEl = document.getElementById('editing-product-id');
    if (editIdEl) editIdEl.value = '';

    const nameEl = document.getElementById('prod-name');
    if (nameEl) nameEl.value = '';

    const genderEl = document.getElementById('prod-gender');
    if (genderEl) genderEl.value = '';

    const catEl = document.getElementById('prod-category');
    if (catEl) catEl.innerHTML = '<option value="" disabled selected>Select Gender First ▼</option>';

    const subCatEl = document.getElementById('prod-subcategory');
    if (subCatEl) subCatEl.value = '';

    const skuEl = document.getElementById('prod-sku');
    if (skuEl) skuEl.value = '';

    const descEl = document.getElementById('prod-desc');
    if (descEl) descEl.value = '';

    const priceEl = document.getElementById('prod-price');
    if (priceEl) priceEl.value = '';

    const compPriceEl = document.getElementById('prod-compare-price');
    if (compPriceEl) compPriceEl.value = '';

    const discBadge = document.getElementById('prod-discount-badge');
    if (discBadge) discBadge.textContent = '0% OFF';

    const badgeSelect = document.getElementById('prod-badge-select');
    if (badgeSelect) badgeSelect.value = 'NEW';
    const badgeCustom = document.getElementById('prod-badge-custom');
    if (badgeCustom) { badgeCustom.value = ''; badgeCustom.style.display = 'none'; }
    updateBadgePreview();

    resetShippingPolicyToDefault();
    resetLegalMetrologyToDefault();

    removeDefaultImage();
    colorVariantsData = [];
    renderAllColorVariants();
    updateLiveProductSummary();
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

    // Sort images by position
    if (data.product_images) {
        data.product_images.sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    // Switch to Add Product view
    document.querySelectorAll('.sidebar-menu li').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active-view'));
    const sidebarItem = document.querySelector('.sidebar-menu li[data-target="products"]');
    if (sidebarItem) sidebarItem.classList.add('active');
    const viewEl = document.getElementById('view-products');
    if (viewEl) viewEl.classList.add('active-view');
    const pageTitle = document.getElementById('dynamic-page-title');
    if (pageTitle) pageTitle.textContent = 'Edit Product';

    // --- Parse metadata tag embedded in description ---
    let rawDesc = data.description || '';
    let metaGender = '';
    let metaSubCat = '';
    let metaTax = '5%';
    let metaTag = '';
    let metaShipping = '';
    let metaOrigin = '';
    let metaNetQty = '';
    let metaMarketed = '';
    let metaSupport = '';

    const metaMatch = rawDesc.match(/\[META:([^\]]+)\]/i);
    if (metaMatch && metaMatch[1]) {
        const parts = metaMatch[1].split('|');
        parts.forEach(part => {
            const [key, val] = part.split('=');
            if (key === 'gender') metaGender = val || '';
            else if (key === 'subcat') metaSubCat = val || '';
            else if (key === 'tax') metaTax = val || '5%';
            else if (key === 'tag') metaTag = decodeURIComponent(val || '');
            else if (key === 'shipping') metaShipping = decodeURIComponent(val || '');
            else if (key === 'origin') metaOrigin = decodeURIComponent(val || '');
            else if (key === 'netqty') metaNetQty = decodeURIComponent(val || '');
            else if (key === 'marketed') metaMarketed = decodeURIComponent(val || '');
            else if (key === 'support') metaSupport = decodeURIComponent(val || '');
        });
        rawDesc = rawDesc.replace(/\s*\[META:[^\]]+\]/gi, '').trim();
    }

    const tagMatch = rawDesc.match(/\[TAG:([^\]]+)\]/i);
    if (tagMatch && tagMatch[1] && !metaTag) {
        metaTag = tagMatch[1].trim();
        rawDesc = rawDesc.replace(/\s*\[TAG:[^\]]+\]/gi, '').trim();
    }

    // --- Try rich variants from localStorage ---
    let richData = null;
    try {
        const richStore = JSON.parse(localStorage.getItem('kappa_rich_variants') || '{}');
        richData = richStore[String(data.id)] || null;
    } catch (_) { }

    // --- Fill Basic Info ---
    const editIdEl = document.getElementById('editing-product-id');
    if (editIdEl) editIdEl.value = data.id;

    const nameEl = document.getElementById('prod-name');
    if (nameEl) nameEl.value = data.name || '';

    const gender = richData?.gender || metaGender || '';
    const genderEl = document.getElementById('prod-gender');
    if (genderEl && gender) {
        genderEl.value = gender;
        // Trigger category options update
        handleGenderChange();
    }

    const category = richData?.category || '';
    const catEl = document.getElementById('prod-category');
    if (catEl && category) {
        catEl.value = category;
    }

    const subCat = richData?.subCategory || metaSubCat || '';
    const subCatEl = document.getElementById('prod-subcategory');
    if (subCatEl && subCat) subCatEl.value = subCat;

    const skuEl = document.getElementById('prod-sku');
    if (skuEl) skuEl.value = data.sku || '';

    // --- Fill Badge / Tag ---
    const activeTag = data.tag || metaTag || richData?.tag || 'NEW';
    const badgeSelect = document.getElementById('prod-badge-select');
    const badgeCustom = document.getElementById('prod-badge-custom');
    if (badgeSelect) {
        const knownValues = ['NEW', 'HOT', 'SALE', 'BESTSELLER', 'TRENDING', 'LIMITED', 'EXCLUSIVE', 'NONE'];
        if (!activeTag) {
            badgeSelect.value = 'NONE';
            if (badgeCustom) { badgeCustom.value = ''; badgeCustom.style.display = 'none'; }
        } else if (knownValues.includes(activeTag.toUpperCase())) {
            badgeSelect.value = activeTag.toUpperCase();
            if (badgeCustom) { badgeCustom.value = ''; badgeCustom.style.display = 'none'; }
        } else {
            badgeSelect.value = 'CUSTOM';
            if (badgeCustom) { badgeCustom.value = activeTag; badgeCustom.style.display = 'inline-block'; }
        }
        updateBadgePreview();
    }

    const descEl = document.getElementById('prod-desc');
    if (descEl) descEl.value = rawDesc;

    // --- Fill Shipping Policy & Legal Metrology ---
    const shippingPolicyEl = document.getElementById('prod-shipping-policy');
    const loadedShipping = data.shipping_policy || metaShipping || richData?.shipping_policy;
    if (shippingPolicyEl) {
        shippingPolicyEl.value = loadedShipping || DEFAULT_SHIPPING_POLICY;
    }

    let loadedMetrology = null;
    if (data.legal_metrology) {
        try {
            loadedMetrology = typeof data.legal_metrology === 'string' ? JSON.parse(data.legal_metrology) : data.legal_metrology;
        } catch (_) { }
    }
    if (!loadedMetrology && richData?.legal_metrology) {
        loadedMetrology = richData.legal_metrology;
    }

    const originEl = document.getElementById('prod-origin');
    if (originEl) originEl.value = loadedMetrology?.origin || metaOrigin || DEFAULT_LEGAL_METROLOGY.origin;

    const netQtyEl = document.getElementById('prod-net-qty');
    if (netQtyEl) netQtyEl.value = loadedMetrology?.netQty || metaNetQty || DEFAULT_LEGAL_METROLOGY.netQty;

    const marketedEl = document.getElementById('prod-marketed-by');
    if (marketedEl) marketedEl.value = loadedMetrology?.marketedBy || metaMarketed || DEFAULT_LEGAL_METROLOGY.marketedBy;

    const supportEl = document.getElementById('prod-customer-support');
    if (supportEl) supportEl.value = loadedMetrology?.support || metaSupport || DEFAULT_LEGAL_METROLOGY.support;

    // --- Fill Pricing ---
    const priceEl = document.getElementById('prod-price');
    if (priceEl) priceEl.value = data.price || '';

    const comparePriceEl = document.getElementById('prod-compare-price');
    if (comparePriceEl) comparePriceEl.value = data.compare_at_price || '';

    const taxEl = document.getElementById('prod-tax');
    const tax = richData?.tax || metaTax || '5%';
    if (taxEl) taxEl.value = tax;

    calculateDiscountAndSummary();

    // --- Fill Status ---
    const isActive = data.is_active;
    const activeRadio = document.querySelector('input[name="prod-status"][value="Active"]');
    const draftRadio = document.querySelector('input[name="prod-status"][value="Draft"]');
    if (activeRadio && draftRadio) {
        if (isActive) activeRadio.checked = true;
        else draftRadio.checked = true;
    }

    // --- Build color variants from rich data or product_variants ---
    colorVariantsData = [];

    if (richData && richData.variants && richData.variants.length > 0) {
        // Use rich variant data (has frontImg, backImg, sizes obj)
        colorVariantsData = richData.variants.map(v => ({ ...v }));
    } else if (data.product_variants && data.product_variants.length > 0) {
        // Reconstruct from flat product_variants table
        const colorMap = {};
        data.product_variants.forEach(pv => {
            const colorKey = pv.color || 'Default';
            if (!colorMap[colorKey]) {
                colorMap[colorKey] = {
                    colorName: colorKey,
                    colorCode: '#000000',
                    frontImg: '',
                    backImg: '',
                    sizes: {},
                    minStock: 5
                };
            }
            if (pv.size && pv.size !== 'Default') {
                colorMap[colorKey].sizes[pv.size] = parseInt(pv.stock_quantity) || 0;
            }
        });

        // Try to attach images
        if (data.product_images) {
            data.product_images.forEach(img => {
                const parts = img.url.split('#');
                const cleanUrl = parts[0];
                const colorTag = parts[1] || '';
                const side = parts[2] || '';
                if (colorTag && colorMap[colorTag]) {
                    if (side === 'front') colorMap[colorTag].frontImg = cleanUrl;
                    else if (side === 'back') colorMap[colorTag].backImg = cleanUrl;
                }
            });
        }

        colorVariantsData = Object.values(colorMap);
    }

    // --- Handle default fallback image & hover image ---
    currentDefaultImageFile = null;
    currentDefaultImageUrl = '';
    currentDefaultHoverImageFile = null;
    currentDefaultHoverImageUrl = '';

    const defaultImgContainer = document.getElementById('default-image-preview-container');
    const defaultImgPreview = document.getElementById('default-image-preview');
    const defaultImgName = document.getElementById('default-image-name');

    const defaultHoverContainer = document.getElementById('default-hover-image-preview-container');
    const defaultHoverPreview = document.getElementById('default-hover-image-preview');
    const defaultHoverName = document.getElementById('default-hover-image-name');

    if (data.product_images && data.product_images.length > 0) {
        // Position 0 = default cover image
        const fallbackImg = data.product_images.find(img => (img.position || 0) === 0 && !img.url.includes('#'))
            || data.product_images.find(img => !img.url.includes('#'));
        if (fallbackImg) {
            currentDefaultImageUrl = fallbackImg.url;
            if (defaultImgPreview) defaultImgPreview.src = fallbackImg.url;
            if (defaultImgName) defaultImgName.textContent = 'Cover Image';
            if (defaultImgContainer) defaultImgContainer.style.display = 'flex';
        } else if (defaultImgContainer) {
            defaultImgContainer.style.display = 'none';
        }

        // Default hover image (position -1 or #default#back or #back)
        const hoverImg = data.product_images.find(img => img.url.includes('#default#back') || (img.position === -1))
            || data.product_images.find(img => img.url.includes('#back'));
        if (hoverImg) {
            currentDefaultHoverImageUrl = hoverImg.url.split('#')[0];
            if (defaultHoverPreview) defaultHoverPreview.src = currentDefaultHoverImageUrl;
            if (defaultHoverName) defaultHoverName.textContent = 'Hover Image';
            if (defaultHoverContainer) defaultHoverContainer.style.display = 'flex';
        } else if (defaultHoverContainer) {
            defaultHoverContainer.style.display = 'none';
        }
    } else {
        if (defaultImgContainer) defaultImgContainer.style.display = 'none';
        if (defaultHoverContainer) defaultHoverContainer.style.display = 'none';
    }

    // --- Render variant cards, summary & interactive hover test ---
    renderAllColorVariants();
    updateLiveProductSummary();
    updateAdminInteractivePreview();

    // Update submit button text
    const submitBtn = document.getElementById('btn-submit-product');
    if (submitBtn) submitBtn.textContent = 'Save Product Changes';

    // Scroll to top
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
    else window.scrollTo(0, 0);
};

window.showOrderDetails = async function (orderId) {
    const overlay = document.getElementById('orderDetailsOverlay');
    const content = document.getElementById('orderDetailsContent');

    overlay.style.display = 'flex';
    content.innerHTML = `<div style="text-align:center; padding:40px; color:#888;">
        <div style="font-size:30px; margin-bottom:10px;">⏳</div>
        <div>Loading order details...</div>
    </div>`;

    let { data, error } = await supabaseClient
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
        .maybeSingle();

    if (error || !data) {
        const fallback = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();
        if (fallback.data) {
            data = fallback.data;
            error = null;
        }
    }

    if (!data) {
        content.innerHTML = '<p style="color:red; padding:20px;">Error loading order details. Order not found.</p>';
        return;
    }

    const cust = data.customer_details || {};
    const addr = data.shipping_address || {};
    const currentStatus = (data.status || 'pending').toLowerCase();
    const paymentStatus = (data.payment_status || 'pending').toLowerCase();
    const isPaid = paymentStatus === 'paid' || currentStatus === 'paid' || !!data.razorpay_payment_id;
    const rzpId = data.razorpay_payment_id || data.payment_id || '';
    const isCancelled = currentStatus.includes('cancel') || (data.order_stage || '') === 'cancelled';
    const isReturned = currentStatus.includes('return') || ['return_requested', 'returned'].includes(data.order_stage || '');
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
    const placedDate = new Date(data.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid #f0f0f0; flex-wrap:wrap; gap:10px;">
            <div>
                <div style="font-size:22px; font-weight:800; color:#111; font-family:monospace; letter-spacing:0.5px;">Order #${data.id.toString().substring(0, 8).toUpperCase()}</div>
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
                ${stageHistory.length > 0 ? `<div style="font-size:11px; color:#999; margin-top:2px;">${new Date(stageHistory[stageHistory.length - 1]?.timestamp || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
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
            const timeLabel = histEntry ? new Date(histEntry.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
            const dotIcon = idx < stageIdx ? '✓' : (idx === stageIdx ? '●' : '○');
            const shortLabels = { incoming: 'Incoming', confirmed: 'Confirmed', processing: 'Processing', packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for Del.', delivered: 'Delivered' };
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
    const _waItems = (data.order_items && data.order_items.length > 0) ? data.order_items : [];
    const _waNames = _waItems.length > 0
        ? _waItems.map(i => (i.products?.name || i.name || 'Product') + (i.size && i.size !== 'N/A' ? ' (' + i.size + ')' : '')).join(', ')
        : 'Your order';
    const _waShortId = data.id.toString().substring(0, 8).toUpperCase();
    const _waStatus = STAGE_LABELS[orderStage] || orderStage;
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
    const etaOptions = ['2-4 days', '3-5 days', '5-7 days', '7-10 days', 'Custom'].map(v => `<option value="${v}" ${deliveryDetails.eta_days === v ? 'selected' : ''}>${v}</option>`).join('');
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
                    <label class="delivery-form-label">Delivery ETA Message (shown to customer in My Orders)</label>
                    <input list="del-eta-presets-${data.id}" class="delivery-form-input" id="del-eta-days-${data.id}" type="text"
                        placeholder="e.g. Delivery within 2-5 working days"
                        value="${deliveryDetails.eta_days || ''}">
                    <datalist id="del-eta-presets-${data.id}">
                        <option value="Delivery within 2-5 working days">Delivery within 2-5 working days</option>
                        <option value="Delivery within 2-4 working days">Delivery within 2-4 working days</option>
                        <option value="Delivery within 3-5 business days">Delivery within 3-5 business days</option>
                        <option value="Delivery within 24-48 hours">Delivery within 24-48 hours</option>
                        <option value="Delivery within 5-7 working days">Delivery within 5-7 working days</option>
                        <option value="Out for delivery today">Out for delivery today</option>
                    </datalist>
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
                            <a href="upi://pay?pa=${upiId}&pn=${encodeURIComponent(cust.name || 'Customer')}&am=${data.total_amount}&cu=INR" style="background:#16a34a; color:#fff; text-decoration:none; padding:5px 12px; border-radius:5px; font-size:11px; font-weight:700;">⚡ Pay via UPI</a>
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
                    `Order ID: #${data.id.toString().substring(0, 8).toUpperCase()}`,
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
                        ${isRefundSettledBool ? `<div style="display:inline-flex; align-items:center; gap:6px; background:#dcfce7; color:#15803d; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800;">✓ Refund Completed (${refundInfo?.refund_ref ? 'Ref: ' + refundInfo.refund_ref : new Date(refundInfo?.refunded_at || Date.now()).toLocaleDateString()})</div>`
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
        const shortId = data.id.toString().substring(0, 8).toUpperCase();
        const currentReason = refundInfo?.reason || 'Customer Request';
        let reasonOptionsHtml = CANCELLATION_REASONS.map(r => `
            <option value="${r}" ${r === currentReason ? 'selected' : ''}>${r}</option>
        `).join('');
        if (!CANCELLATION_REASONS.includes(currentReason)) {
            reasonOptionsHtml += `<option value="${currentReason}" selected>${currentReason}</option>`;
        }

        const cancelledDateStr = refundInfo?.cancelled_at
            ? new Date(refundInfo.cancelled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
                            ${phoneClean ? `<a href="https://wa.me/91${phoneClean}?text=${encodeURIComponent('Hello ' + (cust.name || '') + ', regarding your refund of ₹' + data.total_amount + ' for Kappa Clothing order #' + shortId + '...')}" target="_blank" class="btn-whatsapp-notify" style="padding:6px 12px; font-size:12px;">💬 WhatsApp</a>` : ''}
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
    const partner = document.getElementById(`del-partner-${orderId}`)?.value.trim() || '';
    const tracking = document.getElementById(`del-tracking-${orderId}`)?.value.trim() || '';
    const etaDate = document.getElementById(`del-eta-date-${orderId}`)?.value || '';
    const etaDays = document.getElementById(`del-eta-days-${orderId}`)?.value || '';
    const charge = document.getElementById(`del-charge-${orderId}`)?.value || '';
    const trackUrl = document.getElementById(`del-track-url-${orderId}`)?.value.trim() || '';

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

        const statusSelect = document.getElementById('adminRefundStatusSelect');
        if (statusSelect) {
            statusSelect.value = refund.refund_status === 'refunded' ? 'refunded' : 'refunded';
        }

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
    const chosenStatus = document.getElementById('adminRefundStatusSelect')?.value || 'refunded';
    let refundPayload = {
        method: method,
        refund_status: chosenStatus,
        updated_by_admin: true,
        updated_at: new Date().toISOString()
    };

    if (chosenStatus === 'refunded') {
        refundPayload.refunded_at = new Date().toISOString();
        refundPayload.refund_ref = 'Manual Refund';
    }

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

        const updatePayload = {
            customer_details: updatedCust,
            refund_details: mergedRefund,
            order_stage: chosenStatus === 'refunded' ? 'refunded' : 'cancelled'
        };

        const { error: upErr } = await supabaseClient.from('orders').update(updatePayload).eq('id', orderId);
        if (upErr) {
            delete updatePayload.refund_details;
            await supabaseClient.from('orders').update(updatePayload).eq('id', orderId);
        }

        document.getElementById('adminRefundEditModal').style.display = 'none';
        alert(`Refund details saved! Status: ${chosenStatus.toUpperCase()}`);
        if (typeof showOrderDetails === 'function') showOrderDetails(orderId);
        if (typeof loadOrders === 'function') await loadOrders();
        if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
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

        await supabaseClient.from('orders').update({
            order_stage: 'refunded',
            customer_details: updatedCust,
            refund_details: updatedRefund
        }).eq('id', orderId);

        alert(`Refund of ₹${amount} recorded as completed! Reference: ${refId || 'Manual'}`);
        if (typeof showOrderDetails === 'function') showOrderDetails(orderId);
        if (typeof loadOrders === 'function') await loadOrders();
        if (typeof loadCancelledOrders === 'function') await loadCancelledOrders();
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

        // Auto-correct any profiles in DB that mistakenly have role 'admin' when not kappatvm@gmail.com
        const wrongAdmins = profiles.filter(p => (p.email || '').toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase() && p.role === 'admin');
        if (wrongAdmins.length > 0) {
            const wrongIds = wrongAdmins.map(p => p.id);
            supabaseClient.from('profiles').update({ role: 'customer' }).in('id', wrongIds).then(() => {
                console.log('Sanitized non-authorized admin roles back to customer.');
            }).catch(e => console.warn('Role sanitize warning:', e));
        }

        let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div>
                <h2 class="card-title" style="margin:0;">Customer Accounts (${profiles.length})</h2>
                <p style="font-size:12px; color:#888; margin-top:2px;">Store user profiles and registered accounts</p>
            </div>
        </div>
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
            const isOfficialAdmin = (p.email || '').toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
            const displayRole = isOfficialAdmin ? 'ADMIN' : 'CUSTOMER';
            const roleBadgeStyle = isOfficialAdmin
                ? 'background:#FFD700; color:#111; font-weight:800; border:1px solid #eab308;'
                : 'background:#f1f5f9; color:#475569; font-weight:600; border:1px solid #e2e8f0;';

            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:12px; font-weight:600; color:#111;">${p.full_name || 'Guest User'}</td>
                    <td style="padding:12px; color:#555;">${p.email || 'N/A'}</td>
                    <td style="padding:12px; color:#555;">${p.phone || 'N/A'}</td>
                    <td style="padding:12px;"><span style="padding:4px 10px; border-radius:20px; font-size:11px; letter-spacing:0.5px; ${roleBadgeStyle}">${displayRole}</span></td>
                </tr>`;
        });
        html += `</tbody></table></div>`;
        card.innerHTML = html;
    } catch (e) {
        console.error('Error loading customers:', e);
        card.innerHTML = '<p style="color:red;">Error loading customer list.</p>';
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
        const pst = (o.payment_status || '').toLowerCase().trim();
        const stage = (o.order_stage || '').toLowerCase().trim();
        if (stage === 'cancelled' || st.includes('cancel')) return 0;
        const isPaid = st === 'paid' || st === 'confirmed' || st === 'delivered' || pst === 'paid' || !!o.razorpay_payment_id;
        return isPaid ? Number(o.total_amount || 0) : 0;
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

window.changeSalesTimeframe = function (timeframe, btn) {
    currentSalesTimeframe = timeframe;
    document.querySelectorAll('#salesTimeFilters .dash-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderSalesChart(timeframe);
};

window.switchAdminOrdersFilter = async function (stage) {
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
            .select('id, total_amount, status, payment_status, razorpay_payment_id, order_stage, created_at');

        allLiveOrdersForDashboard = Array.isArray(orders) ? orders : [];

        if (allLiveOrdersForDashboard.length > 0) {
            allLiveOrdersForDashboard.forEach(o => {
                liveOrdersCount++;
                const st = (o.status || '').toLowerCase().trim();
                const pst = (o.payment_status || '').toLowerCase().trim();
                const stage = (o.order_stage || '').toLowerCase().trim();
                const amt = Number(o.total_amount || 0);
                const isCancelled = stage === 'cancelled' || st.includes('cancel');
                const isPaid = (st === 'paid' || st === 'confirmed' || st === 'delivered' || pst === 'paid' || !!o.razorpay_payment_id) && !isCancelled;

                if (isPaid) {
                    liveRevenue += amt;
                    livePaidTotal += amt;
                }

                // Map to distribution bucket
                if (isCancelled) {
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
window.renderSalesChart = function (timeframeKey) {
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
window.renderOrderDonutChart = function (counts, total) {
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


// (Legacy duplicate deleteOrder removed — unified deleteOrder handles Recycle Bin)

// ==========================================
// CANCELLED ORDERS & REFUND MANAGEMENT MODULE
// ==========================================
let currentCancelledFilter = 'all';
let currentCancelledSearch = '';
cachedCancelledOrdersList = [];

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

        if (typeof markCancelledOrdersAsSeen === 'function') {
            markCancelledOrdersAsSeen(cachedCancelledOrdersList.map(o => o.id));
        }

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

        updatePayload.status = 'cancelled';
        updatePayload.order_stage = (status === 'refunded') ? 'refunded' : 'cancelled';

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

// ── SIDEBAR NOTIFICATION BADGES & UNSEEN ORDER TRACKER ──
function getSeenOrders() {
    try {
        return JSON.parse(localStorage.getItem('kappa_admin_seen_orders') || '[]');
    } catch (_) { return []; }
}

function getSeenCancelledOrders() {
    try {
        return JSON.parse(localStorage.getItem('kappa_admin_seen_cancelled') || '[]');
    } catch (_) { return []; }
}

window.markOrdersAsSeen = function (orderIds) {
    try {
        const seen = new Set(getSeenOrders());
        (orderIds || []).forEach(id => {
            if (id) seen.add(String(id));
        });
        localStorage.setItem('kappa_admin_seen_orders', JSON.stringify(Array.from(seen)));

        const ordersBadge = document.getElementById('nav-badge-orders');
        if (ordersBadge) {
            ordersBadge.textContent = '0';
            ordersBadge.style.display = 'none';
        }
    } catch (_) { }
};

window.markCancelledOrdersAsSeen = function (cancelledIds) {
    try {
        const seen = new Set(getSeenCancelledOrders());
        (cancelledIds || []).forEach(id => {
            if (id) seen.add(String(id));
        });
        localStorage.setItem('kappa_admin_seen_cancelled', JSON.stringify(Array.from(seen)));

        const cancelledBadge = document.getElementById('nav-badge-cancelled');
        if (cancelledBadge) {
            cancelledBadge.textContent = '0';
            cancelledBadge.style.display = 'none';
        }
    } catch (_) { }
};

async function updateSidebarOrderBadges() {
    const ordersBadge = document.getElementById('nav-badge-orders');
    const cancelledBadge = document.getElementById('nav-badge-cancelled');

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('id, status, order_stage, created_at')
            .order('created_at', { ascending: false });

        if (error || !orders) return;

        // On very first load of admin dashboard, initialize known orders as already seen so badge starts at 0
        const isFirstInit = localStorage.getItem('kappa_admin_badges_initialized') !== 'true';
        if (isFirstInit) {
            const allOrderIds = orders.filter(o => !((o.status || '').toLowerCase().includes('cancel') || o.order_stage === 'cancelled')).map(o => String(o.id));
            const allCancelledIds = orders.filter(o => ((o.status || '').toLowerCase().includes('cancel') || o.order_stage === 'cancelled')).map(o => String(o.id));
            localStorage.setItem('kappa_admin_seen_orders', JSON.stringify(allOrderIds));
            localStorage.setItem('kappa_admin_seen_cancelled', JSON.stringify(allCancelledIds));
            localStorage.setItem('kappa_admin_badges_initialized', 'true');
        }

        const seenOrders = new Set(getSeenOrders());
        const seenCancelled = new Set(getSeenCancelledOrders());

        const isOrdersActive = document.querySelector('.sidebar-menu li[data-target="orders"]')?.classList.contains('active');
        const isCancelledActive = document.querySelector('.sidebar-menu li[data-target="cancelled"]')?.classList.contains('active');

        let newOrdersCount = 0;
        let newCancelledCount = 0;
        const currentActiveIds = [];
        const currentCancelledIds = [];

        orders.forEach(o => {
            const st = (o.status || '').toLowerCase().trim();
            const stage = (o.order_stage || '').toLowerCase().trim();
            const idStr = String(o.id);

            if (st !== 'pending') {
                if (st.includes('cancel') || stage === 'cancelled') {
                    currentCancelledIds.push(idStr);
                    if (!seenCancelled.has(idStr)) {
                        newCancelledCount++;
                    }
                } else {
                    currentActiveIds.push(idStr);
                    if (!seenOrders.has(idStr)) {
                        newOrdersCount++;
                    }
                }
            }
        });

        // If admin is currently looking at Orders tab, auto-mark active orders as seen
        if (isOrdersActive && currentActiveIds.length > 0) {
            markOrdersAsSeen(currentActiveIds);
            newOrdersCount = 0;
        }

        // If admin is currently looking at Cancelled tab, auto-mark cancelled orders as seen
        if (isCancelledActive && currentCancelledIds.length > 0) {
            markCancelledOrdersAsSeen(currentCancelledIds);
            newCancelledCount = 0;
        }

        if (ordersBadge) {
            if (newOrdersCount > 0) {
                ordersBadge.textContent = newOrdersCount;
                ordersBadge.style.display = 'inline-flex';
            } else {
                ordersBadge.textContent = '0';
                ordersBadge.style.display = 'none';
            }
        }

        if (cancelledBadge) {
            if (newCancelledCount > 0) {
                cancelledBadge.textContent = newCancelledCount;
                cancelledBadge.style.display = 'inline-flex';
            } else {
                cancelledBadge.textContent = '0';
                cancelledBadge.style.display = 'none';
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

// ==========================================
// REAL-TIME MOBILE ADMIN NOTIFICATIONS SYSTEM
// ==========================================

const MOBILE_NOTIF_STORAGE_KEY = 'kappa_mobile_admin_notifications';

function getMobileAdminNotifications() {
    try {
        const stored = localStorage.getItem(MOBILE_NOTIF_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveMobileAdminNotifications(list) {
    try {
        localStorage.setItem(MOBILE_NOTIF_STORAGE_KEY, JSON.stringify(list));
    } catch (e) { }
    updateMobileNotificationUI();
}

function formatNotifTime(isoString) {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;

    const isToday = date.toDateString() === now.toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterdayDate.toDateString();

    const timeStr = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + `, ${timeStr}`;
}

window.addMobileAdminNotification = function (notifObj) {
    const list = getMobileAdminNotifications();
    
    // Prevent duplicate notifications for the exact same order event
    const exists = list.some(n => n.order_id === notifObj.order_id && n.type === notifObj.type);
    if (exists) return;

    const notif = {
        id: notifObj.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        order_id: notifObj.order_id,
        order_number: notifObj.order_number || ('#' + String(notifObj.order_id).substring(0, 8).toUpperCase()),
        type: notifObj.type || 'new_order', // 'new_order' or 'cancelled_order'
        title: notifObj.title || (notifObj.type === 'cancelled_order' ? 'Order Cancelled' : 'New Order Received'),
        message: notifObj.message || (notifObj.type === 'cancelled_order' ? 'Cancelled orders require your attention.' : 'A new order has been received and is waiting for processing.'),
        amount: notifObj.amount || 0,
        itemsCount: notifObj.itemsCount || 1,
        timestamp: notifObj.timestamp || new Date().toISOString(),
        read: false
    };

    list.unshift(notif);
    // Keep max 50 recent notifications
    if (list.length > 50) list.pop();

    saveMobileAdminNotifications(list);

    // Trigger In-App Push Banner Toast & Browser Push Notification
    showMobilePushToast(notif);
    triggerWebPushNotification(notif);
    playNotificationChime(notif.type);
};

window.updateMobileNotificationUI = function () {
    const list = getMobileAdminNotifications();

    const newOrders = list.filter(n => n.type === 'new_order');
    const cancelledOrders = list.filter(n => n.type === 'cancelled_order');
    const unreadCount = list.filter(n => !n.read).length;

    // Update Notification Card 1 (NEW ORDERS)
    const elNewCount = document.getElementById('mobile-new-orders-count');
    if (elNewCount) elNewCount.textContent = newOrders.length;
    const elNewTitle = document.getElementById('mobile-new-orders-title');
    if (elNewTitle) elNewTitle.textContent = `${newOrders.length} New Order${newOrders.length === 1 ? '' : 's'}`;
    const elNewTime = document.getElementById('mobile-new-orders-time');
    if (elNewTime) elNewTime.textContent = newOrders.length > 0 ? formatNotifTime(newOrders[0].timestamp) : 'Just now';

    // Update Notification Card 2 (CANCELLED ORDERS)
    const elCancCount = document.getElementById('mobile-cancelled-orders-count');
    if (elCancCount) elCancCount.textContent = cancelledOrders.length;
    const elCancTitle = document.getElementById('mobile-cancelled-orders-title');
    if (elCancTitle) elCancTitle.textContent = `${cancelledOrders.length} Order${cancelledOrders.length === 1 ? '' : 's'} Cancelled`;
    const elCancTime = document.getElementById('mobile-cancelled-orders-time');
    if (elCancTime) elCancTime.textContent = cancelledOrders.length > 0 ? formatNotifTime(cancelledOrders[0].timestamp) : 'Recently';

    // Update Badges
    const headerBadge = document.getElementById('mobile-header-notif-badge');
    if (headerBadge) {
        headerBadge.textContent = unreadCount;
        headerBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    const bottomBadge = document.getElementById('mobile-bottom-nav-badge');
    if (bottomBadge) {
        bottomBadge.textContent = unreadCount;
        bottomBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    // Render Notifications Center View
    renderNotificationCenterList(list);
};

function renderNotificationCenterList(list) {
    const container = document.getElementById('notif-center-list-container');
    const emptyState = document.getElementById('notif-center-empty-state');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const today = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toDateString();

    const groups = {
        TODAY: [],
        YESTERDAY: [],
        EARLIER: []
    };

    list.forEach(n => {
        const d = new Date(n.timestamp).toDateString();
        if (d === today) groups.TODAY.push(n);
        else if (d === yesterday) groups.YESTERDAY.push(n);
        else groups.EARLIER.push(n);
    });

    let html = '';
    ['TODAY', 'YESTERDAY', 'EARLIER'].forEach(groupKey => {
        const items = groups[groupKey];
        if (items.length > 0) {
            html += `<div class="notif-group-title">${groupKey}</div>`;
            items.forEach(n => {
                const isCancelled = n.type === 'cancelled_order';
                const dotIcon = isCancelled ? '🔴' : '🟡';
                const orderNum = n.order_number || ('#' + String(n.order_id || '').substring(0, 8));
                const actionLabel = isCancelled ? 'cancelled' : 'received';
                const titleText = `Order ${orderNum} ${actionLabel}`;
                const amountText = n.amount > 0 ? `₹${Number(n.amount).toLocaleString('en-IN')} • ${n.itemsCount || 1} Item${(n.itemsCount || 1) === 1 ? '' : 's'}` : '';

                html += `
                    <div class="notif-item ${!n.read ? 'unread' : ''} ${isCancelled ? 'notif-type-cancelled' : ''}" onclick="handleNotificationItemClick('${n.id}', '${n.order_id}', ${isCancelled})">
                        <div class="notif-item-dot">${dotIcon}</div>
                        <div class="notif-item-content">
                            <div class="notif-item-title">${titleText}</div>
                            ${amountText ? `<div class="notif-item-details">${amountText}</div>` : ''}
                            <div class="notif-item-time">${formatNotifTime(n.timestamp)}</div>
                        </div>
                    </div>
                `;
            });
        }
    });

    container.innerHTML = html;
}

window.markAllNotificationsAsRead = function () {
    const list = getMobileAdminNotifications();
    list.forEach(n => n.read = true);
    saveMobileAdminNotifications(list);
};

window.handleNotificationItemClick = function (notifId, orderId, isCancelled) {
    const list = getMobileAdminNotifications();
    const item = list.find(n => n.id === notifId);
    if (item) item.read = true;
    saveMobileAdminNotifications(list);

    if (isCancelled) {
        switchAdminView('cancelled');
    } else {
        switchAdminView('orders');
    }

    if (typeof showOrderDetails === 'function' && orderId) {
        showOrderDetails(orderId);
    }
};

let _pushToastTimeout = null;
function showMobilePushToast(notif) {
    const toast = document.getElementById('mobile-push-toast');
    if (!toast) return;

    const iconEl = document.getElementById('push-toast-icon');
    const titleEl = document.getElementById('push-toast-title');
    const timeEl = document.getElementById('push-toast-time');
    const msgEl = document.getElementById('push-toast-msg');
    const metaEl = document.getElementById('push-toast-meta');

    const isCancelled = notif.type === 'cancelled_order';
    if (iconEl) iconEl.textContent = isCancelled ? '⚠️' : '🔔';
    if (titleEl) titleEl.textContent = isCancelled ? 'Order Cancelled' : 'New Order Received';
    if (timeEl) timeEl.textContent = formatNotifTime(notif.timestamp);
    if (msgEl) msgEl.textContent = `Order ${notif.order_number || '#'+notif.order_id} has been ${isCancelled ? 'cancelled' : 'placed'}.`;
    if (metaEl) metaEl.textContent = notif.amount > 0 ? `₹${Number(notif.amount).toLocaleString('en-IN')} • ${notif.itemsCount || 1} Item${(notif.itemsCount || 1) === 1 ? '' : 's'}` : '';

    toast.onclick = function (e) {
        if (e.target.classList.contains('push-toast-close')) return;
        closeMobilePushToast();
        handleNotificationItemClick(notif.id, notif.order_id, isCancelled);
    };

    toast.classList.add('show');

    if (_pushToastTimeout) clearTimeout(_pushToastTimeout);
    _pushToastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 6000);
}

window.closeMobilePushToast = function (e) {
    if (e) e.stopPropagation();
    const toast = document.getElementById('mobile-push-toast');
    if (toast) toast.classList.remove('show');
};

function triggerWebPushNotification(notif) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        const isCancelled = notif.type === 'cancelled_order';
        const title = isCancelled ? '⚠️ Order Cancelled' : '🔔 New Order Received';
        const body = `Order ${notif.order_number || '#'+notif.order_id} has been ${isCancelled ? 'cancelled' : 'placed'}.\n₹${Number(notif.amount || 0).toLocaleString('en-IN')} • ${notif.itemsCount || 1} Items\nTap to view details.`;
        try {
            new Notification(title, { body: body, icon: 'assets/kappalogo_favion.png' });
        } catch (e) { }
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

function playNotificationChime(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'cancelled_order') {
            osc.frequency.setValueAtTime(350, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) { }
}

let _realtimeOrdersChannel = null;
function initRealtimeOrdersAndNotifications() {
    updateMobileNotificationUI();
    syncExistingOrdersToNotifications();

    if (!supabaseClient) return;

    try {
        _realtimeOrdersChannel = supabaseClient
            .channel('admin-mobile-notifications-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                const newRow = payload.new;
                if (!newRow) return;

                const st = (newRow.status || '').toLowerCase().trim();
                const stage = (newRow.order_stage || '').toLowerCase().trim();
                const isCancelled = stage === 'cancelled' || st.includes('cancel');

                if (isCancelled) {
                    addMobileAdminNotification({
                        order_id: newRow.id,
                        order_number: '#' + String(newRow.id).substring(0, 8).toUpperCase(),
                        type: 'cancelled_order',
                        title: 'Order Cancelled',
                        message: 'Cancelled orders require your attention.',
                        amount: Number(newRow.total_amount || 0),
                        itemsCount: Array.isArray(newRow.items) ? newRow.items.length : 1,
                        timestamp: newRow.updated_at || newRow.created_at || new Date().toISOString()
                    });
                } else if (st === 'paid' || stage === 'incoming' || payload.eventType === 'INSERT') {
                    addMobileAdminNotification({
                        order_id: newRow.id,
                        order_number: '#' + String(newRow.id).substring(0, 8).toUpperCase(),
                        type: 'new_order',
                        title: 'New Order Received',
                        message: 'A new order has been received and is waiting for processing.',
                        amount: Number(newRow.total_amount || 0),
                        itemsCount: Array.isArray(newRow.items) ? newRow.items.length : 1,
                        timestamp: newRow.created_at || new Date().toISOString()
                    });
                }

                // Update badges and view lists dynamically!
                if (typeof updateSidebarOrderBadges === 'function') updateSidebarOrderBadges();
                if (document.getElementById('view-orders')?.classList.contains('active-view') && typeof loadOrders === 'function') loadOrders();
                if (document.getElementById('view-cancelled')?.classList.contains('active-view') && typeof loadCancelledOrders === 'function') loadCancelledOrders();
            })
            .subscribe();
    } catch (e) {
        console.error('Error setting up Supabase Realtime for orders:', e);
    }

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

async function syncExistingOrdersToNotifications() {
    const currentNotifs = getMobileAdminNotifications();

    try {
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('id, total_amount, status, order_stage, created_at, items')
            .order('created_at', { ascending: false })
            .limit(20);

        if (Array.isArray(orders) && orders.length > 0) {
            orders.forEach(o => {
                const st = (o.status || '').toLowerCase().trim();
                const stage = (o.order_stage || '').toLowerCase().trim();
                const isCancelled = stage === 'cancelled' || st.includes('cancel');
                const orderNum = '#' + String(o.id).substring(0, 8).toUpperCase();
                const itemsCount = Array.isArray(o.items) ? o.items.length : 1;

                if (isCancelled) {
                    const exists = currentNotifs.some(n => n.order_id === o.id && n.type === 'cancelled_order');
                    if (!exists) {
                        currentNotifs.push({
                            id: 'notif_canc_' + o.id,
                            order_id: o.id,
                            order_number: orderNum,
                            type: 'cancelled_order',
                            title: 'Order Cancelled',
                            message: 'Cancelled orders require your attention.',
                            amount: Number(o.total_amount || 0),
                            itemsCount: itemsCount,
                            timestamp: o.created_at || new Date().toISOString(),
                            read: false
                        });
                    }
                } else {
                    const exists = currentNotifs.some(n => n.order_id === o.id && n.type === 'new_order');
                    if (!exists) {
                        currentNotifs.push({
                            id: 'notif_new_' + o.id,
                            order_id: o.id,
                            order_number: orderNum,
                            type: 'new_order',
                            title: 'New Order Received',
                            message: 'A new order has been received and is waiting for processing.',
                            amount: Number(o.total_amount || 0),
                            itemsCount: itemsCount,
                            timestamp: o.created_at || new Date().toISOString(),
                            read: false
                        });
                    }
                }
            });

            currentNotifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            saveMobileAdminNotifications(currentNotifs);
        }
    } catch (e) {
        console.error('Error syncing existing orders to notifications:', e);
    }
}