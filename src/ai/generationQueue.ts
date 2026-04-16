// ============================================================
// GENERATION QUEUE — Token-aware throttled AI generation
// ============================================================
// Stays under Anthropic's per-minute input-token rate limit by:
// 1. Maintaining a 60-second sliding-window token budget
// 2. Reserving budget before every call; pausing when the window is full
// 3. Exponential backoff + retry-after honouring on 429s
// 4. Skipping items whose input hasn't changed (dirty-check)
// 5. Preventing duplicate in-flight calls for the same key
// ============================================================

import { kotobaSupabase as supabase } from "@/integrations/supabase/kotobaClient";
import { stripMarkdown } from "@/lib/utils";

// ── Token budget (sliding window) ───────────────────────────
// 90% of Anthropic's 30k input-tokens-per-minute rate limit for this org
// leaves headroom for estimator error and cached-prefix variability.
const TPM_LIMIT = 27000;
const WINDOW_MS = 60_000;
const CACHED_PREFIX_TOKENS = 9000; // 3 docx templates + rule blocks in generate-report
const recentCalls: { at: number; tokens: number }[] = [];

const STORAGE_KEY = "kotoba_input_hashes";

// ── Report-scoped hash cache (localStorage-backed) ──────────
let currentReportId: string | null = null;

export function setHashCacheReportId(reportId: string): void {
  currentReportId = reportId;
}

function prefixKey(key: string): string {
  return currentReportId ? `${currentReportId}:${key}` : key;
}

