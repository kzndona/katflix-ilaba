import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      source,
      customer_id,
      cashier_id,
      status,
      total_amount,
      order_note,
      breakdown,
      handling,
    } = await req.json();

    // Validate required fields
    if (!customer_id || !cashier_id || !breakdown || !handling) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customer_id, cashier_id, breakdown, handling' },
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

    // Verify cashier (staff) exists
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

    // Create order with complete JSONB
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          source: source || 'store',
          customer_id,
          cashier_id,
          status: status || 'processing',
          total_amount,
          order_note: order_note || null,
          breakdown: breakdown,
          handling: handling,
          cancellation: null,
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

    // Create product_transactions for inventory tracking
    if (breakdown.items && breakdown.items.length > 0) {
      const transactions = breakdown.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: -item.quantity, // Negative for deduction
        transaction_type: 'order_placed',
        notes: `Order ${order.id}: ${item.quantity}x ${item.product_name}`,
        created_at: new Date().toISOString(),
      }));

      const { error: txError } = await supabase
        .from('product_transactions')
        .insert(transactions);

      if (txError) {
        console.error('Failed to create product transactions:', txError);
        // Don't fail the order, just warn
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        source: order.source,
        customer_id: order.customer_id,
        cashier_id: order.cashier_id,
        status: order.status,
        total_amount: order.total_amount,
        order_note: order.order_note,
        breakdown: order.breakdown,
        handling: order.handling,
        created_at: order.created_at,
      },
    });
  } catch (err) {
    console.error('POST /api/orders error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
