import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "report-documents";
const FILES: Record<string, string> = {
  template: "OT_FCA_Template_v5.1.docx",
  prompts: "OT_AI_Prompt_Templates_v5.3.docx",
  rubric: "OT_Report_Quality_Rubric_v5.3.docx",
};

const QUESTION_MAP: Record<string, Record<string, string[]>> = {
  support_worker: {
    daily_functioning: ["What does a typical day look like for them when you're supporting them?","What can they do independently?","What do they usually need prompting, supervision, or physical help with?","Are there certain times of day that are harder than others?"],
    adls_iadls: ["How do they manage showering, dressing, toileting, eating?","How do they go with cooking, cleaning, shopping, laundry?","Can they manage medication, appointments, money, transport?"],
    cognition_executive: ["Do they remember tasks or do they need reminders?","Can they start and finish tasks on their own?","How do they go with planning, sequencing, problem-solving?","Do they understand risk and safety issues?"],
    behaviour_emotional: ["What tends to upset or dysregulate them?","How do they usually respond when overwhelmed?","What strategies help calm or redirect them?","Have you noticed any risks to themselves or others?"],
    social_communication: ["How do they communicate their needs?","Do they engage well with others?","Are there issues with boundaries, conflict, withdrawal, or misunderstanding?","How do they go in the community or in groups?"],
    mobility_physical: ["Do they need support with walking, transfers, stairs, community access?","Any falls, near falls, fatigue, pain, or endurance issues?","What equipment or environmental supports are they using?"],
    support_needs: ["What support do you think is most essential for them right now?","Where do current supports seem insufficient?","What happens when support is not available?","Are there gaps in the roster or times where risk increases?"],
    strengths: ["What are they good at?","What do they enjoy?","When are they at their best?","What helps them be more independent?"],
    consistency_variability: ["Are they fairly consistent day to day, or does function vary a lot?","Are there good days and bad days?","What seems to influence that?"],
  },
  support_coordinator: {
    current_supports: ["What formal supports are currently in place?","How consistently are those supports actually being used?","Are there any services that have been hard to engage or maintain?","Are current supports meeting the person's needs?"],
    service_gaps: ["Where are the biggest gaps in the current plan?","What supports do you think are missing?","Are there supports funded but not realistically accessible?","What usually breaks down first when things aren't going well?"],
    functional_impact: ["From your perspective, what are the main areas where the participant struggles day to day?","What support needs come up most often across services?","Where do they need prompting, supervision, or hands-on assistance?","What has the biggest impact on their independence?"],
    risk_sustainability: ["What risks are you most concerned about at the moment?","Are there concerns around carer burnout, placement breakdown, hospitalisation, disengagement, or crisis?","What tends to happen when supports are reduced or inconsistent?","How sustainable is the current arrangement?"],
    barriers: ["What barriers are stopping progress right now?","Are there issues with provider availability, engagement, transport, funding, rural access, behaviour, or mental health?","Are there any systemic issues making it harder for the participant to get what they need?"],
    goals_engagement: ["What goals has the participant or family been prioritising?","How engaged are they with supports and services?","Do they understand their plan and what's available to them?","What tends to help or hinder engagement?"],
    plan_funding: ["In your view, where is the current funding insufficient?","Are there any supports you think need stronger evidence or justification in the report?","What recommendations would likely make the biggest difference?","If this report is strong, what do you hope it helps secure?"],
    collaboration_history: ["What have other providers been saying?","Have there been patterns across OT, psych, support work, behaviour support, etc.?","Has there been previous progress, stagnation, or deterioration?","Are there any past reports or events I should understand for context?"],
  },
  parent_carer: {
    daily_routine: ["What does a typical day look like for them at home?","What can they do independently versus what do you help with?","What does their morning and evening routine look like?","How much time do you spend supporting them each day?"],
    self_care: ["How do they manage showering, dressing, toileting?","Do they need reminding, supervising, or hands-on help?","Are there any continence issues?","How do they manage eating?"],
    home_tasks: ["Can they help with household tasks like cleaning, laundry, cooking?","Do they need step-by-step instructions or can they initiate tasks?","What household tasks do you do entirely for them?"],
    behaviour_mood: ["What tends to upset or overwhelm them?","How do they express frustration, anxiety, or distress?","Are there any behaviours of concern at home?","What helps settle or regulate them?","Have there been any incidents of self-harm, aggression, or absconding?"],
    social_community: ["Do they have friends or social connections outside the home?","How do they go in community settings?","Can they use transport independently?","Do they attend any groups, programs, or activities?"],
    sleep_health: ["How is their sleep?","Are there any current health concerns or hospitalisations?","How do they manage medications?"],
    carer_capacity: ["How are you managing with the current level of care?","Do you have your own health issues that affect your capacity?","Do you work, have other children, or other caring responsibilities?","What would happen if you were unable to provide care temporarily?","Is there anyone else who helps?"],
    strengths_goals: ["What are they good at or what do they enjoy?","What are your goals for them?","What supports would make the biggest difference for your family?"],
    concerns: ["What worries you most about their current situation?","What's the hardest part of your caring role right now?","Is there anything you want the NDIS planner to understand?"],
  },
  teacher_educator: {
    academic_learning: ["How are they performing academically?","Can they follow instructions independently?","What learning supports are in place?","What are their strengths as a learner?"],
    classroom_behaviour: ["How do they manage in the classroom?","Any behaviours of concern?","What triggers dysregulation?","What strategies support regulation?"],
    social_peers: ["How do they interact with peers?","Do they have friends?","Any issues with boundaries or bullying?","How do they go at lunch or recess?"],
    communication: ["How do they communicate?","Can they express needs to staff and peers?","Do they understand group instructions?"],
    self_care_school: ["Can they manage toileting, eating, dressing at school?","Do they need transition support?","Any safety concerns?"],
    support_aides: ["Does the student have an aide?","Is the current support sufficient?","What additional support would help?"],
    sensory: ["Any sensory issues?","What environmental modifications are in place?","How do they manage transitions and noise?"],
  },
  allied_health: {
    role_involvement: ["What is your role and how long have you worked with them?","What has been the focus of your intervention?","How frequently do you see them?"],
    clinical_observations: ["What are the main areas of difficulty?","How does their presentation compare to when you started?","Any specific functional limitations?"],
    progress_outcomes: ["What progress has been made?","What has worked and what hasn't?","Any barriers to progress?"],
    recommendations: ["What do they need more or less of?","Are current funded hours sufficient?","What if your service was discontinued?"],
    risk_concerns: ["Any safety or clinical risks?","Any critical incidents or hospitalisations?","Concerns about engagement or deterioration?"],
    interdisciplinary: ["How does your work intersect with other supports?","Any recommendations for OT?","Anything being missed across the team?"],
  },
  employer: {
    role_tasks: ["What is their current role?","How many hours do they work?","What tasks can they do independently?"],
    workplace_function: ["How do they manage physical demands?","Can they follow multi-step instructions?","How do they manage time?","Any attendance issues?"],
    social_workplace: ["How do they get along with colleagues?","Any interpersonal difficulties?","Can they manage feedback?"],
    accommodations: ["What accommodations are in place?","Do they have a support worker or job coach?","What additional support would help?"],
    strengths_concerns: ["What are their workplace strengths?","What concerns you most?","Is the arrangement sustainable?"],
  },
  participant_self: {
    daily_life: ["What does a normal day look like?","What can you do on your own?","What do you need help with?","Anything that's become harder?"],
    goals_wishes: ["What do you want to be able to do?","Goals for the next 12 months?","What would make the biggest difference?"],
    supports_experience: ["What supports are working well?","Anything you wish was different?","Do you have enough help?","Do you ever feel unsafe?"],
    social_wellbeing: ["Do you see friends or family regularly?","Do you get out into the community enough?","How are you feeling generally?","Anything worrying you?"],
    strengths_interests: ["What are you good at?","What do you enjoy?","When do you feel happiest?"],
  },
};

