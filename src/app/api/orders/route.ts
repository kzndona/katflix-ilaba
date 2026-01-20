import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Match POS API interface
interface ServicePayload {
  service_id: string;
  rate: number;
  subtotal: number;
}

interface BasketPayload {
  machine_id?: string | null;
  weight?: number;
  notes?: string | null;
  subtotal: number;
  services?: ServicePayload[];
}

interface ProductPayload {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PaymentPayload {
  amount: number;
  method: string;
  reference?: string;
}

interface OrderPayload {
  customerId: string | null;
  customer_id?: string | null; // Also accept snake_case
  total: number;
  total_amount?: number; // Also accept alternative naming
  baskets: BasketPayload[];
  products: ProductPayload[];
  payments?: PaymentPayload[];
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  shippingFee?: number;
  source?: "pos" | "mobile";
  cashier_id?: string;
  order_note?: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const body: OrderPayload = await req.json();

  // Support both camelCase and snake_case
  const customerId = body.customerId || body.customer_id;
  const total = body.total || body.total_amount || 0;
  const { baskets, products, payments, pickupAddress, deliveryAddress, shippingFee, source, cashier_id, order_note } = body;

  try {
    // 1️⃣ Insert order with auto-completion logic (matching POS API)
    // If no baskets exist (pure product purchase), mark as completed
    // If pickupAddress exists, start with 'pick-up' status
    // Otherwise, mark as 'processing' (in-store laundry)
    let orderStatus = "processing";
    if (baskets.length === 0) {
      orderStatus = "completed";
    } else if (pickupAddress) {
      orderStatus = "pick-up";
    }
    const completedAt = baskets.length === 0 ? new Date().toISOString() : null;
    
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        cashier_id: cashier_id || null,
        total_amount: total,
        status: orderStatus,
        completed_at: completedAt,
        source: source || "mobile",
        pickup_address: pickupAddress || null,
        delivery_address: deliveryAddress || null,
        shipping_fee: shippingFee || 0,
        order_note: order_note || null,
      })
      .select()
      .single();

    if (orderErr || !order) throw orderErr || new Error("Order insertion failed");
    const orderId = order.id;

    // 2️⃣ Insert baskets and basket services (matching POS API)
    for (let i = 0; i < baskets.length; i++) {
      const b = baskets[i];
      const { data: basket, error: basketErr } = await supabase
        .from("baskets")
        .insert({
          order_id: orderId,
          basket_number: i + 1,
          weight: b.weight || null,
          price: b.subtotal,
          notes: b.notes || null,
          status: "processing",
        })
        .select()
        .single();

      if (basketErr || !basket) throw basketErr || new Error("Basket insertion failed");
      const basketId = basket.id;

      // Only insert services if present
      if (b.services?.length) {
        // If pickup exists, keep all services as 'pending' (pickup must complete first)
        // Otherwise, set first service as 'in_progress' (in-store laundry)
        const serviceInserts = b.services.map((s, index) => ({
          basket_id: basketId,
          service_id: s.service_id,
          rate: s.rate,
          subtotal: s.subtotal,
          status: (index === 0 && !pickupAddress) ? "in_progress" : "pending",
        }));

        const { error: svcErr } = await supabase.from("basket_services").insert(serviceInserts);
        if (svcErr) throw svcErr;
      }
    }

    // 3️⃣ Insert order products and deduct inventory (matching POS API)
    if (products.length) {
      console.log("=== PROCESSING PRODUCTS ===");
      console.log("Products to insert:", JSON.stringify(products, null, 2));
      
      const productInserts = products.map((p) => ({
        order_id: orderId,
        product_id: p.product_id,
        quantity: p.quantity,
        unit_price: p.unit_price,
        subtotal: p.subtotal,
      }));

      console.log("Product inserts:", JSON.stringify(productInserts, null, 2));

      const { error: prodErr } = await supabase.from("order_products").insert(productInserts);
      if (prodErr) {
        console.error("Failed to insert order_products:", prodErr);
        throw prodErr;
      }
      console.log("✓ Order products inserted successfully");

      // Deduct quantities from inventory
      for (const p of products) {
        console.log(`Processing product deduction: ${p.product_id}, quantity: ${p.quantity}`);
        
        // Get current product quantity
        const { data: product, error: fetchErr } = await supabase
          .from("products")
          .select("quantity, item_name")
          .eq("id", p.product_id)
          .single();

        if (fetchErr) {
          console.error(`Failed to fetch product ${p.product_id}:`, fetchErr);
          throw new Error(`Failed to fetch product inventory`);
        }

        if (!product) {
          throw new Error(`Product ${p.product_id} not found`);
        }

        const currentQty = Number(product.quantity);
        const orderQty = Number(p.quantity);
        
        console.log(`Product ${product.item_name}: Current ${currentQty}, Ordering ${orderQty}`);
        
        // Check if sufficient quantity available
        if (currentQty < orderQty) {
          throw new Error(`Insufficient stock for ${product.item_name}. Available: ${currentQty}, Requested: ${orderQty}`);
        }

        const newQty = currentQty - orderQty;

        // Update product quantity
        const { error: updateErr } = await supabase
          .from("products")
          .update({ 
            quantity: newQty,
            last_updated: new Date().toISOString()
          })
          .eq("id", p.product_id);

        if (updateErr) {
          console.error(`Failed to update product ${p.product_id}:`, updateErr);
          throw new Error(`Failed to update product inventory for ${product.item_name}`);
        }
        
        console.log(`Successfully updated ${product.item_name} quantity to ${newQty}`);
      }
    }

    // 4️⃣ Insert payments (matching POS API)
    if (payments?.length) {
      const paymentInserts = payments.map((pay) => ({
        order_id: orderId,
        amount: pay.amount,
        method: pay.method,
        reference_number: pay.reference || null,
        status: "completed",
      }));

      const { error: payErr } = await supabase.from("payments").insert(paymentInserts);
      if (payErr) throw payErr;
    }

    return NextResponse.json({ success: true, orderId, order });
  } catch (err: any) {
    console.error("Orders API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}
