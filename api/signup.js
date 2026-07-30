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

        // Build auth headers — works with both old JWT (eyJ...) and new sb_secret keys
        const authHeaders = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        };

        const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                email: email,
                password: password,
                email_confirm: true,   // skip email confirmation
                user_metadata: {
                    full_name: fullName
                }
            })
        });

        const signupData = await signupRes.json();

        if (!signupRes.ok) {
            console.error("Failed to create user in Supabase auth:", signupRes.status, signupData);
            const errMsg = signupData.msg || signupData.error_description || signupData.message || signupData.error || "Failed to create user";
            // Normalise duplicate user errors
            if (signupRes.status === 422 || (typeof errMsg === 'string' && (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('duplicate')))) {
                return res.status(409).json({ error: "Email is already registered. Please log in instead." });
            }
            return res.status(signupRes.status).json({ error: errMsg });
        }

        console.log(`✅ User ${email} created and email auto-confirmed.`);

        // Insert/upsert profile row in public.profiles
        // (The DB trigger also handles this, but we do it explicitly as a safety net)
        const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
                ...authHeaders,
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify({
                id: signupData.id,
                full_name: fullName,
                role: 'customer'
            })
        });

        if (!profileRes.ok) {
            const profileErr = await profileRes.text();
            console.warn("Profile upsert warning (trigger may have handled it):", profileRes.status, profileErr);
        } else {
            console.log(`✅ Profile row created for ${email}`);
        }

        return res.status(200).json({ success: true, user: { id: signupData.id, email: signupData.email } });

    } catch (err) {
        console.error("Error in signup endpoint:", err);
        return res.status(500).json({ error: err.message });
    }
};
