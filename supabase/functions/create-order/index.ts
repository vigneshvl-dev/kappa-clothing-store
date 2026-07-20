const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight requests (required for browser fetch)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Read the frontend JSON body (amount and dbOrderId)
    const { amount, receipt_id } = await req.json()

    // 3. Fetch Razorpay API keys from Supabase Environment Variables securely
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!keyId || !keySecret) {
      throw new Error("Server configuration error: Missing API keys")
    }

    // 4. Securely ask the Razorpay API to generate an order
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Convert keys to Base64 for Basic Auth as required by Razorpay
        'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`
      },
      body: JSON.stringify({
        amount: amount,      // Secure amount in paise
        currency: 'INR',
        receipt: receipt_id  // Linking Supabase DB order ID to Razorpay
      })
    })

    const razorpayOrder = await response.json()
    
    // 5. Send the created order back to the frontend checkout!
    return new Response(JSON.stringify(razorpayOrder), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.ok ? 200 : 400
    })

  } catch (error) {
    // Safely extract the error message without using 'any'
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})