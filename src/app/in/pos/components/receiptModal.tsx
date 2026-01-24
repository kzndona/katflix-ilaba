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
 * Receipt Display Modal
 * Shows plaintext receipt with Print button
 * Print button downloads as .txt file for now
 * TODO: Replace download logic with thermal printer integration when printer is available
 */
export default function ReceiptModal({
  isOpen,
  receiptContent,
  orderId,
  onClose,
  onPrint,
}: ReceiptModalProps) {
  if (!isOpen) return null;

  const handleDownloadReceipt = () => {
    // TODO: THERMAL PRINTER INTEGRATION
    // When thermal printer is connected, replace this with:
    // - Send receipt to printer API
    // - Show "Printing..." status
    // - Handle print success/failure
    
    // For now: Download as .txt file
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
          <h2 className="text-xl font-bold text-white">Receipt Preview</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
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

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <pre className="font-mono text-sm text-gray-900 whitespace-pre-wrap wrap-break-word bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            {receiptContent}
          </pre>
        </div>

        {/* Actions */}
        <div className="bg-gray-100 px-6 py-4 flex gap-3 border-t border-gray-200">
          <button
            onClick={handleDownloadReceipt}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Print / Download
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
