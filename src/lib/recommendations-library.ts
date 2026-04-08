export interface SupportItem {
  id: string;
  name: string;
  tasks: string[];
  outcomes: string[];
  /**
   * A generic *example* consequence sentence used only as a placeholder hint
   * in the UI. The clinician's actual consequence (RecommendationInstance.
   * consequence) starts BLANK and is filled in either by the clinician or by
   * the AI generation pipeline at report time. The AI generation prompt is
   * explicitly instructed to write a participant-specific consequence rather
   * than reuse this generic template — see the section17 routing in
   * supabase/functions/generate-report/index.ts.
   *
   * Renamed from `consequence` in the participant-specific consequences
   * refactor. The old field name was misleading because the value was the
   * same for every participant who had this support type recommended,
   * which violates rubric criterion B11 (consequence specificity).
   */
  exampleConsequenceTemplate: string;
  sections: string[];
  isConsumable?: boolean;
  isCapital?: boolean;
}

export interface SupportCategory {
  color: string;
  category: "Core" | "Capacity Building" | "Capital";
  items: SupportItem[];
}

export interface RecommendationInstance {
  id: string;
  supportId: string;
  supportName: string;
  categoryName: string;
  ndisCategory: "Core" | "Capacity Building" | "Capital";
  catColor: string;
  currentHours: string;
  recommendedHours: string;
  ratio: string;
  tasks: string[];
  customTask: string;
  justification: string;
  outcomes: string[];
  consequence: string;
  linkedSections: string[];
  s34Justification: string;
  estimatedCost: string;
  isCapital?: boolean;
  isConsumable?: boolean;
}

export const OUTCOME_OPTIONS = [
  { id: "maintain_safety", label: "Maintain safety and wellbeing", short: "Safety" },
  { id: "build_capacity", label: "Build capacity toward independence", short: "Capacity" },
  { id: "social_participation", label: "Increase social and community participation", short: "Social" },
  { id: "reduce_informal", label: "Reduce reliance on informal supports", short: "Carer relief" },
  { id: "achieve_goals", label: "Support achievement of NDIS goals", short: "Goals" },
  { id: "prevent_deterioration", label: "Prevent functional deterioration", short: "Prevention" },
  { id: "prevent_hospitalisation", label: "Reduce risk of hospitalisation or crisis", short: "Hospital avoidance" },
];

export const SECTION_OPTIONS = [
  "2","4","5","7","8","9","10","11",
  "12.1","12.2","12.3","12.4","12.5","12.6","12.7","12.8","12.9","13",
];

