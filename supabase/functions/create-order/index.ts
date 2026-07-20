// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { receipt_id } = body

    if (!receipt_id) {
      throw new Error('Missing receipt_id (order ID) in request body.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch the verified order total directly from your database orders table
    const { data: orderRecord, error } = await supabaseAdmin
      .from('orders') 
      .select('total_amount')
      .eq('id', receipt_id)
      .single()

    if (error || !orderRecord) {
      throw new Error(`Order not found in database for ID: ${receipt_id}`)
    }

    // Convert total amount to paise for Razorpay
    const officialPriceInPaise = Math.round(Number(orderRecord.total_amount) * 100)

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${keyId}:${keySecret}`)
      },
      body: JSON.stringify({
        amount: officialPriceInPaise, 
        currency: 'INR',
        receipt: receipt_id
      })
    })

    const order = await razorpayRes.json()

    if (!order.id) {
      throw new Error(order.error?.description || 'Failed to create Razorpay order')
    }

    return new Response(JSON.stringify(order), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})