-- ============================================================
-- KAPPA STORE — Order Management Upgrade: One-time Migration
-- Run this once in the Supabase SQL Editor
-- ============================================================

-- Add order lifecycle stage (separate from payment status)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_stage text DEFAULT 'incoming';

-- Store full history of stage transitions with timestamps
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '[]'::jsonb;

-- Store delivery details: partner, tracking ID, ETA, etc.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_details jsonb DEFAULT '{}'::jsonb;

-- Store payment method for display (populated at checkout)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;

-- Store refund details & customer cancellation reason
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Update any existing paid orders to have 'incoming' stage if not set
UPDATE public.orders
SET order_stage = 'incoming'
WHERE order_stage IS NULL
   OR order_stage = '';

