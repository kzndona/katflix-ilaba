import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/app/utils/supabase/server';

/**
 * GET /api/services
 * 
 * Phase 1.2: Retrieve all active services with pricing, tiers, and admin-configurable modifiers
 * Public endpoint - no authentication required
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Services fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch services' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      services: services || [],
    });
  } catch (error) {
    console.error('Services endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
