// ============================================================
// FCA REPORT ENGINE — src/ai/reportEngine.ts
// ============================================================
// This file contains ALL prompts and AI functions for the
// FCA report writing system. It calls the edge function to
// transform clinician dot-point observations into NDIS clinical prose.
// ============================================================

// ── 1. MASTER SYSTEM PROMPT ──────────────────────────────────

const SYSTEM_PROMPT = `You are an expert clinical report writing assistant for Occupational Therapists in the Australian NDIS framework.

YOUR ROLE:
- Transform structured clinical observations into formal, NDIS-quality written prose.
- You write what the clinician tells you. You do NOT make clinical judgements.
- You do NOT infer, assume, or add information not provided by the clinician.
- You do NOT recommend supports the clinician has not specified.
- When interpreting assessment scores, you describe what the scores indicate according to the tool's published scoring criteria.

WRITING STANDARDS:
- Person-first language at all times. Use participant's name or 'the participant'.
- Third person. Active voice preferred.
- NDIS terminology: reasonable and necessary, functional capacity, support needs, participant, informal supports, capacity building.
- Observation → functional impact → support need in every domain paragraph.
- No bullet points in output — continuous prose paragraphs only.
- Do NOT use markdown formatting in output. No ## headings, no ** bold **, no * italics *, no bullet point characters.
- Use plain text only. Headings and formatting will be applied by the document template.
- When you need to indicate a heading for a recommendation, just write it on its own line in plain text like: Personal Care Support (Core)
- Clinical prognosis is acceptable when attributed: 'In the assessor's clinical opinion...'
- Do NOT use unattributed speculation: 'it appears', 'may be due to', 'could suggest'.
- Professional, measured, objective tone. No emotive language or value judgements.
- Write at a level suitable for NDIS planners and potential AAT review.

CROSS-REFERENCING:
- When generating assessment interpretations or recommendations, cross-reference findings from other completed sections to identify corroborating observations.
- Attribution format: 'This finding is consistent with [observation] documented in Section [X] of this report.'
- Only cross-reference information the clinician has actually entered.

CONSTRAINTS:
- Never fabricate scores, dates, clinical findings, or hours.
- If clinician input is insufficient, write: [Information not provided — clinician to complete]
- Output only the report section text — no preamble, no commentary, no sign-off.`;


// ── 2. SECTION PROMPTS ───────────────────────────────────────

