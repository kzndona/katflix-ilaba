import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

/**
 * GET /api/pos/orders/:id
 * 
 * Phase 1.2: Retrieve order with all details
 * AUTHENTICATED ENDPOINT - requires valid session
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orderId = id;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        source,
        customer_id,
        cashier_id,
        status,
        total_amount,
        order_data,
        cancellation,
        created_at,
        updated_at,
        customers:customer_id(id, first_name, last_name, phone_number, email_address),
        staff:cashier_id(id, first_name, last_name)
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        source: order.source,
        customer_id: order.customer_id,
        customer: order.customers,
        cashier_id: order.cashier_id,
        cashier: order.staff,
        status: order.status,
        total_amount: order.total_amount,
        order_data: order.order_data,
        cancellation: order.cancellation,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
