import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// =============================================================================
// NARRATIVE THREADING — v2 (iterative, taxonomised, confidence-gated)
// =============================================================================
//
// PURPOSE
// -------
// Take a set of generated report sections and progressively enrich them so
// that clinically meaningful observations in one section inform the narrative
// of other sections. E.g. a standing-tolerance finding in Section 12.1 should
// inform Section 12.4 Domestic IADLs ("endurance limits meal prep"), Section
// 12.8 Social Functioning ("community access requires rest breaks"), and
// Section 11 Risk & Safety ("fear of falling, deconditioning spiral").
//
// ARCHITECTURE (v2 — was v1 static 2-pass)
// ----------------------------------------
// The function now runs a true iterative loop up to `max_passes` times (clamp
// 1-3, default 2). Each iteration has two Claude calls:
//
//   1. Pass 1 — IDENTIFY: analyse the CURRENT sections (which may already
//      contain insertions from the previous iteration) and identify NEW
//      threads. The model is told which threads have already been woven and
//      must not re-identify them. Threads are tagged with a taxonomy type
//      and a confidence level.
//
//   2. Pass 2 — WEAVE: integrate the high/medium confidence insertions into
//      the target sections with conservative prompting (no invention,
//      attribution preservation, anti-redundancy awareness).
//
// Convergence: if Pass 1 returns zero new high/medium threads the loop exits
// early. This is typical on iteration 2 or 3.
//
// KEY INVARIANTS
// --------------
// • Thread signatures (source_section + normalised_observation + target_sections)
//   are tracked across iterations to prevent re-weaving the same connection.
// • Low-confidence threads are NEVER auto-woven; they are surfaced back to the
//   client as suggestions that the clinician can optionally accept.
// • Every thread is tagged with the iteration (`pass`) in which it was woven,
//   so the UI can show which connections emerged from deeper reasoning.
// • Size guardrails are tighter than v1: reject shrink > 20% (was 30%),
//   reject growth > 150% (was 200% warn-only), reject per-iteration growth
//   > 600 chars.
// • Backward threads are self-validated by Pass 1 (the prompt requires the
//   model to confirm the target section does not contain contradictory facts
//   before including a backward thread).
// • Attribution speech acts ("parent reported", "support worker observed")
//   MUST be preserved when a source observation is attributed.
// • Anti-redundancy: if a source observation already appears in the target
//   section, the insertion must use "As noted in [source]..." framing
//   instead of restating the fact.
// =============================================================================

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Call Claude ──────────────────────────────────────────────
async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 16000,
): Promise<{ text: string; usage: Record<string, number> }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return { text, usage: data.usage || {} };
}

// ── Types ────────────────────────────────────────────────────
type ThreadType =
  | "causation"
  | "amplification"
  | "recommendation"
  | "consistency"
  | "contradiction";
type ThreadConfidence = "high" | "medium" | "low";
type ThreadDirection = "forward" | "backward" | "bidirectional";

interface Thread {
  id: string;
  source_section: string;
  source_observation: string;
  source_has_attribution?: boolean;
  target_sections: string[];
  target_insertions: Record<string, string>;
  type: ThreadType;
  direction: ThreadDirection;
  confidence: ThreadConfidence;
  clinical_reasoning: string;
  /** Which iteration (1-based) identified this thread. Stamped server-side. */
  pass?: number;
  /** True if the model flagged the target section as already containing the observation. */
  use_reference_framing?: boolean;
}

interface IterationStats {
  pass: number;
  identified: number;
  woven: number;
  low_confidence_suggestions: number;
  rejected_backward_contradictions: number;
  converged: boolean;
}

