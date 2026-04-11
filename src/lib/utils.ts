import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
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
    // Collapse multiple blank lines into one
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
