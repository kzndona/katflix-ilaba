import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

/**
 * GET /api/pos/products
 * 
 * Phase 1.2: Retrieve all active products with inventory levels and pricing
 * Supports pagination
 * Public endpoint - no authentication required
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await createClient();

    // Get total count
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Get paginated products
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Products fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      products: products || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Products endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