export const SUPPORT_LIBRARY: Record<string, SupportCategory> = {
  "Core Supports — Assistance with Daily Life": {
    color: "#2563eb",
    category: "Core",
    items: [
      {
        id: "personal_care",
        name: "Personal Care Support",
        tasks: ["Showering and drying", "Dressing (upper and lower body)", "Grooming and hygiene", "Toileting and continence management", "Mealtime supervision"],
        outcomes: ["maintain_safety", "reduce_informal", "prevent_deterioration"],
        exampleConsequenceTemplate: "self-neglect, deterioration in skin integrity, nutritional compromise, and increased falls risk during unsupervised personal care tasks",
        sections: ["12.3"],
      },
      {
        id: "domestic",
        name: "Domestic Assistance",
        tasks: ["Meal preparation", "Cleaning and tidying", "Laundry", "Dishwashing", "General household tasks"],
        outcomes: ["maintain_safety", "build_capacity", "reduce_informal"],
        exampleConsequenceTemplate: "deterioration of the home environment, nutritional compromise due to inability to prepare meals, and increased burden on informal supports",
        sections: ["12.4"],
      },
      {
        id: "community_access",
        name: "Community Access Support",
        tasks: ["Accompanied community outings", "Support to attend appointments", "Social and recreational activities", "Shopping support", "Transport assistance"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "increased social isolation, inability to attend medical appointments, and progressive withdrawal from community life",
        sections: ["9", "12.8"],
      },
      {
        id: "overnight_active",
        name: "Overnight Support (Active)",
        tasks: ["Overnight supervision", "Assistance with repositioning", "Continence management", "Behavioural support", "Emergency response"],
        outcomes: ["maintain_safety", "reduce_informal", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "unmanaged safety risks overnight, risk of falls without assistance, and unsustainable burden on informal overnight supports",
        sections: ["11", "12.2"],
      },
      {
        id: "overnight_inactive",
        name: "Overnight Support (Inactive/Sleepover)",
        tasks: ["Sleepover presence for safety", "Response to overnight needs as they arise", "Morning and evening routine support"],
        outcomes: ["maintain_safety", "reduce_informal"],
        exampleConsequenceTemplate: "participant left without overnight safety net, increasing risk of harm from unmanaged medical or behavioural events",
        sections: ["11"],
      },
      {
        id: "mealtime_supervision",
        name: "Mealtime Supervision",
        tasks: ["Supervision during meals", "Monitoring for choking risk", "Assistance with food cutting and setup", "Ensuring adequate nutritional intake"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "choking incidents during unsupervised mealtimes, nutritional compromise, and risk of aspiration-related hospitalisation",
        sections: ["12.3"],
      },
      {
        id: "transport",
        name: "Transport Assistance",
        tasks: ["Transport to and from appointments", "Accompanied travel for community access", "Support with public transport use"],
        outcomes: ["social_participation", "achieve_goals"],
        exampleConsequenceTemplate: "inability to attend medical appointments, allied health sessions, and community activities, leading to functional decline and social isolation",
        sections: ["12.5"],
      },
      {
        id: "garden_maintenance",
        name: "Garden & Home Maintenance",
        tasks: ["Lawn mowing", "Garden upkeep", "Minor home repairs", "Bin management", "Outdoor area maintenance"],
        outcomes: ["maintain_safety", "reduce_informal"],
        exampleConsequenceTemplate: "deterioration of the home environment, safety hazards from unmaintained outdoor areas, and increased burden on informal supports",
        sections: ["12.4"],
      },
    ],
  },
  "Core Supports — Consumables & AT": {
    color: "#059669",
    category: "Core",
    items: [
      {
        id: "continence_aids",
        name: "Continence Aids",
        tasks: ["Supply of continence pads/aids", "Regular replacement schedule"],
        outcomes: ["maintain_safety"],
        exampleConsequenceTemplate: "compromised dignity, skin integrity issues, and increased personal care time",
        sections: ["12.3"],
        isConsumable: true,
      },
      {
        id: "low_cost_at",
        name: "Low-Cost Assistive Technology",
        tasks: ["Non-slip mats", "Shower chair", "Raised toilet seat", "Grab rails (portable)", "Dressing aids", "Kitchen aids"],
        outcomes: ["maintain_safety", "build_capacity", "prevent_deterioration"],
        exampleConsequenceTemplate: "increased falls risk, reduced independence in ADLs, and higher support worker hours required for tasks the participant could complete with appropriate equipment",
        sections: ["12.1", "12.2", "12.3"],
        isConsumable: true,
      },
    ],
  },
  "Capacity Building — Improved Daily Living": {
    color: "#7c3aed",
    category: "Capacity Building",
    items: [
      {
        id: "ot",
        name: "Occupational Therapy",
        tasks: ["Functional capacity assessment and review", "ADL retraining and skill building", "Home modification assessment", "Assistive technology prescription", "Sensory strategies and environmental modification", "Carer training", "Report writing and care coordination"],
        outcomes: ["build_capacity", "achieve_goals", "reduce_informal", "prevent_deterioration"],
        exampleConsequenceTemplate: "missed opportunity for capacity building intervention that could reduce long-term support needs, and inability to assess and implement appropriate assistive technology and home modifications",
        sections: ["12.3", "12.4", "12.5"],
      },
      {
        id: "physio",
        name: "Physiotherapy",
        tasks: ["Mobility and gait training", "Strength and conditioning", "Falls prevention program", "Balance retraining", "Pain management", "Exercise prescription"],
        outcomes: ["build_capacity", "prevent_deterioration", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "progressive decline in mobility, increased falls risk, and deconditioning that will increase long-term support needs",
        sections: ["12.1", "12.2"],
      },
      {
        id: "psychology",
        name: "Psychology",
        tasks: ["Psychological assessment", "Cognitive behavioural therapy", "Trauma-focused therapy", "Anxiety and mood management", "Behavioural intervention", "Carer support and psychoeducation"],
        outcomes: ["build_capacity", "achieve_goals", "prevent_hospitalisation", "social_participation"],
        exampleConsequenceTemplate: "unmanaged mental health symptoms, risk of acute deterioration and hospitalisation, and inability to engage meaningfully with other supports",
        sections: ["11", "12.8"],
      },
      {
        id: "speech",
        name: "Speech Pathology",
        tasks: ["Communication assessment", "AAC device trial and training", "Swallowing assessment and management", "Social communication intervention", "Mealtime management plan"],
        outcomes: ["build_capacity", "maintain_safety", "social_participation"],
        exampleConsequenceTemplate: "unmanaged swallowing risks, inability to communicate needs effectively, and progressive social withdrawal due to communication barriers",
        sections: ["12.7"],
      },
      {
        id: "dietitian",
        name: "Dietitian",
        tasks: ["Nutritional assessment", "Meal planning for specific dietary needs", "Weight management support", "Texture-modified diet planning", "Carer education on nutritional needs"],
        outcomes: ["maintain_safety", "build_capacity"],
        exampleConsequenceTemplate: "nutritional compromise, weight-related health complications, and increased risk of hospital presentation for malnutrition-related conditions",
        sections: ["12.3"],
      },
      {
        id: "exercise_physiology",
        name: "Exercise Physiology",
        tasks: ["Exercise prescription and supervision", "Strength and conditioning program", "Cardiovascular fitness", "Group exercise program", "Health and wellness coaching"],
        outcomes: ["build_capacity", "prevent_deterioration", "social_participation"],
        exampleConsequenceTemplate: "progressive deconditioning, increased falls risk, and reduced capacity for independent daily living tasks",
        sections: ["12.1"],
      },
      {
        id: "behaviour_support",
        name: "Behaviour Support",
        tasks: ["Functional behaviour assessment", "Positive behaviour support plan development", "Implementation support and training", "Restrictive practice review", "Carer and support worker training"],
        outcomes: ["build_capacity", "maintain_safety", "reduce_informal"],
        exampleConsequenceTemplate: "escalation of behaviours of concern, risk of harm to self or others, potential for increased use of restrictive practices, and placement breakdown",
        sections: ["11", "12.8"],
      },
    ],
  },
  "Capacity Building — Social & Community": {
    color: "#0891b2",
    category: "Capacity Building",
    items: [
      {
        id: "support_coordination",
        name: "Support Coordination",
        tasks: ["NDIS plan implementation", "Service provider coordination", "Crisis response coordination", "Plan review preparation", "Connecting to community services"],
        outcomes: ["achieve_goals", "reduce_informal", "social_participation"],
        exampleConsequenceTemplate: "fragmented service delivery, inability to implement the NDIS plan effectively, and increased burden on informal supports to coordinate care",
        sections: [],
      },
      {
        id: "specialist_sc",
        name: "Specialist Support Coordination",
        tasks: ["Complex needs coordination", "Multi-agency liaison", "Housing and SIL/SDA coordination", "Crisis intervention", "Restrictive practice oversight"],
        outcomes: ["maintain_safety", "achieve_goals", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "uncoordinated complex support needs, increased risk of crisis presentation, and potential placement breakdown",
        sections: ["11"],
      },
      {
        id: "community_participation",
        name: "Community Participation Programs",
        tasks: ["Group social activities", "Skill-building programs", "Recreational activities", "Peer connection opportunities", "Life skills development"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "ongoing social isolation, lack of meaningful daytime activity, and missed opportunities for skill development and social connection",
        sections: ["9", "10"],
      },
      {
        id: "parenting_support",
        name: "Parenting Support",
        tasks: ["Parenting skills coaching", "Child safety support", "Routine and structure development", "School engagement support", "Family relationship support"],
        outcomes: ["build_capacity", "maintain_safety", "achieve_goals"],
        exampleConsequenceTemplate: "child safety concerns, inability to meet parenting responsibilities independently, and risk of child protection involvement",
        sections: ["12.5"],
      },
      {
        id: "employment_support",
        name: "Employment / Study Support",
        tasks: ["Vocational assessment", "Job readiness training", "Workplace support and coaching", "Study skills support", "Supported employment placement"],
        outcomes: ["build_capacity", "achieve_goals", "social_participation"],
        exampleConsequenceTemplate: "inability to pursue employment or educational goals, continued financial dependence, and missed opportunity for meaningful occupation",
        sections: ["12.5", "12.6"],
      },
    ],
  },
  "Capital Supports": {
    color: "#dc2626",
    category: "Capital",
    items: [
      {
        id: "home_mods",
        name: "Home Modifications",
        tasks: ["Grab rail installation", "Ramp installation", "Bathroom modification", "Kitchen modification", "Widening doorways", "Ceiling hoist installation"],
        outcomes: ["maintain_safety", "build_capacity", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "ongoing falls risk in unsafe home environment, inability to access essential areas of the home independently, and potential need for premature residential placement",
        sections: ["8"],
        isCapital: true,
      },
      {
        id: "high_at",
        name: "Assistive Technology (High-Cost)",
        tasks: ["Powered wheelchair", "Specialised seating", "Communication device (AAC)", "Pressure care equipment", "Adjustable bed and accessories"],
        outcomes: ["build_capacity", "maintain_safety", "social_participation"],
        exampleConsequenceTemplate: "inability to mobilise independently, progressive postural deterioration, pressure injury risk, and reduced community participation",
        sections: ["12.1", "12.7"],
        isCapital: true,
      },
    ],
  },
};
