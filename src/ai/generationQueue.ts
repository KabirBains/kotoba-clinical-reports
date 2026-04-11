// ============================================================
// GENERATION QUEUE — Sequential, throttled AI generation
// ============================================================
// Prevents 429 rate limits by:
// 1. Processing requests sequentially with a configurable delay
// 2. Retrying once on 429 after a longer backoff
// 3. Skipping items whose input hasn't changed (dirty-check)
// 4. Preventing duplicate in-flight calls for the same key
// ============================================================

import { kotobaSupabase as supabase } from "@/integrations/supabase/kotobaClient";
import { stripMarkdown } from "@/lib/utils";

const INTER_REQUEST_DELAY = 12000; // ms between requests
const RETRY_429_DELAY = 20000;     // ms to wait on 429 before single retry
const STORAGE_KEY = "kotoba_input_hashes";

// ── Report-scoped hash cache (localStorage-backed) ──────────
let currentReportId: string | null = null;

export function setHashCacheReportId(reportId: string): void {
  currentReportId = reportId;
}

function prefixKey(key: string): string {
  return currentReportId ? `${currentReportId}:${key}` : key;
}

function loadCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveCache(cache: Map<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    // storage full or unavailable — ignore
  }
}

// ── In-flight tracking ──────────────────────────────────────
const inFlight = new Set<string>();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return String(hash);
}

export function hasInputChanged(key: string, input: string): boolean {
  const hash = simpleHash(input);
  const cache = loadCache();
  const prev = cache.get(prefixKey(key));
  if (prev === hash) return false;
  return true;
}

export function markInputGenerated(key: string, input: string): void {
  const cache = loadCache();
  cache.set(prefixKey(key), simpleHash(input));
  saveCache(cache);
}

export function clearInputCache(): void {
  if (!currentReportId) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const cache = loadCache();
  const prefix = `${currentReportId}:`;
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) {
      cache.delete(k);
    }
  }
  saveCache(cache);
}

// ── Queue item type ─────────────────────────────────────────
export interface QueueItem {
  key: string;          // unique identifier (e.g. "section12_1", "rec_abc123")
  prompt: string;       // the AI prompt
  maxTokens: number;
  inputForHash: string; // raw input text to hash for dirty-check
  label: string;        // human-readable label for logs/toasts
  extraBody?: Record<string, any>; // additional fields to pass to the edge function
}

