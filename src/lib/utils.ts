import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deterministic JSON.stringify — sorts object keys recursively so the
 * same data always produces the same string regardless of property
 * insertion order.  Used for cache-key hashing.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k]));
  return "{" + sorted.join(",") + "}";
}

/**
 * Strip common markdown formatting from AI-generated text,
 * leaving clean plain prose suitable for clinical reports.
 */
export function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    // Remove headings (##, ###, etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers — run twice to catch nested/adjacent bold
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // Remove any remaining stray ** or __ markers the above missed
    .replace(/\*{2,}/g, "")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown bullet prefixes (- or *)
    .replace(/^[\s]*[-*]\s+/gm, "")
    // Remove numbered list prefixes (1. 2. etc) but keep the text
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove horizontal rules
    .replace(/^---+$/gm, "")
    // Remove blockquote markers
    .replace(/^>\s?/gm, "")
    // Remove residual sub-area delimiter fragments (<> or <<>>)
    .replace(/^<>?\s*/gm, "")
    .replace(/<<>>/g, "")
    // Remove duplicate "Support level:" lines that appear when the sub-area
    // header already shows the support level and the AI also states it in prose
    .replace(/^<>\s*Support level:\s*[^\n]+\n?/gm, "")
    // Collapse multiple blank lines into one
    .replace(/\n{3,}/g, "\n\n")
    // Strip trailing Section 34 boilerplate that the AI sometimes appends
    .replace(/\s*This support is considered reasonable and necessary under Section 34 of the NDIS Act 2013\.?\s*$/gi, "")
    .trim();
}
