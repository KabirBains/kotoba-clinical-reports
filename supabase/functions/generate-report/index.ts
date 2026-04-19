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
    // Collect matched Q/As from BOTH structured responses AND custom questions.
    // Custom questions were previously dropped entirely from domain sections;
    // they only reached Section 6.2 via formatCollateralForPrompt. This is the
    // Liaise Phase 3 fix — any question tied to a matching domain id should
    // flow through to the domain narrative alongside the structured answers.
    const qas: { q: string; a: string }[] = [];
    if (iv.responses) { for (const [key, val] of Object.entries(iv.responses)) { if (!val || !(val as string).trim()) continue; const lu = key.lastIndexOf("_"); if (lu === -1) continue; const did = key.substring(0, lu); const qi = parseInt(key.substring(lu + 1)); if (ids.includes(did)) { const dq = qs[did] || []; qas.push({ q: dq[qi] || `Q${qi+1}`, a: val as string }); } } }
    if (iv.customQuestions) { for (const [did, customs] of Object.entries(iv.customQuestions)) { if (!ids.includes(did) || !Array.isArray(customs)) continue; for (const cq of customs) { if (cq?.question && cq?.response && (cq.response as string).trim()) { qas.push({ q: `${cq.question} (custom)`, a: cq.response as string }); } } } }
    if (qas.length) {
      parts.push(`From ${label}:`);
      for (const qa of qas) { parts.push(`  Q: ${qa.q}`); parts.push(`  A: ${qa.a}`); }
      // Attach generalNotes ONLY when this informant contributed matched Q/As
      // for the current domain. Without the qas.length gate, every informant's
      // generalNotes would leak into every domain section regardless of
      // relevance, which is the opposite of what the DOMAIN_TO_COLLATERAL
      // filter is designed to enforce.
      if (iv.generalNotes && (iv.generalNotes as string).trim()) {
        parts.push(`  General notes from ${label}: ${(iv.generalNotes as string).trim()}`);
      }
      parts.push("");
    }
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

// ── DETERMINISTIC POST-PROCESSING ────────────────────────────
// The v5.3 prompt rules block catches a lot of quality issues, but the
// v1-vs-v2 audit showed that some patterns are consistently ignored by
// the model:
//   • `**Section Name**` markdown headings re-declared in prose
//   • `**12.1 Subheading**` numbered sub-headings in prose
//   • `Evidence: As per standardised assessment...` literal template leak
//   • `Mr. Jane Doe (referred to as Jane for the remainder of the report)`
//     formula appearing in sections other than 1/2
//   • Hallucinated demographic details ("younger brother" when notes don't
//     specify birth order)
//   • Speculation stated as fact ("apparent disinterest", "appears disoriented")
//     without "In the assessor's clinical opinion" attribution
//   • "mental health risks" closers in sections where mental health
//     was never established
//
// This function runs server-side AFTER Claude responds but BEFORE sub-area
// parsing and banned-phrase detection. Everything here is deterministic
// regex work — no extra Claude calls, no extra tokens, no cost.
//
// Order of operations matters:
//   1. Strip whole-line markdown headings FIRST (removes lines entirely)
//   2. Strip Evidence block (whole line)
//   3. Strip first-mention formula (only outside Section 1/2)
//   4. Rewrite hallucinated demographics (in-place word substitution)
//   5. Auto-attribute speculation (sentence-level prefix)
//   6. Strip hallucinated "mental health risks" from closings
//   7. Strip residual `**bold**` markers (keep the text inside)
//   8. Collapse the multiple-blank-lines introduced by the above steps

const SPECULATION_TRIGGERS = /\b(?:apparent(?:ly)?|appears?(?: to)?|seem(?:s|ingly)?|clearly prefers|demonstrates (?:enjoyment|preference)|profound disinterest|apparent disinterest)\b/i;

