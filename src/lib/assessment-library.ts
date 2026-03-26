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
    synopsis: "The WHO Disability Assessment Schedule 2.0 is a standardised measure of health and disability across cultures. The 36-item version assesses seven domains of functioning: cognition, mobility, self-care, getting along, life activities (household and work/school), and participation. It uses a simple scoring method where each item is rated 0–4 (None to Extreme), producing raw scores, percentage disability, and disability level per domain and overall. It is widely used in NDIS functional capacity assessments to quantify the impact of disability on daily life.",
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
    id: "katz-adl",
    name: "Katz Index of Independence in ADLs",
    shortName: "Katz ADL",
    synopsis: "The Katz Index assesses fundamental activities of daily living — bathing, dressing, toileting, transferring, continence, and feeding. Each item is scored as independent (1) or dependent (0). It provides a quick snapshot of a participant's functional independence in personal self-care, commonly used in NDIS reports to establish baseline ADL capacity.",
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
  {
    id: "lawton-iadl",
    name: "Lawton Instrumental ADL Scale",
    shortName: "Lawton IADL",
    synopsis: "The Lawton IADL Scale measures competence in instrumental activities of daily living — higher-order tasks such as telephone use, shopping, food preparation, housekeeping, laundry, transport, medication management, and finances. It is used in NDIS assessments to evaluate a participant's capacity for independent community living and to identify specific areas of support need.",
    subscales: [{
      id: "iadl", label: "Instrumental ADLs", items: [
        { id: "telephone", label: "Ability to use telephone", options: ["Independent", "Needs some help", "Unable"] },
        { id: "shopping", label: "Shopping", options: ["Independent", "Needs some help", "Unable"] },
        { id: "food-prep", label: "Food preparation", options: ["Independent", "Needs some help", "Unable"] },
        { id: "housekeeping", label: "Housekeeping", options: ["Independent", "Needs some help", "Unable"] },
        { id: "laundry", label: "Laundry", options: ["Independent", "Needs some help", "Unable"] },
        { id: "transport", label: "Mode of transport", options: ["Independent", "Needs some help", "Unable"] },
        { id: "medication", label: "Medication management", options: ["Independent", "Needs some help", "Unable"] },
        { id: "finances", label: "Ability to handle finances", options: ["Independent", "Needs some help", "Unable"] },
      ],
    }],
    scoringMethod: "sum",
    classifications: [
      { min: 8, max: 8, label: "High function — independent" },
      { min: 5, max: 7, label: "Moderate function — some assistance needed" },
      { min: 0, max: 4, label: "Low function — significant assistance needed" },
    ],
  },
  {
    id: "frat",
    name: "Falls Risk Assessment Tool (FRAT)",
    shortName: "FRAT",
    synopsis: "The Falls Risk Assessment Tool screens for risk of falls across key domains: recent falls history, medications, psychological status, and cognitive status. It is commonly used in NDIS occupational therapy reports to document a participant's falls risk level and to justify recommendations for mobility aids, home modifications, or support worker assistance.",
    subscales: [{
      id: "risk", label: "Risk Factors", items: [
        { id: "falls-history", label: "Recent falls (past 12 months)", options: ["None", "One fall", "Two or more falls"] },
        { id: "medications", label: "Medications", options: ["Not taking any high-risk meds", "Taking one high-risk med", "Taking two or more high-risk meds"] },
        { id: "psychological", label: "Psychological status", options: ["No concerns", "Mildly affected", "Significantly affected"] },
        { id: "cognitive", label: "Cognitive status", options: ["Intact", "Mildly impaired", "Significantly impaired"] },
      ],
    }],
    scoringMethod: "sum",
    classifications: [
      { min: 0, max: 2, label: "Low risk" },
      { min: 3, max: 5, label: "Medium risk" },
      { min: 6, max: 12, label: "High risk" },
    ],
  },
  {
    id: "lsp-16",
    name: "Life Skills Profile (LSP-16)",
    shortName: "LSP-16",
    synopsis: "The Life Skills Profile 16-item version measures functional disability in people with persistent mental illness across four domains: withdrawal, self-care, compliance, and antisocial behaviour. It is used in NDIS functional capacity assessments for participants with psychosocial disability to quantify the impact of mental health conditions on everyday functioning and social participation.",
    subscales: [
      {
        id: "withdrawal", label: "Withdrawal", items: [
          { id: "w1", label: "Does this person generally withdraw from social contact?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "w2", label: "Does this person participate in activities without being directed?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "w3", label: "Does this person usually need to be encouraged to participate?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "w4", label: "Is this person able to communicate adequately?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
        ],
      },
      {
        id: "self-care", label: "Self-Care", items: [
          { id: "sc1", label: "Does this person generally maintain adequate personal hygiene?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "sc2", label: "Does this person generally look after and take their medication?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "sc3", label: "Is this person generally well groomed?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "sc4", label: "Does this person wear clean clothes or maintain them?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
        ],
      },
      {
        id: "compliance", label: "Compliance", items: [
          { id: "c1", label: "Does this person cooperate with health services?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "c2", label: "Does this person generally manage their own affairs?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "c3", label: "Does this person behave responsibly regarding alcohol and drugs?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "c4", label: "Does this person behave reasonably toward others?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
        ],
      },
      {
        id: "antisocial", label: "Antisocial Behaviour", items: [
          { id: "a1", label: "Does this person behave offensively?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "a2", label: "Does this person interfere with others functioning?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "a3", label: "Does this person create problems by being violent?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
          { id: "a4", label: "Does this person have behaviour that is sexually inappropriate?", options: ["Not at all", "Slightly", "Moderately", "Considerably"] },
        ],
      },
    ],
    scoringMethod: "sum",
    classifications: [
      { min: 0, max: 15, label: "Low disability" },
      { min: 16, max: 31, label: "Moderate disability" },
      { min: 32, max: 48, label: "High disability" },
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