const SECTION_PROMPTS: Record<string, (input: any) => string> = {

  reason_for_referral: (input) => `Write the 'Reason for Referral' section of an NDIS Functional Capacity Assessment for ${input.client_name}.

CLINICIAN INPUT:
- Referral source and date: ${input.referral_source || '[Not provided]'}
- Purpose of assessment: ${input.purpose || '[Not provided]'}
- Funding context: ${input.funding_context || '[Not provided]'}
- Supports currently in place: ${input.current_supports || '[Not provided]'}
- Supports being requested: ${input.supports_requested || '[Not provided]'}

Write 2 paragraphs. Paragraph 1: who referred, when, and why. Paragraph 2: purpose of the assessment in NDIS context and what supports this report will inform. No bullet points. Formal NDIS language throughout.`,

  background: (input) => `Write the 'Background Information' section of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- Participant overview: ${input.participant_overview || '[Not provided]'}
- Living situation: ${input.living_situation || '[Not provided]'}
- Education/work history: ${input.education_work || '[Not provided]'}
- Psychosocial history: ${input.psychosocial_history || '[Not provided]'}
- Medical history: ${input.medical_history || '[Not provided]'}
- Current treating team: ${input.treating_team || '[Not provided]'}

Write 4 paragraphs: (1) participant overview, (2) living situation and family context, (3) education, work history, and mental health background, (4) medical history and treating team. Be clinically precise about mental health history — do not soften or omit significant history.`,

  goals: (input) => `Write the 'Participant Goals' section of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- NDIS goals (participant's own words): ${input.ndis_goals || '[Not provided]'}
- OT therapeutic goals: ${input.ot_goals || '[Not provided]'}

NDIS goals: present in participant's own voice, first person. OT goals: formal therapeutic objectives linked to NDIS goals. Do not add goals the clinician has not listed.`,

  diagnoses: (input) => `Write the 'Diagnoses' section of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- Primary diagnosis: ${input.primary_dx || '[Not provided]'}
- Secondary diagnoses: ${input.secondary_dx || '[Not provided]'}
- Comorbid conditions: ${input.comorbidities || '[Not provided]'}
- Diagnosis description: ${input.dx_description || '[Not provided]'}
- Functional impact summary: ${input.functional_impact || '[Not provided]'}

Paragraph 1: define each diagnosis in plain English — what it is, how it typically presents. This is for planners who may not have clinical training. Paragraph 2: how the diagnoses collectively impact daily functioning.`,

  allied_health_history: (input) => `Write the 'Allied Health Case History' section of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- Allied health disciplines involved: ${input.disciplines || '[Not provided]'}
- Details per discipline (duration, focus, efficacy): ${input.discipline_details || '[Not provided]'}
- Assessment type: ${input.assessment_type || 'Initial'}

For each discipline with an existing therapeutic relationship, write 1-2 paragraphs covering how long the clinician has supported the participant, focus and efficacy of interventions. If initial assessment with no prior involvement, state this clearly.`,

  methodology: (input) => `Write the 'Methodology' section (Section 6) of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- Observation dates and settings: ${input.observation_details || '[Not provided]'}
- Collateral sources: ${input.collateral_sources || '[Not provided]'}
- Environmental assessment: ${input.environment_assessment || '[Not provided]'}

Write 2-3 paragraphs: (1) direct observation details, (2) collateral sources reviewed, (3) environmental assessment. Standardised assessment tools are documented in Section 13 and should NOT be listed here.`,

  informal_supports: (input) => `Write the 'Informal Supports' section of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- Primary carer details: ${input.carer_details || '[Not provided]'}
- Nature and frequency of support: ${input.support_provided || '[Not provided]'}
- Carer health/capacity issues: ${input.carer_health || '[Not provided]'}
- Carer burnout identified: ${input.carer_burnout || '[Not provided]'}
- Sustainability risks: ${input.sustainability_risks || '[Not provided]'}

Paragraph 1: describe informal support network. Paragraph 2: assess carer capacity and sustainability risks. Link sustainability risk to the need for formal NDIS supports.`,

  functional_domain: (input) => `Write the '${input.domain_name}' subsection of Section 12 (Functional Capacity) of an NDIS FCA for ${input.client_name}.

DOMAIN: ${input.domain_name}
FUNCTIONAL RATING: ${input.functional_level || '[Not provided]'}

CLINICIAN OBSERVATIONS (transform these dot points into prose):
${input.raw_observations || '[Not provided]'}

SUPPORT NEED IDENTIFIED: ${input.support_need || '[Not provided]'}
DIAGNOSIS CONTEXT: ${input.diagnosis_context || '[Not provided]'}
RELEVANT ASSESSMENT SCORES: ${input.assessment_scores || 'None available yet'}

Write 2-3 paragraphs:
1. What was observed — strengths AND limitations with specific examples. Reference assessment scores where available.
2. Functional impact on daily life.
3. Close with a clear support need statement.

Rules: Transform dot points into prose. Reference diagnosis where linked. Clinical prognosis must be attributed. Do not add observations not provided.`,

  limitations: (input) => `Write the 'Limitations & Barriers' section (Section 14) of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
${input.limitations_list || '[Not provided]'}

Write a brief intro, then for each limitation: name it, describe what is occurring, state the impact on this participant. Link to findings elsewhere in the report.`,

  impact_summary: (input) => `Write the 'Functional Impact Summary' (Section 15) of an NDIS FCA for ${input.client_name}.

CLINICIAN INPUT:
- Diagnoses: ${input.diagnoses || '[Not provided]'}
- Key impairments by domain: ${input.impairments_by_domain || '[Not provided]'}
- Supports requested: ${input.supports_requested || '[Not provided]'}
- Capacity building goal: ${input.capacity_building_goal || '[Not provided]'}
- Assessment score summary: ${input.assessment_summary || '[Not provided]'}

Write 4-6 sentences: (1) Name diagnoses and consequences. (2) Identify 2-3 most significant impairments with standardised scores. (3) Why the participant cannot complete daily activities. (4) Dual purpose of supports. (5) Close with Section 34 statement.`,

  recommendations: (input) => `Write the 'Recommendations' section (Section 16) of an NDIS FCA for ${input.client_name}.

STRUCTURED INPUT FROM RECOMMENDATIONS BUILDER:
${JSON.stringify(input.recommendations_data, null, 2)}

REPORT CONTEXT:
${input.report_context || 'No context available yet'}

CRITICAL: Each recommendation must be a cohesive clinical narrative paragraph following this reasoning chain:
DIAGNOSIS → FUNCTIONAL IMPAIRMENT → OBSERVED LIMITATION → SUPPORT NEED → HOW SUPPORT ADDRESSES LIMITATION → EXPECTED OUTCOME → CONSEQUENCE IF NOT PROVIDED

For EACH recommendation, write a single paragraph (not bullets) that includes:
1. Bold heading with support name and NDIS category
2. Recommendation statement with hours, frequency, ratio, and current provision comparison
3. Disability-to-support link naming the specific diagnosis and how it causes the limitation
4. Tasks covered with clinical rationale for the hours
5. How the support helps therapeutically (capacity building, recovery, integration)
6. Consequence if not provided — specific to this participant
7. Section 34 close with NDIS funding justification

Use 'is expected to' not 'will'. Reference specific report sections. Name diagnoses explicitly.
After all recommendations, write a Total Support Summary paragraph.`,

  risks: (input) => `Write the 'Risks of Insufficient Funding' section (Section 17) for ${input.client_name}.

CLINICIAN INPUT:
${input.risks_list || '[Not provided]'}

For each risk: name it, explain the consequence for this participant, note downstream cost. Each risk must be participant-specific. Link to recommendations.`,

  section_34: (input) => `Write the 'Statement of Reasonable and Necessary Supports' (Section 19) for ${input.client_name}.

CLINICIAN INPUT:
- Participant's NDIS goals: ${input.ndis_goals || '[Not provided]'}
- Key outcomes: ${input.intended_outcomes || '[Not provided]'}

Address each Section 34 criterion: (1) supports assist achieving NDIS goals, (2) increase independence, (3) value for money, (4) professional clinical judgement, (5) take into account informal supports. Reference Section 34 of the NDIS Act 2013 by name.`,
};


