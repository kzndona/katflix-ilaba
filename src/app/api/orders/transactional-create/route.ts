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
        
        // Build receipt text from order data
        const orderId = orderData.orderId;
        const orderNumber = orderId.substring(0, 8).toUpperCase();
        const timestamp = new Date().toLocaleString("en-PH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        
        const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Valued Customer';
        const customerPhone = customer.phone_number ? `Phone: ${customer.phone_number}` : '';
        
        // Get cashier name if available
        let cashierName = '';
        if (orderPayload.cashier_id) {
          const { data: cashierData } = await supabase
            .from('staff')
            .select('first_name, last_name')
            .eq('id', orderPayload.cashier_id)
            .single();
          
          if (cashierData) {
            cashierName = `${cashierData.first_name || ''} ${cashierData.last_name || ''}`.trim();
          }
        }
        
        // Build items list from breakdown
        const items = orderPayload.breakdown?.items || [];
        const baskets = orderPayload.breakdown?.baskets || [];
        
        // Format products
        const itemsText = items.map((item: any) => {
          return `${item.product_name} x${item.quantity}\n  Price:                        ₱${item.subtotal.toFixed(2)}`;
        }).join('\n\n');
        
        // Format baskets with services
        const basketsText = baskets.map((basket: any) => {
          const serviceNames = basket.services?.map((s: any) => s.service_name).join(' + ') || 'Services';
          const details = `Basket ${basket.basket_number} • ${basket.weight}kg`;
          return `${serviceNames} x1\n  ${details}\n  Price:                         ₱${basket.total.toFixed(2)}`;
        }).join('\n\n');
        
        // Combine items and baskets
        const allItemsText = [itemsText, basketsText].filter(t => t.trim()).join('\n\n');
        
        // Build totals from summary or calculate
        const summary = orderPayload.breakdown?.summary || {};
        const subtotal = summary.subtotal_products || 0 + (summary.subtotal_services || 0);
        const serviceFee = summary.service_fee || 0;
        const handlingFee = summary.handling_fee || 0;
        const tax = summary.vat_amount || 0;
        const total = orderPayload.total_amount;
        
        // Payment details
        const paymentMethod = orderPayload.breakdown?.payment?.method?.toUpperCase() || 'GCASH';
        const amountPaid = orderPayload.breakdown?.payment?.amount_paid || total;
        const change = orderPayload.breakdown?.payment?.change || 0;
        const gcashRef = orderPayload.breakdown?.payment?.reference_number || null;
        
        const receiptText = `
========================================
                KATFLIX
            Laundry Services
========================================

ORDER: ${orderNumber}
${timestamp}
Customer: ${customerName}
${customerPhone}
${cashierName ? `Cashier: ${cashierName}` : ''}
────────────────────────────────────────

${allItemsText || '  (No items)'}

────────────────────────────────────────
Subtotal:                    ₱${subtotal.toFixed(2)}${serviceFee > 0 ? `\nService Fee:                 ₱${serviceFee.toFixed(2)}` : ''}${handlingFee > 0 ? `\nHandling Fee:                ₱${handlingFee.toFixed(2)}` : ''}${tax > 0 ? `\nTax (VAT):                   ₱${tax.toFixed(2)}` : ''}
========================================
TOTAL:                       ₱${total.toFixed(2)}
========================================

Payment:                            ${paymentMethod}${gcashRef ? `\nGCash Ref:                   ${gcashRef}` : ''}
Amount Paid:                    ₱${amountPaid.toFixed(2)}${change > 0 ? `\nChange:                      ₱${change.toFixed(2)}` : ''}

${orderPayload.handling?.pickup?.scheduled ? `PICKUP SERVICE${orderPayload.handling?.pickup?.address ? `\nLocation: ${orderPayload.handling.pickup.address}` : ''}` : ''}${orderPayload.handling?.delivery?.scheduled ? `${orderPayload.handling?.pickup?.scheduled ? '\n\n' : '\n'}DELIVERY SERVICE${orderPayload.handling?.delivery?.address ? `\nAddress: ${orderPayload.handling.delivery.address}` : ''}` : ''}

========================================
          Thank you for your order!
              Come again!
========================================
        `.trim();

        const greeting = `Hi ${customerName.split(" ")[0]}!`;

        const emailResult = await resend.emails.send({
          from: "onboarding@resend.dev",
          to: customer.email_address,
          subject: `Receipt for Order ${orderNumber}`,
          text: `${greeting}\n\nThank you for your order! Here's your receipt:\n\n${receiptText}\n\nWe appreciate your business!\n\nBest regards,\nKATFLIX Team`,
          html: `
            <html>
              <body style="font-family: 'Courier New', monospace; line-height: 1.6; color: #333; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 20px auto; padding: 30px; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="margin-top: 0; color: #2c3e50;">${greeting}</h2>
                  <p style="font-size: 16px; color: #555;">Thank you for your order! Here's your receipt:</p>
                  
                  <div style="border: 2px solid #34495e; padding: 20px; margin: 20px 0; background-color: #ecf0f1; font-family: 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.8;">
${receiptText}
                  </div>

                  <p style="font-size: 15px; color: #27ae60; margin-top: 20px;"><strong>✓ Order Confirmed</strong></p>
                  <p style="font-size: 14px; color: #555; margin-bottom: 20px;">Your laundry order has been received and is being processed. We'll notify you when your items are ready!</p>

                  <hr style="margin: 20px 0; border: none; border-top: 2px solid #bdc3c7;" />
                  <p style="text-align: center; color: #7f8c8d; font-size: 12px; margin-bottom: 0;">
                    Best regards,<br />
                    <strong style="color: #2c3e50;">KATFLIX Team</strong><br />
                    <span style="color: #95a5a6;">Laundry Services</span>
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
