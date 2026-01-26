import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

/**
 * POST /api/pos/orders/:id/cancel
 * 
 * Phase 1.2: Cancel order and restore inventory
 * AUTHENTICATED ENDPOINT - requires valid session
 */

export async function POST(
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

    // Get cashier ID
    const { data: staffData } = await supabase
      .from('staff')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!staffData) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orderId = id;
    const body = await request.json();

    if (!body.reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Cancellation reason required' },
        { status: 400 }
      );
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, order_data')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Validate state
    if (order.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Order already cancelled' },
        { status: 400 }
      );
    }

    if (order.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel completed orders' },
        { status: 400 }
      );
    }

    // Restore inventory
    const orderData = order.order_data;
    if (orderData?.products && Array.isArray(orderData.products)) {
      for (const product of orderData.products) {
        // Get current quantity
        const { data: prod } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', product.product_id)
          .single();

        if (!prod) continue;

        const newQuantity = (prod.quantity || 0) + product.quantity;

        await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', product.product_id);
      }
    }

    // Update order
    const { data: cancelledOrder, error: cancelError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation: {
          reason: body.reason,
          cancelled_by: staffData.id,
          cancelled_at: new Date().toISOString(),
        },
      })
      .eq('id', orderId)
      .select()
      .single();

    if (cancelError) {
      console.error('Cancel order error:', cancelError);
      return NextResponse.json(
        { success: false, error: 'Failed to cancel order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: cancelledOrder.id,
        status: cancelledOrder.status,
        cancellation: cancelledOrder.cancellation,
      },
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
