require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { items } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: "Server Supabase credentials not configured" });
    }

    const headers = {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    const updated = [];

    try {
        for (const item of items) {
            const prodId = item.id || item.product_id;
            const qty = Math.max(1, parseInt(item.qty || item.quantity || 1));
            const size = (item.size && item.size !== 'Default' && item.size !== 'N/A') ? item.size.trim() : null;
            const color = (item.color && item.color !== 'Default' && item.color !== 'N/A') ? item.color.trim() : null;

            if (!prodId) continue;

            // 1. Update variant stock if size specified
            if (size) {
                let variantQuery = `${SUPABASE_URL}/rest/v1/product_variants?product_id=eq.${prodId}&size=eq.${encodeURIComponent(size)}`;
                if (color) {
                    variantQuery += `&color=eq.${encodeURIComponent(color)}`;
                }

                const vRes = await fetch(variantQuery, { headers });
                let variants = vRes.ok ? await vRes.json() : [];

                // Fallback to size only if color match didn't find rows
                if ((!variants || variants.length === 0) && color) {
                    const vResSize = await fetch(`${SUPABASE_URL}/rest/v1/product_variants?product_id=eq.${prodId}&size=eq.${encodeURIComponent(size)}`, { headers });
                    if (vResSize.ok) variants = await vResSize.json();
                }

                if (Array.isArray(variants) && variants.length > 0) {
                    for (const variant of variants) {
                        const currentStock = Number(variant.stock_quantity || 0);
                        const newStock = Math.max(0, currentStock - qty);

                        await fetch(`${SUPABASE_URL}/rest/v1/product_variants?id=eq.${variant.id}`, {
                            method: 'PATCH',
                            headers: {
                                ...headers,
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ stock_quantity: newStock })
                        });

                        updated.push({
                            type: 'variant',
                            variantId: variant.id,
                            productId: prodId,
                            size: variant.size,
                            previousStock: currentStock,
                            newStock
                        });
                    }
                }
            }

            // 2. Update main product stock
            const pRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${prodId}&select=id,stock_quantity`, { headers });
            if (pRes.ok) {
                const prods = await pRes.json();
                if (Array.isArray(prods) && prods.length > 0) {
                    const prod = prods[0];
                    const currentProdStock = Number(prod.stock_quantity || 0);
                    const newProdStock = Math.max(0, currentProdStock - qty);

                    await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${prodId}`, {
                        method: 'PATCH',
                        headers: {
                            ...headers,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ stock_quantity: newProdStock })
                    });

                    updated.push({
                        type: 'product',
                        productId: prodId,
                        previousStock: currentProdStock,
                        newStock: newProdStock
                    });
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Stock successfully deducted",
            updated
        });
    } catch (err) {
        return res.status(500).json({
            error: "Failed to deduct stock: " + err.message
        });
    }
};
