"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type RevenueData = {
  date: string;
  revenue: number;
};

type ProductRevenueData = {
  product: string;
  revenue: number;
};

type ServiceRevenueData = {
  service: string;
  revenue: number;
};

type FulfillmentData = {
  name: string;
  value: number;
  color: string;
};

type Product = {
  id: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
};

export default function AnalyticsPage() {
  // Date range - default to this month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const startDate = firstDay.toISOString().split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  const [dateRange, setDateRange] = useState({ startDate, endDate });

  // Analytics data states
  const [revenueData, setRevenueData] = useState<{
    dailyRevenue: RevenueData[];
    productRevenue: ProductRevenueData[];
    serviceRevenue: ServiceRevenueData[];
  } | null>(null);

  const [ordersData, setOrdersData] = useState<{
    totalOrders: number;
    avgOrderValue: number;
    fulfillmentBreakdown: {
      pickupOnly: number;
      deliveryOnly: number;
      both: number;
      inStore: number;
    };
  } | null>(null);

  const [customersData, setCustomersData] = useState<{
    newCustomers: number;
    returningCustomers: number;
  } | null>(null);

  const [productsData, setProductsData] = useState<{
    lowStockProducts: Product[];
    allProducts: Product[];
    totalProducts: number;
    lowStockCount: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productsPage, setProductsPage] = useState(1);

  // Fetch all analytics data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const revenueRes = await fetch(
          `/api/analytics/revenue?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );
        const ordersRes = await fetch(
          `/api/analytics/orders?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );
        const customersRes = await fetch(
          `/api/analytics/customers?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );
        const productsRes = await fetch(`/api/analytics/products`);

        if (
          !revenueRes.ok ||
          !ordersRes.ok ||
          !customersRes.ok ||
          !productsRes.ok
        ) {
          throw new Error("Failed to fetch analytics data");
        }

        const revenue = await revenueRes.json();
        const orders = await ordersRes.json();
        const customers = await customersRes.json();
        const products = await productsRes.json();

        setRevenueData(revenue);
        setOrdersData(orders);
        setCustomersData(customers);
        setProductsData(products);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-200">
          <p className="text-lg font-semibold">Error loading analytics</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Prepare fulfillment chart data
  const fulfillmentChartData: FulfillmentData[] = [
    {
      name: "Pick-up Only",
      value: ordersData?.fulfillmentBreakdown.pickupOnly || 0,
      color: "#f59e0b",
    },
    {
      name: "Delivery Only",
      value: ordersData?.fulfillmentBreakdown.deliveryOnly || 0,
      color: "#f97316",
    },
    {
      name: "Pick-up & Delivery",
      value: ordersData?.fulfillmentBreakdown.both || 0,
      color: "#dc2626",
    },
    {
      name: "In-store",
      value: ordersData?.fulfillmentBreakdown.inStore || 0,
      color: "#ea580c",
    },
  ].filter((item) => item.value > 0);

  // Paginated products (excluding low-stock)
  const productsPerPage = 10;
  const normalProducts =
    productsData?.allProducts.filter((p) => p.quantity >= p.reorderLevel) || [];
  const totalPages = Math.ceil(normalProducts.length / productsPerPage);
  const paginatedProducts = normalProducts.slice(
    (productsPage - 1) * productsPerPage,
    productsPage * productsPerPage
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-900 relative m-0 p-0">
      {/* Background subtle gradient effect - Apple M1 style */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-linear-to-br from-slate-900/50 via-transparent to-slate-900/30"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-18 z-20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Sales & Analytics
              </h1>
              <p className="text-slate-400 mt-1">
                Historical data and performance metrics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition text-sm font-medium">
                📊 Export Summary
              </button>
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition text-sm font-medium">
                📋 Export Transactions
              </button>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange({
                      ...dateRange,
                      startDate: e.target.value,
                    })
                  }
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange({
                      ...dateRange,
                      endDate: e.target.value,
                    })
                  }
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Revenue Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Revenue</h2>
          <div className="grid grid-cols-1 gap-6">
            {/* Daily Revenue Chart */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">
                Daily Revenue Trend
              </h3>
              {revenueData?.dailyRevenue &&
              revenueData.dailyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      style={{ fontSize: "12px" }}
                      tickFormatter={(value) => `₱${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(value: any) =>
                        `₱${parseFloat(value).toFixed(2)}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      dot={{ fill: "#3b82f6", r: 4 }}
                      activeDot={{ r: 6 }}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-center py-8">
                  No revenue data for selected period
                </p>
              )}
            </div>

            {/* Product & Service Revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Products */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Top Products by Revenue
                </h3>
                {revenueData?.productRevenue &&
                revenueData.productRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData.productRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis
                        dataKey="product"
                        stroke="#94a3b8"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: "12px" }}
                        tickFormatter={(value) => `₱${value.toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                        formatter={(value: any) =>
                          `₱${parseFloat(value).toFixed(2)}`
                        }
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#10b981"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    No product data
                  </p>
                )}
              </div>

              {/* Services */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Services by Revenue
                </h3>
                {revenueData?.serviceRevenue &&
                revenueData.serviceRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData.serviceRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis
                        dataKey="service"
                        stroke="#94a3b8"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: "12px" }}
                        tickFormatter={(value) => `₱${value.toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                        formatter={(value: any) =>
                          `₱${parseFloat(value).toFixed(2)}`
                        }
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    No service data
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Orders Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Orders</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Total Orders Card */}
            <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-xl border border-blue-500/30">
              <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide">
                Total Orders
              </p>
              <p className="text-5xl font-bold text-white mt-3">
                {ordersData?.totalOrders || 0}
              </p>
            </div>

            {/* Avg Order Value Card */}
            <div className="bg-linear-to-br from-emerald-600 to-emerald-700 rounded-xl p-6 shadow-xl border border-emerald-500/30">
              <p className="text-emerald-100 text-sm font-semibold uppercase tracking-wide">
                Average Order Value
              </p>
              <p className="text-4xl font-bold text-white mt-3">
                ₱{(ordersData?.avgOrderValue || 0).toFixed(2)}
              </p>
            </div>

            {/* Fulfillment Overview */}
            <div className="bg-linear-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-xl border border-purple-500/30">
              <p className="text-purple-100 text-sm font-semibold uppercase tracking-wide">
                Fulfillment Types
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-100">Pick-up Only:</span>
                  <span className="text-white font-semibold">
                    {ordersData?.fulfillmentBreakdown.pickupOnly || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-100">Delivery Only:</span>
                  <span className="text-white font-semibold">
                    {ordersData?.fulfillmentBreakdown.deliveryOnly || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-100">Pick-up & Delivery:</span>
                  <span className="text-white font-semibold">
                    {ordersData?.fulfillmentBreakdown.both || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-100">In-store:</span>
                  <span className="text-white font-semibold">
                    {ordersData?.fulfillmentBreakdown.inStore || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment Breakdown Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Fulfillment Breakdown
            </h3>
            {fulfillmentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fulfillmentChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fulfillmentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                      color: "#ffffff",
                    }}
                    labelStyle={{ color: "#ffffff" }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-center py-8">No orders data</p>
            )}
          </div>
        </div>

        {/* Customers Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Customers</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* New Customers */}
            <div className="bg-linear-to-br from-cyan-600 to-cyan-700 rounded-xl p-6 shadow-xl border border-cyan-500/30">
              <p className="text-cyan-100 text-sm font-semibold uppercase tracking-wide">
                New Customers
              </p>
              <p className="text-5xl font-bold text-white mt-3">
                {customersData?.newCustomers || 0}
              </p>
            </div>

            {/* Returning Customers */}
            <div className="bg-linear-to-br from-pink-600 to-pink-700 rounded-xl p-6 shadow-xl border border-pink-500/30">
              <p className="text-pink-100 text-sm font-semibold uppercase tracking-wide">
                Returning Customers
              </p>
              <p className="text-5xl font-bold text-white mt-3">
                {customersData?.returningCustomers || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Products Stock Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Product Stock</h2>

          {/* Low Stock Section */}
          {productsData?.lowStockProducts &&
            productsData.lowStockProducts.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Low Stock Alert ({productsData.lowStockCount})
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-red-900/30 border-b border-slate-700">
                        <th className="px-6 py-3 text-left text-red-200 font-semibold">
                          Product Name
                        </th>
                        <th className="px-6 py-3 text-right text-red-200 font-semibold">
                          Current Qty
                        </th>
                        <th className="px-6 py-3 text-right text-red-200 font-semibold">
                          Reorder Level
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsData.lowStockProducts.map((product) => (
                        <tr
                          key={product.id}
                          className="border-b border-slate-700 bg-red-900/10 hover:bg-red-900/20 transition"
                        >
                          <td className="px-6 py-4 text-slate-100 font-medium">
                            {product.name}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-300">
                            {Math.floor(product.quantity)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-300">
                            {Math.floor(product.reorderLevel)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* All Products Section */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              All Products ({normalProducts.length})
            </h3>

            {/* Products Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-xl mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="px-6 py-3 text-left text-slate-200 font-semibold">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-right text-slate-200 font-semibold">
                      Current Qty
                    </th>
                    <th className="px-6 py-3 text-right text-slate-200 font-semibold">
                      Reorder Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.length > 0 ? (
                    paginatedProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-slate-700 bg-slate-800 hover:bg-slate-700/50 transition"
                      >
                        <td className="px-6 py-4 text-slate-100 font-medium">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          {Math.floor(product.quantity)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          {Math.floor(product.reorderLevel)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        No products with adequate stock
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setProductsPage(Math.max(1, productsPage - 1))}
                  disabled={productsPage === 1}
                  className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-600 transition"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setProductsPage(i + 1)}
                      className={`px-3 py-2 rounded-lg transition ${
                        productsPage === i + 1
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setProductsPage(Math.min(totalPages, productsPage + 1))
                  }
                  disabled={productsPage === totalPages}
                  className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-600 transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Stock Health Chart - Stock Status Percentage */}
          <div className="mt-8 bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6">
              Stock Status Summary
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Total Products */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <p className="text-slate-300 text-sm font-semibold mb-2">
                  Total Products
                </p>
                <p className="text-3xl font-bold text-white">
                  {productsData?.totalProducts || 0}
                </p>
              </div>

              {/* Healthy Stock */}
              <div className="bg-green-900/30 rounded-lg p-4 border border-green-700/50">
                <p className="text-green-300 text-sm font-semibold mb-2">
                  Healthy Stock
                </p>
                <p className="text-3xl font-bold text-green-400">
                  {(productsData?.totalProducts || 0) -
                    (productsData?.lowStockCount || 0)}
                </p>
              </div>

              {/* Low Stock Count */}
              <div className="bg-red-900/30 rounded-lg p-4 border border-red-700/50">
                <p className="text-red-300 text-sm font-semibold mb-2">
                  Low Stock Alert
                </p>
                <p className="text-3xl font-bold text-red-400">
                  {productsData?.lowStockCount || 0}
                </p>
              </div>
            </div>

            {/* Stock Status Breakdown */}
            {productsData?.allProducts &&
            productsData.allProducts.length > 0 ? (
              <div>
                <p className="text-slate-300 text-sm font-semibold mb-4">
                  Top 10 Products by Stock Status
                </p>
                <div className="space-y-3">
                  {productsData.allProducts.slice(0, 10).map((product) => {
                    const stockPercentage =
                      (product.quantity /
                        (product.reorderLevel || product.quantity || 1)) *
                      100;
                    const isLowStock = product.quantity < product.reorderLevel;

                    return (
                      <div key={product.id}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-200 text-sm font-medium truncate">
                            {product.name}
                          </span>
                          <span className="text-slate-400 text-sm ml-2">
                            {Math.floor(product.quantity)}/
                            {Math.floor(product.reorderLevel)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isLowStock
                                ? "bg-red-500"
                                : stockPercentage > 150
                                  ? "bg-green-500"
                                  : "bg-blue-500"
                            }`}
                            style={{
                              width: `${Math.min(stockPercentage, 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No products</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
