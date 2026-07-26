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

    try {
        console.log(`Updating order ${orderId} status to cancelled in Supabase via service role...`);
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                status: 'cancelled'
            })
        });

        if (!updateRes.ok) {
            const updateErr = await updateRes.text();
            console.error("Failed to cancel order status in Supabase:", updateRes.status, updateErr);
            return res.status(updateRes.status).json({ error: "Failed to update status: " + updateErr });
        }

        console.log(`✅ Order ${orderId} successfully marked as CANCELLED in database.`);
        return res.status(200).json({ success: true, message: "Order status updated to cancelled" });

    } catch (err) {
        console.error("Error in cancel-order endpoint:", err);
        return res.status(500).json({ error: err.message });
    }
};