export interface QueueResult {
  key: string;
  success: boolean;
  text?: string;
  name_warnings?: string[];
  refined?: boolean;
  refineWarnings?: string[];
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Refine a generated section ──────────────────────────────
async function refineText(
  generatedText: string,
  sectionName: string,
  participantName?: string,
  participantFirstName?: string
): Promise<{ refined_text: string; warnings?: string[] } | null> {
  try {
    console.log(`REFINE: calling refine-report for "${sectionName}"...`, {
      generated_text_length: generatedText.length,
      participant_name: participantName,
      participant_first_name: participantFirstName,
    });
    const { data, error } = await supabase.functions.invoke("refine-report", {
      method: "POST",
      body: {
        generated_text: generatedText,
        section_name: sectionName,
        ...(participantName ? { participant_name: participantName } : {}),
        ...(participantFirstName ? { participant_first_name: participantFirstName } : {}),
      },
    });
    console.log(`REFINE: response received for "${sectionName}"`, { data, error });
    if (error) {
      console.error(`REFINE: refine-report failed for "${sectionName}":`, error);
      return null;
    }
    if (!data?.refined_text) {
      console.error(`REFINE: refine-report returned no refined_text for "${sectionName}":`, data);
      return null;
    }
    return { refined_text: data.refined_text, warnings: data.warnings };
  } catch (err) {
    console.error(`REFINE: refine-report exception for "${sectionName}":`, err);
    return null;
  }
}

// ── Single invoke with 429 retry ────────────────────────────
async function invokeWithRetry(prompt: string, maxTokens: number, label: string, extraBody?: Record<string, any>): Promise<{ success: boolean; text?: string; name_warnings?: string[]; error?: string }> {
  const doCall = async () => {
    const { data, error } = await supabase.functions.invoke("generate-report", {
      body: { prompt, max_tokens: maxTokens, ...extraBody },
    });
    if (error) {
      const errMsg = error.message || "";
      if (errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("Rate")) {
        return { is429: true, data: null, error: errMsg };
      }
      return { is429: false, data: null, error: errMsg };
    }
    if (!data?.success) {
      const detail = data?.details || data?.error || "";
      if (detail.includes("429") || detail.includes("rate")) {
        return { is429: true, data: null, error: detail };
      }
      return { is429: false, data: null, error: data?.error || "Generation failed" };
    }
    return { is429: false, data, error: null };
  };

  // First attempt
  const r1 = await doCall();
  if (!r1.error) return { success: true, text: r1.data?.text, name_warnings: r1.data?.name_warnings };

  if (r1.is429) {
    console.log(`[QUEUE] 429 rate limit for "${label}" — waiting ${RETRY_429_DELAY}ms before retry`);
    await sleep(RETRY_429_DELAY);
    console.log(`[QUEUE] Retrying "${label}" after 429 backoff`);
    const r2 = await doCall();
    if (!r2.error) return { success: true, text: r2.data?.text, name_warnings: r2.data?.name_warnings };
    console.error(`[QUEUE] Retry failed for "${label}":`, r2.error);
    return { success: false, error: r2.error || "Retry failed after 429" };
  }

  return { success: false, error: r1.error };
}

// ── Process queue sequentially ──────────────────────────────
export async function processQueue(
  items: QueueItem[],
  onProgress?: (step: number, total: number, label: string, status: string) => void,
): Promise<QueueResult[]> {
  const results: QueueResult[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 1. Check if already in-flight
    if (inFlight.has(item.key)) {
      console.log(`[QUEUE] SKIP (in-flight): "${item.label}"`);
      onProgress?.(i + 1, total, item.label, "skipped (already generating)");
      results.push({ key: item.key, success: false, skipped: true, skipReason: "already generating" });
      continue;
    }

    // 2. Check if input unchanged
    if (!hasInputChanged(item.key, item.inputForHash)) {
      console.log(`[QUEUE] SKIP (unchanged): "${item.label}"`);
      onProgress?.(i + 1, total, item.label, "skipped (unchanged)");
      results.push({ key: item.key, success: true, skipped: true, skipReason: "unchanged" });
      continue;
    }

    // 3. Add inter-request delay (except for first item)
    if (i > 0) {
      await sleep(INTER_REQUEST_DELAY);
    }

    // 4. Mark in-flight and generate
    inFlight.add(item.key);
    console.log(`[QUEUE] START (${i + 1}/${total}): "${item.label}"`);
    onProgress?.(i + 1, total, item.label, "generating");

    try {
      const result = await invokeWithRetry(item.prompt, item.maxTokens, item.label, item.extraBody);
      if (result.success && result.text) {
        const sectionName = item.extraBody?.section_name || item.key;
        const isDomainJson = item.key.startsWith("section12_");

        let finalText = result.text;
        let refined = false;
        let refineWarnings: string[] | undefined;

        if (isDomainJson) {
          // Domain sections return JSON with per-field keys.
          // Refine each field value individually to preserve structure.
          onProgress?.(i + 1, total, item.label, "refining");
          try {
            const rawText = result.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
            const parsed = JSON.parse(rawText) as Record<string, string>;
            const refinedObj: Record<string, string> = {};
            let anyRefined = false;
            const allWarnings: string[] = [];

            for (const [fieldKey, fieldText] of Object.entries(parsed)) {
              if (!fieldText || fieldText.length < 20) {
                refinedObj[fieldKey] = fieldText;
                continue;
              }
              const fieldRefine = await refineText(
                fieldText,
                `${sectionName}_${fieldKey}`,
                item.extraBody?.participant_name,
                item.extraBody?.participant_first_name
              );
              if (fieldRefine?.refined_text) {
                refinedObj[fieldKey] = stripMarkdown(fieldRefine.refined_text);
                anyRefined = true;
                if (fieldRefine.warnings?.length) allWarnings.push(...fieldRefine.warnings);
              } else {
                refinedObj[fieldKey] = stripMarkdown(fieldText);
              }
            }

            finalText = JSON.stringify(refinedObj);
            refined = anyRefined;
            refineWarnings = allWarnings.length > 0 ? allWarnings : undefined;
          } catch (parseErr) {
            console.warn(`[QUEUE] Domain JSON parse failed for refine, skipping per-field refinement`, parseErr);
            // Fall back: refine as plain text (original behaviour)
            const refineResult = await refineText(
              result.text, sectionName,
              item.extraBody?.participant_name,
              item.extraBody?.participant_first_name
            );
            finalText = stripMarkdown(refineResult?.refined_text || result.text);
            refined = !!refineResult?.refined_text;
            refineWarnings = refineResult?.warnings;
          }
        } else {
          // Non-domain sections: refine as a single block of text
          onProgress?.(i + 1, total, item.label, "refining");
          const refineResult = await refineText(
            result.text, sectionName,
            item.extraBody?.participant_name,
            item.extraBody?.participant_first_name
          );
          finalText = stripMarkdown(refineResult?.refined_text || result.text);
          refined = !!refineResult?.refined_text;
          refineWarnings = refineResult?.warnings;
        }

        markInputGenerated(item.key, item.inputForHash);
        console.log(`[QUEUE] SUCCESS: "${item.label}" (${finalText.length} chars, refined: ${refined})`);
        results.push({
          key: item.key,
          success: true,
          text: finalText,
          name_warnings: result.name_warnings,
          refined,
          refineWarnings,
        });
      } else if (result.success) {
        markInputGenerated(item.key, item.inputForHash);
        results.push({ key: item.key, success: true, text: result.text, name_warnings: result.name_warnings });
      } else {
        console.error(`[QUEUE] FAILED: "${item.label}" — ${result.error}`);
        results.push({ key: item.key, success: false, error: result.error });
      }
    } catch (err: any) {
      console.error(`[QUEUE] ERROR: "${item.label}" —`, err);
      results.push({ key: item.key, success: false, error: err?.message || "Unknown error" });
    } finally {
      inFlight.delete(item.key);
    }
  }

  return results;
}

// Export refineText for use in individual section generators
export { refineText };
