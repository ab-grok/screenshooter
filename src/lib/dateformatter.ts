import { isDate } from "node:util/types";

export function formatDate(date: number | string | Date): string {
  try {
    date = isDate(date) ? date : new Date(date);
    return new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    })
      .format(date)
      .replace(/\//g, "-");
  } catch {
    return "Null date";
  }
}

export function formatRelativeTime(date: string | Date): string {
  try {
    date = isDate(date) ? date : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDate(date);
  } catch {
    return "Null date";
  }
}

export function truncateHtml(
  html: string | undefined | null,
  maxLength = 150,
): string {
  if (!html) return "";
  // Strip HTML tags for preview
  const textContent = html.replace(/<[^>]*>/g, "").trim();
  if (textContent.length <= maxLength) return textContent;
  return `${textContent.slice(0, maxLength)}...`;
}