function postProcessClaudeOutput(
  rawText: string,
  sectionName: string | undefined,
  participantFirstName?: string,
  participantFullName?: string,
): string {
  if (!rawText || typeof rawText !== "string") return rawText;
  let text = rawText;

  // Build a set of "first words" that should keep their initial capital
  // when we prepend "In the assessor's clinical opinion, " to a sentence.
  // These are proper nouns (participant names) the AI is likely to lead a
  // sentence with — we shouldn't lowercase them to "john's presentation".
  const keepCapitals = new Set<string>();
  if (participantFirstName) keepCapitals.add(participantFirstName.toLowerCase());
  if (participantFullName) {
    for (const part of participantFullName.split(/\s+/)) {
      if (part) keepCapitals.add(part.toLowerCase());
    }
  }

  // 1. Strip `**Section Name**` whole-line markdown headings.
  // Matches lines like `**Social Environment**`, `**Informal Supports**`,
  // `**12. Risk & Safety Profile**` — standalone lines only, so we don't
  // catch legitimate inline bold (which we'll also strip later anyway).
  text = text.replace(/^\s*\*\*[^*\n]+\*\*\s*$/gm, "");

  // 2. Strip `**12.1 Subheading**` numbered markdown sub-headings.
  // Belt-and-braces for Risk & Safety which uses numbered subsections.
  // (Already caught by rule 1 since it's whole-line, but explicit for safety.)
  text = text.replace(/^\s*\*\*\d+\.\d+[^*\n]+\*\*\s*$/gm, "");

  // 3. Strip the `Evidence: As per standardised assessment...` template leak.
  // This is a v5.3 template marker that Claude keeps emitting as literal prose.
  text = text.replace(/^\s*Evidence:\s*As per standardised[^\n]*\n?/gim, "");

  // 4. Strip the first-mention formula ("Mr. X (referred to as Y for the
  // remainder of the report)") when appearing OUTSIDE Section 1/2.
  // Sections 1 and 2 are where the formal introduction legitimately belongs.
  const isFirstMentionAllowed = sectionName === "section1" || sectionName === "section2";
  if (!isFirstMentionAllowed) {
    // Match: Title First Last (referred to as First for the remainder of the report)
    // Then some optional connector (comma, space, "is", etc.)
    // Preserve the first name by capturing it and reinserting.
    text = text.replace(
      /(?:Mr\.?|Ms\.?|Mrs\.?|Miss|Mx\.?)\s+[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+)*\s*\(referred to as ([A-Z][A-Za-z'\-]+)\s+for the remainder of the report\)\s*/g,
      "$1 ",
    );
  }

  // 5. Rewrite hallucinated birth-order demographics.
  // The AI invents "younger brother", "older sister" etc. when the notes
  // don't specify birth order. Collapse to just the relationship.
  text = text.replace(/\b(?:younger|older|elder)\s+(brother|sister|sibling)\b/gi, "$1");

  // 6. Auto-attribute speculation. For any sentence containing a speculation
  // trigger word that is not already attributed with "in the assessor's
  // clinical opinion" (case-insensitive), prepend the attribution phrase.
  //
  // We split into sentences by `. ` / `? ` / `! ` boundaries (simple but
  // effective for clinical prose; the AI rarely uses multi-sentence blocks
  // without standard punctuation). For each sentence we test the triggers
  // and check whether the phrase is already present anywhere in the
  // sentence — if not, we prepend.
  //
  // We deliberately DO NOT rewrite the trigger word itself because the
  // rewording is context-dependent and would risk bad grammar. Attribution
  // is enough to flag the claim as inferred rather than observed.
  text = text.replace(/([^.!?\n]+[.!?])(\s+|$)/g, (match, sentence, trailing) => {
    const s = sentence as string;
    const t = trailing as string;
    if (!SPECULATION_TRIGGERS.test(s)) return match;
    // Already attributed somewhere in this sentence?
    if (/in the assessor['']s (?:clinical )?(?:opinion|view|judgement)/i.test(s)) {
      return match;
    }
    // Prepend the attribution. Lowercase the first letter so the grammar
    // reads naturally: "In the assessor's clinical opinion, he appears
    // disoriented..." — UNLESS the first word is a proper noun (like the
    // participant's name), in which case we keep its capital: "In the
    // assessor's clinical opinion, John's presentation indicates...".
    const lead = s.trimStart();
    const firstWordMatch = lead.match(/^([A-Za-z'\-]+)/);
    const firstWord = firstWordMatch ? firstWordMatch[1] : "";
    // Strip a trailing possessive "'s" for the lookup so "John's" matches "john".
    const firstWordBase = firstWord.replace(/['']s$/i, "").toLowerCase();
    const isProperNoun = keepCapitals.has(firstWordBase);
    const firstChar = lead.charAt(0);
    const rest = lead.slice(1);
    const adjusted = !isProperNoun && firstChar === firstChar.toUpperCase() && /[A-Za-z]/.test(firstChar)
      ? firstChar.toLowerCase() + rest
      : lead;
    return `In the assessor's clinical opinion, ${adjusted}${t}`;
  });

  // 7. Strip hallucinated "mental health risks" from closings.
  // The AI's default closer pattern keeps inserting this even when mental
  // health has not been clinically established in the section. We only
  // remove the clause when the rest of the section does NOT mention
  // "mental health" at all — keeping legitimate mental-health references
  // untouched.
  const hasMentalHealthContext = /mental health/i.test(text.replace(/mental health risks?/gi, ""));
  if (!hasMentalHealthContext) {
    // Strip a range of closer patterns that add "mental health risks"
    // without context — sentence-level only.
    text = text.replace(/[^.!?\n]*\bmental health risks?\b[^.!?\n]*[.!?]\s*/gi, "");
    // Also strip a common phrase fragment: "and its associated mental health risks"
    text = text.replace(/,?\s*and its associated mental health risks?/gi, "");
  }

  // 8. Strip residual `**bold**` markers that aren't whole-line headings.
  // Runs twice to catch adjacent bold blocks. This is the same pattern
  // from stripMarkdown() in the client utils — we apply it here too so
  // the server-side output is already clean.
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  text = text.replace(/\*{2,}/g, "");

  // 9. Collapse multiple blank lines that the strips may have created.
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // 10. Insert cross-section citations. Runs LAST so it operates on already-
  // cleaned prose (no markdown artefacts to confuse the sentence splitter).
  // See insertCrossSectionCitations() for the trigger table and self-
  // citation guards. Skipped entirely when the caller didn't supply a
  // sectionName (we can't guard against self-citation without it).
  if (sectionName) {
    text = insertCrossSectionCitations(text, sectionName);
  }

  return text;
}

// ── Cross-section citation insertion ─────────────────────────
// The prompt rule asking the AI to cite other sections is ignored in
// practice (v1, v2, v3 simulations all produced 0 citations). This
// post-processor scans the output for reliable trigger phrases and
// inserts `(see Section N — [Name])` at the end of the matched sentence.
//
// Four categories of trigger:
//   • Collateral attributions (mother/parent/carer/support worker reported)
//     → Section 6 — Collateral Information
//   • Standardised assessment names (WHODAS, DASS, LSP-16, etc.)
//     → Section 14 — Standardised Assessments
//   • Safety incident references (documented falls, choking, absconding)
//     → Section 12 — Risk & Safety Profile
//   • Functional findings from another domain (mobility limitations,
//     cognitive deficits when written OUTSIDE the relevant domain section)
//     → Section 13 — Functional Capacity
//
// Self-citation guards prevent a section from citing itself:
//   • Section 6* guards skip collateral citations
//   • Section 12* / 13* guards skip risk/functional citations
//   • Section 14*/15* guards skip assessment citations
//
// Guardrails:
//   • Max 4 citations per section (clutter protection)
//   • Never cite a sentence that already has a citation (idempotency)
//   • Insert at end-of-sentence, before terminal punctuation (grammar safety)

interface CitationRule {
  target: string; // the citation text to insert
  skipIfSectionStartsWith: string[]; // self-citation guard prefixes
  trigger: RegExp; // sentence-level match
}

// Citation targets use section NAMES, not numbers. The user's Lovable
// source-of-truth re-orders and renames sections, so number-based
// citations would become wrong the moment the template migrates. Name-
// based citations remain correct across any renumbering.
//
// Collateral attribution ("mother reported", "support worker observed")
// is INTENTIONALLY excluded from citation insertion. In the new Lovable
// SoT there is no dedicated Collateral Information section — collateral
// data lives inside "Methodology and Assessments used". Rather than cite
// the methodology section for every attributed sentence, we let the
// attribution stand on its own (the informant's name/role in the
// sentence is already the evidence trail).
const CITATION_RULES: CitationRule[] = [
  {
    target: "(as documented in the Assessments section)",
    skipIfSectionStartsWith: ["section14", "section15"],
    // Assessment tool names. These are unambiguous — if WHODAS or DASS
    // appears in prose outside the Assessments section, it's a cross-
    // reference that should point the reader there.
    trigger: /\b(?:WHODAS(?:[\s-]?2\.0)?|DASS[\s-]?42|LSP[\s-]?16|FRAT\b|Lawton(?:\s+IADL)?|\bCANS\b|Zarit(?:[\s-]?22)?|Vineland(?:[\s-]?3)?|Sensory Profile|standardised assessment(?:\s+scores?)?)\b/i,
  },
  {
    target: "(as documented in the Risk & Safety Profile section)",
    skipIfSectionStartsWith: ["section12"],
    // Specific safety-incident language that the AI uses when referring
    // back to established risks. Deliberately narrow — generic words like
    // "risk" would false-positive. "Identified" was removed because it
    // false-positives on negation ("no safety concerns identified during
    // assessment").
    trigger: /\b(?:previous choking incident|documented (?:falls|choking|absconding|self[\s-]?harm)|history of (?:falls|absconding|self[\s-]?harm|hospitalisations?)|critical incident (?:documented|reported)|safety (?:concerns?|risks?|vulnerabilit(?:y|ies)) (?:described|documented) (?:in|elsewhere))/i,
  },
  {
    target: "(as documented in the Functional Capacity section)",
    skipIfSectionStartsWith: ["section12_", "section13"],
    // Functional findings written about outside the functional-capacity
    // sub-sections. Guards against section12_N / section13_N (the domain
    // sub-sections themselves) which ARE Functional Capacity and shouldn't
    // self-cite.
    trigger: /\b(?:(?:his|her|their) mobility limitations|(?:his|her|their) cognitive (?:deficits|limitations|impairments?)|(?:his|her|their) communication (?:impairments?|difficulties)|functional (?:capacity )?findings described|as (?:documented|established) in the functional capacity)/i,
  },
];

// Regex matching a complete sentence — anything up to the next ., !, or ?
// followed by whitespace or end-of-text. Used to split-and-rebuild the text
// without changing the surrounding formatting.
const SENTENCE_SPLIT = /([^.!?\n]+[.!?])(\s+|$)/g;

function insertCrossSectionCitations(text: string, sectionName: string): string {
  if (!text || !sectionName) return text;

  // Decide which rules apply for THIS section (self-citation guards).
  const applicableRules = CITATION_RULES.filter(
    (rule) => !rule.skipIfSectionStartsWith.some((prefix) => sectionName.startsWith(prefix)),
  );
  if (applicableRules.length === 0) return text;

  let citationCount = 0;
  const MAX_CITATIONS_PER_SECTION = 4;

  const rebuilt = text.replace(SENTENCE_SPLIT, (match, sentence: string, trailing: string) => {
    if (citationCount >= MAX_CITATIONS_PER_SECTION) return match;
    const s = sentence;

    // Skip if this sentence already contains ANY citation. Prevents
    // double-citation when the AI already obeyed the prompt rule for part
    // of the output or when a previous iteration added one.
    if (/\(see Section\s+\d+/i.test(s)) return match;

    // Skip if the sentence is a NEGATION. Regex triggers can't tell "X was
    // documented" from "no X was documented" — both match the same keyword.
    // If the sentence asserts absence rather than reference, don't cite.
    // Matches leading "No ", "Without ", "Nil ", "None ", or mid-sentence
    // "no [trigger]" / "without [trigger]" phrasing.
    if (/^\s*(?:No|Without|Nil|None|No evidence of|No history of|No documented)\b/i.test(s.trimStart())) return match;
    if (/\b(?:without|no|nil|none|no evidence of|no documented|no history of)\s+(?:safety|behavioural|cognitive|mobility|communication|self[\s-]?harm|aggression|falls?|choking|absconding)\b/i.test(s)) return match;

    // Find the first applicable rule whose trigger matches this sentence.
    for (const rule of applicableRules) {
      if (rule.trigger.test(s)) {
        // Insert the citation before the terminal punctuation.
        const terminal = s.slice(-1); // ".", "!", or "?"
        const body = s.slice(0, -1);
        citationCount++;
        return `${body} ${rule.target}${terminal}${trailing}`;
      }
    }
    return match;
  });

  return rebuilt;
}

// Apply post-processing to a single JSON-domain response. Domain sections
// return structured JSON where each value is a string of per-field prose;
// we post-process each value in-place and return a re-serialised JSON
// string so the client sees cleaned text.
function postProcessDomainJson(
  rawText: string,
  sectionName: string | undefined,
  participantFirstName?: string,
  participantFullName?: string,
): string {
  try {
    let cleaned = rawText.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace > 0 || lastBrace < cleaned.length - 1) {
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = typeof v === "string"
        ? postProcessClaudeOutput(v, sectionName, participantFirstName, participantFullName)
        : String(v ?? "");
    }
    return JSON.stringify(out);
  } catch {
    // Not JSON — treat as text.
    return postProcessClaudeOutput(rawText, sectionName, participantFirstName, participantFullName);
  }
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
      // Clinical Spine — pre-computed structured reasoning backbone.
      // When present, injected into the dynamic suffix so Claude can
      // reference anchor impairments, recurring consequences, and
      // cross-domain links when writing each section. Produced by the
      // clinical-spine edge function before the generation queue starts.
      clinical_spine,
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

    // === SECTION-WRITING DISCIPLINE ===
    // Six clinical writing rules with rationale. Placed early in the
    // dynamic suffix so the model encounters them before per-section
    // routing. Each rule preserves the RULE / Why / Forbidden / Correct
    // structure so Claude understands the rationale, not just the
    // constraint.
    dynamicSuffix += `

=== SECTION-WRITING DISCIPLINE ===

RULE: No in-prose section headings or numbering.
Why: The document renderer adds all section titles and numbering. When the AI emits "## Informal Supports" or "**12.1 Health Risks**" or "## Social Environment" inside its prose, those appear as visible markdown in the final report because the renderer already has a heading above.
Forbidden: emitting any of these inside your output — "## [anything]", "**Section [anything]**", "**[section title]**", "12.1", "12.2", "13.3" or similar numbered sub-section references, any line that restates the section name you were asked to write.
Correct: start directly with the first clinical sentence. Example for a Risk & Safety section: start with "John presents with significant nutritional risks..." — do NOT start with "## Risk & Safety Profile" or "**12.1 Health Risks**".

RULE: Do not emit template evidence-citation blocks.
Why: The v5.3 prompt template contains an "Evidence: As per standardised assessment; as evident in functional assessment and observations; as evident in interviews; collateral information; reviewed reports." line as a template marker. This is documentation, not something to print.
Forbidden: emitting the string "Evidence: As per standardised assessment" or any variant starting with "Evidence:" as a literal line in your prose.
Correct: weave evidence sources into sentences naturally — e.g. "John's support coordinator reported..." or "Observations during the home visit revealed..." — but never as a bulleted or labelled "Evidence:" line.

RULE: Do not infer or invent demographic details.
Why: Anything the AI invents becomes a clinical claim the assessor is professionally accountable for. Invented details can misrepresent the family and create legal/ethical risk.
Forbidden inferences: birth order ("younger brother", "older sister") unless explicitly stated; ages of family members not supplied; employment status of family members not supplied; marital/relationship history not supplied; reason someone stopped working; whether a sibling is adult or child unless their age is given; whether parents are together or separated unless stated.
Correct: if the notes say "lives with mother, father, and brother", write "resides in the family home with his mother, father, and brother" — NOT "resides with his parents and younger brother".

RULE: The formal first-mention introduction belongs only in Section 1 or 2.
Why: Repeating "Mr. John Smith (referred to as John for the remainder of the report)" at the start of every section is noise — the reader already knows who John is after Section 1.
Forbidden: opening Sections 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, or any functional domain sub-section with the full "Mr. [Full Name] (referred to as [First])" formula.
Correct: use the first name directly — "John presents with...", "John attends his respite centre...", etc. The ONLY place the formal introduction appears is in Section 1 (Reason for Referral) or, if Section 1 doesn't introduce him, Section 2 (Background).

RULE: Attribute to the single most causally relevant diagnosis, not all of them.
Why: Writing "secondary to his Autism Spectrum Disorder Level 3 and Severe Intellectual Disability" after every single observation is clinically imprecise and reads as boilerplate. An assessor wants to see that the clinician has thought about WHICH diagnosis drives WHICH deficit.
Forbidden: listing every supplied diagnosis for every limitation ("secondary to his ASD Level 3 and Severe Intellectual Disability" used 10+ times in a single report).
Correct: pair each finding with the diagnosis most causally linked to it. Examples: non-speaking presentation → "secondary to his Autism Spectrum Disorder Level 3"; inability to operate a washing machine → "secondary to his Severe Intellectual Disability"; restricted food preferences → "characteristic of his Autism Spectrum Disorder"; lack of safety awareness in community → "secondary to his Severe Intellectual Disability". If a finding is genuinely driven by both, then both is appropriate — but the default should be one.

RULE: Consistent parent/carer reference form.
Why: Switching between "Mo", "his mother Mo", "John's mother", and "the mother" within a single report reads as careless and creates ambiguity.
Convention: at first mention of the parent/carer in any given section, use their name and relationship in full ("his mother, Mo") — but only on the FIRST mention in that section. After that, use just the first name ("Mo") for the rest of the section. Do not switch to "his mother" or "John's mother" later. Across sections, each section can re-introduce ("his mother, Mo") on its first mention and then use just the name.

=== ENFORCEABLE QUALITY RULES (count before returning) ===

RULE: INTENSIFIER BUDGET.
Why: A scan of a real generated report found ~80 intensifier occurrences in 23 paragraphs. This reads as AI pattern-matching, not clinical observation. Clinical authority comes from specifics, not adverbs.
Hard caps per section (count before returning your output):
- "significantly" / "significant" (combined): max 2 per section
- "profound" / "profoundly" (combined): max 1 per section
- "severe" / "severely" (combined): max 2 per section, AND the word "severe" as part of a diagnosis name (e.g. "Severe Intellectual Disability") does NOT count toward this cap
- "markedly" / "marked": max 1 per section
- "substantially" / "substantial": max 1 per section
- "complete" / "completely": max 2 per section
If you find yourself exceeding any cap, rewrite the sentence to use a concrete anchor instead. Example rewrites:
  "severely impaired attention span" → "attention span of 2-3 seconds"
  "significantly limits his ability to" → "prevents him from" OR "eliminates his capacity to"
  "profound social withdrawal" → "lies on the stage during group activities and does not respond to peer overtures"
  "complete dependence on his mother" → "his mother provides all [specific task]"
If your output has the intensifier before a quantified fact (number, frequency, time), DELETE the intensifier. The number carries the weight. Examples:
  WRONG: "markedly impaired memory, becoming consistently lost"
  RIGHT: "memory impairment — consistently becomes lost in familiar places, with the exception of his home"

RULE: SPECULATION MUST BE ATTRIBUTED.
Why: A scan found 6 instances of "apparent/appears/seems" asserting internal states as fact, and 0 uses of clinical-opinion attribution. Asserting inferred mental states as observation is a clinical methodology error.
Trigger words (treat these as REQUIRING either attribution or rewrite):
  apparent, apparently, appears, appears to, seems, seemingly, clearly [verb], evidently, obviously, demonstrates enjoyment of, demonstrates preference for, finds [X] [adjective], is [uncomfortable/comfortable] with, dislikes, prefers, enjoys (except when directly reported by participant/carer)
Two acceptable treatments:
  (A) REWRITE as observable behaviour. "apparent disinterest in social interaction" → "does not initiate social contact and does not respond to peer overtures without intensive prompting"
  (B) ATTRIBUTE to assessor opinion. "In the assessor's clinical opinion, [name] presents as [state], evidenced by [observable behaviour]."
Use (A) whenever possible. Use (B) only when the inference is clinically necessary and cannot be expressed as pure behaviour.
Forbidden pattern: "[name] appears [adjective]" or "[name]'s [noun] appears [adjective]" stated as fact without either rewrite or attribution.

RULE: CROSS-SECTION CITATION WHEN REFERENCING INFORMATION FROM ANOTHER SECTION.
Why: A scan found 0 cross-section references in 30KB of prose. When a section cites "collateral information from the Positive Behaviour Support Practitioner" but doesn't say WHICH section the collateral lives in, the reader cannot trace the evidence.
Rule: When you reference information whose primary source lives in a different section of the report, cite it by section name or number:
  Collateral → "(see Section 6 — Collateral Information)" or "as documented in Section 6"
  Standardised assessment scores → "(see Section 14/15 — Standardised Assessments)"
  Safety/risk incidents → "(see Section 12 — Risk and Safety Profile)"
  Functional capacity findings → "(see Section 13 — Functional Capacity)"
  Diagnoses (when mentioned outside Section 4) → "(see Section 4 — Diagnoses)"
Do NOT apply to: observations made directly within the current section; the clinician's own observations during assessment (those don't need citation because the current section IS the source).
Example: "John's mother reported he experiences medication aversion (see Section 6, Collateral Summary)." Not: "John's mother reported he experiences medication aversion."

RULE: NO GENERIC CLOSING BOILERPLATE.
Why: Closings like "without intervention he faces continued isolation and missed opportunities for meaningful participation" are pattern-matchable AI filler. An experienced NDIS reviewer recognises them on sight.
Banned in closing sentences (last sentence or last paragraph of any section):
  "missed opportunities for [generic noun]"
  "continued [isolation/withdrawal/deterioration]" without a specific named cause
  "improved quality of life through [anything generic]"
  "meaningful [participation/engagement/connection]" when not tied to a specific documented activity
  "associated mental health risks" (unless mental health HAS been clinically established in this section)
  "ongoing monitoring to prevent [generic outcome]"
Rule: The closing sentence of each section must name at least ONE concrete finding, consequence, or intervention from this section's own content. If the section documented "fell twice last month in bathroom", close with a bathroom-fall-specific consequence. If the section documented "carer burnout in a 72-year-old mother with T2DM", close with an age-and-health-specific sustainability consequence.
Test before finalising: does this closing sentence make sense if pasted into a different section of a different participant's report? If YES, it's boilerplate — rewrite it with section-specific content.
`;

    // === CLINICAL SPINE ===
    // When the clinical-spine edge function has pre-computed a reasoning
    // backbone, inject it so the model can reference anchor impairments
    // and cross-domain links when writing this section. The spine is
    // participant-level context (not section-specific) so it goes before
    // collateral routing.
    if (clinical_spine && typeof clinical_spine === "object") {
      const spineJson = JSON.stringify(clinical_spine, null, 2);
      dynamicSuffix += `\n\n=== CLINICAL SPINE (reasoning backbone — use to inform this section) ===
The following Clinical Spine was derived from the participant's diagnoses, assessment scores, clinician notes, and collateral information. It identifies the anchor impairments, recurring consequences, and cross-domain links that should thread through the report.

USE THE SPINE TO:
- Reference the specific anchor impairments relevant to THIS section's domain
- Connect observations to the recurring consequences identified in the spine
- Use the diagnosis-function chains to link clinical findings back to named diagnoses
- Ensure your prose is consistent with the cross-domain links (if the spine says an impairment affects this domain, address it)

DO NOT:
- Copy the spine text verbatim — it is a reasoning scaffold, not report prose
- Invent new impairments or consequences not in the spine
- Contradict the spine's clinical reasoning

${spineJson}
`;
    }

    // === COLLATERAL ROUTING ===
    let collateralContext = ""; let domainCollateral = ""; let safetySummary = ""; let hasSafetyAlerts = false;

    if (collateral_interviews && Array.isArray(collateral_interviews) && collateral_interviews.length > 0) {
      collateralContext = formatCollateralForPrompt(collateral_interviews);
      safetySummary = extractSafetySummary(collateral_interviews);
      hasSafetyAlerts = !!safetySummary;
      if (domain_hint) domainCollateral = extractCollateralForDomain(collateral_interviews, domain_hint);

      if (section_name === "section6" || section_name === "section6_collateral") {
        dynamicSuffix += "\n\n=== FULL COLLATERAL — GENERATE SECTION 6 ===\n" + collateralContext;
      } else if (section_name === "section6_informant") {
        // Per-informant Section 6.2 summary (Liaise Phase 2).
        // The caller passes collateral_interviews with a SINGLE entry —
        // the informant whose formal attributed summary this call is
        // generating. formatCollateralForPrompt naturally focuses on
        // that entry; we add a framing directive so the model produces
        // an ATTRIBUTED single-informant summary rather than a generic
        // section 6 dump.
        dynamicSuffix += "\n\n=== INFORMANT COLLATERAL — GENERATE ATTRIBUTED 6.2 SUMMARY ===\n";
        dynamicSuffix += "Write a formal collateral summary focused EXCLUSIVELY on the single informant below. Every clinical statement in your output must be attributed to this informant by name and role. Do not reference other informants (there are none in this payload). Do not write in the participant's or clinician's voice — this is a second-hand account.\n\n";
        dynamicSuffix += collateralContext;
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

    // === RECOMMENDATIONS-SPECIFIC: PARTICIPANT-SPECIFIC CONSEQUENCE RULE ===
    // When generating Section 17 (Recommendations) narratives, the model
    // must produce a participant-specific consequence statement for every
    // recommendation. Generic phrasing ("functional decline", "social
    // isolation", "deterioration in daily functioning") is forbidden by
    // rubric criterion B11 (consequence specificity).
    //
    // This directive runs regardless of whether collateral_interviews are
    // present. It catches the case where the recommendations builder
    // produces a recommendation with a blank consequence field (the new
    // default after the participant-specific consequences refactor) and
    // ensures the model derives the consequence from the cross-section
    // lookback rather than falling back to boilerplate.
    if (section_name === "section17") {
      dynamicSuffix += "\n\n=== CONSEQUENCE STATEMENT REQUIREMENT (CRITICAL) ===\n" +
        "Every recommendation in this section MUST include a consequence statement that is SPECIFIC to this participant. The consequence must:\n" +
        "  1. Name the participant directly (use the first name set in the PARTICIPANT block).\n" +
        "  2. Reference at least one specific finding from the cross-section context (functional capacity, risk profile, assessment scores, or carer sustainability).\n" +
        "  3. Name a concrete risk pathway — what specifically happens to this participant if the support is not provided.\n" +
        "  4. Avoid generic phrases that would apply to any participant. The following are FORBIDDEN unless followed by a participant-specific consequence in the same sentence: 'functional decline', 'social isolation' (after first use), 'deterioration in daily functioning', 'reduced quality of life', 'increased risk of harm'.\n" +
        "  5. Use the format: 'Without this support, [first name] is at risk of [specific outcome] given [specific finding from earlier sections].'\n\n" +
        "If a recommendation in the input has a blank or generic consequence field, you MUST construct a participant-specific consequence using the cross-section context. Do NOT pad with boilerplate. Do NOT skip the consequence — every recommendation must have one.\n";
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

    // === POST-PROCESSING: Deterministic cleanup ===
    // Strip markdown headings, template leaks, first-mention formula outside
    // Section 1/2, demographic hallucinations, and auto-attribute speculation.
    // See postProcessClaudeOutput() doc block above for the full list of rules
    // and why they live here rather than in the prompt.
    //
    // Domain JSON responses (e.g. Mobility, Personal ADLs) have per-field
    // values that each need cleaning, so we route those through a JSON-aware
    // wrapper that parses, cleans each value, and re-serialises.
    const isDomainSection = !!section_name && /^section(12|13)_\d+$/.test(section_name);
    if (isDomainSection) {
      result.text = postProcessDomainJson(result.text, section_name, firstName, fullName);
    } else {
      result.text = postProcessClaudeOutput(result.text, section_name, firstName, fullName);
    }

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
