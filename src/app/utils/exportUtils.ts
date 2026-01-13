import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export function generateMonthlySummaryPDF(data: ExportSummaryData) {
  const doc = new jsPDF();
  let yPosition = 20;

  // Title
  doc.setFontSize(20);
  doc.text("Monthly Sales Summary", doc.internal.pageSize.getWidth() / 2, yPosition, {
    align: "center",
  });

  // Date range
  yPosition += 15;
  doc.setFontSize(11);
  doc.text(
    `Period: ${formatDate(data.dateRange.start)} to ${formatDate(data.dateRange.end)}`,
    20,
    yPosition
  );

  // Key metrics section
  yPosition += 20;
  doc.setFontSize(14);
  doc.text("Key Performance Metrics", 20, yPosition);

  yPosition += 12;
  doc.setFontSize(10);
  const metricsData = [
    ["Metric", "Value"],
    ["Total Revenue", `₱${data.totalRevenue.toFixed(2)}`],
    ["Total Orders", data.totalOrders.toString()],
    ["Average Order Value", `₱${data.avgOrderValue.toFixed(2)}`],
    ["New Customers", data.newCustomers.toString()],
    ["Returning Customers", data.returningCustomers.toString()],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [metricsData[0]],
    body: metricsData.slice(1),
    margin: 20,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 8,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Fulfillment breakdown
  doc.setFontSize(14);
  doc.text("Fulfillment Breakdown", 20, yPosition);

  yPosition += 12;
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
    margin: 20,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 8,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Top products
  if (data.topProducts.length > 0) {
    if (yPosition > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.text("Top Products by Revenue", 20, yPosition);

    yPosition += 12;
    const productData = [
      ["Product", "Revenue"],
      ...data.topProducts.map((p) => [p.product, `₱${p.revenue.toFixed(2)}`]),
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [productData[0]],
      body: productData.slice(1),
      margin: 20,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 8,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [243, 244, 246],
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Top services
  if (data.topServices.length > 0) {
    if (yPosition > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.text("Top Services by Revenue", 20, yPosition);

    yPosition += 12;
    const serviceData = [
      ["Service", "Revenue"],
      ...data.topServices.map((s) => [s.service, `₱${s.revenue.toFixed(2)}`]),
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [serviceData[0]],
      body: serviceData.slice(1),
      margin: 20,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 8,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
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
  productTransactions: ProductTransaction[]
) {
  const doc = new jsPDF("l"); // landscape mode for more columns
  let yPosition = 20;

  // Title
  doc.setFontSize(18);
  doc.text("Transaction Report", doc.internal.pageSize.getWidth() / 2, yPosition, {
    align: "center",
  });

  yPosition += 15;
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);

  // Order Transactions Section
  yPosition += 20;
  doc.setFontSize(14);
  doc.text("Order Transactions", 20, yPosition);

  yPosition += 10;
  if (orderTransactions.length > 0) {
    const orderData = [
      ["Order ID", "Date", "Customer Name", "Amount", "Payment Method"],
      ...orderTransactions.map((t) => [
        t.orderId,
        formatDate(t.date),
        t.customerName,
        `₱${t.amount.toFixed(2)}`,
        t.paymentMethod,
      ]),
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [orderData[0]],
      body: orderData.slice(1),
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
      columnStyles: {
        3: { halign: "right" },
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;
  } else {
    doc.setFontSize(10);
    doc.text("No order transactions found for the selected period.", 20, yPosition);
    yPosition += 15;
  }

  // Product Transactions Section
  if (yPosition > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage("l");
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.text("Product Transactions", 20, yPosition);

  yPosition += 10;
  if (productTransactions.length > 0) {
    const productData = [
      ["Date", "Product Name", "Quantity", "Total Cost", "Type"],
      ...productTransactions.map((t) => [
        formatDate(t.date),
        t.productName,
        t.quantity.toString(),
        `₱${t.totalCost.toFixed(2)}`,
        t.type,
      ]),
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [productData[0]],
      body: productData.slice(1),
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });
  } else {
    doc.setFontSize(10);
    doc.text("No product transactions found for the selected period.", 20, yPosition);
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