const DOMAIN_LABELS: Record<string, string> = {
  daily_functioning:"Daily Functioning",adls_iadls:"ADLs / IADLs",cognition_executive:"Cognition / Executive Functioning",behaviour_emotional:"Behaviour / Emotional Regulation",social_communication:"Social / Communication",mobility_physical:"Mobility / Physical Support",support_needs:"Support Needs",strengths:"Strengths",consistency_variability:"Consistency / Variability",current_supports:"Current Supports",service_gaps:"Service Gaps",functional_impact:"Functional Impact",risk_sustainability:"Risk / Sustainability",barriers:"Barriers",goals_engagement:"Participant Goals / Engagement",plan_funding:"Plan / Funding Context",collaboration_history:"Collaboration / History",daily_routine:"Daily Routine",self_care:"Self-Care & Personal ADLs",home_tasks:"Domestic Tasks",behaviour_mood:"Behaviour & Mood",social_community:"Social & Community",sleep_health:"Sleep & Health",carer_capacity:"Carer Capacity & Sustainability",strengths_goals:"Strengths & Goals",concerns:"Key Concerns",academic_learning:"Academic / Learning",classroom_behaviour:"Classroom Behaviour",social_peers:"Social & Peer Interaction",communication:"Communication",self_care_school:"Self-Care at School",support_aides:"Current School Supports",sensory:"Sensory & Environment",role_involvement:"Role & Involvement",clinical_observations:"Clinical Observations",progress_outcomes:"Progress & Outcomes",recommendations:"Recommendations",risk_concerns:"Risk & Concerns",interdisciplinary:"Interdisciplinary",role_tasks:"Role & Tasks",workplace_function:"Workplace Functioning",social_workplace:"Social & Interpersonal",accommodations:"Accommodations & Support",strengths_concerns:"Strengths & Concerns",daily_life:"Daily Life",goals_wishes:"Goals & Wishes",supports_experience:"Experience with Supports",social_wellbeing:"Social & Wellbeing",strengths_interests:"Strengths & Interests",
};

const TEMPLATE_LABELS: Record<string, string> = {
  support_worker:"Support Worker",support_coordinator:"Support Coordinator",parent_carer:"Parent / Carer",teacher_educator:"Teacher / Educator",allied_health:"Allied Health Professional",employer:"Employer / Workplace",participant_self:"Participant (Self-Report)",
};

const SAFETY_KEYWORDS = ["self-harm","self harm","cutting","cuts herself","cuts himself","suicid","suicide","suicidal","overdose","attempt","ideation","absconding","abscond","aggression","aggressive","violent","assault","hospital","hospitalisation","emergency","crisis","psychosis","psychotic","manic episode","mania","police","QPS","restrain","restrictive","seclusion","risk to self","risk to others","harm to self","harm to others","weapon","knife","blade","neglect","self-neglect","placement breakdown","eviction","homeless","exploitation","death","deceased"];