// ── 3. ASSESSMENT SYNOPSIS LIBRARY ───────────────────────────

export const SYNOPSIS_LIBRARY: Record<string, string> = {
  whodas: "The WHODAS 2.0 is a 36-item self-report measure developed by the World Health Organisation to assess disability across six domains of functioning: Cognition, Mobility, Self-Care, Getting Along, Life Activities, and Participation. Each item is scored from 0 (no difficulty) to 4 (extreme difficulty or cannot do). Domain scores are converted to a percentage, with higher percentages indicating greater disability. Disability levels are classified as: None (0–4%), Mild (5–24%), Moderate (25–49%), Severe (50–95%), and Extreme (96–100%).",

  frat: "The FRAT is a validated falls risk screening tool developed by Peninsula Health. Part 1 scores four risk factors — Recent Falls (2–8), Medications (1–4), Psychological status (1–4), and Cognitive Status (1–4) — yielding a total score out of 20. Risk levels are classified as Low (5–11), Medium (12–15), or High (16–20). The cognitive status component is scored using the Abbreviated Mental Test Score (AMTS; Hodkinson, 1972), a 10-item screen where a score of 6 or less suggests delirium or dementia.",

  lsp16: "The LSP-16 is a 16-item clinician-rated measure of general functioning designed for individuals with mental health conditions. Each item is scored 0–3, with higher scores indicating greater disability (total range 0–48). Four subscales assess Withdrawal, Self-Care, Compliance, and Anti-Social behaviour. The LSP-16 assesses functioning over the preceding three months, excluding crisis periods.",

  cans: "The CANS is a clinician-rated measure of the type and intensity of care and support needed. It uses a needs checklist of 28 items across four groups — Group A (nursing/severe behavioural needs), Group B (basic ADL assistance), Group C (instrumental ADL and social participation), and Group D (informational/emotional supports). The CANS level (0–7) is determined by the highest group of need endorsed and how long the client can safely be left alone.",

  lawton: "The Lawton-Brody IADL is an 8-item measure of complex functional skills required for independent community living. Domains assessed are telephone use, shopping, food preparation, housekeeping, laundry, transport, medication management, and financial management. Each domain is scored 0 (dependent) or 1 (independent or partially independent), with a total score ranging from 0 (fully dependent) to 8 (fully independent).",

  sensory: "The Adolescent/Adult Sensory Profile (Brown & Dunn, 2002) is a 60-item self-report measure assessing sensory processing patterns across six sensory sections. Items are scored 1–5 and mapped to four quadrants — Low Registration, Sensation Seeking, Sensory Sensitivity, and Sensation Avoiding — with 15 items per quadrant (maximum 75). Quadrant raw scores are compared against age-normed cut-offs and classified from Much Less Than Most People to Much More Than Most People.",

  zarit: "The Zarit Burden Interview is a 22-item self-report measure completed by the caregiver to assess the level of burden experienced in their caring role. Each item is scored 0 (Never) to 4 (Nearly Always), yielding a total score of 0–88. Burden levels are classified as: No to Mild (0–20), Mild to Moderate (21–40), Moderate to Severe (41–60), and Severe (61–88).",

  katz: "The Katz Index of ADL is a 6-item clinician-rated measure of basic activities of daily living: bathing, dressing, toileting, transferring, continence, and feeding. Each domain is scored 1 (independent) or 0 (dependent), with a total score ranging from 0 (fully dependent) to 6 (fully independent).",
};


