import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      first_name,
      last_name,
      phone_number,
      email,
      birthdate,
      gender,
      address,
    } = await req.json();

    // Validate required fields
    if (!first_name || !last_name) {
      return NextResponse.json(
        { success: false, error: 'first_name and last_name are required' },
        { status: 400 }
      );
    }

    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: 'phone_number is required' },
        { status: 400 }
      );
    }

    // Check if customer with this phone already exists
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone_number', phone_number)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Customer with this phone number already exists', customer_id: existing.id },
        { status: 409 }
      );
    }

    // Insert new customer
    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          first_name,
          last_name,
          phone_number,
          email_address: email || null,
          birthdate: birthdate || null,
          gender: gender || null,
          address: address || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create customer' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: data[0].id,
        first_name: data[0].first_name,
        last_name: data[0].last_name,
        phone_number: data[0].phone_number,
        email_address: data[0].email_address,
        created_at: data[0].created_at,
      },
    });
  } catch (err) {
    console.error('POST /api/customers/create error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