function extractSafetySummary(interviews: any[]): string {
  if (!interviews || interviews.length === 0) return "";
  const items: string[] = []; const seen = new Set<string>();
  for (const iv of interviews) {
    const informant = `${iv.intervieweeName || "[Informant]"} (${iv.intervieweeRole || TEMPLATE_LABELS[iv.templateId] || "stakeholder"})`;
    const allText: string[] = [];
    if (iv.responses) { for (const v of Object.values(iv.responses)) { if (v && (v as string).trim()) allText.push(v as string); } }
    if (iv.customQuestions) { for (const customs of Object.values(iv.customQuestions)) { if (Array.isArray(customs)) { for (const cq of customs) { if (cq.response?.trim()) allText.push(cq.response); } } } }
    if (iv.generalNotes?.trim()) allText.push(iv.generalNotes);
    for (const text of allText) { const lower = text.toLowerCase(); for (const kw of SAFETY_KEYWORDS) { if (lower.includes(kw.toLowerCase())) { const key = `${kw}|${informant}`; if (!seen.has(key)) { seen.add(key); items.push(`- ${informant}: ${text.substring(0, 150)}${text.length > 150 ? "..." : ""}`); } break; } } }
  }
  return items.join("\n");
}

function formatCollateralForPrompt(interviews: any[]): string {
  if (!interviews || interviews.length === 0) return "";
  const parts: string[] = [];
  for (const iv of interviews) {
    const tid = iv.templateId || "unknown"; const tl = TEMPLATE_LABELS[tid] || tid; const qs = QUESTION_MAP[tid] || {};
    parts.push(`=== COLLATERAL: ${tl} ===`); parts.push(`Informant: ${iv.intervieweeName || "[N/A]"}`); parts.push(`Role: ${iv.intervieweeRole || "[N/A]"}`); parts.push(`Method: ${iv.method || "[N/A]"}  Date: ${iv.date || "[N/A]"}`); parts.push("");
    if (iv.responses) {
      const groups: Record<string, { q: string; a: string }[]> = {};
      for (const [key, val] of Object.entries(iv.responses)) { if (!val || !(val as string).trim()) continue; const lu = key.lastIndexOf("_"); if (lu === -1) continue; const did = key.substring(0, lu); const qi = parseInt(key.substring(lu + 1)); const dl = DOMAIN_LABELS[did] || did; const dq = qs[did] || []; if (!groups[dl]) groups[dl] = []; groups[dl].push({ q: dq[qi] || `Q${qi+1}`, a: val as string }); }
      for (const [dl, qas] of Object.entries(groups)) { parts.push(`--- ${dl} ---`); for (const qa of qas) { parts.push(`Q: ${qa.q}`); parts.push(`A: ${qa.a}`); parts.push(""); } }
    }
    if (iv.customQuestions) { for (const [did, customs] of Object.entries(iv.customQuestions)) { if (!Array.isArray(customs)) continue; for (const cq of customs) { if (cq.question && cq.response?.trim()) { parts.push(`--- ${DOMAIN_LABELS[did] || did} (Custom) ---`); parts.push(`Q: ${cq.question}`); parts.push(`A: ${cq.response}`); parts.push(""); } } } }
    if (iv.generalNotes?.trim()) { parts.push(`--- Notes ---`); parts.push(iv.generalNotes); parts.push(""); }
    parts.push("");
  }
  return parts.join("\n");
}

const DOMAIN_TO_COLLATERAL: Record<string, string[]> = {
  "Mobility":["mobility_physical","daily_functioning"],"Transfers":["mobility_physical"],"Personal ADLs":["adls_iadls","self_care","daily_functioning","daily_routine","self_care_school"],"Domestic IADLs":["adls_iadls","home_tasks","daily_functioning"],"Executive IADLs":["adls_iadls","cognition_executive"],"Cognition":["cognition_executive","academic_learning"],"Communication":["social_communication","communication"],"Social Functioning":["social_communication","social_community","social_peers","social_wellbeing","social_workplace"],"Sensory Profile":["sensory"],"Behaviour":["behaviour_emotional","behaviour_mood","classroom_behaviour","risk_concerns"],"Risk":["risk_sustainability","risk_concerns","behaviour_emotional","behaviour_mood","concerns","support_needs"],"Strengths":["strengths","strengths_goals","strengths_interests","strengths_concerns"],"Carer":["carer_capacity","risk_sustainability"],
};

function extractCollateralForDomain(interviews: any[], hint: string): string {
  if (!interviews || !interviews.length) return "";
  let ids: string[] = [];
  for (const [k, v] of Object.entries(DOMAIN_TO_COLLATERAL)) { if (hint.toLowerCase().includes(k.toLowerCase())) ids = [...ids, ...v]; }
  ids = [...new Set(ids)]; if (!ids.length) return "";
  const parts: string[] = [];
  for (const iv of interviews) {
    const tid = iv.templateId || "unknown"; const qs = QUESTION_MAP[tid] || {};
    const label = `${iv.intervieweeName || "[Informant]"}, ${iv.intervieweeRole || TEMPLATE_LABELS[tid] || "stakeholder"}`;
    if (!iv.responses) continue;
    const qas: { q: string; a: string }[] = [];
    for (const [key, val] of Object.entries(iv.responses)) { if (!val || !(val as string).trim()) continue; const lu = key.lastIndexOf("_"); if (lu === -1) continue; const did = key.substring(0, lu); const qi = parseInt(key.substring(lu + 1)); if (ids.includes(did)) { const dq = qs[did] || []; qas.push({ q: dq[qi] || `Q${qi+1}`, a: val as string }); } }
    if (qas.length) { parts.push(`From ${label}:`); for (const qa of qas) { parts.push(`  Q: ${qa.q}`); parts.push(`  A: ${qa.a}`); } parts.push(""); }
  }
  return parts.join("\n");
}

