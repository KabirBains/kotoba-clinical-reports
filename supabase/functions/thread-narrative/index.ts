import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  maxTokens = 16000
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
      diagnoses_context,
      max_passes = 2,
    } = body;

    if (!generated_sections || typeof generated_sections !== "object") {
      return jsonResponse({ success: false, error: "generated_sections required" }, 400);
    }

    const firstName = participant_first_name || participant_name?.split(/\s+/)[0] || "the participant";
    const passes = Math.min(Math.max(Number(max_passes) || 2, 1), 3);

    // Filter to sections with actual content
    const sectionEntries = Object.entries(generated_sections).filter(
      ([, v]) => typeof v === "string" && (v as string).trim().length > 20
    );

    if (sectionEntries.length === 0) {
      return jsonResponse({
        success: true,
        threaded_sections: generated_sections,
        original_sections: { ...generated_sections },
        thread_map: [],
        threads_identified: 0,
        threads_woven: 0,
        passes_completed: 0,
        warnings: ["No sections with sufficient content to thread"],
        usage: [],
      });
    }

    // Build the sections text for analysis
    const sectionsText = sectionEntries
      .map(([key, text]) => `=== ${key} ===\n${text}`)
      .join("\n\n");

    const sectionKeys = sectionEntries.map(([k]) => k);

    // ── PASS 1: Identify narrative threads ──────────────────
    const identifySystem = `You are a clinical report analyst specialising in NDIS Functional Capacity Assessments. Your task is to identify observations in one section that should be cross-referenced in other sections to create a cohesive clinical narrative.

Rules:
- Only identify clinically meaningful connections (not trivial ones)
- Each thread must have a clear clinical reasoning chain
- Focus on functional observations that have implications across multiple life domains
- The participant's name is "${participant_name || firstName}". Use "${firstName}" when referencing them.
- Diagnoses: ${diagnoses_context || "Not specified"}

You must return valid JSON only, no markdown fences.`;

    const identifyPrompt = `Analyse these report sections and identify cross-domain narrative threads — observations in one section that should be referenced in other sections to create clinical coherence.

SECTIONS:
${sectionsText}

Return a JSON object with this structure:
{
  "threads": [
    {
      "id": "thread_1",
      "source_section": "section12_1",
      "source_observation": "Cannot stand for more than 30 minutes",
      "target_sections": ["section12_4", "section12_8", "risk-safety"],
      "target_insertions": {
        "section12_4": "A brief sentence to insert that references the mobility limitation in context of domestic tasks",
        "section12_8": "A brief sentence about how this affects social participation",
        "risk-safety": "A sentence about deconditioning risk"
      },
      "direction": "forward",
      "clinical_reasoning": "Mobility limitations directly impact domestic task endurance, community access, and create progressive deconditioning risk"
    }
  ]
}

Rules:
- Maximum 15 threads
- Each target_insertion must be 1-2 sentences maximum
- Insertions must feel natural in the target section's context
- Use person-first language and clinical voice
- direction: "forward" (earlier section → later), "backward" (later → earlier), or "bidirectional"
- Only include threads where the cross-reference adds genuine clinical value`;

    console.log(`[THREAD] Pass 1: Identifying threads across ${sectionEntries.length} sections...`);
    const identifyResult = await callClaude(identifySystem, identifyPrompt, 8000);
    const usageLog = [identifyResult.usage];

    let threads: any[] = [];
    try {
      const cleaned = identifyResult.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
      const parsed = JSON.parse(cleaned);
      threads = Array.isArray(parsed.threads) ? parsed.threads : [];
    } catch (e) {
      console.error("[THREAD] Failed to parse thread identification:", e);
      return jsonResponse({
        success: true,
        threaded_sections: generated_sections,
        original_sections: { ...generated_sections },
        thread_map: [],
        threads_identified: 0,
        threads_woven: 0,
        passes_completed: 1,
        warnings: ["Thread identification parsing failed — returning original sections"],
        usage: usageLog,
      });
    }

    console.log(`[THREAD] Identified ${threads.length} threads`);

    if (threads.length === 0) {
      return jsonResponse({
        success: true,
        threaded_sections: generated_sections,
        original_sections: { ...generated_sections },
        thread_map: [],
        threads_identified: 0,
        threads_woven: 0,
        passes_completed: 1,
        warnings: [],
        usage: usageLog,
      });
    }

    // ── PASS 2: Weave threads into sections ─────────────────
    // Build a map of insertions per section
    const insertionsBySection: Record<string, { threadId: string; insertion: string; sourceSection: string; sourceObs: string }[]> = {};
    for (const thread of threads) {
      if (!thread.target_insertions || typeof thread.target_insertions !== "object") continue;
      for (const [targetSection, insertion] of Object.entries(thread.target_insertions)) {
        if (!insertion || typeof insertion !== "string") continue;
        if (!insertionsBySection[targetSection]) insertionsBySection[targetSection] = [];
        insertionsBySection[targetSection].push({
          threadId: thread.id,
          insertion: insertion as string,
          sourceSection: thread.source_section,
          sourceObs: thread.source_observation,
        });
      }
    }

    const sectionsToWeave = Object.keys(insertionsBySection).filter(
      (k) => generated_sections[k] && typeof generated_sections[k] === "string"
    );

    if (sectionsToWeave.length === 0) {
      return jsonResponse({
        success: true,
        threaded_sections: generated_sections,
        original_sections: { ...generated_sections },
        thread_map: threads,
        threads_identified: threads.length,
        threads_woven: 0,
        passes_completed: 1,
        warnings: ["Threads identified but no matching target sections found"],
        usage: usageLog,
      });
    }

    // Build weaving prompt
    const weaveSystem = `You are a clinical report writer weaving cross-domain narrative connections into NDIS Functional Capacity Assessment sections. You must integrate the provided insertions naturally into each section's existing prose, maintaining clinical voice, person-first language, and factual accuracy.

Rules:
- Do NOT change existing clinical facts or observations
- Do NOT remove any existing content
- Integrate insertions at the most natural point in the existing text
- Maintain paragraph structure
- The insertions should feel like they were always part of the section
- Use "${firstName}" consistently
- Return valid JSON only, no markdown fences`;

    const weavePrompt = `For each section below, integrate the specified narrative thread insertions naturally into the existing text. Return all sections (including unchanged ones) as a JSON object mapping section keys to their updated text.

SECTIONS TO WEAVE:
${sectionsToWeave.map((key) => {
  const ins = insertionsBySection[key];
  return `=== ${key} ===
