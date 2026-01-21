import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/orders
 * 
 * Internal endpoint called by /api/orders/transactional-create
 * 
 * Handles POS format with JSONB breakdown + handling
 * {
 *   "source": "store",
 *   "customer_id": "uuid",
 *   "cashier_id": "uuid" (or null for mobile),
 *   "status": "processing",
 *   "total_amount": 500,
 *   "breakdown": { ...JSONB... },
 *   "handling": { ...JSONB... },
 *   "gcash_receipt_url": "https://..." (optional)
 * }
 */

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const body = await req.json();

  try {
    // ========== VALIDATE POS FORMAT ==========
    // Must have breakdown + handling (JSONB)
    
    const { source, customer_id, cashier_id, status, total_amount, order_note, breakdown, handling, gcash_receipt_url, loyaltyPointsUsed } = body;

    if (!customer_id || !breakdown || !handling) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customer_id, breakdown, handling' },
        { status: 400 }
      );
    }

    // Verify customer exists
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .single();

    if (customerError || !customerData) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify cashier exists (only if provided)
    if (cashier_id) {
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('id', cashier_id)
        .single();

      if (staffError || !staffData) {
        return NextResponse.json(
          { success: false, error: 'Staff/cashier not found' },
          { status: 404 }
        );
      }
    }

    // Create order with JSONB
    const finalStatus = status || 'processing';
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          source: source || 'store',
          customer_id,
          cashier_id: cashier_id || null,
          status: finalStatus,
          total_amount,
          order_note: order_note || null,
          breakdown: breakdown,
          handling: handling,
          gcash_receipt_url: gcash_receipt_url || null,
          cancellation: null,
          completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (orderError) {
      console.error('Database error:', orderError);
      return NextResponse.json(
        { success: false, error: orderError.message },
        { status: 500 }
      );
    }

    if (!orderData || orderData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      );
    }

    const order = orderData[0];
    
    // ========== INCREMENT LOYALTY POINTS ==========
    // Award 1 loyalty point per order created (unless loyalty discount is being used)
    // If customer is redeeming points, don't award new points for this order
    if (!loyaltyPointsUsed || loyaltyPointsUsed === 0) {
      const { data: customerLoyalty } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', customer_id)
        .single();

      if (customerLoyalty) {
        const newPoints = (customerLoyalty.loyalty_points || 0) + 1;
        const { error: loyaltyError } = await supabase
          .from('customers')
          .update({ loyalty_points: newPoints })
          .eq('id', customer_id);

        if (loyaltyError) {
          console.warn('Loyalty points update failed (non-critical):', loyaltyError.message);
        } else {
          console.log('✓ Loyalty point awarded to customer:', customer_id, '(new total:', newPoints, ')');
        }
      }
    } else {
      console.log(`ℹ Loyalty discount used (${loyaltyPointsUsed} points), skipping point award for this order`);
    }
    
    return NextResponse.json({
      success: true,
      orderId: order.id,
      order: {
        id: order.id,
        source: order.source || 'store',
        customer_id: order.customer_id,
        cashier_id: order.cashier_id,
        status: order.status,
        total_amount: order.total_amount,
        order_note: order.order_note,
        breakdown: order.breakdown,
        handling: order.handling,
        gcash_receipt_url: order.gcash_receipt_url,
        created_at: order.created_at,
      },
    });
  } catch (err: any) {
    console.error("Orders API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}