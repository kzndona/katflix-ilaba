import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

/**
 * GET /api/pos/customers/search
 * 
 * Phase 1.2: Search for customers by name or phone number
 * Case-insensitive search (ilike)
 * Public endpoint - no authentication required
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

    if (!query || query.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query must be at least 2 characters',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone_number, email_address, address, loyalty_points, created_at')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      console.error('Customer search error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search customers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customers: customers || [],
    });
  } catch (error) {
    console.error('Customer search error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
