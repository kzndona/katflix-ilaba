/**
 * inventoryHelpers.ts
 * Helper functions for inventory management during order operations
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface StockCheckResult {
  available: boolean;
  insufficientItems: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

export interface InventoryDeductionResult {
  success: boolean;
  deductedProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
  failedProducts: Array<{
    productId: string;
    productName: string;
    error: string;
  }>;
}

/**
 * Validate stock availability for products
 * Returns detailed info about which products have insufficient stock
 */
export async function validateStockAvailability(
  supabase: SupabaseClient,
  orderItems: Array<{ product_id: string; product_name: string; quantity: number }>
): Promise<StockCheckResult> {
  const insufficientItems: StockCheckResult['insufficientItems'] = [];

  for (const item of orderItems) {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, item_name, quantity')
      .eq('id', item.product_id)
      .single();

    if (error || !product) {
      insufficientItems.push({
        productId: item.product_id,
        productName: item.product_name,
        requested: item.quantity,
        available: 0,
      });
      continue;
    }

    const availableQty = Number(product.quantity) || 0;
    const requestedQty = Number(item.quantity);

    if (availableQty < requestedQty) {
      insufficientItems.push({
        productId: item.product_id,
        productName: product.item_name,
        requested: requestedQty,
        available: availableQty,
      });
    }
  }

  return {
    available: insufficientItems.length === 0,
    insufficientItems,
  };
}

/**
 * Deduct inventory and create transaction records
 * Should only be called after stock validation passes
 */
export async function deductInventory(
  supabase: SupabaseClient,
  orderId: string,
  orderItems: Array<{ product_id: string; product_name: string; quantity: number }>
): Promise<InventoryDeductionResult> {
  const deductedProducts: InventoryDeductionResult['deductedProducts'] = [];
  const failedProducts: InventoryDeductionResult['failedProducts'] = [];

  for (const item of orderItems) {
    try {
      // Get current quantity
      const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .single();

      if (fetchErr || !product) {
        failedProducts.push({
          productId: item.product_id,
          productName: item.product_name,
          error: 'Product not found',
        });
        continue;
      }

      const currentQty = Number(product.quantity) || 0;
      const newQty = currentQty - Number(item.quantity);

      // Update product quantity
      const { error: updateErr } = await supabase
        .from('products')
        .update({ 
          quantity: newQty,
          last_updated: new Date().toISOString(),
        })
        .eq('id', item.product_id);

      if (updateErr) {
        failedProducts.push({
          productId: item.product_id,
          productName: item.product_name,
          error: updateErr.message,
        });
        continue;
      }

      // Log transaction
      const { error: txErr } = await supabase
        .from('product_transactions')
        .insert({
          product_id: item.product_id,
          order_id: orderId,
          change_type: 'consume',
          quantity: item.quantity,
          reason: `Order ${orderId}: ${item.quantity}x ${item.product_name}`,
        });

      if (txErr) {
        console.error(
          `Failed to log transaction for product ${item.product_id}:`,
          txErr
        );
        // Don't fail the deduction if logging fails, just warn
      }

      deductedProducts.push({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
      });
    } catch (err) {
      failedProducts.push({
        productId: item.product_id,
        productName: item.product_name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    success: failedProducts.length === 0,
    deductedProducts,
    failedProducts,
  };
}

/**
 * Restore inventory when order is cancelled
 * Creates reverse transactions
 */
export async function restoreInventory(
  supabase: SupabaseClient,
  orderId: string,
  orderItems: Array<{ product_id: string; product_name: string; quantity: number }>
): Promise<InventoryDeductionResult> {
  const restoredProducts: InventoryDeductionResult['deductedProducts'] = [];
  const failedProducts: InventoryDeductionResult['failedProducts'] = [];

  for (const item of orderItems) {
    try {
      // Get current quantity
      const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .single();

      if (fetchErr || !product) {
        failedProducts.push({
          productId: item.product_id,
          productName: item.product_name,
          error: 'Product not found',
        });
        continue;
      }

      const currentQty = Number(product.quantity) || 0;
      const newQty = currentQty + Number(item.quantity);

      // Update product quantity
      const { error: updateErr } = await supabase
        .from('products')
        .update({ 
          quantity: newQty,
          last_updated: new Date().toISOString(),
        })
        .eq('id', item.product_id);

      if (updateErr) {
        failedProducts.push({
          productId: item.product_id,
          productName: item.product_name,
          error: updateErr.message,
        });
        continue;
      }

      // Log reverse transaction
      const { error: txErr } = await supabase
        .from('product_transactions')
        .insert({
          product_id: item.product_id,
          order_id: orderId,
          change_type: 'add',
          quantity: item.quantity,
          reason: `Cancelled order ${orderId}: ${item.quantity}x ${item.product_name}`,
        });

      if (txErr) {
        console.error(
          `Failed to log reverse transaction for product ${item.product_id}:`,
          txErr
        );
        // Don't fail the restoration if logging fails
      }

      restoredProducts.push({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
      });
    } catch (err) {
      failedProducts.push({
        productId: item.product_id,
        productName: item.product_name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    success: failedProducts.length === 0,
    deductedProducts: restoredProducts,
    failedProducts,
  };
}

/**
 * Get current stock levels for products
 * Useful for displaying warnings
 */
export async function getStockLevels(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Record<string, number>> {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, quantity')
    .in('id', productIds);

  if (error || !products) {
    return {};
  }

  return Object.fromEntries(
    products.map((p) => [p.id, Number(p.quantity) || 0])
  );
}
