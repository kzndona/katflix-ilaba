"use client";

import { type ExportSummaryData, generateMonthlySummaryPDF, formatCurrency } from "../utils/exportUtils";

interface Props {
  data: ExportSummaryData;
  onClose: () => void;
  dateRange: { startDate: string; endDate: string };
  customerEarnings?: Array<{ customerName: string; earnings: number }>;
  userEmail?: string;
}

export function ExportSummaryPreviewModal({ data, onClose, dateRange, customerEarnings = [], userEmail }: Props) {
  const handleDownloadPDF = () => {
    const pdf = generateMonthlySummaryPDF(data, userEmail);
    pdf.save(`summary_${dateRange.startDate}_to_${dateRange.endDate}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-h-[90vh] max-w-4xl w-full overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Sales Summary Report</h2>
              <p className="text-blue-100 text-sm mt-1">
                {new Date(data.dateRange.start).toLocaleDateString()} to{" "}
                {new Date(data.dateRange.end).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-blue-100 hover:text-white transition"
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
          {/* Key Performance Metrics Table */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-600">
              Key Performance Metrics
            </h3>
            <table className="w-full">
              <tbody>
                <tr className="bg-blue-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">Total Revenue</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(data.totalRevenue)}</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-semibold text-gray-700">Total Orders</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.totalOrders}</td>
                </tr>
                <tr className="bg-blue-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">Average Order Value</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(data.avgOrderValue)}</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-semibold text-gray-700">New Customers</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.newCustomers}</td>
                </tr>
                <tr className="bg-blue-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">Returning Customers</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.returningCustomers}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Fulfillment Breakdown Table */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-emerald-600">
              Fulfillment Breakdown
            </h3>
            <table className="w-full">
              <tbody>
                <tr className="bg-emerald-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">Pick-up Only</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.fulfillmentBreakdown.pickupOnly}</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-semibold text-gray-700">Delivery Only</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.fulfillmentBreakdown.deliveryOnly}</td>
                </tr>
                <tr className="bg-emerald-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">Pick-up & Delivery</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.fulfillmentBreakdown.both}</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-semibold text-gray-700">In-store</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{data.fulfillmentBreakdown.inStore}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Top Products by Revenue Table */}
          {data.topProducts.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-orange-600">
                Top Products by Revenue
              </h3>
              <table className="w-full">
                <tbody>
                  {data.topProducts.map((product, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-orange-50" : "bg-white"}>
                      <td className="px-4 py-3 font-semibold text-gray-700">{product.product}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-600">{formatCurrency(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Services by Revenue Table */}
          {data.topServices.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">
                Top Services by Revenue
              </h3>
              <table className="w-full">
                <tbody>
                  {data.topServices.map((service, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-purple-50" : "bg-white"}>
                      <td className="px-4 py-3 font-semibold text-gray-700">{service.service}</td>
                      <td className="px-4 py-3 text-right font-semibold text-purple-600">{formatCurrency(service.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Customer Earnings Summary Table */}
          {customerEarnings.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-indigo-600">
                Earnings by Customer
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-indigo-600 text-white">
                      <th className="px-4 py-3 text-left font-semibold">Customer Name</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerEarnings.map((customer, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-indigo-50" : "bg-white"}>
                        <td className="px-4 py-3 font-semibold text-gray-700">{customer.customerName}</td>
                        <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatCurrency(customer.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
          >
            📥 Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
