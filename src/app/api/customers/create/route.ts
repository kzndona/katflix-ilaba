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

    const customer = data[0];
    let invitationSent = false;

    // Send invitation email if email was provided
    if (email) {
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
          email,
          {
            data: {
              first_name,
              last_name,
            },
          }
        );

        if (authError) {
          console.error('Auth invite error:', authError);
          // Continue with customer creation - invitation is non-critical
        } else if (authData?.user?.id) {
          // Update customer with auth_id
          const { error: updateErr } = await supabase
            .from('customers')
            .update({ auth_id: authData.user.id })
            .eq('id', customer.id);

          if (!updateErr) {
            invitationSent = true;
            console.log('✓ Invitation sent to', email);
          }
        }
      } catch (inviteErr) {
        console.error('Failed to send invitation:', inviteErr);
        // Don't fail the customer creation if invitation fails
      }
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone_number: customer.phone_number,
        email_address: customer.email_address,
        created_at: customer.created_at,
      },
      invitationSent,
      message: invitationSent 
        ? 'Customer created and invitation email sent'
        : 'Customer created successfully',
    });
  } catch (err) {
    console.error('POST /api/customers/create error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