let cache: { template: string; prompts: string; rubric: string; at: number } | null = null;
const TTL = 30 * 60 * 1000;

async function extractTextFromDocx(blob: Blob): Promise<string> {
  try {
    const JSZipModule = await import("https://esm.sh/jszip@3.10.1"); const JSZip = JSZipModule.default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer()); const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("No document.xml");
    return xml.replace(/<w:p[^>]*\/>/g,"\n").replace(/<w:p[^>]*>/g,"\n").replace(/<w:tab\/>/g,"\t").replace(/<w:br\/>/g,"\n").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/\n{3,}/g,"\n\n").trim();
  } catch (e) { throw new Error("docx extract failed: " + (e as Error).message); }
}

async function loadDocs() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env vars");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const result: Record<string, string> = {};
  for (const [key, fn] of Object.entries(FILES)) { const { data, error } = await sb.storage.from(BUCKET).download(fn); if (error || !data) throw new Error("Load failed: " + fn); result[key] = await extractTextFromDocx(data); }
  cache = { template: result.template, prompts: result.prompts, rubric: result.rubric, at: Date.now() }; return cache;
}

// System prompt is a structured array so we can cache the stable prefix.
// The first block (cached) contains the ~9k tokens of reference docs and the
// always-on rule blocks. Anthropic prompt caching reuses these tokens at ~10%
// cost across the 5-minute TTL. The second block contains per-call dynamic
// context (participant naming, collateral routing, generated_sections).
type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

async function callClaude(sys: string | SystemBlock[], user: string, max: number = 3000): Promise<{ text: string; usage: any }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: max,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { text: data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n"), usage: data.usage };
}

// ── LIGHT RUBRIC SELF-CHECK ────────────────────────────────────
// An optional, small Claude call that evaluates the generated section
// against ~8 high-impact rubric criteria from v5.3. Returns a structured
// pass/fail map with brief reasons. Total cost: ~1k input + ~300 output
// per check, roughly 10x cheaper than the main generation call.
//
// Opt-in via body: { self_check: true }. Default off so existing
// callers see no cost change. Designed to be called for sections where
// the clinician explicitly wants extra rigor (e.g., S12.3 mental health
// risk, S17 recommendations, S2 background) without running the full
// review-report flow.

type RubricCheckResult = {
  criterion: string;
  pass: boolean;
  reason: string;
};