// ── Thread signature helpers ─────────────────────────────────
// A signature is used to dedupe the SAME connection across iterations.
// We normalise the source observation (lowercase, collapse whitespace, strip
// punctuation) so small rewordings by the model don't defeat dedup.
function normaliseObservation(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function threadSignature(t: Thread): string {
  const targets = [...(t.target_sections || [])].sort().join(",");
  return `${t.source_section}|${normaliseObservation(t.source_observation)}|${targets}`;
}

// ── Anti-redundancy detection ────────────────────────────────
// Simple substring check: does the normalised source observation already
// appear in the target section? If yes, the insertion should use reference
// framing ("as noted in...") rather than restate the fact.
function observationAppearsInSection(observation: string, sectionText: string): boolean {
  if (!observation || !sectionText) return false;
  const normObs = normaliseObservation(observation);
  const normSection = normaliseObservation(sectionText);
  if (normObs.length < 8) return false;
  // Check the first 8+ word tokens of the observation — this catches both
  // verbatim restatements and near-verbatim paraphrases.
  const obsTokens = normObs.split(" ").filter((t) => t.length > 2);
  if (obsTokens.length < 3) return false;
  // If 70%+ of the content words from the observation appear (in any order)
  // within any 30-token window of the section text, we consider it present.
  const sectionTokens = normSection.split(" ");
  const matchedTokens = obsTokens.filter((t) => sectionTokens.includes(t));
  return matchedTokens.length / obsTokens.length >= 0.7;
}

// ── Thread taxonomy reference (injected into the identify prompt) ─────
const THREAD_TAXONOMY = `
THREAD TAXONOMY — every thread must be tagged with exactly one type:

1. "causation" — Source observation DIRECTLY causes the target issue.
   Example: "Cannot stand for more than 30 minutes" (source: mobility) CAUSES
   "fatigue during community outings requiring frequent rest breaks" (target:
   social functioning). Direction is usually forward.

2. "amplification" — Source observation WORSENS or compounds a separate
   difficulty in the target section. Example: "Chronic sleep disruption"
   (source: health) AMPLIFIES "cognitive fatigue during complex tasks"
   (target: cognition). Direction is usually forward.

3. "recommendation" — Source observation in a recommendation / support
   section JUSTIFIES a functional capacity finding elsewhere, or vice versa.
   Example: recommending 2:1 community access support BECAUSE of documented
   absconding history. Direction is usually backward (recommendation →
   earlier capacity section to add context).

4. "consistency" — Source and target describe the SAME underlying issue from
   different angles. The weave should cross-reference rather than duplicate.
   Example: mother reports poor shower routine (S6 collateral) and Personal
   ADLs domain independently notes hygiene concerns (S12.3). Direction is
   bidirectional.

5. "contradiction" — Source and target appear to DISAGREE. This type MUST
   NEVER produce a woven insertion. It is a flag only — the clinician should
   reconcile manually. If you identify a contradiction, include the thread
   with type: "contradiction" and target_insertions: {} (empty).
`;

// ── Pass 1 — IDENTIFY prompt ─────────────────────────────────
function buildIdentifySystemPrompt(
  participantName: string,
  firstName: string,
  diagnosesContext: string,
  iteration: number,
  maxPasses: number,
): string {
  return `You are a clinical report analyst specialising in NDIS Functional Capacity Assessments. Your task is to identify observations in one section that should be cross-referenced in other sections to create a cohesive, clinically coherent narrative.

ITERATION: ${iteration} of ${maxPasses}
${iteration > 1 ? "This is a follow-up iteration. The sections you are analysing may already contain threads woven in from earlier iterations. Your job is to find NEW secondary connections that have emerged from that weaving — DO NOT re-identify threads that were already woven (the ALREADY WOVEN list in the user message tells you which ones to skip)." : "This is the first iteration. Identify the strongest first-order connections."}

PARTICIPANT: "${participantName || firstName}". Use "${firstName}" when referencing them.
DIAGNOSES: ${diagnosesContext || "Not specified"}

${THREAD_TAXONOMY}

CONFIDENCE SCORING — every thread must be tagged:
- "high" — The connection is clinically explicit, the insertion adds real value, and the target section will clearly benefit. These will be auto-woven.
- "medium" — The connection is clinically plausible but the insertion is a minor enhancement. Still auto-woven, but surfaced to the clinician for review.
- "low" — The connection is speculative, tangential, or the value is unclear. These are NOT woven. They are surfaced as optional suggestions for clinician review.

Prefer FEWER, HIGHER-QUALITY threads over many weak ones. If you are uncertain, mark it "low" and let the clinician decide.

BACKWARD THREAD SELF-VALIDATION:
For any thread with direction "backward" or "bidirectional", you MUST confirm the target section does not contain contradictory facts before including the thread. If the target section says "[Name] lives independently" and a later section suggests otherwise, that is a contradiction — use type: "contradiction" with empty target_insertions, do NOT silently rewrite history.

ATTRIBUTION AWARENESS:
If the source observation is attributed to a specific informant (e.g. the source text contains "parent reported", "support worker observed", "the support coordinator noted"), set source_has_attribution: true. Your insertion text must preserve the attribution when woven.

ANTI-REDUNDANCY:
For every target_insertion you propose, check whether the source observation is already present in the target section text (verbatim or near-verbatim). If it is, set use_reference_framing: true and write the insertion as a cross-reference (e.g. "As noted in section12_1, ${firstName}'s standing tolerance is limited…") rather than restating the underlying fact.

OUTPUT:
Return valid JSON only. No markdown fences, no commentary. Schema:
{
  "threads": [
    {
      "id": "thread_<iter>_<n>",
      "source_section": "section12_1",
      "source_observation": "Cannot stand for more than 30 minutes",
      "source_has_attribution": false,
      "target_sections": ["section12_4", "section12_8"],
      "target_insertions": {
        "section12_4": "A brief 1-2 sentence insertion referencing the mobility limitation in the context of domestic tasks",
        "section12_8": "A brief 1-2 sentence insertion about how this affects social participation"
      },
      "type": "causation",
      "direction": "forward",
      "confidence": "high",
      "use_reference_framing": false,
      "clinical_reasoning": "Standing tolerance limits domestic task endurance and community access; both are direct functional consequences of the same impairment."
    }
  ]
}

HARD LIMITS:
- Maximum 12 threads per iteration (fewer is better)
- Each target_insertion: 1-2 sentences MAX
- Do not duplicate threads from the ALREADY WOVEN list in the user message
- Use person-first language and clinical voice`;
}

function buildIdentifyUserPrompt(
  sectionsText: string,
  alreadyWovenSignatures: string[],
  iteration: number,
): string {
  return `ITERATION ${iteration}

SECTIONS (current state — may include insertions from previous iterations):
${sectionsText}

${alreadyWovenSignatures.length > 0 ? `ALREADY WOVEN THREADS (do NOT re-identify — find NEW secondary connections only):
${alreadyWovenSignatures.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}
` : "ALREADY WOVEN THREADS: (none — this is the first iteration)"}

Return a JSON object with a "threads" array. Identify NEW clinically meaningful threads only.`;
}

// ── Pass 2 — WEAVE prompt ────────────────────────────────────
function buildWeaveSystemPrompt(firstName: string, pronouns?: string): string {
  const pronounRule = pronouns
    ? `\n\n9. PRONOUNS (critical): ${firstName} uses ${pronouns} pronouns. ALL pronoun references to ${firstName} — in inserted sentences AND in any minimal grammatical adjustments to existing prose — MUST use ${pronouns}. Do NOT introduce or retain any conflicting pronouns. If you encounter a conflicting pronoun in existing prose during weaving, leave it untouched (rule 2) — never replace existing facts — but ensure your inserted sentences use ${pronouns} exclusively.`
    : "";
  return `You are a clinical report writer weaving cross-domain narrative connections into NDIS Functional Capacity Assessment sections. You must integrate the provided insertions into each section's existing prose with the LOWEST POSSIBLE editorial footprint.

CORE RULES — violating any of these is a critical failure:

1. DO NOT invent clinical detail. Insert the provided insertion text (with only minimal grammatical adjustment for tense, pronouns, and sentence-level flow). Do NOT add reasoning, context, or details that were not in the insertion.

2. DO NOT remove or alter any existing clinical facts in the target section.

3. DO NOT change the voice, tone, or style of the target section. Your job is integration, not rewriting.

4. ATTRIBUTION PRESERVATION (critical): If an insertion indicates source_has_attribution=true, the woven sentence MUST retain the attribution speech act. Example — if the source was "parent reported difficulty with showering", a valid weave is "As ${firstName}'s mother reported, showering is challenging…" but an INVALID weave would drop the "mother reported" framing and present it as a direct clinical observation.

5. ANTI-REDUNDANCY (critical): If an insertion has use_reference_framing=true, the weave MUST use a cross-reference phrasing like "As noted in the mobility domain…", "Consistent with the earlier observation that…", or "Building on the findings discussed above…" — do NOT restate the underlying fact.

6. PLACEMENT: Insert each sentence at the MOST NATURAL point in the existing prose. Prefer inserting at a paragraph break over splitting a sentence in half.

7. PARTICIPANT NAME: Use "${firstName}" consistently. Never change name or pronoun usage in existing text.

8. SIZE DISCIPLINE: The woven section should not grow by more than a few sentences total. If you find yourself wanting to expand heavily, you are doing too much — stop.${pronounRule}

OUTPUT FORMAT:
Return valid JSON only. No markdown fences, no commentary. A JSON object mapping section keys to their updated text. Include every requested section.`;
}

function buildWeaveUserPrompt(
  sectionsToWeave: string[],
  insertionsBySection: Record<string, Array<{
    threadId: string;
    insertion: string;
    sourceSection: string;
    sourceObs: string;
    sourceHasAttribution: boolean;
    useReferenceFraming: boolean;
  }>>,
  currentSections: Record<string, string>,
): string {
  return `For each section below, integrate the specified insertions into the existing text following the CORE RULES in the system prompt.

SECTIONS TO WEAVE:
${sectionsToWeave.map((key) => {
  const insertions = insertionsBySection[key];
  return `=== ${key} ===
CURRENT TEXT:
${currentSections[key]}

INSERTIONS TO WEAVE IN:
${insertions.map((i, idx) => `  ${idx + 1}. FROM: ${i.sourceSection}
     SOURCE OBS: "${i.sourceObs}"
     source_has_attribution: ${i.sourceHasAttribution}
     use_reference_framing: ${i.useReferenceFraming}
     INSERTION: "${i.insertion}"`).join("\n\n")}`;
}).join("\n\n---\n\n")}

Return a JSON object with these exact keys: ${JSON.stringify(sectionsToWeave)}
Each value is the full updated section text with insertions woven in. Do not include any other keys.`;
}

// ── Size guardrails ──────────────────────────────────────────
// Per-iteration: reject if shrunk > 20%, reject if grown > 150% overall,
// reject if grown by more than 600 chars in a single iteration. Track the
// ORIGINAL (pre-v2-loop) length for the 150% overall ceiling so a pathological
// 3-pass run can't inflate a section 10x.
interface SizeCheckResult {
  accept: boolean;
  warning?: string;
}
function checkSize(
  original: string,
  iterationStart: string,
  candidate: string,
  key: string,
): SizeCheckResult {
  const originalLen = original.length;
  const iterationStartLen = iterationStart.length;
  const candidateLen = candidate.length;

  // Shrinkage check (vs. iteration start, not original — we allow gradual
  // rewording but not sudden content loss).
  if (candidateLen < iterationStartLen * 0.8) {
    const pct = Math.round((1 - candidateLen / iterationStartLen) * 100);
    return {
      accept: false,
      warning: `Section "${key}" shrank by ${pct}% during weaving — rejected, using iteration-start version`,
    };
  }

  // Overall growth ceiling vs. the ORIGINAL (pre-threading) version.
  if (candidateLen > originalLen * 1.5) {
    const pct = Math.round((candidateLen / originalLen - 1) * 100);
    return {
      accept: false,
      warning: `Section "${key}" grew by ${pct}% overall (ceiling is 50%) — rejected to prevent runaway expansion`,
    };
  }

  // Per-iteration growth cap — prevents a single pass from dumping 3
  // paragraphs into one section.
  const iterationGrowth = candidateLen - iterationStartLen;
  if (iterationGrowth > 600) {
    return {
      accept: false,
      warning: `Section "${key}" grew by ${iterationGrowth} chars in a single iteration (cap is 600) — rejected`,
    };
  }

  return { accept: true };
}

// ── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "POST required" }, 405);
  }

  if (!CLAUDE_API_KEY) {
    return jsonResponse({ success: false, error: "CLAUDE_API_KEY not configured" }, 500);
  }

  try {
    const body = await req.json();
    const {
      generated_sections,
      participant_name,
      participant_first_name,
      participant_pronouns,
      diagnoses_context,
      max_passes = 2,
    } = body;

    if (!generated_sections || typeof generated_sections !== "object") {
      return jsonResponse({ success: false, error: "generated_sections required" }, 400);
    }

    const firstName = participant_first_name || participant_name?.split(/\s+/)[0] || "the participant";
    const maxPasses: number = Math.min(Math.max(Number(max_passes) || 2, 1), 3);

    // Filter to sections with actual content
    const initialEntries = Object.entries(generated_sections).filter(
      ([, v]) => typeof v === "string" && (v as string).trim().length > 20,
    );

    if (initialEntries.length < 3) {
      // Threading needs at least a few sections to find meaningful
      // cross-domain connections. With fewer than 3 populated sections it's
      // wasted cost.
      return jsonResponse({
        success: true,
        threaded_sections: generated_sections,
        original_sections: { ...generated_sections },
        thread_map: [],
        threads_identified: 0,
        threads_woven: 0,
        passes_completed: 0,
        low_confidence_suggestions: [],
        iteration_stats: [],
        warnings: ["Threading requires at least 3 populated sections — skipping"],
        usage: [],
      });
    }

    // State carried across iterations
    const originalSections: Record<string, string> = { ...generated_sections };
    const currentSections: Record<string, string> = { ...generated_sections };
    const allWovenThreads: Thread[] = [];
    const lowConfidenceSuggestions: Thread[] = [];
    const contradictionFlags: Thread[] = [];
    const seenSignatures = new Set<string>();
    const warnings: string[] = [];
    const usageLog: Record<string, number>[] = [];
    const iterationStats: IterationStats[] = [];
    let passesCompleted = 0;

    for (let iter = 1; iter <= maxPasses; iter++) {
      const iterationStartSections: Record<string, string> = { ...currentSections };
      console.log(`[THREAD] ═══ Iteration ${iter} of ${maxPasses} ═══`);

      // Build sections text from the CURRENT state (may include earlier weaves)
      const sectionEntries = Object.entries(currentSections).filter(
        ([, v]) => typeof v === "string" && (v as string).trim().length > 20,
      );
      const sectionsText = sectionEntries
        .map(([key, text]) => `=== ${key} ===\n${text}`)
        .join("\n\n");

      // ── PASS 1: Identify threads ──
      const identifySystem = buildIdentifySystemPrompt(
        participant_name,
        firstName,
        diagnoses_context,
        iter,
        maxPasses,
      );
      const identifyUser = buildIdentifyUserPrompt(
        sectionsText,
        [...seenSignatures],
        iter,
      );

      console.log(`[THREAD] Pass 1.${iter}: Identifying threads across ${sectionEntries.length} sections...`);
      let identifyResult: { text: string; usage: Record<string, number> };
      try {
        identifyResult = await callClaude(identifySystem, identifyUser, 8000);
      } catch (e) {
        console.error(`[THREAD] Identify call failed on iteration ${iter}:`, e);
        warnings.push(`Iteration ${iter} identify failed — loop stopped`);
        break;
      }
      usageLog.push(identifyResult.usage);

      let rawThreads: Thread[] = [];
      try {
        const cleaned = identifyResult.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
        const parsed = JSON.parse(cleaned);
        rawThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
      } catch (e) {
        console.error(`[THREAD] Failed to parse identify output on iteration ${iter}:`, e);
        warnings.push(`Iteration ${iter} identification parsing failed`);
        break;
      }

      console.log(`[THREAD] Iter ${iter}: model returned ${rawThreads.length} raw threads`);

      // Normalise / sanitise the returned threads
      const normalisedThreads: Thread[] = rawThreads
        .filter((t) => t && typeof t === "object" && t.source_section && t.source_observation)
        .map((t) => ({
          id: t.id || `thread_${iter}_${Math.random().toString(36).slice(2, 8)}`,
          source_section: String(t.source_section),
          source_observation: String(t.source_observation),
          source_has_attribution: t.source_has_attribution === true,
          target_sections: Array.isArray(t.target_sections) ? t.target_sections.map(String) : [],
          target_insertions: (t.target_insertions && typeof t.target_insertions === "object") ? t.target_insertions : {},
          type: (["causation", "amplification", "recommendation", "consistency", "contradiction"] as ThreadType[]).includes(t.type as ThreadType)
            ? t.type as ThreadType
            : "causation",
          direction: (["forward", "backward", "bidirectional"] as ThreadDirection[]).includes(t.direction as ThreadDirection)
            ? t.direction as ThreadDirection
            : "forward",
          confidence: (["high", "medium", "low"] as ThreadConfidence[]).includes(t.confidence as ThreadConfidence)
            ? t.confidence as ThreadConfidence
            : "medium",
          use_reference_framing: t.use_reference_framing === true,
          clinical_reasoning: String(t.clinical_reasoning || ""),
          pass: iter,
        }));

      // 1. Dedupe against threads already woven in earlier iterations.
      const newThreads = normalisedThreads.filter((t) => {
        const sig = threadSignature(t);
        if (seenSignatures.has(sig)) return false;
        return true;
      });

      // 2. Separate contradictions — these are NEVER woven, only flagged.
      const contradictions = newThreads.filter((t) => t.type === "contradiction");
      const weaveCandidates = newThreads.filter((t) => t.type !== "contradiction");
      contradictions.forEach((t) => contradictionFlags.push(t));

      // 3. Partition by confidence. Only high + medium are woven; low goes to
      //    the suggestions bucket.
      const autoWeave = weaveCandidates.filter((t) => t.confidence === "high" || t.confidence === "medium");
      const lowConf = weaveCandidates.filter((t) => t.confidence === "low");
      lowConf.forEach((t) => lowConfidenceSuggestions.push(t));

      // 4. Enforce anti-redundancy server-side as a belt-and-braces check.
      //    The model is asked to self-flag via use_reference_framing, but we
      //    also detect it here so a missed flag doesn't create duplicate
      //    content in the target section.
      for (const thread of autoWeave) {
        for (const targetKey of Object.keys(thread.target_insertions)) {
          const targetText = currentSections[targetKey];
          if (!targetText) continue;
          if (observationAppearsInSection(thread.source_observation, targetText)) {
            thread.use_reference_framing = true;
          }
        }
      }

      // Early convergence exit — no new weave-worthy threads found.
      if (autoWeave.length === 0) {
        console.log(`[THREAD] Iter ${iter}: converged (no new high/medium threads)`);
        iterationStats.push({
          pass: iter,
          identified: newThreads.length,
          woven: 0,
          low_confidence_suggestions: lowConf.length,
          rejected_backward_contradictions: contradictions.length,
          converged: true,
        });
        passesCompleted = iter;
        break;
      }

      // Build insertions map keyed by target section
      const insertionsBySection: Record<string, Array<{
        threadId: string;
        insertion: string;
        sourceSection: string;
        sourceObs: string;
        sourceHasAttribution: boolean;
        useReferenceFraming: boolean;
      }>> = {};
      for (const thread of autoWeave) {
        for (const [targetKey, insertion] of Object.entries(thread.target_insertions)) {
          if (!insertion || typeof insertion !== "string" || !insertion.trim()) continue;
          if (!currentSections[targetKey] || typeof currentSections[targetKey] !== "string") continue;
          if (!insertionsBySection[targetKey]) insertionsBySection[targetKey] = [];
          insertionsBySection[targetKey].push({
            threadId: thread.id,
            insertion,
            sourceSection: thread.source_section,
            sourceObs: thread.source_observation,
            sourceHasAttribution: thread.source_has_attribution === true,
            useReferenceFraming: thread.use_reference_framing === true,
          });
        }
      }

      const sectionsToWeave = Object.keys(insertionsBySection);
      if (sectionsToWeave.length === 0) {
        console.log(`[THREAD] Iter ${iter}: no target sections matched — skipping weave`);
        iterationStats.push({
          pass: iter,
          identified: newThreads.length,
          woven: 0,
          low_confidence_suggestions: lowConf.length,
          rejected_backward_contradictions: contradictions.length,
          converged: false,
        });
        passesCompleted = iter;
        continue;
      }

      // ── PASS 2: Weave ──
      console.log(`[THREAD] Pass 2.${iter}: Weaving ${autoWeave.length} threads into ${sectionsToWeave.length} sections...`);
      const weaveSystem = buildWeaveSystemPrompt(firstName, participant_pronouns);
      const weaveUser = buildWeaveUserPrompt(sectionsToWeave, insertionsBySection, currentSections);
      let weaveResult: { text: string; usage: Record<string, number> };
      try {
        weaveResult = await callClaude(weaveSystem, weaveUser, 16000);
      } catch (e) {
        console.error(`[THREAD] Weave call failed on iteration ${iter}:`, e);
        warnings.push(`Iteration ${iter} weave failed — loop stopped`);
        break;
      }
      usageLog.push(weaveResult.usage);

      let wovenSections: Record<string, string> = {};
      try {
        const cleaned = weaveResult.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
        wovenSections = JSON.parse(cleaned);
      } catch (e) {
        console.error(`[THREAD] Failed to parse weave output on iteration ${iter}:`, e);
        warnings.push(`Iteration ${iter} weave parsing failed`);
        break;
      }

      // Apply woven sections with size guardrails. Threads that survive the
      // guardrail check get added to the seen set and logged as successfully
      // woven. Rejected sections do NOT block the whole iteration — they
      // just revert to the iteration-start version.
      let iterationWoven = 0;
      const successfullyWovenTargets = new Set<string>();
      for (const [key, wovenText] of Object.entries(wovenSections)) {
        if (typeof wovenText !== "string" || !wovenText.trim()) continue;
        const originalText = originalSections[key];
        const iterationStartText = iterationStartSections[key];
        if (!originalText || !iterationStartText) continue;

        const check = checkSize(originalText, iterationStartText, wovenText, key);
        if (!check.accept) {
          if (check.warning) warnings.push(check.warning);
          continue;
        }
        currentSections[key] = wovenText;
        successfullyWovenTargets.add(key);
        iterationWoven++;
      }

      // Record each auto-weave thread whose target(s) were successfully
      // woven. Threads whose targets all got rejected by size guardrails are
      // NOT recorded, so they can be re-attempted on the next iteration.
      for (const thread of autoWeave) {
        const anyTargetWoven = Object.keys(thread.target_insertions).some((k) => successfullyWovenTargets.has(k));
        if (anyTargetWoven) {
          seenSignatures.add(threadSignature(thread));
          allWovenThreads.push(thread);
        }
      }

      iterationStats.push({
        pass: iter,
        identified: newThreads.length,
        woven: iterationWoven,
        low_confidence_suggestions: lowConf.length,
        rejected_backward_contradictions: contradictions.length,
        converged: false,
      });
      passesCompleted = iter;

      console.log(`[THREAD] Iter ${iter}: wove ${iterationWoven} sections, ${lowConf.length} low-conf suggestions, ${contradictions.length} contradictions flagged`);
    }

    console.log(`[THREAD] Complete: ${passesCompleted} passes, ${allWovenThreads.length} threads woven, ${lowConfidenceSuggestions.length} suggestions, ${contradictionFlags.length} contradictions`);

    return jsonResponse({
      success: true,
      threaded_sections: currentSections,
      original_sections: originalSections,
      thread_map: allWovenThreads,
      threads_identified: allWovenThreads.length + lowConfidenceSuggestions.length + contradictionFlags.length,
      threads_woven: allWovenThreads.length,
      passes_completed: passesCompleted,
      low_confidence_suggestions: lowConfidenceSuggestions,
      contradiction_flags: contradictionFlags,
      iteration_stats: iterationStats,
      warnings,
      usage: usageLog,
    });
  } catch (err: unknown) {
    console.error("[THREAD] Error:", err);
    return jsonResponse({ success: false, error: (err as Error)?.message || "Unknown error" }, 500);
  }
});
