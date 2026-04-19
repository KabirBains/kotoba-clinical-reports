export interface SubsectionField {
  id: string;
  label: string;
  placeholder: string;
  ratingOptions?: string[];
}

export interface SubsectionConfig {
  subsectionId: string;
  fields: SubsectionField[];
}

const TRANSFER_RATINGS = [
  "Independent",
  "Requires Prompting",
  "Requires Physical Assistance",
  "Dependent",
  "Unable",
];

const PADL_RATINGS = [
  "Independent",
  "Prompting Required",
  "Assistance Required",
  "Fully Dependent",
];

const DOMESTIC_IADL_RATINGS = PADL_RATINGS;

const EXECUTIVE_IADL_RATINGS = [
  "Independent",
  "Prompting Required",
  "Assistance Required",
  "Managed by Others",
];

const COGNITION_RATINGS = [
  "Intact",
  "Mildly Impaired",
  "Moderately Impaired",
  "Markedly Impaired",
  "Unable to Determine",
];

const COMMUNICATION_RATINGS = [
  "Independent",
  "Mildly Impaired",
  "Significantly Impaired",
  "Non-speaking",
  "Unable to Determine",
];

const SOCIAL_RATINGS = [
  "Adequate",
  "Mildly Impaired",
  "Significantly Impaired",
  "Avoidant",
  "Unable to Determine",
];

const SENSORY_RATINGS = ["Present", "Absent", "N/A"];

