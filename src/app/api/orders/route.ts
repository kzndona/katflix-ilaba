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
        cashier_id,
        status,
        total_amount,
        breakdown,
        handling,
        created_at,
        updated_at,
        cancelled_at,
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
      const breakdown = order.breakdown || {};
      const handling = order.handling || {};
      
      return {
        id: order.id,
        source: order.source || 'pos', // 'pos' or 'mobile'
        customer_id: order.customer_id,
        status: order.status,
        total_amount: order.total_amount,
        order_note: breakdown.order_note || null,
        created_at: order.created_at,
        completed_at: order.updated_at, // Use updated_at as completed timestamp
        handling: {
          pickup: {
            address: handling.handling_type === 'pickup' ? (handling.pickup_address || '') : '',
            status: order.status === 'completed' ? 'completed' : 'pending',
            notes: handling.pickup_notes || null,
          },
          delivery: {
            address: handling.handling_type === 'delivery' ? (handling.delivery_address || '') : '',
            status: order.status === 'completed' ? 'completed' : 'pending',
            notes: handling.delivery_notes || null,
          },
        },
        breakdown: {
          items: breakdown.items || [],
          baskets: breakdown.baskets || [],
          summary: breakdown.summary || {
            subtotal_products: breakdown.subtotal_products || null,
            subtotal_services: breakdown.subtotal_services || null,
            handling: breakdown.handling_fee || null,
            service_fee: breakdown.service_fee || null,
            grand_total: order.total_amount,
          },
          payment: breakdown.payment || {
            method: handling.payment_method || 'cash',
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
