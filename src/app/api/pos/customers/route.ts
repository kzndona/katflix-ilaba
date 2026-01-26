import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

/**
 * POST /api/pos/customers
 * 
 * Phase 1.2: Create new customer or update existing customer
 * Public endpoint - no authentication required
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.first_name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'First name is required' },
        { status: 400 }
      );
    }
    if (!body.last_name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Last name is required' },
        { status: 400 }
      );
    }
    if (!body.phone_number?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (body.id) {
      // UPDATE existing customer
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', body.id)
        .single();

      if (!existingCustomer) {
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('customers')
        .update({
          first_name: body.first_name.trim(),
          last_name: body.last_name.trim(),
          phone_number: body.phone_number,
          email_address: body.email_address || null,
          address: body.address || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.id)
        .select()
        .single();

      if (updateError) {
        console.error('Customer update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update customer' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        customer: updated,
      });
    } else {
      // CREATE new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([
          {
            first_name: body.first_name.trim(),
            last_name: body.last_name.trim(),
            phone_number: body.phone_number,
            email_address: body.email_address || null,
            address: body.address || null,
            loyalty_points: 0,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Customer creation error:', createError);
        if (createError.code === '23505') {
          // Unique constraint violation
          return NextResponse.json(
            { success: false, error: 'Phone number already exists' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { success: false, error: 'Failed to create customer' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        customer: newCustomer,
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Customer endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
