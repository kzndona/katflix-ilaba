import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * GET /api/orders/:id
 * 
 * Retrieve order with all details (authenticated)
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const orderId = params.id;
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
          },
        },
      }
    );

    // Fetch order with customer details
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
      return notFound('Order not found');
    }

    return NextResponse.json(
      {
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
          breakdown: order.order_data,
          cancellation: order.cancellation,
          created_at: order.created_at,
          updated_at: order.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get order error:', error);
    return serverError('Internal server error');
  }
}
