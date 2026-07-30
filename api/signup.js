require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Missing required fields (email, password, fullName)" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
    }

    try {
        console.log(`Creating user ${email} in Supabase Auth via admin API...`);
        const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: {
                    full_name: fullName
                }
            })
        });

        const signupData = await signupRes.json();

        if (!signupRes.ok) {
            console.error("Failed to create user in Supabase auth:", signupRes.status, signupData);
            return res.status(signupRes.status).json({ error: signupData.error_description || signupData.message || "Failed to create user" });
        }

        console.log(`✅ User ${email} successfully created and email marked as confirmed.`);
        
        // Also insert profile in public.profiles table
        const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                id: signupData.id,
                full_name: fullName,
                role: 'customer'
            })
        });

        if (!profileRes.ok) {
            const profileErr = await profileRes.text();
            console.warn("Failed to create profile row in database (might already exist or be handled by trigger):", profileRes.status, profileErr);
        }

        return res.status(200).json({ success: true, user: signupData });

    } catch (err) {
        console.error("Error in signup endpoint:", err);
        return res.status(500).json({ error: err.message });
    }
};
