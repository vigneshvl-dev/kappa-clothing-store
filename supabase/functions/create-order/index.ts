// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, receipt_id } = await req.json()

    const keyId = 'rzp_test_TFOxCSs3iPI2pU'
    const keySecret = 'bb6nZdz3nr7lytEq9eaubKg6'

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${keyId}:${keySecret}`)
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        receipt: receipt_id || 'receipt_' + Date.now()
      })
    })

    const order = await razorpayRes.json()

    if (!razorpayRes.ok) {
      console.error("Razorpay rejection:", order)
      return new Response(JSON.stringify({ error: order.error?.description || "Razorpay API error" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify(order), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})