"use client";

import React from "react";

interface ReceiptModalProps {
  isOpen: boolean;
  receiptContent: string;
  orderId: string;
  onClose: () => void;
  onPrint?: () => void;
}

/**
 * Receipt Preview Modal
 * Displays formatted receipt with print functionality
 * Print button: Currently downloads as .txt (placeholder for thermal printer)
 */
export default function ReceiptModal({
  isOpen,
  receiptContent,
  orderId,
  onClose,
  onPrint,
}: ReceiptModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    // Optimized print for 58mm thermal printer (RONGTA, Epson, etc.)
    const printWindow = window.open("", "", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${orderId}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
              }
              
              @page {
                /* 58mm thermal printer = 2.28 inches width */
                size: 58mm auto;
                margin: 0;
                padding: 0;
              }
              
              @media print {
                * {
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 58mm;
                  height: auto;
                }
                
                pre {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 58mm;
                  height: auto;
                  page-break-after: avoid;
                  orphans: 0;
                  widows: 0;
                }
              }
              
              body {
                font-family: 'Courier New', monospace;
                background: white;
                width: 58mm;
              }
              
              pre {
                font-size: 9px;
                line-height: 1.2;
                white-space: pre-wrap;
                word-wrap: break-word;
                width: 58mm;
                overflow: hidden;
              }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
            <script>
              // Wait for page to render, then print
              setTimeout(() => {
                window.print();
                // Close after a short delay to ensure print job is sent
                setTimeout(() => window.close(), 500);
              }, 100);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownloadReceipt = () => {
    // Download as .txt file for backup
    const element = document.createElement("a");
    const file = new Blob([receiptContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `receipt-${orderId}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Receipt Preview</h2>
            <p className="text-xs text-blue-100">Order ID: {orderId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
            title="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Receipt Content - 80mm thermal printer width optimized */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex items-start justify-center">
          <pre className="font-mono text-xs text-gray-900 bg-white p-6 rounded-lg border border-gray-200 shadow-sm whitespace-pre-wrap wrap-break-word max-w-sm">
            {receiptContent}
          </pre>
        </div>

        {/* Actions */}
        <div className="bg-gray-100 px-6 py-4 flex gap-3 border-t border-gray-200">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
            title="Print receipt (opens print dialog)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 00-2 2v2a2 2 0 002 2h10a2 2 0 002-2v-2a2 2 0 00-2-2"
              />
            </svg>
            Print
          </button>

          <button
            onClick={handleDownloadReceipt}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
            title="Download receipt as text file"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
