import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { product_id, adjustment_amount, adjustment_type, notes } = await req.json();

    // Validate inputs
    if (!product_id || adjustment_amount === undefined || adjustment_amount === null) {
      return NextResponse.json(
        { error: 'Missing product_id or adjustment_amount' },
        { status: 400 }
      );
    }

    if (!['add', 'subtract'].includes(adjustment_type)) {
      return NextResponse.json(
        { error: 'adjustment_type must be "add" or "subtract"' },
        { status: 400 }
      );
    }

    const amount = Number(adjustment_amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Adjustment amount must be a positive number' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Get current product quantity
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, item_name, quantity')
      .eq('id', product_id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const currentQty = Number(product.quantity) || 0;
    const newQty = adjustment_type === 'add' 
      ? currentQty + amount 
      : currentQty - amount;

    // Validate result is not negative
    if (newQty < 0) {
      return NextResponse.json(
        {
          error: `Cannot reduce quantity below 0. Current: ${currentQty}, Attempting to subtract: ${amount}`,
          current_quantity: currentQty,
          attempted_reduction: amount,
        },
        { status: 400 }
      );
    }

    // Update product quantity
    const { error: updateError } = await supabase
      .from('products')
      .update({
        quantity: newQty,
      })
      .eq('id', product_id);

    if (updateError) {
      console.error('Failed to update product quantity:', updateError);
      return NextResponse.json(
        { error: 'Failed to update quantity' },
        { status: 500 }
      );
    }

    // Create transaction record for audit trail
    const { error: txError } = await supabase
      .from('product_transactions')
      .insert({
        product_id,
        quantity_change: adjustment_type === 'add' ? amount : -amount,
        transaction_type: 'adjustment',
        notes: notes || null,
      });

    if (txError) {
      console.warn('Failed to create transaction record:', txError);
      // Don't fail the adjustment if logging fails
    }

    return NextResponse.json({
      success: true,
      product_id,
      product_name: product.item_name,
      previous_quantity: currentQty,
      adjustment_amount: amount,
      adjustment_type,
      new_quantity: newQty,
    });
  } catch (error) {
    console.error('POST /api/manage/products/adjustQuantity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
