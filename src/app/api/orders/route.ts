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
        gcash_receipt_url,
        created_at,
        updated_at,
        cancelled_at,
        customers:customer_id(
          id,
          first_name,
          last_name,
          phone_number,
          email_address
        ),
        staff:cashier_id(
          id,
          first_name,
          last_name
        ),
        service_logs:basket_service_status(
          id,
          basket_number,
          service_type,
          status,
          started_at,
          completed_at,
          notes,
          started_by_staff:started_by(
            id,
            first_name,
            last_name
          ),
          completed_by_staff:completed_by(
            id,
            first_name,
            last_name
          )
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
      const summary = breakdown.summary || {};
      
      return {
        id: order.id,
        source: order.source || 'pos', // 'pos' or 'mobile'
        customer_id: order.customer_id,
        cashier_id: order.cashier_id,
        status: order.status,
        total_amount: order.total_amount,
        order_note: breakdown.order_note || null,
        created_at: order.created_at,
        completed_at: order.updated_at,
        gcash_receipt_url: order.gcash_receipt_url,
        handling: {
          pickup: {
            address: handling.pickup?.address || handling.pickup_address || '',
            status: handling.pickup?.status || (order.status === 'completed' ? 'completed' : 'pending'),
            notes: handling.pickup?.notes || handling.pickup_notes || null,
          },
          delivery: {
            address: handling.delivery?.address || handling.delivery_address || '',
            status: handling.delivery?.status || (order.status === 'completed' ? 'completed' : 'pending'),
            notes: handling.delivery?.notes || handling.delivery_notes || null,
          },
          payment_method: handling.payment_method || 'cash',
          scheduled: handling.scheduled || false,
          scheduled_date: handling.scheduled_date,
          scheduled_time: handling.scheduled_time,
        },
        breakdown: {
          items: breakdown.items || [],
          baskets: (breakdown.baskets || []).map((basket: any, basketIdx: number, basketsArr: any[]) => {
            // Services are stored as an object with pricing snapshots, not an array
            const services = basket.services || {};
            
            // Calculate basket total from services if not provided
            // Look for pricing snapshots (wash_pricing, dry_pricing, etc.)
            const pricingTotal = Object.entries(services)
              .filter(([key]) => key.endsWith('_pricing'))
              .reduce((sum: number, [_, pricing]: [string, any]) => sum + (pricing.base_price || 0), 0);
            
            let basketTotal = basket.total || pricingTotal;
            
            // If no total and no services pricing, try to use proportional share of summary services
            if (basketTotal === 0 && summary.subtotal_services) {
              const basketCount = basketsArr.length || 1;
              basketTotal = (summary.subtotal_services as number) / basketCount;
            }
            
            return {
              basket_number: basket.basket_number || 0,
              weight: basket.weight || 0,
              basket_notes: basket.basket_notes || null,
              services: services,
              total: basketTotal,
            };
          }),
          summary: {
            subtotal_products: summary.subtotal_products ?? null,
            subtotal_services: summary.subtotal_services ?? null,
            staff_service_fee: summary.staff_service_fee ?? null,
            delivery_fee: summary.delivery_fee ?? null,
            vat_amount: summary.vat_amount ?? null,
            loyalty_discount: summary.loyalty_discount ?? null,
            total: summary.total ?? order.total_amount,
          },
          payment: breakdown.payment || {
            method: handling.payment_method || 'cash',
            amount_paid: order.total_amount,
            change: 0,
            payment_status: 'successful',
          },
        },
        customers: order.customers,
        staff: order.staff,
        service_logs: order.service_logs || [],
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
