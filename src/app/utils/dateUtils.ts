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

    // Add 8 hours to convert from UTC to PST (UTC+8)
    const pstDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    return formatter.format(pstDate);
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

    // Add 8 hours to convert from UTC to PST (UTC+8)
    const pstDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return formatter.format(pstDate);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}
