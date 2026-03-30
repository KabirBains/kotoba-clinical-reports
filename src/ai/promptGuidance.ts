// ============================================================
// PROMPT GUIDANCE — Section-specific rules extracted from
// the FCA Template, AI Prompt Templates, and Quality Rubric.
// Instead of sending all 3 full .docx files on every request,
// we include only the relevant guidance per section type.
// ============================================================

// ── TEMPLATE GUIDANCE (from FCA Report Template) ──────────

const TEMPLATE_SECTION_GUIDANCE: Record<string, string> = {
  reason_for_referral: `TEMPLATE GUIDANCE (Section 1 — Reason for Referral):
- State who referred, when, and under what funding stream.
- State the purpose of the assessment.
- State what supports this report will inform.
- 2 paragraphs. Paragraph 1: referral details. Paragraph 2: assessment purpose and NDIS context.`,

  background: `TEMPLATE GUIDANCE (Section 2 — Background Information):
- Cover participant overview, living situation, education/work, psychosocial history, medical history, and treating team.
- 4 paragraphs: (1) overview, (2) living/family, (3) education/work/mental health, (4) medical history and team.
- Be clinically precise about mental health history — do not soften or omit significant history.`,

  goals: `TEMPLATE GUIDANCE (Section 3 — Participant Goals):
- NDIS goals: present in participant's own voice, first person.
- Therapeutic goals: formal clinical objectives linked to NDIS goals.
- Do not add goals the clinician has not listed.`,

  diagnoses: `TEMPLATE GUIDANCE (Section 4 — Diagnoses):
- Paragraph 1: Define each diagnosis in plain English for planners without clinical training.
- Paragraph 2: How the diagnoses collectively impact daily functioning.`,

  allied_health_history: `TEMPLATE GUIDANCE (Section 5 — Allied Health Case History):
- For each discipline with existing therapeutic relationship: how long, focus, efficacy.
- If initial assessment with no prior involvement, state clearly.`,

  methodology: `TEMPLATE GUIDANCE (Section 6 — Methodology):
- 2-3 paragraphs: (1) direct observation details, (2) collateral sources, (3) environmental assessment.
- Standardised assessments documented in Section 13 — do NOT list them here.`,

  informal_supports: `TEMPLATE GUIDANCE (Section 7 — Informal Supports):
- Paragraph 1: Describe informal support network.
- Paragraph 2: Assess carer capacity and sustainability risks.
- Link sustainability risk to the need for formal NDIS supports.`,

  limitations: `TEMPLATE GUIDANCE (Section 14 — Limitations & Barriers):
- Brief intro, then for each limitation: name it, describe what is occurring, state impact on this participant.
- Link to findings elsewhere in the report.`,

  impact_summary: `TEMPLATE GUIDANCE (Section 15 — Functional Impact Summary):
- 4-6 sentences: (1) Name diagnoses and consequences. (2) 2-3 most significant impairments with scores. (3) Why participant cannot complete daily activities. (4) Dual purpose of supports. (5) Section 34 statement.`,

  risks: `TEMPLATE GUIDANCE (Section 17 — Risks of Insufficient Funding):
- For each risk: name it, explain consequence for this participant, note downstream cost.
- Each risk must be participant-specific. Link to recommendations.`,

  section_34: `TEMPLATE GUIDANCE (Section 19 — Statement of Reasonable and Necessary):
- Address each Section 34 criterion: (1) assists achieving NDIS goals, (2) increases independence, (3) value for money, (4) professional clinical judgement, (5) takes into account informal supports.
- Reference Section 34 of the NDIS Act 2013 by name.`,
};

// ── FUNCTIONAL DOMAIN GUIDANCE (from Template + Prompt Templates) ──

export const FUNCTIONAL_DOMAIN_GUIDANCE = `FUNCTIONAL DOMAIN WRITING RULES (from FCA Template Section 12):
- Each domain must follow the structure: Observation → Functional Impact → Support Need.
- Reference the participant's diagnosis where it links to the observed limitation.
- Include both strengths AND limitations with specific observed examples.
- Reference standardised assessment scores where they corroborate the observation.
- Close each domain with a clear support need statement.
- Use attributed clinical prognosis: 'In the assessor's clinical opinion...'
- Do not generalise — use specific observed examples from the clinician's input.
- Each row should produce 1-2 sentences of continuous prose, not bullet points.`;

