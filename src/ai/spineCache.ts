// ============================================================
// CLINICAL SPINE — cache, canonicalisation, and stale detection
// ============================================================
// Stores the Clinical Spine under reports.notes.__clinical_spine__
// and detects when upstream clinical inputs have drifted enough
// that the cached Spine should be re-approved by the clinician.
//
// Hashing is SHA-256 over a CANONICALISED JSON representation:
//   • object keys are sorted recursively
//   • string whitespace is trimmed
//   • undefined/empty-string normalised to null
//   • arrays preserve order
// This prevents false "stale" flags from incidental key-order
// changes in the notes JSONB.
// ============================================================

export type SpineStatus = "draft" | "approved" | "stale";

export interface SpineAnchor {
  id: string;
  label: string;
  evidence: string;
  expected_domains: string[];
}

export interface SpineConsequence {
  id: string;
  label: string;
  linked_anchors: string[];
}

export interface SpineCrossDomainLink {
  anchor_id: string;
  domains: string[];
}

export interface SpineDiagnosisChain {
  diagnosis: string;
  chain: string;
  linked_anchors: string[];
}

export interface ClinicalSpine {
  anchor_impairments: SpineAnchor[];
  recurring_consequences: SpineConsequence[];
  cross_domain_links: SpineCrossDomainLink[];
  diagnosis_function_chains: SpineDiagnosisChain[];
  generated_at: string;
}

export interface SpineCache {
  spine: ClinicalSpine;
  status: SpineStatus;
  approved_at: string | null;
  source_hash: string;
}

export const SPINE_CACHE_KEY = "__clinical_spine__";

// ── Canonicalisation ─────────────────────────────────────────
// Recursively normalises a value into a deterministic shape so
// hashing produces the same result regardless of key order or
// incidental whitespace differences.
export function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.replace(/\r\n?/g, "\n").trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      out[k] = canonicalize(obj[k]);
    }
    return out;
  }
  return null;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

// ── SHA-256 over canonical JSON ──────────────────────────────
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Spine input extraction ───────────────────────────────────
// Pulls ONLY the fields whose changes should invalidate the
// Spine. Recommendations, goals, formatting fields, and the
// spine cache itself are deliberately excluded.
function extractSpineInputs(notes: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Diagnoses
  out.diagnoses = notes?.["__diagnoses__"] ?? null;

  // Assessments — only score-bearing fields, never UI/display fields.
  const assessments = Array.isArray(notes?.["__assessments__"]) ? notes["__assessments__"] : [];
  out.assessments = assessments.map((a: any) => ({
    id: a?.id ?? null,
    library_id: a?.libraryId ?? a?.library_id ?? null,
    name: a?.name ?? null,
    scores: a?.scores ?? null,
    interpretation: a?.interpretation ?? null,
  }));

  // Section 12 raw functional notes — every key shaped like
  // `<domain>__<field>__notes` or `<domain>__<field>__rating`.
  const functional: Record<string, string> = {};
  for (const [k, v] of Object.entries(notes || {})) {
    if (typeof k !== "string") continue;
    if (k.startsWith("__")) continue;
    if (k.endsWith("__notes") || k.endsWith("__rating")) {
      if (typeof v === "string") functional[k] = v;
    }
  }
  out.functional = functional;

  // Top-level section notes (clinician dot-points per section).
  const topLevel: Record<string, string> = {};
  for (const [k, v] of Object.entries(notes || {})) {
    if (typeof k !== "string") continue;
    if (k.startsWith("__")) continue;
    if (k.includes("__")) continue; // skip subsection keys
    if (typeof v === "string" && v.trim()) topLevel[k] = v;
  }
  out.top_level = topLevel;

  // Participant demographics that shape pronoun handling in the spine.
  out.participant = {
    full_name: notes?.["__participant__fullName"] ?? null,
    gender_identity: notes?.["__participant__genderIdentity"] ?? null,
    gender_custom: notes?.["__participant__genderCustom"] ?? null,
    pronouns: notes?.["__participant__pronouns"] ?? null,
  };

  return out;
}

// ── Public API ───────────────────────────────────────────────

export async function computeSpineSourceHash(
  notes: Record<string, any>,
  collateralSnapshot?: unknown
): Promise<string> {
  const payload = {
    notes: extractSpineInputs(notes || {}),
    collateral: collateralSnapshot ?? null,
  };
  return sha256Hex(canonicalJson(payload));
}

export function getSpineCache(notes: Record<string, any>): SpineCache | null {
  const cache = notes?.[SPINE_CACHE_KEY];
  if (!cache || typeof cache !== "object") return null;
  if (!cache.spine || typeof cache.spine !== "object") return null;
  return cache as SpineCache;
}

export async function isSpineStale(
  notes: Record<string, any>,
  collateralSnapshot?: unknown
): Promise<boolean> {
  const cache = getSpineCache(notes);
  if (!cache) return false; // no spine yet — not "stale", just missing
  const fresh = await computeSpineSourceHash(notes, collateralSnapshot);
  return fresh !== cache.source_hash;
}

// Returns a shallow-merged notes object with the spine cache
// flagged stale when upstream inputs have drifted. Pure helper —
// callers decide when to persist the result.
export async function markSpineStaleIfNeeded(
  notes: Record<string, any>,
  collateralSnapshot?: unknown
): Promise<{ notes: Record<string, any>; changed: boolean }> {
  const cache = getSpineCache(notes);
  if (!cache) return { notes, changed: false };
  const stale = await isSpineStale(notes, collateralSnapshot);
  if (!stale) return { notes, changed: false };
  if (cache.status === "stale") return { notes, changed: false };
  const updated: SpineCache = { ...cache, status: "stale" };
  return {
    notes: { ...notes, [SPINE_CACHE_KEY]: updated },
    changed: true,
  };
}

export function buildSpineCacheEntry(
  spine: ClinicalSpine,
  sourceHash: string,
  status: SpineStatus = "draft",
  approvedAt: string | null = null
): SpineCache {
  return { spine, status, approved_at: approvedAt, source_hash: sourceHash };
}
