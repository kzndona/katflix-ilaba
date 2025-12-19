import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

interface Params {
  id: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const orderId = params.id;

    // Fetch order with customer details
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        customers!orders_customer_id_fkey (
          id,
          first_name,
          last_name,
          phone_number,
          email_address
        ),
        staff!orders_cashier_id_fkey (
          id,
          first_name,
          last_name
        )
      `
      )
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: data,
    });
  } catch (err) {
    console.error('GET /api/orders/:id error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