// ── 4. ASSESSMENT INTERPRETATION PROMPTS ─────────────────────

const INTERPRETATION_PROMPTS: Record<string, (input: any) => string> = {

  interpretation_whodas: (input) => `Generate the WHODAS 2.0 interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS (insert verbatim as opening):
${SYNOPSIS_LIBRARY.whodas}

SCORES FROM SCORING TOOL:
${JSON.stringify(input.scores, null, 2)}

CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}

REPORT CONTEXT:
${input.report_context || 'No context available'}

Para 1: Insert synopsis verbatim + why the tool was selected for this participant.
Para 2: Total score + disability level + 2-3 highest domains + functional implications.
Para 3: Clinician notes + cross-references to earlier report sections.`,

  interpretation_frat: (input) => `Generate the FRAT interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS (insert verbatim as opening):
${SYNOPSIS_LIBRARY.frat}

SCORES FROM SCORING TOOL:
${JSON.stringify(input.scores, null, 2)}

CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}

REPORT CONTEXT:
${input.report_context || 'No context available'}

Para 1: Synopsis verbatim + why selected. Para 2: Score + risk level + AMTS + highest risk factors. If clinical risk differs from scored level, use attributed language. Para 3: Part 2 summary + cross-refs to Section 8 (home), 12.1 (mobility), 12.2 (transfers).`,

  interpretation_lsp16: (input) => `Generate the LSP-16 interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS: ${SYNOPSIS_LIBRARY.lsp16}

SCORES: ${JSON.stringify(input.scores, null, 2)}
CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}
REPORT CONTEXT: ${input.report_context || 'No context available'}

Para 1: Synopsis + why selected. Para 2: Total + highest subscales + implications. Cross-ref Section 12.8, Section 2. Para 3: Clinician notes + support linkage.`,

  interpretation_cans: (input) => `Generate the CANS interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS: ${SYNOPSIS_LIBRARY.cans}

SCORES: ${JSON.stringify(input.scores, null, 2)}
CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}
REPORT CONTEXT: ${input.report_context || 'No context available'}

Para 1: Synopsis + why selected. Para 2: CANS level + time alone + highest group needs. Cross-ref Section 11, 10, 7. Para 3: Clinician notes + link to support hours.`,

  interpretation_lawton: (input) => `Generate the Lawton IADL interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS: ${SYNOPSIS_LIBRARY.lawton}

SCORES: ${JSON.stringify(input.scores, null, 2)}
CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}
REPORT CONTEXT: ${input.report_context || 'No context available'}

Para 1: Synopsis + why selected. Para 2: Total + domains scored 0 + practical implications. Cross-ref Section 12.4, 12.5. Para 3: Clinician notes.`,

  interpretation_sensory: (input) => `Generate the Sensory Profile interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS: ${SYNOPSIS_LIBRARY.sensory}

SCORES: ${JSON.stringify(input.scores, null, 2)}
CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}
REPORT CONTEXT: ${input.report_context || 'No context available'}

Para 1: Synopsis + why selected. Para 2: Quadrant scores using published classification language. Focus on 'More' and 'Much More' quadrants. Cross-ref Section 12.9, 12.8, 12.3. Para 3: Clinician notes + strategy recommendations.`,

  interpretation_zarit: (input) => `Generate the Zarit interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS: ${SYNOPSIS_LIBRARY.zarit}

SCORES: ${JSON.stringify(input.scores, null, 2)}
CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}
REPORT CONTEXT: ${input.report_context || 'No context available'}

Para 1: Synopsis + why administered. Para 2: Total + burden level + highest areas. Cross-ref Section 7. Para 3: Clinician notes + explicit link to need for formal NDIS supports.`,

  interpretation_katz: (input) => `Generate the Katz ADL interpretation for Section 13.2 of an NDIS FCA for ${input.client_name}.

FIXED SYNOPSIS: ${SYNOPSIS_LIBRARY.katz}

SCORES: ${JSON.stringify(input.scores, null, 2)}
CLINICIAN NOTES: ${input.clinician_notes || 'None provided'}
REPORT CONTEXT: ${input.report_context || 'No context available'}

Para 1: Synopsis + why selected. Para 2: Total + items scored 0 + daily implications. Cross-ref Section 12.3, 12.2. Para 3: Clinician notes.`,
};