function normalizeHashInput(input: string): string {
  return input.replace(/\r\n?/g, "\n").trim();
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

function getCachedHash(cache: Map<string, string>, key: string): string | undefined {
  const scopedKey = prefixKey(key);
  const scopedValue = cache.get(scopedKey);
  if (scopedValue !== undefined) {
    return scopedValue;
  }

  if (!currentReportId) {
    return undefined;
  }

  const legacyValue = cache.get(key);
  if (legacyValue !== undefined) {
    cache.set(scopedKey, legacyValue);
    cache.delete(key);
    saveCache(cache);
  }

  return legacyValue;
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
  const cache = loadCache();
  const hash = simpleHash(normalizeHashInput(input));
  const prev = getCachedHash(cache, key);
  return prev !== hash;
}

export function markInputGenerated(key: string, input: string): void {
  const cache = loadCache();
  cache.set(prefixKey(key), simpleHash(normalizeHashInput(input)));
  if (currentReportId) {
    cache.delete(key);
  }
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
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Token estimator ─────────────────────────────────────────
// Rough estimator: cached prefix tokens + (dynamic body + prompt) / 4 chars-per-token.
// Conservative enough to keep us under the per-minute cap without needing the
// real tokenizer on the client.
function estimateInputTokens(prompt: string, extraBody?: Record<string, any>): number {
  const dynamicChars = JSON.stringify(extraBody || {}).length + (prompt?.length || 0);
  return CACHED_PREFIX_TOKENS + Math.ceil(dynamicChars / 4);
}

// ── Reserve token budget in the sliding window ──────────────
// Pauses until there is room in the last-60-seconds window for `tokens`.
// Records the reservation once granted so subsequent callers see updated usage.
async function reserveBudget(tokens: number, label?: string): Promise<void> {
  while (true) {
    const now = Date.now();
    while (recentCalls.length && now - recentCalls[0].at > WINDOW_MS) {
      recentCalls.shift();
    }
    const inWindow = recentCalls.reduce((s, r) => s + r.tokens, 0);
    if (inWindow + tokens <= TPM_LIMIT) {
      recentCalls.push({ at: now, tokens });
      return;
    }
    const oldest = recentCalls[0]?.at ?? now;
    const waitMs = Math.max(1000, oldest + WINDOW_MS - now + 500);
    console.log(
      `[QUEUE] throttle${label ? ` "${label}"` : ""}: ${inWindow} tokens in window, ` +
      `need ${tokens}, waiting ${waitMs}ms`
    );
    await sleep(waitMs);
  }
}

// ── Extract retry-after hint from error messages ────────────
function parseRetryAfterMs(errMsg: string): number | null {
  // Anthropic 429 responses sometimes include "retry after X seconds" in the body
  // or a literal header value surfaced via the supabase client error.message.
  const m = errMsg.match(/retry[- ]?after[:\s"]+(\d+(?:\.\d+)?)/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return null;
}

// ── Single invoke with exponential backoff on 429 ───────────
async function invokeWithRetry(
  prompt: string,
  maxTokens: number,
  label: string,
  extraBody?: Record<string, any>,
): Promise<{ success: boolean; text?: string; name_warnings?: string[]; error?: string }> {
  const BACKOFF_SCHEDULE = [5000, 15000, 30000]; // attempt 1 wait, attempt 2 wait, attempt 3 wait
  const estimated = estimateInputTokens(prompt, extraBody);

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

  let lastError = "";
  for (let attempt = 0; attempt <= BACKOFF_SCHEDULE.length; attempt++) {
    const r = await doCall();
    if (!r.error) {
      return { success: true, text: r.data?.text, name_warnings: r.data?.name_warnings };
    }
    lastError = r.error;

    if (!r.is429 || attempt >= BACKOFF_SCHEDULE.length) {
      return { success: false, error: r.error };
    }

    const retryAfter = parseRetryAfterMs(r.error);
    const waitMs = retryAfter ?? BACKOFF_SCHEDULE[attempt];
    console.log(
      `[QUEUE] 429 for "${label}" — attempt ${attempt + 1}/${BACKOFF_SCHEDULE.length + 1}, ` +
      `waiting ${waitMs}ms${retryAfter ? " (from retry-after)" : ""}`,
    );
    await sleep(waitMs);
    // Re-reserve budget — the previous reservation has likely aged out, but this
    // also accounts for the retry's own token cost in the sliding window.
    await reserveBudget(estimated, `${label} retry`);
  }

  return { success: false, error: lastError || "Retry failed after 429" };
}

// ── Process queue with token-aware throttling ───────────────
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

    // 2. Check if input unchanged (before reserving any budget)
    if (!hasInputChanged(item.key, item.inputForHash)) {
      console.log(`[QUEUE] SKIP (unchanged): "${item.label}"`);
      onProgress?.(i + 1, total, item.label, "skipped (unchanged)");
      results.push({ key: item.key, success: true, skipped: true, skipReason: "unchanged" });
      continue;
    }

    // 3. Reserve token budget before invoking
    const estimated = estimateInputTokens(item.prompt, item.extraBody);
    await reserveBudget(estimated, item.label);

    // 4. Mark in-flight and generate
    inFlight.add(item.key);
    console.log(`[QUEUE] START (${i + 1}/${total}): "${item.label}" (~${estimated} est tokens)`);
    onProgress?.(i + 1, total, item.label, "generating");

    try {
      const result = await invokeWithRetry(item.prompt, item.maxTokens, item.label, item.extraBody);

      if (result.success && result.text) {
        const isDomainJson = item.key.startsWith("section12_");
        let finalText: string;

        if (isDomainJson) {
          // Domain sections return JSON with per-field keys. Parse and clean each
          // field; fall back to plain stripMarkdown if parsing fails.
          try {
            const rawText = result.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
            const parsed = JSON.parse(rawText) as Record<string, string>;
            const cleaned: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsed)) cleaned[k] = stripMarkdown(v || "");
            finalText = JSON.stringify(cleaned);
          } catch (parseErr) {
            console.warn(`[QUEUE] Domain JSON parse failed for "${item.label}"`, parseErr);
            finalText = stripMarkdown(result.text);
          }
        } else {
          finalText = stripMarkdown(result.text);
        }

        markInputGenerated(item.key, item.inputForHash);
        console.log(`[QUEUE] SUCCESS: "${item.label}" (${finalText.length} chars)`);
        results.push({
          key: item.key,
          success: true,
          text: finalText,
          name_warnings: result.name_warnings,
        });
      } else if (result.success) {
        markInputGenerated(item.key, item.inputForHash);
        results.push({
          key: item.key,
          success: true,
          text: result.text,
          name_warnings: result.name_warnings,
        });
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
