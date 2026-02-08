import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a SUN amount to TRX with 6 decimal places.
 */
export function sunToTrx(sun: number | string): string {
  const sunNum = typeof sun === "string" ? parseInt(sun, 10) : sun;
  return (sunNum / 1_000_000).toFixed(6);
}

/**
 * Truncate an address for display.
 */
export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format a timestamp (ms) to human-readable date.
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Parse JSON safely with a fallback.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
