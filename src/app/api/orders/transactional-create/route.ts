/**
 * POST /api/orders/transactional-create
 * 
 * POS ORDER CREATION ENDPOINT
 * 
 * This endpoint:
 * 1. Updates customer phone/email (if provided)
 * 2. Creates order with JSONB breakdown and handling
 * 
 * ============================================================================
 * REQUEST FORMAT (POS ONLY)
 * ============================================================================
 * {
 *   "customer": {
 *     "id": "customer-uuid",
 *     "phone_number": "+639123456789",
 *     "email_address": "customer@example.com"
 *   },
 *   "orderPayload": {
 *     "source": "store",
 *     "customer_id": "customer-uuid",
 *     "cashier_id": "staff-uuid" (or null for mobile),
 *     "status": "processing",
 *     "total_amount": 500,
 *     "breakdown": { ...JSONB breakdown object... },
 *     "handling": { ...JSONB handling object... },
 *     "order_note": "Special instructions",
 *     "gcash_receipt_url": "https://bucket-url/path/to/receipt.jpg" (optional)
 *   }
 * }
 * 
 * ============================================================================
 * RESPONSE (Success)
 * ============================================================================
 * { "success": true, "orderId": "order-uuid", "order": {...} }
 * 
 * ============================================================================
 * ERROR RESPONSES
 * ============================================================================
 * 400: Missing customer_id or orderPayload
 * 404: Customer or staff not found
 * 500: Database or processing error
 */