// ── 5. RUBRIC REVIEW PROMPT ──────────────────────────────────

const RUBRIC_PROMPT = (input: { section_name: string; generated_text: string; clinician_input: string }) => `You are a quality reviewer for NDIS Occupational Therapy reports. Review this generated report section against quality criteria and either correct issues or flag them for the clinician.

REPORT SECTION: ${input.section_name}

GENERATED TEXT TO REVIEW:
${input.generated_text}

ORIGINAL CLINICIAN INPUT:
${input.clinician_input}

CRITERIA TO CHECK:
1. Person-first language (use participant name, not standalone pronouns)
2. No bullet points — continuous prose only
3. No fabricated content beyond clinician input
4. NDIS terminology used (reasonable and necessary, functional capacity, etc.)
5. Active voice preferred
6. Professional non-emotive tone
7. Speculation attributed ('In the assessor's clinical opinion...')
8. Diagnosis linked to functional limitation
9. Observation → Impact → Support need structure (for domain sections)
10. Specific observed examples used, not generalisations
11. Hours and frequency stated (for recommendations)
12. 'Without this support...' consequence statement (for recommendations)
13. Disability-to-support link present (for recommendations)
14. Assessment scores referenced where relevant
15. Cross-references cite real content, not fabricated

Respond with ONLY a JSON object:
{
  "issues_found": true or false,
  "auto_corrected_text": "the corrected version (or original if no issues)",
  "flags_for_clinician": ["list of issues that need clinician review"],
  "corrections_made": ["list of auto-corrections applied"]
}

AUTO-CORRECT: language, tone, person-first, bullet points, active voice, vague statements, missing NDIS framing.
NEVER AUTO-CORRECT: clinical findings, scores, diagnoses, hours, support categories.
FLAG: suspected fabrication, missing hours, incorrect categories, missing consequence statements.`;


