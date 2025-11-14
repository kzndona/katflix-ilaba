"use client";

import { useState } from "react";

export default function OrdersPage() {
  const [orders, setOrders] = useState([
    {
      id: 1,
      customer: "Juan Dela Cruz",
      service: "Wash & Fold",
      status: "In Progress",
      total: 150,
    },
    {
      id: 2,
      customer: "Maria Santos",
      service: "Dry Clean",
      status: "Completed",
      total: 200,
    },
  ]);

  return <div className="p-6 space-y-6">Staff</div>;
}