CURRENT TEXT:
${generated_sections[key]}

INSERTIONS TO WEAVE IN:
${ins.map((i) => `- From ${i.sourceSection}: "${i.insertion}"`).join("\n")}`;
}).join("\n\n---\n\n")}

Return a JSON object with these exact keys: ${JSON.stringify(sectionsToWeave)}
Each value is the full updated section text with insertions woven in.`;

    console.log(`[THREAD] Pass 2: Weaving ${threads.length} threads into ${sectionsToWeave.length} sections...`);
    const weaveResult = await callClaude(weaveSystem, weavePrompt, 16000);
    usageLog.push(weaveResult.usage);

    let wovenSections: Record<string, string> = {};
    try {
      const cleaned = weaveResult.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
      wovenSections = JSON.parse(cleaned);
    } catch (e) {
      console.error("[THREAD] Failed to parse woven sections:", e);
      return jsonResponse({
        success: true,
        threaded_sections: generated_sections,
        original_sections: { ...generated_sections },
        thread_map: threads,
        threads_identified: threads.length,
        threads_woven: 0,
        passes_completed: 2,
        warnings: ["Thread weaving parsing failed — returning original sections"],
        usage: usageLog,
      });
    }

    // Merge woven sections with originals
    const threadedSections = { ...generated_sections };
    let threadsWoven = 0;
    const warnings: string[] = [];

    for (const [key, wovenText] of Object.entries(wovenSections)) {
      if (typeof wovenText !== "string" || !wovenText.trim()) continue;
      const originalText = generated_sections[key];
      if (!originalText) continue;

      // Sanity check: woven text shouldn't be dramatically shorter
      const originalLen = originalText.length;
      const wovenLen = wovenText.length;
      if (wovenLen < originalLen * 0.7) {
        warnings.push(`Section "${key}" shrank by ${Math.round((1 - wovenLen / originalLen) * 100)}% after threading — using original`);
        continue;
      }
      if (wovenLen > originalLen * 2.0) {
        warnings.push(`Section "${key}" grew by ${Math.round((wovenLen / originalLen - 1) * 100)}% after threading — may need review`);
      }

      threadedSections[key] = wovenText;
      threadsWoven++;
    }

    console.log(`[THREAD] Complete: ${threads.length} threads identified, ${threadsWoven} sections modified`);

    return jsonResponse({
      success: true,
      threaded_sections: threadedSections,
      original_sections: { ...generated_sections },
      thread_map: threads,
      threads_identified: threads.length,
      threads_woven: threadsWoven,
      passes_completed: passes >= 2 ? 2 : 1,
      warnings,
      usage: usageLog,
    });
  } catch (err: any) {
    console.error("[THREAD] Error:", err);
    return jsonResponse({ success: false, error: err?.message || "Unknown error" }, 500);
  }
});