// ── ASSESSMENT INTERPRETATION GUIDANCE (from Prompt Templates) ──

export const ASSESSMENT_INTERPRETATION_GUIDANCE = `ASSESSMENT INTERPRETATION WRITING RULES (from AI Prompt Templates):
- Paragraph 1: Insert the assessment synopsis verbatim as the opening. Explain why the tool was selected for this participant.
- Paragraph 2: State the total score + classification. Identify the 2-3 highest-scoring domains/subscales and describe their functional implications in daily life.
- Paragraph 3: Incorporate clinician notes. Cross-reference findings from earlier sections using: 'This finding is consistent with [observation] documented in Section [X] of this report.'
- Use the tool's published scoring criteria — do not interpret scores beyond the published classification.
- Do NOT fabricate domain scores or classifications.`;

// ── RECOMMENDATION GUIDANCE (from Template + Prompt Templates) ──

export const RECOMMENDATION_GUIDANCE = `RECOMMENDATION WRITING RULES (from FCA Template Section 16 + Prompt Templates):
- Each recommendation must be a single cohesive clinical narrative paragraph.
- Follow this reasoning chain: DIAGNOSIS → FUNCTIONAL IMPAIRMENT → OBSERVED LIMITATION → SUPPORT NEED → HOW SUPPORT ADDRESSES LIMITATION → EXPECTED OUTCOME → CONSEQUENCE IF NOT PROVIDED → SECTION 34 JUSTIFICATION.
- Include: support name, NDIS category, hours/frequency/ratio, current provision comparison.
- Name the specific diagnosis and explain how it causes the functional limitation.
- List specific tasks covered with clinical rationale for the hours.
- State how the support helps therapeutically (capacity building, recovery, integration).
- Consequence statement: 'Without this support, [participant] is at risk of [specific consequence].'
- Section 34 close: 'This support is considered reasonable and necessary under Section 34 of the NDIS Act 2013.'
- Use 'is expected to' not 'will'.
- Reference specific report sections where evidence was documented.
- Name diagnoses explicitly — do not use generic terms.`;

// ── RUBRIC CRITERIA (subset per section type) ──────────────

const RUBRIC_CORE = `QUALITY CRITERIA (apply to all sections):
1. Person-first language — use participant's name, not standalone pronouns.
2. No bullet points — continuous prose only.
3. No fabricated content beyond clinician input.
4. NDIS terminology used (reasonable and necessary, functional capacity, etc.).
5. Active voice preferred.
6. Professional non-emotive tone.
7. Speculation attributed ('In the assessor's clinical opinion...').
8. Specific observed examples used, not generalisations.`;

const RUBRIC_DOMAIN = `ADDITIONAL QUALITY CRITERIA (functional domains):
9. Diagnosis linked to functional limitation.
10. Observation → Impact → Support need structure maintained.
11. Assessment scores referenced where relevant.
12. Cross-references cite real content from earlier sections.`;

const RUBRIC_RECOMMENDATION = `ADDITIONAL QUALITY CRITERIA (recommendations):
9. Hours and frequency stated.
10. 'Without this support...' consequence statement present.
11. Disability-to-support link present — diagnosis named explicitly.
12. Section 34 justification included.
13. Current vs recommended provision compared.`;

const RUBRIC_ASSESSMENT = `ADDITIONAL QUALITY CRITERIA (assessment interpretations):
9. Synopsis inserted verbatim as opening.
10. Scores and classification stated accurately from scoring tool output.
11. Highest domains/subscales identified and functional implications described.
12. Cross-references to earlier report sections present.
13. No interpretation beyond the tool's published scoring criteria.`;

// ── PUBLIC: Get guidance for a section ─────────────────────

export function getTemplateGuidance(sectionId: string): string {
  return TEMPLATE_SECTION_GUIDANCE[sectionId] || "";
}

export function getRubricForSection(sectionType: "text" | "domain" | "assessment" | "recommendation"): string {
  switch (sectionType) {
    case "domain": return `${RUBRIC_CORE}\n\n${RUBRIC_DOMAIN}`;
    case "assessment": return `${RUBRIC_CORE}\n\n${RUBRIC_ASSESSMENT}`;
    case "recommendation": return `${RUBRIC_CORE}\n\n${RUBRIC_RECOMMENDATION}`;
    default: return RUBRIC_CORE;
  }
}
