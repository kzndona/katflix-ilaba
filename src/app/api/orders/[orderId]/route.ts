import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Helper functions
function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        ),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: serverError('Authentication failed'),
    };
  }
}

/**
 * GET /api/orders/:orderId
 * 
 * Retrieve order with all details (authenticated)
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    
    // Authenticate user
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

/**
 * PUT /api/orders/:orderId
 * 
 * Update order handling (delivery/pickup address and special instructions)
 * Only staff can update - requires authentication
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // Authenticate user
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // Parse request body
    const body = await request.json();
    const { handling } = body;

    // Validate handling object has required fields
    if (!handling) {
      return NextResponse.json(
        { error: 'Missing handling data' },
        { status: 400 }
      );
    }

    // Get current order to merge handling data
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('handling')
      .eq('id', orderId)
      .single();

    if (fetchError || !currentOrder) {
      return notFound('Order not found');
    }

    // Merge handling data (keep existing fields, update provided ones)
    const updatedHandling = {
      ...currentOrder.handling,
      ...handling,
    };

    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        handling: updatedHandling,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Order update error:', updateError);
      return serverError('Failed to update order');
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Order updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update order error:', error);
    return serverError('Internal server error');
  }
}
