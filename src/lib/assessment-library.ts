export interface AssessmentItem {
  id: string;
  label: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface AssessmentSubscale {
  id: string;
  label: string;
  items: AssessmentItem[];
}

export interface AssessmentDefinition {
  id: string;
  name: string;
  shortName: string;
  synopsis: string;
  subscales: AssessmentSubscale[];
  scoringMethod: "sum" | "average" | "weighted";
  classifications: { min: number; max: number; label: string }[];
}

export interface AssessmentInstance {
  id: string;
  definitionId: string;
  name: string;
  dateAdministered: string;
  scores: Record<string, string>;
  interpretation: string;
  isCustom?: boolean;
  customItems?: { id: string; label: string; value: string }[];
}

const WHODAS_OPTIONS = ["None", "Mild", "Moderate", "Severe", "Extreme / Cannot do"];
const WHODAS_SCORE_MAP: Record<string, number> = {
  "None": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Extreme / Cannot do": 4,
};

export const ASSESSMENT_LIBRARY: AssessmentDefinition[] = [
  {
    id: "whodas-2.0",
    name: "WHODAS 2.0 (36-item)",
    shortName: "WHODAS 2.0",
    synopsis: "The WHO Disability Assessment Schedule 2.0 is a standardised measure of health and disability across cultures. The 36-item version assesses seven domains of functioning: cognition, mobility, self-care, getting along, life activities (household and work/school), and participation. It uses a simple scoring method where each item is rated 0–4 (None to Extreme), producing raw scores, percentage disability, and disability level per domain and overall.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [
      { min: 0, max: 4, label: "No disability" },
      { min: 5, max: 24, label: "Mild disability" },
      { min: 25, max: 49, label: "Moderate disability" },
      { min: 50, max: 95, label: "Severe disability" },
      { min: 96, max: 100, label: "Extreme disability" },
    ],
  },
  {
    id: "frat",
    name: "Falls Risk Assessment Tool (FRAT)",
    shortName: "FRAT",
    synopsis: "The FRAT (Peninsula Health, 1999) screens for falls risk across four domains: recent falls history, medications, psychological status, and cognitive status (with embedded AMTS). Part 1 produces a risk score /20 mapped to Low (5–11), Medium (12–15), or High (16–20). Part 2 is a risk factor checklist. Automatic high-risk triggers override the score.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [
      { min: 5, max: 11, label: "Low risk" },
      { min: 12, max: 15, label: "Medium risk" },
      { min: 16, max: 20, label: "High risk" },
    ],
  },
  {
    id: "lawton-iadl",
    name: "Lawton-Brody Instrumental ADL Scale",
    shortName: "Lawton IADL",
    synopsis: "The Lawton IADL Scale (Lawton & Brody, 1969) measures competence in 8 instrumental activities of daily living: telephone use, shopping, food preparation, housekeeping, laundry, transport, medication management, and finances. Each domain scores 0 (dependent) or 1 (independent). Total 0–8 for all domains or 0–5 excluding food prep, housekeeping, and laundry. Higher scores indicate greater independence.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [
      { min: 8, max: 8, label: "High function — independent" },
      { min: 5, max: 7, label: "Moderate function — some assistance needed" },
      { min: 0, max: 4, label: "Low function — significant assistance needed" },
    ],
  },
  {
    id: "zarit",
    name: "Zarit Burden Interview (22-item)",
    shortName: "Zarit",
    synopsis: "The Zarit Burden Interview (Zarit, Reever & Bach-Peterson, 1980) is a 22-item self-report measure of caregiver burden. Each item is rated 0 (Never) to 4 (Nearly Always), producing a total score /88. Used in NDIS reports to quantify the impact of caring responsibilities on family/informal carers and to justify respite and carer support recommendations.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [
      { min: 0, max: 20, label: "No to Mild Burden" },
      { min: 21, max: 40, label: "Mild to Moderate Burden" },
      { min: 41, max: 60, label: "Moderate to Severe Burden" },
      { min: 61, max: 88, label: "Severe Burden" },
    ],
  },
  {
    id: "cans",
    name: "Care and Needs Scale (CANS)",
    shortName: "CANS",
    synopsis: "The CANS (Tate, 2003/2017) assesses 28 care needs across 4 groups (A–D) to determine a CANS Level (0–7) based on the highest group endorsed and how long the client can be left alone. It quantifies support intensity for people with acquired brain injury or complex disability, commonly used in NDIS reports to justify attendant care and support worker hours.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [
      { min: 0, max: 0, label: "No support needed" },
      { min: 1, max: 3, label: "Intermittent support" },
      { min: 4, max: 7, label: "Daily support required" },
    ],
  },
  {
    id: "lsp-16",
    name: "Life Skills Profile (LSP-16)",
    shortName: "LSP-16",
    synopsis: "The LSP-16 (Rosen et al.) measures functional disability in people with persistent mental illness across four subscales: Withdrawal (social engagement), Self-Care (personal maintenance), Compliance (medication and health cooperation), and Anti-Social behaviour. 16 items scored 0–3, total /48. Higher scores indicate greater disability. Used in NDIS psychosocial disability assessments.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [
      { min: 0, max: 15, label: "Low disability" },
      { min: 16, max: 31, label: "Moderate disability" },
      { min: 32, max: 48, label: "High disability" },
    ],
  },
  {
    id: "sensory-profile",
    name: "Adolescent/Adult Sensory Profile",
    shortName: "Sensory Profile",
    synopsis: "The Adolescent/Adult Sensory Profile (Brown & Dunn, 2002) is a 60-item self-questionnaire assessing sensory processing across 6 sections (Taste/Smell, Movement, Visual, Touch, Activity Level, Auditory). Items map to 4 quadrants: Low Registration, Sensation Seeking, Sensory Sensitivity, and Sensation Avoiding. Scores compared against age-normed cut-offs to classify sensory processing patterns.",
    subscales: [],
    scoringMethod: "sum",
    classifications: [],
  },
  {
    id: "katz-adl",
    name: "Katz Index of Independence in ADLs",
    shortName: "Katz ADL",
    synopsis: "The Katz Index assesses fundamental activities of daily living — bathing, dressing, toileting, transferring, continence, and feeding. Each item is scored as independent (1) or dependent (0). It provides a quick snapshot of a participant's functional independence in personal self-care.",
    subscales: [{
      id: "adl", label: "Activities of Daily Living", items: [
        { id: "bathing", label: "Bathing", options: ["Independent", "Dependent"] },
        { id: "dressing", label: "Dressing", options: ["Independent", "Dependent"] },
        { id: "toileting", label: "Toileting", options: ["Independent", "Dependent"] },
        { id: "transferring", label: "Transferring", options: ["Independent", "Dependent"] },
        { id: "continence", label: "Continence", options: ["Independent", "Dependent"] },
        { id: "feeding", label: "Feeding", options: ["Independent", "Dependent"] },
      ],
    }],
    scoringMethod: "sum",
    classifications: [
      { min: 6, max: 6, label: "Full function" },
      { min: 4, max: 5, label: "Moderate impairment" },
      { min: 2, max: 3, label: "Severe impairment" },
      { min: 0, max: 1, label: "Very severe impairment" },
    ],
  },
];

