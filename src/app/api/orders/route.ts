/**
 * GET /api/orders
 * 
 * Retrieve all orders with full details (authenticated)
 * Returns orders with customer data, breakdown, and handling info
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // === FETCH ORDERS ===
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        source,
        customer_id,
        status,
        total_amount,
        order_data,
        created_at,
        updated_at,
        customers:customer_id(
          id,
          first_name,
          last_name,
          phone_number,
          email_address
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // === TRANSFORM DATA ===
    const transformedOrders = (orders || []).map((order: any) => {
      const orderData = order.order_data || {};
      
      return {
        id: order.id,
        source: order.source,
        customer_id: order.customer_id,
        status: order.status,
        total_amount: order.total_amount,
        order_note: orderData.order_note || null,
        created_at: order.created_at,
        completed_at: orderData.completed_at || null,
        handling: orderData.handling || {
          pickup: {
            address: '',
            status: 'pending',
            notes: null,
          },
          delivery: {
            address: '',
            status: 'pending',
            notes: null,
          },
        },
        breakdown: orderData.breakdown || {
          items: [],
          baskets: [],
          summary: {
            subtotal_products: null,
            subtotal_services: null,
            handling: null,
            service_fee: null,
            grand_total: order.total_amount,
          },
          payment: {
            method: 'cash',
            amount_paid: order.total_amount,
            change: 0,
            payment_status: 'successful',
          },
        },
        customers: order.customers,
      };
    });

    return NextResponse.json(transformedOrders, { status: 200 });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
