import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { validateStockAvailability, deductInventory } from './inventoryHelpers';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      source,
      customer_id,
      cashier_id,
      status,
      total_amount,
      order_note,
      breakdown,
      handling,
    } = await req.json();

    // Validate required fields
    if (!customer_id || !cashier_id || !breakdown || !handling) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customer_id, cashier_id, breakdown, handling' },
        { status: 400 }
      );
    }

    // Validate stock availability before proceeding
    if (breakdown.items && breakdown.items.length > 0) {
      const stockCheck = await validateStockAvailability(
        supabase,
        breakdown.items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
        }))
      );

      if (!stockCheck.available) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient stock for one or more items',
            insufficientItems: stockCheck.insufficientItems,
          },
          { status: 400 }
        );
      }
    }

    // Verify customer exists
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .single();

    if (customerError || !customerData) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify cashier (staff) exists
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('id', cashier_id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json(
        { success: false, error: 'Staff/cashier not found' },
        { status: 404 }
      );
    }

    // Create order with complete JSONB
    const finalStatus = status || 'processing';
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          source: source || 'store',
          customer_id,
          cashier_id,
          status: finalStatus,
          total_amount,
          order_note: order_note || null,
          breakdown: breakdown,
          handling: handling,
          cancellation: null,
          completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (orderError) {
      console.error('Database error:', orderError);
      return NextResponse.json(
        { success: false, error: orderError.message },
        { status: 500 }
      );
    }

    if (!orderData || orderData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      );
    }

    const order = orderData[0];

    // Deduct inventory for products
    if (breakdown.items && breakdown.items.length > 0) {
      const deductionResult = await deductInventory(
        supabase,
        order.id,
        breakdown.items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
        }))
      );

      if (!deductionResult.success) {
        console.warn('Some inventory deductions failed:', deductionResult.failedProducts);
        // Don't fail the order, but log the warning
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        source: order.source,
        customer_id: order.customer_id,
        cashier_id: order.cashier_id,
        status: order.status,
        total_amount: order.total_amount,
        order_note: order.order_note,
        breakdown: order.breakdown,
        handling: order.handling,
        created_at: order.created_at,
      },
    });
  } catch (err) {
    console.error('POST /api/orders error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
