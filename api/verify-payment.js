require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const crypto = require("crypto");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Missing fields: return 400
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing required verification fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim().replace(/^['"]|['"]$/g, "") : null;
    if (!key_secret) {
        return res.status(401).json({ error: "Razorpay credentials are not configured on the server" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    try {
        // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        const generated_signature = crypto
            .createHmac("sha256", key_secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        // Compare generated signature with razorpay_signature
        if (generated_signature === razorpay_signature) {
            // Update order status securely in Supabase using service role key (bypasses RLS)
            if (orderId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
                console.log(`Updating order ${orderId} status to paid in Supabase via service role...`);
                const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        status: 'paid',
                        payment_status: 'paid',
                        razorpay_payment_id: razorpay_payment_id
                    })
                });

                if (!updateRes.ok) {
                    const updateErr = await updateRes.text();
                    console.error("Failed to update order status in Supabase:", updateRes.status, updateErr);
                } else {
                    console.log(`✅ Order ${orderId} successfully marked as PAID in database.`);
                }
            } else {
                console.warn("Skipping order update: missing orderId, SUPABASE_URL, or SUPABASE_SERVICE_KEY");
            }

            res.status(200).json({ success: true, message: "Payment verified successfully" });
        } else {
            // Signature mismatch: return 400
            res.status(400).json({ success: false, error: "Signature verification failed" });
        }
    } catch (error) {
        console.error("Signature verification error:", error);
        res.status(500).json({ error: "Internal server error during verification" });
    }
};