// ── 6. API CALLING FUNCTIONS ─────────────────────────────────

async function callClaude(userMessage: string, maxTokens: number = 2000): Promise<string> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Backend not configured. Please ensure the project is connected to Lovable Cloud."
    );
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      system_prompt: SYSTEM_PROMPT,
      prompt: userMessage,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(
      `Report generation failed (${response.status}): ${errorData.error || errorData.details || "Unknown error"}`
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Generation failed");
  }

  return data.text;
}


// ── 7. PUBLIC FUNCTIONS ──────────────────────────────────────

export async function generateSection(
  sectionId: string,
  clientName: string,
  clinicianInput: Record<string, any>
): Promise<string> {
  const promptBuilder = SECTION_PROMPTS[sectionId] || INTERPRETATION_PROMPTS[sectionId];

  if (!promptBuilder) {
    throw new Error(`Unknown section ID: ${sectionId}. Check the Section ID Map in the integration guide.`);
  }

  const prompt = promptBuilder({ client_name: clientName, ...clinicianInput });
  const generatedText = await callClaude(prompt);
  return generatedText;
}

export async function qualityCheck(
  sectionName: string,
  generatedText: string,
  clinicianInput: string
): Promise<{
  issues_found: boolean;
  auto_corrected_text: string;
  flags_for_clinician: string[];
  corrections_made: string[];
}> {
  const prompt = RUBRIC_PROMPT({
    section_name: sectionName,
    generated_text: generatedText,
    clinician_input: clinicianInput,
  });

  const response = await callClaude(prompt, 3000);

  try {
    const clean = response.replace(/```json\s*|```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      issues_found: false,
      auto_corrected_text: generatedText,
      flags_for_clinician: ["Quality check response could not be parsed — please review manually"],
      corrections_made: [],
    };
  }
}

export function assembleReportContext(reportData: Record<string, any>): string {
  const parts: string[] = [];

  if (reportData.section2?.generatedProse) {
    parts.push(`SECTION 2 (Background): ${summarise(reportData.section2.generatedProse)}`);
  }
  if (reportData.section4?.generatedProse) {
    parts.push(`SECTION 4 (Diagnoses): ${summarise(reportData.section4.generatedProse)}`);
  }
  if (reportData.section7?.generatedProse) {
    parts.push(`SECTION 7 (Informal Supports): ${summarise(reportData.section7.generatedProse)}`);
  }
  if (reportData.section8) {
    parts.push(`SECTION 8 (Home Environment): ${JSON.stringify(reportData.section8).substring(0, 500)}`);
  }
  if (reportData.section9) {
    parts.push(`SECTION 9 (Social Environment): ${JSON.stringify(reportData.section9).substring(0, 300)}`);
  }
  if (reportData.section10) {
    parts.push(`SECTION 10 (Typical Week): ${JSON.stringify(reportData.section10).substring(0, 300)}`);
  }
  if (reportData.section11) {
    parts.push(`SECTION 11 (Risk & Safety): ${JSON.stringify(reportData.section11).substring(0, 400)}`);
  }
  for (let i = 1; i <= 9; i++) {
    const key = `section12_${i}`;
    if (reportData[key]?.generatedProse) {
      parts.push(`SECTION 12.${i}: ${summarise(reportData[key].generatedProse)}`);
    } else if (reportData[key]?.observations) {
      parts.push(`SECTION 12.${i} (raw): ${reportData[key].observations.substring(0, 200)}`);
    }
  }

  return parts.join("\n\n") || "No report context available yet — earlier sections have not been completed.";
}

function summarise(text: string): string {
  const words = (typeof text === 'string' ? text : '').split(/\s+/);
  if (words.length <= 200) return typeof text === 'string' ? text : '';
  return words.slice(0, 200).join(" ") + "...";
}

export function getSynopsis(toolId: string): string | undefined {
  return SYNOPSIS_LIBRARY[toolId];
}
