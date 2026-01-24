import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format a number as currency with proper symbol, decimals, and thousands separators
 * Used for display in UI
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as currency for PDF output
 * Uses simpler format without Unicode characters to avoid encoding issues
 */
export function formatCurrencyPDF(value: number): string {
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "PHP " + formatter.format(value);
}

export interface ExportSummaryData {
  dateRange: { start: string; end: string };
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  fulfillmentBreakdown: {
    pickupOnly: number;
    deliveryOnly: number;
    both: number;
    inStore: number;
  };
  topProducts: Array<{ product: string; revenue: number }>;
  topServices: Array<{ service: string; revenue: number }>;
}

export interface OrderTransaction {
  orderId: string;
  date: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
}

export interface ProductTransaction {
  date: string;
  productName: string;
  quantity: number;
  totalCost: number;
  type: string;
}

export function generateMonthlySummaryPDF(data: ExportSummaryData, userEmail?: string) {
  const doc = new jsPDF();
  let yPosition = 15;

  // Title
  doc.setFontSize(20);
  doc.text("Monthly Sales Summary", doc.internal.pageSize.getWidth() / 2, yPosition, {
    align: "center",
  });

  // Date range and generated info
  yPosition += 12;
  doc.setFontSize(9);
  doc.text(
    `Period: ${formatDate(data.dateRange.start)} to ${formatDate(data.dateRange.end)}`,
    20,
    yPosition
  );
  yPosition += 4;
  doc.text(
    `Generated: ${new Date().toLocaleString()} | By: ${userEmail || "System"}`,
    20,
    yPosition
  );

  yPosition += 8;  // Key metrics section
  yPosition += 8;
  doc.setFontSize(12);
  doc.text("Key Performance Metrics", 20, yPosition);

  yPosition += 6;
  doc.setFontSize(9);
  const metricsData = [
    ["Metric", "Value"],
    ["Total Revenue", formatCurrencyPDF(data.totalRevenue)],
    ["Total Orders", data.totalOrders.toString()],
    ["Average Order Value", formatCurrencyPDF(data.avgOrderValue)],
    ["New Customers", data.newCustomers.toString()],
    ["Returning Customers", data.returningCustomers.toString()],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [metricsData[0]],
    body: metricsData.slice(1),
    margin: { left: 20, right: 20 },
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  // Fulfillment breakdown
  doc.setFontSize(12);
  doc.text("Fulfillment Breakdown", 20, yPosition);

  yPosition += 6;
  const fulfillmentData = [
    ["Type", "Orders"],
    ["Pick-up Only", data.fulfillmentBreakdown.pickupOnly.toString()],
    ["Delivery Only", data.fulfillmentBreakdown.deliveryOnly.toString()],
    ["Pick-up & Delivery", data.fulfillmentBreakdown.both.toString()],
    ["In-store", data.fulfillmentBreakdown.inStore.toString()],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [fulfillmentData[0]],
    body: fulfillmentData.slice(1),
    margin: { left: 20, right: 20 },
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  // Top products
  if (data.topProducts.length > 0) {
    if (yPosition > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.text("Top Products by Revenue", 20, yPosition);

    yPosition += 6;
    const productData = [
      ["Product", "Revenue"],
      ...data.topProducts.map((p) => [p.product, formatCurrencyPDF(p.revenue)]),
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [productData[0]],
      body: productData.slice(1),
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [243, 244, 246],
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // Top services
  if (data.topServices.length > 0) {
    if (yPosition > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPosition = 15;
    }

    yPosition += 8;
    doc.setFontSize(12);
    doc.text("Top Services by Revenue", 20, yPosition);

    yPosition += 6;
    const serviceData = [
      ["Service", "Revenue"],
      ...data.topServices.map((s) => [s.service, formatCurrencyPDF(s.revenue)]),
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [serviceData[0]],
      body: serviceData.slice(1),
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [243, 244, 246],
      },
    });
  }

  // Footer
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  return doc;
}

export function generateTransactionsPDF(
  orderTransactions: OrderTransaction[],
  productTransactions: ProductTransaction[],
  userEmail?: string
) {
  const doc = new jsPDF("l"); // landscape mode for more columns
  let yPosition = 15;

  // Title
  doc.setFontSize(18);
  doc.text("Transaction Report", doc.internal.pageSize.getWidth() / 2, yPosition, {
    align: "center",
  });

  yPosition += 10;
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()} | By: ${userEmail || "System"}`, 20, yPosition);

  yPosition += 8;
  const totalOrderEarnings = orderTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalProductCost = productTransactions.reduce((sum, t) => sum + t.totalCost, 0);
  const totalEarnings = totalOrderEarnings + totalProductCost;

  // Total Earnings Summary
  yPosition += 8;
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Total Earnings Summary", 20, yPosition);
  yPosition += 6;
  
  const earningsData = [
    ["Category", "Amount"],
    ["Order Earnings", formatCurrencyPDF(totalOrderEarnings)],
    ["Product Earnings", formatCurrencyPDF(totalProductCost)],
    ["Total", formatCurrencyPDF(totalEarnings)],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [earningsData[0]],
    body: earningsData.slice(1),
    margin: { left: 20, right: 20 },
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
    columnStyles: {
      1: { halign: "right" },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  // Unified Transactions Section
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("All Transactions", 20, yPosition);

  yPosition += 6;
  if (orderTransactions.length > 0 || productTransactions.length > 0) {
    // Create unified transaction data with all rows
    const allTransactionData = [
      ["Order ID", "Date", "Customer Name", "Product Name", "Quantity", "Total Cost", "Type"],
    ];

    // Add order transactions
    orderTransactions.forEach((t) => {
      allTransactionData.push([
        t.orderId || "N/A",
        formatDate(t.date),
        t.customerName || "N/A",
        "N/A", // Product Name
        "N/A", // Quantity
        formatCurrencyPDF(t.amount),
        "Order",
      ]);
    });

    // Add product transactions
    productTransactions.forEach((t) => {
      allTransactionData.push([
        "N/A", // Order ID
        formatDate(t.date),
        "N/A", // Customer Name
        t.productName || "N/A",
        t.quantity ? t.quantity.toString() : "N/A",
        formatCurrencyPDF(t.totalCost),
        t.type || "N/A",
      ]);
    });

    autoTable(doc, {
      startY: yPosition,
      head: [allTransactionData[0]],
      body: allTransactionData.slice(1),
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  } else {
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text("No transactions found for the selected period.", 20, yPosition);
  }

  // Footer
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  return doc;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}
