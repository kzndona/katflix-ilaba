"use client";

import { type OrderTransaction, type ProductTransaction, generateTransactionsPDF, formatCurrency } from "../utils/exportUtils";

interface Props {
  orderTransactions: OrderTransaction[];
  productTransactions: ProductTransaction[];
  onClose: () => void;
  dateRange: { startDate: string; endDate: string };
  userEmail?: string;
}

export function ExportTransactionsPreviewModal({
  orderTransactions,
  productTransactions,
  onClose,
  dateRange,
  userEmail,
}: Props) {
  const handleDownloadPDF = () => {
    const pdf = generateTransactionsPDF(orderTransactions, productTransactions, userEmail);
    pdf.save(`transactions_${dateRange.startDate}_to_${dateRange.endDate}.pdf`);
  };

  // Calculate total earnings
  const totalOrderEarnings = orderTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalProductCost = productTransactions.reduce((sum, t) => sum + t.totalCost, 0);
  const totalEarnings = totalOrderEarnings + totalProductCost;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-h-[90vh] max-w-5xl w-full overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Transaction Report</h2>
              <p className="text-green-100 text-sm mt-1">
                {new Date(dateRange.startDate).toLocaleDateString()} to{" "}
                {new Date(dateRange.endDate).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-green-100 hover:text-white transition"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Total Earnings Summary */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-600 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Total Earnings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-sm font-medium">Order Earnings</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalOrderEarnings)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm font-medium">Product Earnings</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalProductCost)}</p>
              </div>
              <div className="bg-green-600 text-white rounded-lg p-4">
                <p className="text-sm font-medium opacity-90">Total</p>
                <p className="text-3xl font-bold">{formatCurrency(totalEarnings)}</p>
              </div>
            </div>
          </div>

          {/* Unified Transactions Table */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-green-600">
              All Transactions
            </h3>
            {(orderTransactions.length > 0 || productTransactions.length > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-600 text-white">
                      <th className="px-4 py-3 text-left font-semibold">Order ID</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Customer Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Product Name</th>
                      <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Cost</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Order Transactions */}
                    {orderTransactions.map((transaction, index) => (
                      <tr
                        key={`order-${index}`}
                        className={index % 2 === 0 ? "bg-green-50" : "bg-white border-b border-gray-200"}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{transaction.orderId || "N/A"}</td>
                        <td className="px-4 py-3 text-gray-700">{new Date(transaction.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-700">{transaction.customerName || "N/A"}</td>
                        <td className="px-4 py-3 text-gray-500">N/A</td>
                        <td className="px-4 py-3 text-right text-gray-500">N/A</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(transaction.amount)}</td>
                        <td className="px-4 py-3 text-gray-700">Order</td>
                      </tr>
                    ))}
                    {/* Product Transactions */}
                    {productTransactions.map((transaction, index) => (
                      <tr
                        key={`product-${index}`}
                        className={(orderTransactions.length + index) % 2 === 0 ? "bg-green-50" : "bg-white border-b border-gray-200"}
                      >
                        <td className="px-4 py-3 text-gray-500">N/A</td>
                        <td className="px-4 py-3 text-gray-700">{new Date(transaction.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-500">N/A</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{transaction.productName || "N/A"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{transaction.quantity || "N/A"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(transaction.totalCost)}</td>
                        <td className="px-4 py-3 text-gray-700">{transaction.type || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No transactions found for the selected period.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-medium"
          >
            Close
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-md"
          >
            📥 Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
