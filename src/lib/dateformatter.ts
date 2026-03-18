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

    const miliDiff = new Date().getTime() - date.getTime();
    const secDiff = Math.floor(miliDiff / 1000);
    const minDiff = Math.floor(secDiff / 60);
    const hourDiff = Math.floor(minDiff / 60);
    const dayDiff = Math.floor(hourDiff / 24);
    const monthDiff = Math.floor(dayDiff / 30);
    const yearDiff = Math.floor(dayDiff / 365);

    if (yearDiff >= 1) return `${yearDiff} year(s) ago`;
    if (monthDiff >= 1) return `${monthDiff} month(s) ago`;
    if (dayDiff >= 1) return `${dayDiff} day(s) ago`;
    if (hourDiff >= 1) return `${hourDiff} hour(s) ago`;
    if (minDiff >= 1) return `${minDiff} min(s) ago`;
    if (secDiff >= 1) return `${secDiff} sec(s) ago`;

    return "just now";
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