async function runLightRubricCheck(
  generatedText: string,
  sectionName: string | undefined
): Promise<{ checks: RubricCheckResult[]; usage: any } | null> {
  // The criteria evaluated are a high-impact subset of the v5.3 rubric.
  // Each one is a yes/no judgment that is hard to make with pure regex
  // but cheap for Claude to assess in a single short call.
  const isDomainSection = sectionName?.startsWith("section13") || sectionName?.startsWith("section14");

  const criteriaList = [
    { id: "A1_person_first", description: "Uses participant name or 'the participant' as first reference in each paragraph (not standalone pronouns)." },
    { id: "A2_no_bullets", description: "Continuous prose only — no bullet points, numbered lists, or markdown headings in the body." },
    { id: "A6a_definitive_verbs", description: "Uses definitive verbs ('cannot', 'is unable to', 'requires') rather than hedged constructions like 'experiences difficulty with'." },
    { id: "A7_attributed_speculation", description: "Any speculation or clinical opinion is attributed using 'In the assessor's clinical opinion' or equivalent — no unattributed 'it appears', 'may be', 'could suggest'." },
    { id: "A8a_diagnosis_named", description: "Where a limitation is linked to disability, the specific diagnosis is named (e.g., 'secondary to schizophrenia') rather than 'due to his disability'." },
    { id: "B10_participant_anchoring", description: "Every paragraph contains at least one detail unique to this specific participant (not generic boilerplate)." },
    { id: "B11_consequence_specificity", description: "Any consequence statement ('Without this support…') names a specific, participant-relevant outcome rather than generic 'functional decline'." },
    { id: "B13_sentence_length_variety", description: "At least one sentence under 15 words appears in the section (creates clinical rhythm)." },
  ];

  if (isDomainSection) {
    criteriaList.push({
      id: "D2_support_level_declarations",
      description: "Every sub-area opens with an explicit 'Support level: [level]' statement before the narrative paragraph.",
    });
    criteriaList.push({
      id: "A18a_evidence_citation",
      description: "The section opens with the evidence citation block: 'Evidence: As per standardised assessment; as evident in functional assessment and observations; as evident in interviews; collateral information; reviewed reports.'",
    });
  }

  const checkSystem = `You are a quality reviewer for NDIS Functional Capacity Assessment report sections.

Your task: evaluate the provided section text against a list of binary pass/fail criteria. For each criterion, return:
  - pass: true or false
  - reason: a brief one-sentence explanation (max 25 words) — for failures, point to the specific text that failed; for passes, briefly note evidence

Return ONLY a valid JSON object of the form:
{
  "checks": [
    { "criterion": "<id>", "pass": true|false, "reason": "<brief>" },
    ...
  ]
}

Do not include any commentary outside the JSON. Do not use markdown code fences.`;

  const checkUser = `SECTION: ${sectionName || "unknown"}

CRITERIA TO EVALUATE:
${criteriaList.map(c => `  - ${c.id}: ${c.description}`).join("\n")}

GENERATED TEXT:
---
${generatedText}
---

Return the JSON object now.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: checkSystem,
        messages: [{ role: "user", content: checkUser }],
      }),
    });

    if (!res.ok) {
      console.warn("Light rubric self-check failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text || "";

    // Parse the JSON response. Tolerate code fences just in case.
    const cleaned = rawText.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed || !Array.isArray(parsed.checks)) {
      console.warn("Light rubric self-check returned unexpected shape");
      return null;
    }

    return { checks: parsed.checks as RubricCheckResult[], usage: data.usage };
  } catch (e: unknown) {
    console.warn("Light rubric self-check exception:", (e as Error).message);
    return null;
  }
}

const ANTI_REDUNDANCY = `
ANTI-REDUNDANCY RULES:
1. DOCUMENT ONCE, REFERENCE THEREAFTER.
2. Safety-critical info: FULL in Section 12 ONLY. Brief in S2 and S6. Cross-reference elsewhere.
3. Collateral observations: FULL in S6 ONLY. Brief in ONE domain. Cross-reference elsewhere.
4. Do NOT restate facts from previous sections.
5. Each section must add NEW information.
`;

const SUB_AREA_RULES = `
SUB-AREA SEPARATION RULES (CRITICAL — MUST FOLLOW):
When writing a functional domain that contains MULTIPLE sub-areas (e.g., Laundry, Shopping, Meal Prep, Cleaning under Domestic IADLs), you MUST:

1. Write SEPARATE, UNIQUE content for EACH sub-area. Each sub-area gets its OWN paragraph(s) that discuss ONLY that specific sub-area.
2. Use the delimiter <<SUB_AREA: [Name]>> before each sub-area's content. Example:
   <<SUB_AREA: Laundry>>
   Support level: Assistance Required
   [Paragraph about laundry ONLY]
   <<SUB_AREA: Shopping>>
   Support level: Fully Dependent
   [Paragraph about shopping ONLY]
3. NEVER combine multiple sub-areas into one paragraph. NEVER write about shopping in the laundry section or vice versa.
4. Each sub-area MUST contain ONLY observations relevant to THAT specific sub-area.
5. If the clinician provided the same observation text for multiple sub-areas, write DIFFERENT prose for each — extract only the relevant parts.
6. The content under each <<SUB_AREA>> delimiter must be completely self-contained and make sense on its own.

For Communication domains with Receptive and Expressive sub-areas:
- Receptive content discusses ONLY understanding, comprehension, processing information.
- Expressive content discusses ONLY producing speech, expressing needs, verbal output.
- NEVER combine both into one block.

CRITICAL OUTPUT FORMAT — DELIMITER LITERAL ONLY:
The frontend post-processor uses the regex /<<SUB_AREA:\\s*([^>]+)>>/g to split your output. ANY other heading format will fail parsing and will display as a single unbroken block of prose to the clinician. You MUST emit the literal delimiter — not markdown bold, not markdown headings, not any other formatting.

WRONG (markdown bold — DO NOT EMIT):
**Ambulation and Balance**
Support level: Assistance Required

WRONG (markdown heading — DO NOT EMIT):
## Ambulation and Balance
Support level: Assistance Required

WRONG (plain heading — DO NOT EMIT):
Ambulation and Balance:
Support level: Assistance Required

RIGHT (the literal delimiter — ALWAYS EMIT THIS):
<<SUB_AREA: Ambulation and Balance>>
Support level: Assistance Required

The string "<<SUB_AREA:" appears NOWHERE in your other output. It is ONLY used as the sub-area delimiter. If you find yourself writing markdown bold or heading syntax for a sub-area name, STOP and replace it with <<SUB_AREA: [Name]>>.

FAILURE TO SEPARATE SUB-AREAS, OR FAILURE TO USE THE LITERAL <<SUB_AREA: [Name]>> DELIMITER, IS A CRITICAL ERROR. The frontend will display the entire domain as a single unbroken block to the clinician, who will then have to manually edit it back into the correct format.
`;

const ASSESSMENT_SCORING_RULES = `
ASSESSMENT SCORING RULES:
LSP-16: ALL subscales HIGHER = WORSE. 0 = no disability. Withdrawal 12/12 = MAXIMUM withdrawal (NOT a strength). Self-Care 15/15 = EXTREME deficits.
WHODAS 2.0: HIGHER = WORSE disability.
DASS-42: HIGHER = WORSE symptoms.
FRAT: HIGHER = greater falls risk. 5-11=Low, 12-15=Medium, 16-20=High.
Lawton IADL: HIGHER = BETTER (0-8, 8=independent).
CANS: HIGHER levels = MORE care needs.
Zarit: HIGHER = GREATER carer burden (0-88).
Vineland-3: LOWER = WORSE.
`;

// ── BANNED PHRASE DETECTION ────────────────────────────────────
// The v5.3 prompt templates and v5.2 rubric (criterion B9) define a list
// of banned stock phrases that may appear at most once per full report.
// The model is instructed to avoid these in the system prompt, but
// compliance is imperfect. This post-processing layer detects banned-phrase
// usage and surfaces it in the response so the frontend can either
// re-generate or flag for clinician review.
//
// Each entry is { regex, label, max_occurrences }. Some banned phrases are
// permitted once per report (max_occurrences = 1) — the per-call detector
// flags any usage in a single section, and the orchestrator can compare
// across sections to enforce the per-report limit.
type BannedPhraseRule = {
  regex: RegExp;
  label: string;
  replacement_hint: string;
};

const BANNED_PHRASES: BannedPhraseRule[] = [
  {
    regex: /\bthese (challenges|limitations|deficits)\b/gi,
    label: "these challenges/limitations/deficits",
    replacement_hint: "Name the specific issue (e.g., 'these mobility limitations', 'these cognitive deficits').",
  },
  {
    regex: /\bsignificantly (impacts?|affects?)\b/gi,
    label: "significantly impacts/affects",
    replacement_hint: "Use 'prevents', 'eliminates capacity to', or a specific causal verb.",
  },
  {
    regex: /\bfunctional decline\b/gi,
    label: "functional decline",
    replacement_hint: "Name the specific domain: 'deterioration in mobility', 'deterioration in self-care'.",
  },
  {
    regex: /\bsocial isolation\b/gi,
    label: "social isolation",
    replacement_hint: "After first use, alternate with 'withdrawal from community life', 'reduced social contact', or domain-specific framing.",
  },
  {
    regex: /\bmeaningful activities\b/gi,
    label: "meaningful activities",
    replacement_hint: "Name the actual activities the participant values.",
  },
  {
    regex: /\bremains? at high risk\b/gi,
    label: "remains at high risk",
    replacement_hint: "Use 'faces [specific consequence]' (e.g., 'faces tenancy loss', 'faces deterioration in mental health').",
  },
  {
    regex: /\bcapacity[- ]building interventions?\b/gi,
    label: "capacity-building interventions",
    replacement_hint: "Name the specific intervention (e.g., 'occupational therapy intervention', 'AAC training').",
  },
  {
    regex: /\bdue to (his|her|their) disability\b/gi,
    label: "due to his/her/their disability",
    replacement_hint: "Use 'secondary to [named diagnosis]' (e.g., 'secondary to schizophrenia').",
  },
];

type BannedPhraseHit = {
  label: string;
  matched_text: string;
  count: number;
  replacement_hint: string;
};

function detectBannedPhrases(text: string): BannedPhraseHit[] {
  if (!text || typeof text !== "string") return [];
  const hits: BannedPhraseHit[] = [];
  for (const rule of BANNED_PHRASES) {
    // Reset regex state in case the regex object is shared.
    rule.regex.lastIndex = 0;
    const matches = text.match(rule.regex);
    if (matches && matches.length > 0) {
      hits.push({
        label: rule.label,
        matched_text: matches[0],
        count: matches.length,
        replacement_hint: rule.replacement_hint,
      });
    }
  }
  return hits;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!CLAUDE_API_KEY) return new Response(JSON.stringify({ success: false, error: "CLAUDE_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    let body;
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const {
      prompt,
      max_tokens = 3000,
      collateral_interviews,
      section_name,
      generated_sections,
      domain_hint,
      participant_name,
      participant_first_name,
      // Explicit safety declaration. When the clinician has identified
      // safety concerns (e.g., suicidal ideation, BoC, abscond history), they
      // pass them as an array of short strings. The function injects these
      // into S2 (briefly) and S12.3 (fully) regardless of whether the same
      // content appears in collateral_interviews. This ensures safety routing
      // fires even when notes are sparse or when the clinician declared a
      // concern outside the collateral interview flow.
      safety_concerns,
      // Demographic fields. All optional, all forward-compatible.
      // If a field is missing, the participant block falls back to its
      // pre-existing behaviour (name-only).
      participant_age,
      participant_sex,
      participant_pronouns,
      participant_title,
      // Opt-in light rubric self-check. When true, the function makes
      // a small additional Claude call after generation to evaluate the
      // output against ~8-10 high-impact rubric criteria. Default false
      // to preserve backward compatibility and existing per-call cost.
      self_check,
    } = body;
    if (!prompt) return new Response(JSON.stringify({ success: false, error: "No prompt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let docs;
    try { docs = await loadDocs(); } catch (e: unknown) {
      return new Response(JSON.stringify({ success: false, error: "Doc load failed", details: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fullName = participant_name || "";
    const firstName = participant_first_name || (fullName ? fullName.split(" ")[0] : "");

    // ── CACHED PREFIX ──────────────────────────────────────────
    // Stable across calls within the 5-minute prompt cache TTL.
    // Includes role + 3 reference docs + always-on rule blocks.
    // SUB_AREA_RULES is included unconditionally (cheap to ship, harmless
    // for non-domain sections, and critical that it stays cacheable).
    const cachedPrefix =
      "You are an expert clinical report writing assistant for Occupational Therapists in the Australian NDIS framework.\n\n" +
      "=== DOCUMENT 1: FCA REPORT TEMPLATE (v5.1) ===\n" + docs.template + "\n\n" +
      "=== DOCUMENT 2: AI PROMPT TEMPLATES (v5.3) ===\n" + docs.prompts + "\n\n" +
      "=== DOCUMENT 3: QUALITY RUBRIC (v5.3) ===\n" + docs.rubric + "\n\n" +
      "YOUR ROLE: Transform clinical observations into NDIS-quality prose. Do NOT add information not provided. Plain text only. No preamble." +
      ANTI_REDUNDANCY +
      ASSESSMENT_SCORING_RULES +
      SUB_AREA_RULES;

    // ── DYNAMIC SUFFIX ─────────────────────────────────────────
    // Changes per call. Participant naming, collateral routing, lookback.
    let dynamicSuffix = "";

    if (fullName) {
      // Build a richer participant block when demographic fields are
      // provided. Each field is optional — missing fields are simply
      // omitted from the descriptor rather than appearing as placeholders.
      const demographicParts: string[] = [];
      if (participant_age) demographicParts.push(String(participant_age));
      if (participant_sex) demographicParts.push(String(participant_sex));
      const demographicDescriptor = demographicParts.length > 0
        ? ` (${demographicParts.join(", ")})`
        : "";

      dynamicSuffix += `\n\nPARTICIPANT: ${fullName}${demographicDescriptor}\n`;
      dynamicSuffix += `Use '${firstName}' after the formal first-mention introduction.\n`;
      dynamicSuffix += `NEVER use full name after first mention. NEVER use another person's name in participant-referencing position.\n`;

      if (participant_title) {
        dynamicSuffix += `FORMAL TITLE: Use "${participant_title}" in the formal first mention (e.g. "${participant_title} ${fullName} (referred to as ${firstName} for the remainder of the report)").\n`;
      }

      if (participant_pronouns) {
        // Honour the participant's stated pronouns explicitly. This is
        // important for non-default presentations (they/them, fluid,
        // self-described). The model should NOT default to gendered
        // pronouns based on name, surname, or any other inference.
        dynamicSuffix += `PRONOUNS: ${firstName} uses ${participant_pronouns} pronouns. Use these consistently throughout. Do NOT default to gendered pronouns based on name or any inference. If the pronouns are unfamiliar or non-default, treat this as a deliberate participant-led choice and apply it carefully.\n`;
      }
    }
    // Note: ANTI_REDUNDANCY, ASSESSMENT_SCORING_RULES and SUB_AREA_RULES
    // are now part of the cached prefix above (added by PR A: prompt
    // caching). Do not append them here again.

    // === COLLATERAL ROUTING ===
    let collateralContext = ""; let domainCollateral = ""; let safetySummary = ""; let hasSafetyAlerts = false;

    if (collateral_interviews && Array.isArray(collateral_interviews) && collateral_interviews.length > 0) {
      collateralContext = formatCollateralForPrompt(collateral_interviews);
      safetySummary = extractSafetySummary(collateral_interviews);
      hasSafetyAlerts = !!safetySummary;
      if (domain_hint) domainCollateral = extractCollateralForDomain(collateral_interviews, domain_hint);

      if (section_name === "section6" || section_name === "section6_collateral") {
        dynamicSuffix += "\n\n=== FULL COLLATERAL — GENERATE SECTION 6 ===\n" + collateralContext;
      } else if (section_name === "section2") {
        if (safetySummary) dynamicSuffix += "\n\n=== SAFETY COLLATERAL (brief, for background) ===\n" + safetySummary;
        if (collateralContext) dynamicSuffix += "\n\n=== COLLATERAL CONTEXT ===\n" + collateralContext;
      } else if (section_name === "section12" || section_name?.startsWith("section12_")) {
        if (safetySummary) dynamicSuffix += "\n\n=== SAFETY-CRITICAL — DOCUMENT FULLY HERE ===\n" + safetySummary;
        const rc = extractCollateralForDomain(collateral_interviews, "Risk");
        if (rc) dynamicSuffix += "\n\n=== RISK COLLATERAL ===\n" + rc;
      } else if (section_name?.startsWith("section13")) {
        if (domainCollateral) dynamicSuffix += "\n\n=== DOMAIN COLLATERAL (use once, attribute) ===\n" + domainCollateral;
        if (hasSafetyAlerts && (domain_hint?.toLowerCase().includes("social") || domain_hint?.toLowerCase().includes("behaviour"))) {
          dynamicSuffix += "\nSafety info is in Section 12. Cross-reference only.";
        }
      } else if (["section16","section17","section18"].includes(section_name || "")) {
        if (safetySummary) dynamicSuffix += "\n\n=== SAFETY CONTEXT (cross-ref S12) ===\n" + safetySummary;
        if (collateralContext && section_name === "section17") dynamicSuffix += "\n\n=== COLLATERAL FOR RECS ===\n" + collateralContext;
      } else if (section_name === "section8" || section_name === "section9") {
        const cc = extractCollateralForDomain(collateral_interviews, "Carer");
        if (cc) dynamicSuffix += "\n\n=== CARER COLLATERAL ===\n" + cc;
      } else if (collateralContext) {
        dynamicSuffix += "\n\n=== COLLATERAL AVAILABLE ===\n" + collateralContext;
      }
    }

    // === EXPLICIT SAFETY CONCERNS ROUTING ===
    // Clinician-declared safety concerns are routed independently of
    // collateral_interviews. This ensures safety routing fires even when:
    //   (a) the clinician has not conducted any collateral interviews,
    //   (b) the safety concern was identified outside the interview flow,
    //   (c) the SAFETY_KEYWORDS scanner failed to catch a paraphrased note.
    // The clinician passes safety_concerns as an array of short declared
    // items (e.g., ["passive suicidal ideation — historical episode 2024",
    // "abscond risk", "documented choking history"]). These are then
    // injected into the appropriate section based on section_name, with
    // S12.3 receiving the FULL list and S2 receiving only a brief mention.
    if (Array.isArray(safety_concerns) && safety_concerns.length > 0) {
      const declared = safety_concerns
        .map((s: unknown) => typeof s === "string" ? s.trim() : "")
        .filter((s: string) => s.length > 0);
      if (declared.length > 0) {
        const declaredBlock = declared.map(s => `- ${s}`).join("\n");
        hasSafetyAlerts = true;
        if (section_name === "section12" || section_name?.startsWith("section12_")) {
          // S12 (and especially 12.3 Mental Health Risk) MUST document safety
          // concerns in full. This is the canonical location per the v5.3
          // anti-redundancy rules. Mark as MANDATORY so the model knows it
          // cannot omit any item from the declared list.
          dynamicSuffix += "\n\n=== CLINICIAN-DECLARED SAFETY CONCERNS — DOCUMENT ALL OF THESE FULLY ===\n" + declaredBlock + "\nThese items have been explicitly declared by the assessing clinician as safety concerns for this participant. Each one MUST appear in your output for this section, framed clinically and attributed appropriately. Do not omit any item. If a particular item belongs more naturally in a different sub-section (12.1 Health, 12.2 Behavioural, 12.3 Mental Health, 12.4 BoC, 12.5 Supervision), route it there but ensure it appears.\n";
        } else if (section_name === "section2") {
          // S2 should mention briefly with cross-reference to S12.
          dynamicSuffix += "\n\n=== CLINICIAN-DECLARED SAFETY CONCERNS (brief mention only — full detail in S12) ===\n" + declaredBlock + "\nMention these briefly in the trauma/medical history paragraphs as relevant. Do NOT document in full — Section 12 carries the full account. Cross-reference S12 explicitly.\n";
        } else if (["section16","section17","section18"].includes(section_name || "")) {
          // Risks/recommendations sections should reference safety concerns
          // when justifying support intensity.
          dynamicSuffix += "\n\n=== CLINICIAN-DECLARED SAFETY CONCERNS (cross-reference S12) ===\n" + declaredBlock + "\nReference these where they justify the recommended support intensity or constitute a documented risk of insufficient funding. Do NOT restate in full — cross-reference S12.\n";
        }
        // Other sections: safety concerns are not injected. The model is
        // told via the cross-section lookback that S12 contains the detail.
      }
    }

    // Lookback context
    if (generated_sections && typeof generated_sections === "object") {
      let lb = "\n\n=== PREVIOUS SECTIONS (cross-ref only) ===";
      for (const [k, v] of Object.entries(generated_sections)) { if (v && (v as string).trim()) lb += `\n--- ${k} ---\n${v}\n`; }
      dynamicSuffix += lb;
    }

    // Build the structured system prompt: cached prefix + dynamic suffix.
    // The cached prefix is reused across calls within the 5-min TTL at ~10%
    // input cost. The dynamic suffix is sent fresh each call.
    const systemBlocks: SystemBlock[] = [
      { type: "text", text: cachedPrefix, cache_control: { type: "ephemeral" } },
    ];
    if (dynamicSuffix) {
      systemBlocks.push({ type: "text", text: dynamicSuffix });
    }

    const result = await callClaude(systemBlocks, prompt, max_tokens);

    // === POST-PROCESSING: Parse sub-areas if present ===
    let parsedSubAreas: Record<string, string> | null = null;
    if (result.text.includes("<<SUB_AREA:")) {
      parsedSubAreas = {};
      const regex = /<<SUB_AREA:\s*([^>]+)>>\s*([\s\S]*?)(?=<<SUB_AREA:|$)/g;
      let match;
      while ((match = regex.exec(result.text)) !== null) {
        const name = match[1].trim();
        const content = match[2].trim();
        parsedSubAreas[name] = content;
      }
    }

    // === POST-PROCESSING: Detect banned phrases ===
    // The v5.3 prompt rules and v5.2 rubric (B9) define banned stock phrases
    // that should appear at most once per full report. This per-call check
    // surfaces any banned-phrase usage in the response so the orchestrator
    // can either re-generate with stricter instructions or flag the section
    // for clinician review.
    //
    // The check is intentionally non-blocking: we always return the
    // generated text, even if it contains banned phrases. The frontend
    // decides what to do with the warnings.
    const bannedPhraseHits = detectBannedPhrases(result.text);

    // === OPT-IN LIGHT RUBRIC SELF-CHECK ===
    // When the caller passes self_check: true, run a small focused Claude
    // call against the generated text to evaluate ~8-10 high-impact rubric
    // criteria. Adds ~1k input + ~300 output tokens (~10x cheaper than the
    // main generation call). The result is structured pass/fail flags
    // surfaced in the response.
    let rubricCheck: { checks: RubricCheckResult[]; usage: any } | null = null;
    if (self_check === true) {
      rubricCheck = await runLightRubricCheck(result.text, section_name);
    }

    return new Response(JSON.stringify({
      success: true,
      text: result.text,
      sub_areas: parsedSubAreas,
      usage: result.usage,
      section_name: section_name || null,
      has_collateral_context: !!collateralContext,
      has_domain_collateral: !!domainCollateral,
      has_safety_alerts: hasSafetyAlerts,
      banned_phrase_hits: bannedPhraseHits,
      banned_phrase_count: bannedPhraseHits.reduce((acc, h) => acc + h.count, 0),
      rubric_check: rubricCheck,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
