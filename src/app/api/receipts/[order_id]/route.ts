import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper: Return 404 response
 */
function notFound(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}

/**
 * Helper: Return 500 response
 */
function serverError(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

/**
 * GET /api/receipts/:order_id
 * 
 * Retrieve order receipt (plaintext and HTML)
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { order_id: string } }
) {
  try {
    const orderId = params.order_id;

    // TODO: Implement receipt generation logic
    // For now, return placeholder response
    
    return NextResponse.json(
      {
        success: true,
        receipt: {
          order_id: orderId,
          plaintext: 'Receipt generation not yet implemented',
          html: '<p>Receipt generation not yet implemented</p>',
          generated_at: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get receipt error:', error);
    return serverError('Internal server error');
  }
}
