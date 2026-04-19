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
    // Remove bold/italic markers (run twice to catch adjacent bold blocks)
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\*{2,}/g, "")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
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
    // Remove residual <<SUB_AREA:>> delimiter artifacts and any leaked "Support level: ..." lines
    .replace(/^[\s<>]*support level\s*:\s*[^\n]*\n?/gim, "")
    .replace(/^<>?\s*/gm, "")
    .replace(/<<>>/g, "")
    // Collapse multiple blank lines into one
    .replace(/\n{3,}/g, "\n\n")
    // Strip trailing Section 34 boilerplate that the AI sometimes appends
    .replace(/\s*This support is considered reasonable and necessary under Section 34 of the NDIS Act 2013\.?\s*$/gi, "")
    .trim();
}

/**
 * Strip markdown code fences and preamble/postamble from a JSON-like string.
 *
 * The AI occasionally wraps its JSON output in ```json ... ``` fences, or
 * prepends a natural-language preamble ("Here is the JSON:"), or adds
 * trailing commentary. Passing raw output straight to JSON.parse fails
 * silently in those cases, which causes the downstream UI to render the
 * entire blob (fences and all) as literal prose — this is the "raw JSON
 * leaking into the report" bug seen when domain sections return
 * ```json\n{...}\n``` wrapped output.
 *
 * This helper handles:
 *  - Leading/trailing whitespace
 *  - ```json, ```JSON, or bare ``` fences (with optional newline)
 *  - Leading prose before the first `{` (brace-bounded fallback)
 *  - Trailing prose after the last `}` (brace-bounded fallback)
 *
 * Pass the result to JSON.parse. If parse still fails, the string was
 * genuinely malformed, not just fenced.
 */
export function stripJsonFences(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;
  let cleaned = raw.trim();
  // Remove leading ```json / ```JSON / ``` (with optional trailing newline)
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/i, "");
  // Remove trailing ``` (with optional leading newline)
  cleaned = cleaned.replace(/\n?```\s*$/i, "");
  cleaned = cleaned.trim();
  // Brace-bounded fallback: if there's non-JSON text surrounding a JSON
  // object, extract the {...} region. Handles cases like the AI prepending
  // "Here is the JSON:" or appending "Hope this helps!".
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace > 0 || (firstBrace >= 0 && lastBrace < cleaned.length - 1)) {
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }
  return cleaned;
}