export function getScoreForOption(definitionId: string, optionValue: string): number {
  if (definitionId === "whodas-2.0") {
    return WHODAS_SCORE_MAP[optionValue] ?? 0;
  }
  if (definitionId === "katz-adl") {
    return optionValue === "Independent" ? 1 : 0;
  }
  if (definitionId === "lawton-iadl") {
    if (optionValue === "Independent") return 1;
    return 0;
  }
  if (definitionId === "frat") {
    const map: Record<string, number> = {
      "None": 0, "One fall": 1, "Two or more falls": 2,
      "Not taking any high-risk meds": 0, "Taking one high-risk med": 1, "Taking two or more high-risk meds": 2,
      "No concerns": 0, "Mildly affected": 1, "Significantly affected": 2,
      "Intact": 0, "Mildly impaired": 1, "Significantly impaired": 2,
    };
    return map[optionValue] ?? 0;
  }
  if (definitionId === "lsp-16") {
    const map: Record<string, number> = {
      "Not at all": 0, "Slightly": 1, "Moderately": 2, "Considerably": 3,
    };
    return map[optionValue] ?? 0;
  }
  return 0;
}

export function calculateTotal(definition: AssessmentDefinition, scores: Record<string, string>): number {
  let total = 0;
  for (const subscale of definition.subscales) {
    for (const item of subscale.items) {
      const val = scores[item.id];
      if (val) total += getScoreForOption(definition.id, val);
    }
  }
  return total;
}

export function getClassification(definition: AssessmentDefinition, total: number): string {
  for (const c of definition.classifications) {
    if (total >= c.min && total <= c.max) return c.label;
  }
  return "Unclassified";
}

export function calculateSubscaleTotal(definition: AssessmentDefinition, subscaleId: string, scores: Record<string, string>): number {
  const subscale = definition.subscales.find(s => s.id === subscaleId);
  if (!subscale) return 0;
  let total = 0;
  for (const item of subscale.items) {
    const val = scores[item.id];
    if (val) total += getScoreForOption(definition.id, val);
  }
  return total;
}