export const SUBSECTION_FIELDS: SubsectionConfig[] = [
  {
    subsectionId: "mobility",
    fields: [
      { id: "gross-motor", label: "Gross Motor", placeholder: "Gait quality, balance, walking distance, unsteadiness, distance before fatigue" },
      { id: "fine-motor", label: "Fine Motor", placeholder: "Hand function, grip strength, dexterity, manipulation of objects" },
      { id: "endurance", label: "Endurance", placeholder: "Activity tolerance, fatigue profile, time before rest required, BMI impact" },
      { id: "assistive-devices", label: "Assistive Devices", placeholder: "Devices in use or nil — adequacy, condition, prescribed or self-selected" },
    ],
  },
  {
    subsectionId: "transfers",
    fields: [
      { id: "bed", label: "Bed transfers", placeholder: "Technique observed, aids used, safety level", ratingOptions: TRANSFER_RATINGS },
      { id: "toilet", label: "Toilet transfers", placeholder: "Observed or note if not directly observed", ratingOptions: TRANSFER_RATINGS },
      { id: "shower", label: "Shower transfers", placeholder: "Surface, hob height, steadiness, fear of falling", ratingOptions: TRANSFER_RATINGS },
      { id: "stairs", label: "Stairs", placeholder: "Observed or clinician prognosis if no stairs in home", ratingOptions: TRANSFER_RATINGS },
      { id: "car", label: "Car transfers", placeholder: "Adaptations used or needed", ratingOptions: TRANSFER_RATINGS },
      { id: "safety-level", label: "Safety level required", placeholder: "Overall — supervision / min / mod / max assist / dependent", ratingOptions: TRANSFER_RATINGS },
    ],
  },
  {
    subsectionId: "personal-adls",
    fields: [
      { id: "feeding", label: "Feeding / Eating", placeholder: "Utensil use, choking history, supervised mealtimes, food preparation needs", ratingOptions: PADL_RATINGS },
      { id: "toileting", label: "Toileting", placeholder: "Continence status, aids used, supervised toileting, incidents", ratingOptions: PADL_RATINGS },
      { id: "bathing", label: "Bathing / Showering", placeholder: "Frequency, support required, sensory issues, safety concerns", ratingOptions: PADL_RATINGS },
      { id: "dressing-upper", label: "Dressing — Upper body", placeholder: "Setup needed, physical assist, clasp or button difficulties", ratingOptions: PADL_RATINGS },
      { id: "dressing-lower", label: "Dressing — Lower body", placeholder: "Bending tolerance, footwear management", ratingOptions: PADL_RATINGS },
      { id: "grooming", label: "Grooming / Hygiene", placeholder: "Hair, teeth, nails, deodorant — frequency and independence level", ratingOptions: PADL_RATINGS },
      { id: "sleep", label: "Sleep", placeholder: "Hours, quality, fragmentation, sleep aids used", ratingOptions: PADL_RATINGS },
    ],
  },
  {
    subsectionId: "domestic-iadls",
    fields: [
      { id: "shopping", label: "Shopping", placeholder: "In-store or online, support needed, barriers", ratingOptions: DOMESTIC_IADL_RATINGS },
      { id: "laundry", label: "Laundry", placeholder: "What can/cannot be done, prompting needed", ratingOptions: DOMESTIC_IADL_RATINGS },
      { id: "cleaning", label: "Cleaning", placeholder: "Participant vs carer tasks, motivational barriers", ratingOptions: DOMESTIC_IADL_RATINGS },
      { id: "meal-prep", label: "Meal preparation", placeholder: "Standing tolerance, lifting, motivation, what participant currently eats", ratingOptions: DOMESTIC_IADL_RATINGS },
      { id: "home-maintenance", label: "Home maintenance", placeholder: "Gardening, repairs — who currently does this", ratingOptions: DOMESTIC_IADL_RATINGS },
    ],
  },
  {
    subsectionId: "executive-iadls",
    fields: [
      { id: "money", label: "Money management", placeholder: "Budgeting, managed by family, NDIS plan", ratingOptions: EXECUTIVE_IADL_RATINGS },
      { id: "medication", label: "Medication management", placeholder: "Compliance, prompting, method of administration", ratingOptions: EXECUTIVE_IADL_RATINGS },
      { id: "appointments", label: "Appointment management", placeholder: "Independent / reminders needed / full coordination required", ratingOptions: EXECUTIVE_IADL_RATINGS },
      { id: "transport", label: "Transport / Travel", placeholder: "Drives / public transport / fully reliant on others, driving restrictions", ratingOptions: EXECUTIVE_IADL_RATINGS },
      { id: "technology", label: "Technology use", placeholder: "Functional use vs entertainment only vs unable", ratingOptions: EXECUTIVE_IADL_RATINGS },
    ],
  },
  {
    subsectionId: "cognition",
    fields: [
      { id: "attention", label: "Attention", placeholder: "Sustained attention, distractibility, task duration before disengaging", ratingOptions: COGNITION_RATINGS },
      { id: "memory", label: "Memory", placeholder: "Short-term, long-term, prospective — functional examples", ratingOptions: COGNITION_RATINGS },
      { id: "executive-functioning", label: "Executive Functioning", placeholder: "Planning, initiation, sequencing, multi-step tasks", ratingOptions: COGNITION_RATINGS },
      { id: "organisation", label: "Organisation", placeholder: "Organising tasks, belongings, appointments — examples of breakdown", ratingOptions: COGNITION_RATINGS },
      { id: "insight", label: "Insight", placeholder: "Awareness of own deficits, safety risks, need for support", ratingOptions: COGNITION_RATINGS },
      { id: "problem-solving", label: "Problem Solving", placeholder: "Response to emergency scenarios, independent problem-solving capacity", ratingOptions: COGNITION_RATINGS },
    ],
  },
  {
    subsectionId: "communication",
    fields: [
      { id: "expressive", label: "Expressive communication", placeholder: "Verbal/non-verbal/AAC, word output, ability to communicate needs", ratingOptions: COMMUNICATION_RATINGS },
      { id: "receptive", label: "Receptive communication", placeholder: "Instruction understanding, complexity tolerated, processing speed", ratingOptions: COMMUNICATION_RATINGS },
    ],
  },
  {
    subsectionId: "social-functioning",
    fields: [
      { id: "one-on-one", label: "1:1 interactions", placeholder: "Comfort, anxiety, avoidance, coping strategies", ratingOptions: SOCIAL_RATINGS },
      { id: "group", label: "Group settings", placeholder: "Engagement, triggers for disengagement, distress observed", ratingOptions: SOCIAL_RATINGS },
      { id: "behaviour-reg", label: "Behaviour regulation", placeholder: "Dysregulation frequency, triggers, strategies, incidents", ratingOptions: SOCIAL_RATINGS },
      { id: "emotional-reg", label: "Emotional regulation", placeholder: "Adaptive and maladaptive coping, self-harm, withdrawal", ratingOptions: SOCIAL_RATINGS },
    ],
  },
];

export function getSubsectionConfig(subsectionId: string): SubsectionConfig | undefined {
  return SUBSECTION_FIELDS.find((c) => c.subsectionId === subsectionId);
}