import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { validateStockAvailability, deductInventory } from "@/src/app/api/orders/inventoryHelpers";
import { Resend } from "resend";
import { formatReceiptAsPlaintext } from "@/src/app/in/pos/logic/receiptGenerator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let customer, orderPayload;

    // ========== VALIDATE POS FORMAT ==========
    // Expected: { customer: {...}, orderPayload: {...} }
    
    const isPOSFormat = body.customer && body.orderPayload && (body.orderPayload.breakdown || body.orderPayload.handling);

    if (!isPOSFormat) {
      console.error("❌ Invalid format - expected POS format with customer and orderPayload containing breakdown/handling");
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid payload format. Expected POS format: { customer: {...}, orderPayload: {...breakdown, handling...} }",
          receivedKeys: Object.keys(body),
          payloadKeys: body.orderPayload ? Object.keys(body.orderPayload) : null
        },
        { status: 400 }
      );
    }

    // ========== EXTRACT POS FORMAT ==========
    customer = body.customer;
    orderPayload = body.orderPayload;
    
    // Extract loyalty info (if present)
    const loyaltyPointsUsed = orderPayload.loyaltyPointsUsed || 0;
    const loyaltyDiscountAmount = orderPayload.loyaltyDiscountAmount || 0;
    const loyaltyDiscountPercentage = orderPayload.loyaltyDiscountPercentage || 0;
    
    console.log("📥 POS Format order received");
    // Preserve source from orderPayload (app or store), default to 'store' for backwards compatibility
    if (!orderPayload.source) {
      orderPayload.source = 'store';
    }

    // ========== VALIDATE CUSTOMER ==========
    if (!customer?.id) {
      console.error("❌ Customer ID missing");
      return NextResponse.json(
        { 
          success: false, 
          error: "Customer ID is required",
          debug: {
            customerReceived: !!customer,
            customerKeys: customer ? Object.keys(customer) : null,
          }
        },
        { status: 400 }
      );
    }

    if (!orderPayload) {
      console.error("❌ Order payload missing");
      return NextResponse.json(
        { 
          success: false, 
          error: "Order payload is required"
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ========== VALIDATE & DEDUCT INVENTORY ==========
    // Extract product items from breakdown for inventory management
    const productItems = orderPayload.breakdown?.items || [];
    
    if (productItems.length > 0) {
      console.log("🔍 Validating product inventory...");
      
      // Validate stock availability
      const stockCheck = await validateStockAvailability(supabase, productItems);
      
      if (!stockCheck.available) {
        console.error("❌ Insufficient stock for products:", stockCheck.insufficientItems);
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient stock for one or more products",
            insufficientItems: stockCheck.insufficientItems,
          },
          { status: 400 }
        );
      }
      
      console.log("✓ Stock validated successfully");
    }

    // ========== UPDATE CUSTOMER DETAILS ==========
    const updateData: any = {};
    if (customer.phone_number) updateData.phone_number = customer.phone_number;
    if (customer.email_address) updateData.email_address = customer.email_address;

    if (Object.keys(updateData).length > 0) {
      const { error: customerUpdateError } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", customer.id);

      if (customerUpdateError) {
        console.error("❌ Customer update failed:", customerUpdateError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update customer details",
            errorMessage: customerUpdateError.message,
          },
          { status: 500 }
        );
      }
      console.log("✓ Customer details updated");
    }

    // ========== CREATE ORDER ==========
    // Call /api/orders which handles POS format
    console.log("📦 Calling /api/orders endpoint...");
    
    // Get the origin from request headers - construct properly
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const origin = `${protocol}://${host}`;
    
    console.log(`Using origin for internal fetch: ${origin}`);
    
    const orderRes = await fetch(`${origin}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    console.log("📥 /api/orders response:", { 
      status: orderRes.status, 
      ok: orderRes.ok,
      responseKeys: Object.keys(orderData),
      hasSuccess: orderData?.success,
      hasOrderId: orderData?.orderId,
      orderId: orderData?.orderId
    });

    if (!orderRes.ok) {
      console.error("❌ Order creation failed:", { status: orderRes.status, error: orderData.error });
      return NextResponse.json(
        {
          success: false,
          error: orderData.error || "Failed to create order",
          debugInfo: {
            endpoint: "/api/orders",
            statusCode: orderRes.status,
            responseKeys: orderData ? Object.keys(orderData) : null,
          }
        },
        { status: orderRes.status }
      );
    }

    if (!orderData.success || !orderData.orderId) {
      console.error("❌ Unexpected order response format:", { 
        success: orderData?.success, 
        orderId: orderData?.orderId,
        allKeys: Object.keys(orderData)
      });
      return NextResponse.json(
        {
          success: false,
          error: "Order creation returned unexpected format",
        },
        { status: 500 }
      );
    }

    console.log("✓ Order created successfully:", orderData.orderId);
    
    // ========== DEDUCT INVENTORY ==========
    // Now that order exists, deduct inventory for all products
    if (productItems.length > 0) {
      console.log("📦 Deducting inventory for products...");
      
      const deductionResult = await deductInventory(supabase, orderData.orderId, productItems);
      
      if (!deductionResult.success) {
        console.error("⚠️ Inventory deduction failed for some products:", deductionResult.failedProducts);
        // Log the error but don't fail the order creation - inventory helpers handles partial failures
        // The order exists but inventory deduction had issues
      } else {
        console.log("✓ Inventory deducted successfully:", deductionResult.deductedProducts.map(p => `${p.productName}(${p.quantity})`).join(", "));
      }
    }

    // ========== SEND RECEIPT EMAIL ==========
    if (customer.email_address && orderData.order) {
      try {
        console.log("📧 Sending receipt email...");
        
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        // Generate plaintext receipt from order data
        const receiptText = `
Order Number: ${orderData.orderId.substring(0, 8).toUpperCase()}
Date: ${new Date().toLocaleString()}
Customer: ${customer.first_name || ''} ${customer.last_name || ''}

Items:
${orderPayload.breakdown?.items?.map((item: any) => 
  `  • ${item.name} x${item.quantity} - ₱${item.total?.toFixed(2) || '0.00'}`
).join('\n') || 'No items'}

Total: ₱${orderPayload.total_amount?.toFixed(2) || '0.00'}
        `.trim();

        const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        const greeting = customerName ? `Hi ${customerName.split(" ")[0]}!` : "Hi there!";

        const emailResult = await resend.emails.send({
          from: "onboarding@resend.dev",
          to: customer.email_address,
          subject: `Receipt for Order ${orderData.orderId.substring(0, 8).toUpperCase()}`,
          text: `${greeting}\n\nThank you for your order! Here's your receipt:\n\n${receiptText}\n\nYour order is being processed. We'll notify you when it's ready!\n\nBest regards,\nKATFLIX Team`,
          html: `
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2>${greeting}</h2>
                  <p>Thank you for your order! Here's your receipt:</p>
                  
                  <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0; background-color: #f9f9f9; font-family: monospace; white-space: pre-wrap;">
${receiptText}
                  </div>

                  <p>Your order is being processed. We'll notify you when it's ready!</p>

                  <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
                  <p style="text-align: center; color: #666; font-size: 12px;">
                    Best regards,<br />
                    <strong>KATFLIX Team</strong>
                  </p>
                </div>
              </body>
            </html>
          `,
        });

        if (emailResult.error) {
          console.warn(`⚠️ Failed to send receipt email to ${customer.email_address}:`, emailResult.error.message);
        } else {
          console.log(`✅ Receipt email sent to ${customer.email_address}`);
        }
      } catch (emailErr) {
        console.warn("⚠️ Email sending error (non-critical):", emailErr instanceof Error ? emailErr.message : String(emailErr));
      }
    }
    
    // ========== HANDLE LOYALTY DISCOUNT ==========
    // Deduct loyalty points if any were used (no hard cap on max points)
    if (loyaltyPointsUsed > 0) {
      const { data: customerLoyalty } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', customer.id)
        .single();

      if (customerLoyalty) {
        const newPoints = Math.max(0, (customerLoyalty.loyalty_points || 0) - loyaltyPointsUsed);
        const { error: loyaltyError } = await supabase
          .from('customers')
          .update({ loyalty_points: newPoints })
          .eq('id', customer.id);

        if (loyaltyError) {
          console.warn('Loyalty points deduction failed (non-critical):', loyaltyError.message);
        } else {
          console.log(`✓ Loyalty points deducted (${loyaltyPointsUsed} points used). New total: ${newPoints}`);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      orderId: orderData.orderId,
      order: orderData.order,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Transactional order creation error:", errorMsg);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during order creation",
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
