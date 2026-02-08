"use client";

import { useEffect, useState } from "react";

type Issue = {
  id: string;
  order_id: string | null;
  basket_number: number | null;
  description: string;
  status: "open" | "resolved" | "cancelled";
  severity: "low" | "medium" | "high" | "critical";
  reported_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  resolved_by_name?: string;
};

type SortConfig = {
  key: keyof Issue;
  direction: "asc" | "desc";
};

export default function IssuesPage() {
  const [rows, setRows] = useState<Issue[]>([]);
  const [filteredRows, setFilteredRows] = useState<Issue[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"open" | "resolved" | "cancelled">(
    "open",
  );
  const [updating, setUpdating] = useState(false);

  const ROWS_PER_PAGE = 10;

  useEffect(() => {
    load();
  }, []);

  // Apply search and filters
  useEffect(() => {
    const timer = setTimeout(() => {
      let result = rows;

      // Status filter
      if (filterStatus !== "all") {
        result = result.filter((issue) => issue.status === filterStatus);
      }

      // Severity filter
      if (filterSeverity !== "all") {
        result = result.filter((issue) => issue.severity === filterSeverity);
      }

      // Search
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        result = result.filter((issue) => {
          return (
            issue.description.toLowerCase().includes(query) ||
            (issue.order_id?.toLowerCase().includes(query) ?? false) ||
            String(issue.basket_number).includes(query)
          );
        });
      }

      // Sort
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(String(bVal));
          return sortConfig.direction === "asc" ? cmp : -cmp;
        } else if (typeof aVal === "number") {
          return sortConfig.direction === "asc"
            ? aVal - (bVal as number)
            : (bVal as number) - aVal;
        }
        return 0;
      });

      setFilteredRows(result);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, rows, sortConfig, filterStatus, filterSeverity]);

  async function updateIssueStatus(
    issueId: string,
    status: "open" | "resolved" | "cancelled",
  ) {
    setUpdating(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/manage/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded ${res.status}`);
      }

      await load();
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to update issue status",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/manage/issues");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      setRows(data.issues || []);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const paginatedRows = filteredRows.slice(startIdx, endIdx);

  const handleSort = (key: keyof Issue) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ key, direction: "asc" });
    }
  };

  const SortIcon = ({ field }: { field: keyof Issue }) => {
    if (sortConfig.key !== field)
      return <span className="text-gray-300">⇅</span>;
    return <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "resolved":
        return "bg-green-100 text-green-800 border-green-300";
      case "cancelled":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Issues Report</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {filteredRows.length} issue
              {filteredRows.length !== 1 ? "s" : ""} found
              {filteredRows.length > ROWS_PER_PAGE && (
                <>
                  {" "}
                  • Page {currentPage} of{" "}
                  {Math.ceil(filteredRows.length / ROWS_PER_PAGE)}
                </>
              )}
            </p>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search by description, order ID, basket number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />

          <div className="flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8 text-gray-600">
            Loading issues...
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort("created_at")}
                        className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                      >
                        Created <SortIcon field="created_at" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort("description")}
                        className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                      >
                        Description <span className="text-red-600">*</span>{" "}
                        <SortIcon field="description" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Resolved By
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                      >
                        Status <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Basket
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort("resolved_at")}
                        className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                      >
                        Resolved <SortIcon field="resolved_at" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-gray-500 text-sm"
                      >
                        No issues found
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((issue) => (
                      <tr
                        key={issue.id}
                        className="border-b border-gray-200 hover:bg-gray-50 transition"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatDate(issue.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div
                            className="max-w-xs truncate"
                            title={issue.description}
                          >
                            {issue.description}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {issue.customer_name ? (
                            <div>
                              <div className="font-medium">
                                {issue.customer_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {issue.customer_phone || "—"}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {issue.resolved_by_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingId === issue.id ? (
                            <select
                              value={newStatus}
                              onChange={(e) =>
                                setNewStatus(
                                  e.target.value as
                                    | "open"
                                    | "resolved"
                                    | "cancelled",
                                )
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="open">Open</option>
                              <option value="resolved">Resolved</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer hover:shadow-md transition ${getStatusColor(
                                issue.status,
                              )}`}
                              onClick={() => {
                                setEditingId(issue.id);
                                setNewStatus(issue.status);
                              }}
                            >
                              {issue.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-center">
                          {issue.basket_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatDate(issue.resolved_at)}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {editingId === issue.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  updateIssueStatus(issue.id, newStatus)
                                }
                                disabled={updating}
                                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 transition"
                              >
                                {updating ? "..." : "Save"}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={updating}
                                className="px-3 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 disabled:opacity-50 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(issue.id);
                                setNewStatus(issue.status);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ← Previous
                </button>
                <span className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
