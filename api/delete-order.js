require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { orderId } = req.body;
    if (!orderId) {
        return res.status(400).json({ error: "Missing orderId in request body" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
    }

    const headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal"
    };

    try {
        // Step 1: Delete order_items (child rows first to avoid FK constraint errors)
        const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${orderId}`, {
            method: "DELETE",
            headers
        });

        if (!itemsRes.ok && itemsRes.status !== 404) {
            const itemsErr = await itemsRes.text();
            console.warn("Could not delete order_items:", itemsErr);
            // Don't abort — order may have no items
        }

        // Step 2: Delete the order itself
        const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
            method: "DELETE",
            headers
        });

        if (!orderRes.ok) {
            const orderErr = await orderRes.text();
            console.error("Failed to delete order:", orderRes.status, orderErr);
            return res.status(orderRes.status).json({ error: "Failed to delete order: " + orderErr });
        }

        console.log(`✅ Order ${orderId} deleted successfully via service role`);
        return res.status(200).json({ success: true, message: "Order deleted successfully" });

    } catch (err) {
        console.error("Error in delete-order endpoint:", err);
        return res.status(500).json({ error: err.message });
    }
};
