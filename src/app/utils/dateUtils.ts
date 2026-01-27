/**
 * Format UTC datetime string and convert to Philippines Standard Time (PST, UTC+8)
 * @param utcDateString - UTC datetime string from database
 * @returns Formatted datetime string in PST
 */
export function formatToPST(utcDateString: string | null): string {
  if (!utcDateString) return "-";

  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) return "-";

    // Use Intl.DateTimeFormat with Manila timezone (Asia/Manila = UTC+8)
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });

    return formatter.format(date);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}

/**
 * Format UTC datetime string to date only in Philippines Standard Time (PST, UTC+8)
 * @param utcDateString - UTC datetime string from database
 * @returns Formatted date string in PST
 */
export function formatDateToPST(utcDateString: string | null): string {
  if (!utcDateString) return "-";

  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) return "-";

    // Use Intl.DateTimeFormat with Manila timezone (Asia/Manila = UTC+8)
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Manila",
    });

    return formatter.format(date);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}
