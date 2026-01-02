import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { updateServiceStatusInBreakdown } from '@/src/app/in/pos/logic/orderHelpers';

interface Params {
  id: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const orderId = id;

    const {
      basket_index,
      service_index,
      status,
      completed_by,
      duration_minutes,
    } = await req.json();

    // Validate required fields
    if (
      basket_index === undefined ||
      service_index === undefined ||
      !status ||
      !completed_by
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: basket_index, service_index, status, completed_by',
        },
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

    // Update breakdown with new service status and audit log
    const updatedBreakdown = updateServiceStatusInBreakdown(
      orderData.breakdown,
      basket_index,
      service_index,
      status,
      completed_by,
      duration_minutes
    );

    if (!updatedBreakdown) {
      return NextResponse.json(
        { success: false, error: 'Failed to update service status' },
        { status: 400 }
      );
    }

    // Update order
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({
        breakdown: updatedBreakdown,
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
    console.error('PATCH /api/orders/:id/service-status error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
