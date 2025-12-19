import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { updateHandlingStatusInOrder } from '@/src/app/in/pos/logic/orderHelpers';

interface Params {
  id: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const orderId = params.id;

    const {
      stage, // 'pickup' or 'delivery'
      status,
      completed_by,
      duration_minutes,
    } = await req.json();

    // Validate required fields
    if (!stage || !status || !completed_by) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: stage, status, completed_by',
        },
        { status: 400 }
      );
    }

    // Validate stage
    if (stage !== 'pickup' && stage !== 'delivery') {
      return NextResponse.json(
        { success: false, error: 'Stage must be "pickup" or "delivery"' },
        { status: 400 }
      );
    }

    // Fetch current order
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !orderData) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify staff exists
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('id', completed_by)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Update handling with new stage status
    const updatedHandling = updateHandlingStatusInOrder(
      orderData.handling,
      stage,
      status,
      completed_by,
      duration_minutes
    );

    if (!updatedHandling) {
      return NextResponse.json(
        { success: false, error: 'Failed to update handling status' },
        { status: 400 }
      );
    }

    // Determine new order status based on handling stage
    let newOrderStatus = orderData.status;
    if (stage === 'pickup' && status === 'completed') {
      newOrderStatus = 'processing';
    } else if (stage === 'delivery' && status === 'completed') {
      newOrderStatus = 'completed';
    }

    // Update order
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({
        handling: updatedHandling,
        status: newOrderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: updated[0],
    });
  } catch (err) {
    console.error('PATCH /api/orders/:id/handling-status error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
