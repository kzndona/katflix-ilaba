"use client";

import { useEffect, useState } from "react";
import { formatToPST, formatDateToPST } from "@/src/app/utils/dateUtils";

type Basket = {
  id: string;
  basket_number: number;
  weight: number | null;
  notes: string | null;
  price: number | null;
  status: string;
  created_at: string | null;
  basket_services: BasketService[];
};

type BasketService = {
  id: string;
  service_id: string;
  rate: number | null;
  subtotal: number | null;
  status: string;
  services: {
    id: string;
    name: string;
    service_type: string;
  };
};

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email_address: string | null;
  phone_number: string | null;
};

type OrderProduct = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    id: string;
    item_name: string;
  };
};

type Order = {
  id: string;
  source: string;
  customer_id: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  discount: number;
  pickup_address: string | null;
  delivery_address: string | null;
  shipping_fee: number;
  created_at: string | null;
  completed_at: string | null;
  baskets: Basket[];
  order_products: OrderProduct[];
  customers: Customer | null;
};

export default function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [filteredRows, setFilteredRows] = useState<Order[]>([]);
  const [processingRows, setProcessingRows] = useState<Order[]>([]);
  const [pickupRows, setPickupRows] = useState<Order[]>([]);
  const [deliveryRows, setDeliveryRows] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDateFrom(today);
    setDateTo(today);
    load();
  }, []);

  useEffect(() => {
    filterByDate();
  }, [rows, dateFrom, dateTo]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/orders/getOrdersWithBaskets");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      setRows(data || []);
    } catch (err) {
      setErrorMsg("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function filterByDate() {
    let filtered = rows;

    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter((order) => {
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        return orderDate && orderDate >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => {
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        return orderDate && orderDate <= to;
      });
    }

    // Separate processing, pickup, delivery, and other orders
    const processing = filtered.filter(
      (order) => order.status === "processing"
    );
    const pickup = filtered.filter((order) => order.status === "pick-up");
    const delivery = filtered.filter((order) => order.status === "delivering");
    const nonProcessing = filtered.filter(
      (order) => !["processing", "pick-up", "delivering"].includes(order.status)
    );

    // Sort by created_at descending
    processing.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
    pickup.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
    delivery.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
    nonProcessing.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

    setProcessingRows(processing);
    setPickupRows(pickup);
    setDeliveryRows(delivery);
    setFilteredRows(nonProcessing);
  }

  function selectOrder(order: Order) {
    setSelected(order);
    setIsEditingDetails(false);
  }

  function startEdit() {
    if (!selected) return;
    setEditing({ ...selected });
    setIsEditingDetails(true);
  }

  function updateField<K extends keyof Order>(key: K, value: Order[K]) {
    if (!editing) return;
    const updated = { ...editing, [key]: value };
    // Auto-set completed_at when status changes to completed
    if (key === "status" && value === "completed" && !editing.completed_at) {
      updated.completed_at = new Date().toISOString();
    }
    setEditing(updated);
  }

  function validateForm(data: Order) {
    if (!data.source.trim()) return "Source is required";
    if (!data.status.trim()) return "Status is required";
    if (!data.payment_status.trim()) return "Payment status is required";
    return null;
  }

  async function save() {
    if (!editing) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validateForm(editing);
    if (validation) {
      setErrorMsg(validation);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        ...(editing.customer_id ? { customer_id: editing.customer_id } : {}),
        source: editing.source,
        status: editing.status,
        payment_status: editing.payment_status,
        total_amount: editing.total_amount,
        discount: editing.discount,
        pickup_address: editing.pickup_address || null,
        delivery_address: editing.delivery_address || null,
        shipping_fee: editing.shipping_fee,
        completed_at: editing.completed_at || null,
      };

      const res = await fetch("/api/orders/saveOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || `Server responded ${res.status}`);

      setSuccessMsg("Order saved successfully");
      load();
      setTimeout(() => {
        setIsEditingDetails(false);
        setEditing(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save order";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;

    setSaving(true);
    try {
      const res = await fetch("/api/orders/removeOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || `Server responded ${res.status}`);

      setSuccessMsg("Order deleted successfully");
      load();
      setTimeout(() => {
        setIsEditingDetails(false);
        setEditing(null);
        setSelected(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete order";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 bg-gray-50 flex flex-col h-screen">
      <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
        {/* LEFT PANE - Orders List */}
        <div className="col-span-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-3xl font-bold mb-4">Orders</h2>

            {/* Date Range Filter */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : errorMsg ? (
              <div className="p-4 text-red-600 text-sm">{errorMsg}</div>
            ) : (
              <>
                {/* Processing Orders */}
                {processingRows.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-orange-50 px-4 py-3 border-b border-orange-200 font-semibold text-orange-900 text-sm">
                      🔄 Processing ({processingRows.length})
                    </div>
                    <div className="divide-y divide-gray-200">
                      {processingRows.map((order) => (
                        <OrderListItem
                          key={order.id}
                          order={order}
                          isSelected={selected?.id === order.id}
                          onClick={() => selectOrder(order)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pickup Orders */}
                {pickupRows.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-amber-50 px-4 py-3 border-b border-amber-200 font-semibold text-amber-900 text-sm">
                      🏪 Pickup ({pickupRows.length})
                    </div>
                    <div className="divide-y divide-gray-200">
                      {pickupRows.map((order) => (
                        <OrderListItem
                          key={order.id}
                          order={order}
                          isSelected={selected?.id === order.id}
                          onClick={() => selectOrder(order)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Orders */}
                {deliveryRows.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-cyan-50 px-4 py-3 border-b border-cyan-200 font-semibold text-cyan-900 text-sm">
                      🚚 Delivery ({deliveryRows.length})
                    </div>
                    <div className="divide-y divide-gray-200">
                      {deliveryRows.map((order) => (
                        <OrderListItem
                          key={order.id}
                          order={order}
                          isSelected={selected?.id === order.id}
                          onClick={() => selectOrder(order)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Non-Processing Orders */}
                {filteredRows.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-gray-100 px-4 py-3 border-b border-gray-300 font-semibold text-gray-900 text-sm">
                      📋 Other Orders ({filteredRows.length})
                    </div>
                    <div className="divide-y divide-gray-200">
                      {filteredRows.map((order) => (
                        <OrderListItem
                          key={order.id}
                          order={order}
                          isSelected={selected?.id === order.id}
                          onClick={() => selectOrder(order)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {processingRows.length === 0 &&
                  pickupRows.length === 0 &&
                  deliveryRows.length === 0 &&
                  filteredRows.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No orders found
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANE - Details or Edit */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          {isEditingDetails && editing ? (
            <EditPane
              order={editing}
              updateField={updateField}
              save={save}
              remove={remove}
              saving={saving}
              errorMsg={errorMsg}
              successMsg={successMsg}
              onCancel={() => {
                setIsEditingDetails(false);
                setEditing(null);
                setErrorMsg(null);
              }}
            />
          ) : selected ? (
            <DetailsPane order={selected} onEdit={startEdit} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">📦</div>
                <p>Select an order to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderListItem({
  order,
  isSelected,
  onClick,
}: {
  order: Order;
  isSelected: boolean;
  onClick: () => void;
}) {
  const customerName = order.customers
    ? `${order.customers.first_name} ${order.customers.last_name}`
    : "Unknown";

  const statusColor =
    {
      processing: "text-orange-600",
      "pick-up": "text-blue-600",
      delivering: "text-purple-600",
      completed: "text-green-600",
      cancelled: "text-red-600",
    }[order.status] || "text-gray-600";

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition ${
        isSelected
          ? "bg-blue-50 border-l-4 border-blue-600"
          : "hover:bg-gray-50"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-medium text-sm">{customerName}</div>
          <div className={`text-xs font-semibold mt-1 ${statusColor}`}>
            {order.status.toUpperCase()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {formatDateToPST(order.created_at)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-sm">
            ₱{order.total_amount.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {order.baskets?.length || 0} baskets
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsPane({ order, onEdit }: { order: Order; onEdit: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-start shrink-0">
        <div>
          <h3 className="text-3xl font-bold">
            {order.customers
              ? `${order.customers.first_name} ${order.customers.last_name}`
              : "No customer"}
          </h3>
          <p className="text-gray-500 mt-1 text-sm">
            Order #{order.id.slice(0, 8)}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="p-3 hover:bg-gray-100 rounded-lg transition shrink-0"
          title="Edit"
        >
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {/* Order Status & Dates */}
          <div className="grid grid-cols-3 gap-4">
            <DetailField label="📊 Status" value={order.status} />
            <DetailField label="💳 Payment" value={order.payment_status} />
            <DetailField label="🔧 Source" value={order.source} />
            <DetailField
              label="📅 Created"
              value={formatToPST(order.created_at)}
            />
            <DetailField
              label="✅ Completed"
              value={formatToPST(order.completed_at)}
            />
          </div>

          {/* Customer Contact */}
          {order.customers && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <DetailField
                label="☎️ Phone"
                value={order.customers.phone_number || "—"}
              />
              <DetailField
                label="📧 Email"
                value={order.customers.email_address || "—"}
              />
            </div>
          )}

          {/* Addresses */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              🚚 Delivery Info
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Pickup Address</p>
                <p className="text-sm text-gray-900">
                  {order.pickup_address || "In-store"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Delivery Address</p>
                <p className="text-sm text-gray-900">
                  {order.delivery_address || "In-store"}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              💰 Charges
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">
                  ₱{order.total_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium">
                  ₱{order.discount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping Fee:</span>
                <span className="font-medium">
                  ₱{order.shipping_fee.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Products */}
          {order.order_products && order.order_products.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                🛍️ Products ({order.order_products.length})
              </h4>
              <div className="space-y-2">
                {order.order_products.map((product) => (
                  <div
                    key={product.id}
                    className="flex justify-between text-sm p-2 rounded bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {product.products.item_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.quantity} × ₱{product.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-medium text-gray-900">
                      ₱{product.subtotal.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Baskets Section */}
          {order.baskets && order.baskets.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                🧺 Baskets ({order.baskets.length})
              </h4>
              <div className="space-y-3">
                {order.baskets.map((basket) => (
                  <BasketCard key={basket.id} basket={basket} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BasketCard({ basket }: { basket: Basket }) {
  const statusColor =
    {
      processing: "bg-orange-50 border-orange-200",
      "pick-up": "bg-blue-50 border-blue-200",
      delivering: "bg-purple-50 border-purple-200",
      completed: "bg-green-50 border-green-200",
      cancelled: "bg-red-50 border-red-200",
    }[basket.status] || "bg-gray-50 border-gray-200";

  return (
    <div className={`border rounded-lg p-3 ${statusColor}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h5 className="font-semibold text-sm">
            Basket #{basket.basket_number}
          </h5>
          {basket.weight !== null && (
            <p className="text-xs text-gray-600">Weight: {basket.weight} kg</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-gray-700">
            {basket.status}
          </div>
          {basket.price !== null && (
            <div className="text-sm font-semibold">
              ₱{basket.price.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {basket.notes && (
        <p className="text-xs text-gray-700 mb-2 italic">"{basket.notes}"</p>
      )}

      {basket.basket_services && basket.basket_services.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-50">
          <div className="space-y-1">
            {basket.basket_services.map((service) => (
              <div
                key={service.id}
                className="text-xs text-gray-700 grid grid-cols-[1fr_80px_70px] gap-2"
              >
                <span className="font-medium truncate">
                  {service.services.name}
                </span>
                <span className="text-gray-600 text-right">
                  {service.status}
                </span>
                {service.subtotal !== null && (
                  <span className="font-medium text-right">
                    ₱{service.subtotal.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-0">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function EditPane({
  order,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  successMsg,
  onCancel,
}: {
  order: Order;
  updateField: (key: keyof Order, value: any) => void;
  save: () => void;
  remove: () => void;
  saving: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-8 border-b border-gray-200">
        <h3 className="text-4xl font-bold">Edit Order</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700">
            {successMsg}
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Select
              label="Source"
              value={order.source}
              onChange={(v) => updateField("source", v)}
              options={[
                { value: "pos", label: "POS" },
                { value: "mobile", label: "Mobile" },
              ]}
            />

            <Select
              label="Status"
              value={order.status}
              onChange={(v) => updateField("status", v)}
              options={[
                { value: "processing", label: "Processing" },
                { value: "pick-up", label: "Pick-up" },
                { value: "delivering", label: "Delivering" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />

            <Select
              label="Payment Status"
              value={order.payment_status}
              onChange={(v) => updateField("payment_status", v)}
              options={[
                { value: "processing", label: "Processing" },
                { value: "successful", label: "Successful" },
                { value: "failed", label: "Failed" },
              ]}
            />

            <Field
              label="Total Amount"
              value={order.total_amount.toString()}
              onChange={(v) => updateField("total_amount", parseFloat(v))}
              type="number"
            />

            <Field
              label="Discount"
              value={order.discount.toString()}
              onChange={(v) => updateField("discount", parseFloat(v))}
              type="number"
            />

            <Field
              label="Shipping Fee"
              value={order.shipping_fee.toString()}
              onChange={(v) => updateField("shipping_fee", parseFloat(v))}
              type="number"
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Field
              label="Pickup Address"
              value={order.pickup_address ?? ""}
              onChange={(v) => updateField("pickup_address", v)}
            />

            <Field
              label="Delivery Address"
              value={order.delivery_address ?? ""}
              onChange={(v) => updateField("delivery_address", v)}
            />

            <Field
              label="Completed At"
              value={order.completed_at ?? ""}
              onChange={(v) => updateField("completed_at", v)}
              type="datetime-local"
            />
          </div>
        </div>
      </div>

      <div className="p-8 border-t border-gray-200 flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-base font-medium w-24"
          disabled={saving}
        >
          Cancel
        </button>

        <button
          onClick={remove}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-base font-medium w-24"
          disabled={saving}
        >
          Delete
        </button>

        <button
          onClick={save}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-base font-medium w-24"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
