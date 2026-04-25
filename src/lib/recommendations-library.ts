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
  isConsumable?: boolean;
  isCapital?: boolean;
  /**
   * Hide the Support Ratio field in the RecommendationCard UI for this
   * item. Use for professional/clinician services (OT, Psychology, Speech,
   * etc.) where the 1:1 clinician-to-participant ratio is implicit and not
   * a decision variable, and for coordination services (SC, Specialist SC)
   * where the funding is hours-based rather than ratio-based, and for
   * task-based supports like garden maintenance where participant ratio is
   * not applicable. Items without this flag continue to show the ratio
   * selector as before.
   */
  hideRatio?: boolean;
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
      },
      {
        id: "domestic",
        name: "Domestic Assistance",
        tasks: ["Meal preparation", "Cleaning and tidying", "Laundry", "Dishwashing", "General household tasks"],
        outcomes: ["maintain_safety", "build_capacity", "reduce_informal"],
        exampleConsequenceTemplate: "deterioration of the home environment, nutritional compromise due to inability to prepare meals, and increased burden on informal supports",
      },
      {
        id: "community_access",
        name: "Community Access Support",
        tasks: ["Accompanied community outings", "Support to attend appointments", "Social and recreational activities", "Shopping support", "Transport assistance"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "increased social isolation, inability to attend medical appointments, and progressive withdrawal from community life",
      },
      {
        id: "overnight_active",
        name: "Overnight Support (Active)",
        tasks: ["Overnight supervision", "Assistance with repositioning", "Continence management", "Behavioural support", "Emergency response"],
        outcomes: ["maintain_safety", "reduce_informal", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "unmanaged safety risks overnight, risk of falls without assistance, and unsustainable burden on informal overnight supports",
      },
      {
        id: "overnight_inactive",
        name: "Overnight Support (Inactive/Sleepover)",
        tasks: ["Sleepover presence for safety", "Response to overnight needs as they arise", "Morning and evening routine support"],
        outcomes: ["maintain_safety", "reduce_informal"],
        exampleConsequenceTemplate: "participant left without overnight safety net, increasing risk of harm from unmanaged medical or behavioural events",
      },
      {
        id: "mealtime_supervision",
        name: "Mealtime Supervision",
        tasks: ["Supervision during meals", "Monitoring for choking risk", "Assistance with food cutting and setup", "Ensuring adequate nutritional intake"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "choking incidents during unsupervised mealtimes, nutritional compromise, and risk of aspiration-related hospitalisation",
      },
      {
        id: "transport",
        name: "Transport Assistance",
        tasks: ["Transport to and from appointments", "Accompanied travel for community access", "Support with public transport use"],
        outcomes: ["social_participation", "achieve_goals"],
        exampleConsequenceTemplate: "inability to attend medical appointments, allied health sessions, and community activities, leading to functional decline and social isolation",
      },
      {
        id: "garden_maintenance",
        name: "Garden & Home Maintenance",
        tasks: ["Lawn mowing", "Garden upkeep", "Minor home repairs", "Bin management", "Outdoor area maintenance"],
        outcomes: ["maintain_safety", "reduce_informal"],
        exampleConsequenceTemplate: "deterioration of the home environment, safety hazards from unmaintained outdoor areas, and increased burden on informal supports",
        hideRatio: true,
      },
      {
        id: "high_intensity_personal_care_l1",
        name: "High Intensity Daily Personal Activities — Level 1",
        tasks: ["Continence support requiring training", "Manual handling with no equipment", "Stoma care", "Catheter care", "Severe dysphagia mealtime support"],
        outcomes: ["maintain_safety", "prevent_hospitalisation", "reduce_informal"],
        exampleConsequenceTemplate: "skin breakdown, urinary tract infection, choking and aspiration events, and unmanaged complex personal care needs requiring trained worker intervention",
      },
      {
        id: "high_intensity_personal_care_l2",
        name: "High Intensity Daily Personal Activities — Level 2",
        tasks: ["Complex bowel care", "Tracheostomy care", "Ventilator support", "Enteral feeding (PEG/NG)", "Diabetes management requiring insulin", "Complex wound care"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "life-threatening medical complications, frequent hospital presentations, and inability to safely live in the community without trained high-intensity support",
      },
      {
        id: "respite_short_term_accommodation",
        name: "Short Term Accommodation & Assistance (Respite)",
        tasks: ["Overnight respite stays", "Weekend respite", "Crisis respite", "Support during informal carer absence", "Recreation activities during respite"],
        outcomes: ["reduce_informal", "maintain_safety", "social_participation"],
        exampleConsequenceTemplate: "informal carer burnout and breakdown, escalating risk of placement instability, and acute mental health deterioration when respite is not available",
      },
      {
        id: "school_holiday_program",
        name: "School Holiday Program",
        tasks: ["Structured holiday activities", "Transport to and from program", "Recreational outings", "Skill-building activities", "Carer relief during school breaks"],
        outcomes: ["reduce_informal", "social_participation", "build_capacity"],
        exampleConsequenceTemplate: "complete loss of routine during school holidays, behavioural escalation, and unsustainable carer load during periods when school structure is removed",
      },
      {
        id: "sleepover_active_overnight",
        name: "Active Overnight Support (Awake)",
        tasks: ["Awake overnight support worker", "Repositioning during the night", "Continence management overnight", "Behavioural response", "Medication administration"],
        outcomes: ["maintain_safety", "prevent_hospitalisation", "reduce_informal"],
        exampleConsequenceTemplate: "unmanaged overnight medical or behavioural events, repositioning failure leading to pressure injury, and unsustainable carer load on family members providing overnight care",
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
        isConsumable: true,
      },
      {
        id: "low_cost_at",
        name: "Low-Cost Assistive Technology",
        tasks: ["Non-slip mats", "Shower chair", "Raised toilet seat", "Grab rails (portable)", "Dressing aids", "Kitchen aids"],
        outcomes: ["maintain_safety", "build_capacity", "prevent_deterioration"],
        exampleConsequenceTemplate: "increased falls risk, reduced independence in ADLs, and higher support worker hours required for tasks the participant could complete with appropriate equipment",
        isConsumable: true,
      },
      {
        id: "nutritional_supplements",
        name: "Nutritional Supplements & Specialised Formula",
        tasks: ["Texture-modified meals", "Enteral feeding formula", "Nutritional supplement drinks", "Vitamin and mineral supplementation", "Specialised dietary products"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "ongoing nutritional deficiency, weight loss, and increased risk of hospital presentation for malnutrition-related conditions",
        isConsumable: true,
      },
      {
        id: "wound_care_consumables",
        name: "Wound & Skin Care Consumables",
        tasks: ["Wound dressings", "Pressure-relieving cushions and overlays", "Barrier creams", "Skin-protective products", "Specialised hygiene wipes"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "preventable pressure injuries, wound deterioration, and acute hospital admission for skin breakdown that could be managed with appropriate consumables",
        isConsumable: true,
      },
      {
        id: "communication_consumables",
        name: "Low-Cost Communication Aids",
        tasks: ["Communication boards", "Picture exchange cards", "AAC apps and software", "Switch-access devices", "Visual schedule materials"],
        outcomes: ["build_capacity", "social_participation"],
        exampleConsequenceTemplate: "ongoing inability to communicate basic needs, dignity loss during care interactions, and social withdrawal due to communication barriers",
        isConsumable: true,
      },
    ],
  },
  "Core Supports — Social & Community Participation": {
    color: "#0d9488",
    category: "Core",
    items: [
      {
        id: "centre_based_group",
        name: "Centre-Based Group Activities",
        tasks: ["Day program attendance", "Group recreational activities", "Skill-building groups", "Social engagement programs", "Daily structured routines"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "withdrawal from community life, loss of daytime structure, and absence of opportunities for peer connection and meaningful daily activity",
      },
      {
        id: "community_access_one_on_one",
        name: "1:1 Community Access",
        tasks: ["Accompanied community outings", "Skill-building in real settings", "Supported access to events and venues", "Travel training", "Community route familiarisation"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "inability to access community settings safely, missed opportunities for skill development in real-world environments, and progressive disengagement from community life",
      },
      {
        id: "supported_holidays",
        name: "Supported Holiday & Vacation Programs",
        tasks: ["Group holiday programs", "Supported travel", "Recreational activities away from home", "Carer relief during holidays"],
        outcomes: ["social_participation", "reduce_informal", "achieve_goals"],
        exampleConsequenceTemplate: "absence of any holiday or change of routine, ongoing carer load during extended periods, and loss of developmental and recreational opportunity",
      },
      {
        id: "peer_support_program",
        name: "Peer Support / Mentoring Program",
        tasks: ["Peer mentor sessions", "Peer-led group activities", "Disability-specific peer connection", "Mentoring around independence and goals"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "social isolation from disability peers, loss of peer-modelled coping strategies, and reduced sense of community and identity",
      },
      {
        id: "cultural_community_engagement",
        name: "Cultural & Community Engagement Support",
        tasks: ["Support to attend cultural events", "Engagement with cultural community groups", "Religious and spiritual community access", "Language-appropriate community programs"],
        outcomes: ["social_participation", "achieve_goals"],
        exampleConsequenceTemplate: "disconnection from cultural identity, loss of meaningful community ties, and reduced wellbeing due to absence of culturally appropriate support",
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
        hideRatio: true,
      },
      {
        id: "physio",
        name: "Physiotherapy",
        tasks: ["Mobility and gait training", "Strength and conditioning", "Falls prevention program", "Balance retraining", "Pain management", "Exercise prescription"],
        outcomes: ["build_capacity", "prevent_deterioration", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "progressive decline in mobility, increased falls risk, and deconditioning that will increase long-term support needs",
        hideRatio: true,
      },
      {
        id: "psychology",
        name: "Psychology",
        tasks: ["Psychological assessment", "Cognitive behavioural therapy", "Trauma-focused therapy", "Anxiety and mood management", "Behavioural intervention", "Carer support and psychoeducation"],
        outcomes: ["build_capacity", "achieve_goals", "prevent_hospitalisation", "social_participation"],
        exampleConsequenceTemplate: "unmanaged mental health symptoms, risk of acute deterioration and hospitalisation, and inability to engage meaningfully with other supports",
        hideRatio: true,
      },
      {
        id: "speech",
        name: "Speech Pathology",
        tasks: ["Communication assessment", "AAC device trial and training", "Swallowing assessment and management", "Social communication intervention", "Mealtime management plan"],
        outcomes: ["build_capacity", "maintain_safety", "social_participation"],
        exampleConsequenceTemplate: "unmanaged swallowing risks, inability to communicate needs effectively, and progressive social withdrawal due to communication barriers",
        hideRatio: true,
      },
      {
        id: "dietitian",
        name: "Dietitian",
        tasks: ["Nutritional assessment", "Meal planning for specific dietary needs", "Weight management support", "Texture-modified diet planning", "Carer education on nutritional needs"],
        outcomes: ["maintain_safety", "build_capacity"],
        exampleConsequenceTemplate: "nutritional compromise, weight-related health complications, and increased risk of hospital presentation for malnutrition-related conditions",
        hideRatio: true,
      },
      {
        id: "exercise_physiology",
        name: "Exercise Physiology",
        tasks: ["Exercise prescription and supervision", "Strength and conditioning program", "Cardiovascular fitness", "Group exercise program", "Health and wellness coaching"],
        outcomes: ["build_capacity", "prevent_deterioration", "social_participation"],
        exampleConsequenceTemplate: "progressive deconditioning, increased falls risk, and reduced capacity for independent daily living tasks",
        hideRatio: true,
      },
      {
        id: "behaviour_support",
        name: "Behaviour Support",
        tasks: ["Functional behaviour assessment", "Positive behaviour support plan development", "Implementation support and training", "Restrictive practice review", "Carer and support worker training"],
        outcomes: ["build_capacity", "maintain_safety", "reduce_informal"],
        exampleConsequenceTemplate: "escalation of behaviours of concern, risk of harm to self or others, potential for increased use of restrictive practices, and placement breakdown",
        hideRatio: true,
      },
      {
        id: "counselling",
        name: "Counselling (separate from Psychology)",
        tasks: ["Solution-focused counselling", "Grief and loss support", "Adjustment to disability counselling", "Family relationship counselling", "Trauma-informed counselling"],
        outcomes: ["build_capacity", "achieve_goals", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "unaddressed emotional distress, deterioration in coping capacity, and inability to engage with other supports due to unmanaged psychological burden",
        hideRatio: true,
      },
      {
        id: "art_music_therapy",
        name: "Art / Music / Movement Therapy",
        tasks: ["Creative therapy sessions", "Sensory regulation through art or music", "Non-verbal expression and communication", "Group creative therapy", "Therapeutic movement programs"],
        outcomes: ["build_capacity", "social_participation", "achieve_goals"],
        exampleConsequenceTemplate: "loss of accessible communication and expression channels for participants with limited verbal capacity, and reduced engagement with therapeutic intervention",
        hideRatio: true,
      },
      {
        id: "continence_assessment",
        name: "Continence Assessment & Management",
        tasks: ["Specialised continence assessment", "Bladder and bowel management plan", "Continence aid prescription", "Pelvic floor rehabilitation", "Carer training in continence care"],
        outcomes: ["maintain_safety", "build_capacity", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "ongoing skin integrity issues, urinary tract infection, dignity loss during continence care, and inappropriate use of continence aids",
        hideRatio: true,
      },
      {
        id: "dysphagia_management",
        name: "Dysphagia Assessment & Management",
        tasks: ["Swallowing assessment", "Mealtime management plan", "Texture-modified diet recommendations", "Mealtime support training", "Aspiration risk monitoring"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "choking events, aspiration pneumonia hospitalisation, and unmanaged mealtime safety risks",
        hideRatio: true,
      },
      {
        id: "audiology",
        name: "Audiology",
        tasks: ["Hearing assessment", "Hearing aid fitting and tuning", "Auditory processing assessment", "Cochlear implant rehabilitation", "Hearing health education"],
        outcomes: ["build_capacity", "social_participation"],
        exampleConsequenceTemplate: "progressive social withdrawal due to hearing loss, communication breakdown with carers and clinicians, and reduced engagement with therapeutic supports",
        hideRatio: true,
      },
      {
        id: "optometry_low_vision",
        name: "Optometry / Low Vision Services",
        tasks: ["Low vision assessment", "Magnification and assistive aid prescription", "Environmental modification advice", "Orientation and mobility training", "Vision-related ADL training"],
        outcomes: ["build_capacity", "maintain_safety"],
        exampleConsequenceTemplate: "preventable falls due to undiagnosed vision impairment, loss of independence in ADLs requiring vision, and reduced community access",
        hideRatio: true,
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
        hideRatio: true,
      },
      {
        id: "specialist_sc",
        name: "Specialist Support Coordination",
        tasks: ["Complex needs coordination", "Multi-agency liaison", "Housing and SIL/SDA coordination", "Crisis intervention", "Restrictive practice oversight"],
        outcomes: ["maintain_safety", "achieve_goals", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "uncoordinated complex support needs, increased risk of crisis presentation, and potential placement breakdown",
        hideRatio: true,
      },
      {
        id: "community_participation",
        name: "Community Participation Programs",
        tasks: ["Group social activities", "Skill-building programs", "Recreational activities", "Peer connection opportunities", "Life skills development"],
        outcomes: ["social_participation", "build_capacity", "achieve_goals"],
        exampleConsequenceTemplate: "ongoing social isolation, lack of meaningful daytime activity, and missed opportunities for skill development and social connection",
      },
      {
        id: "parenting_support",
        name: "Parenting Support",
        tasks: ["Parenting skills coaching", "Child safety support", "Routine and structure development", "School engagement support", "Family relationship support"],
        outcomes: ["build_capacity", "maintain_safety", "achieve_goals"],
        exampleConsequenceTemplate: "child safety concerns, inability to meet parenting responsibilities independently, and risk of child protection involvement",
      },
      {
        id: "employment_support",
        name: "Employment / Study Support",
        tasks: ["Vocational assessment", "Job readiness training", "Workplace support and coaching", "Study skills support", "Supported employment placement"],
        outcomes: ["build_capacity", "achieve_goals", "social_participation"],
        exampleConsequenceTemplate: "inability to pursue employment or educational goals, continued financial dependence, and missed opportunity for meaningful occupation",
      },
      {
        id: "independent_living_skills",
        name: "Independent Living Skills Program",
        tasks: ["ADL skill-building", "Cooking and meal planning", "Money management training", "Public transport training", "Routine and time management"],
        outcomes: ["build_capacity", "achieve_goals", "reduce_informal"],
        exampleConsequenceTemplate: "ongoing dependence on informal supports for routine daily living tasks, loss of opportunity to develop foundational independence skills, and progression to higher-cost residential support",
      },
      {
        id: "social_skills_training",
        name: "Social Skills Training Program",
        tasks: ["Group social skills sessions", "Conversation and turn-taking practice", "Conflict resolution skills", "Friendship-building activities", "Community-based social skill application"],
        outcomes: ["build_capacity", "social_participation", "achieve_goals"],
        exampleConsequenceTemplate: "ongoing social difficulties leading to loneliness and exclusion, missed opportunities to develop reciprocal peer relationships, and consequent risk of mental health deterioration",
      },
      {
        id: "transition_to_adulthood",
        name: "Transition to Adulthood / School Leaver Support",
        tasks: ["Post-school options exploration", "Goal-setting and planning", "Skill-building for adult life", "Connection to adult services", "Family transition support"],
        outcomes: ["build_capacity", "achieve_goals", "social_participation"],
        exampleConsequenceTemplate: "abrupt loss of school structure without alternative pathway, disengagement from community, and missed opportunity to build foundations for adult independence",
      },
    ],
  },
  "Capacity Building — Improved Health & Wellbeing": {
    color: "#16a34a",
    category: "Capacity Building",
    items: [
      {
        id: "exercise_program",
        name: "Structured Exercise & Fitness Program",
        tasks: ["Individual exercise prescription", "Gym-based exercise sessions", "Group fitness classes", "Home exercise program", "Health and wellness coaching"],
        outcomes: ["build_capacity", "prevent_deterioration", "social_participation"],
        exampleConsequenceTemplate: "progressive deconditioning, weight gain, secondary metabolic complications, and increased falls risk due to reduced muscle strength and balance",
      },
      {
        id: "hydrotherapy",
        name: "Hydrotherapy / Aquatic Therapy",
        tasks: ["Pool-based therapeutic exercise", "Pain management in water", "Range of motion exercises", "Cardiovascular conditioning", "Recreation in water"],
        outcomes: ["build_capacity", "prevent_deterioration"],
        exampleConsequenceTemplate: "loss of low-impact exercise option for participants unable to tolerate land-based activity, leading to deconditioning and pain escalation",
      },
      {
        id: "wellness_coaching",
        name: "Disability-Informed Wellness Coaching",
        tasks: ["Individual wellness goal-setting", "Sleep hygiene education", "Stress management techniques", "Nutrition education", "Health behaviour change support"],
        outcomes: ["build_capacity", "prevent_deterioration", "achieve_goals"],
        exampleConsequenceTemplate: "ongoing poor sleep, unmanaged stress, deteriorating health behaviours, and loss of opportunity for self-management capacity-building",
        hideRatio: true,
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
        isCapital: true,
      },
      {
        id: "high_at",
        name: "Assistive Technology (High-Cost General)",
        tasks: ["Powered wheelchair", "Specialised seating", "Pressure care equipment", "Adjustable bed and accessories"],
        outcomes: ["build_capacity", "maintain_safety", "social_participation"],
        exampleConsequenceTemplate: "inability to mobilise independently, progressive postural deterioration, pressure injury risk, and reduced community participation",
        isCapital: true,
      },
      {
        id: "home_mods_minor",
        name: "Home Modifications — Minor",
        tasks: ["Grab rail installation", "Portable ramps", "Lever taps", "Threshold ramps", "Handheld shower installation"],
        outcomes: ["maintain_safety", "build_capacity"],
        exampleConsequenceTemplate: "ongoing falls risk and dependency on support workers for tasks the participant could complete with simple environmental adjustments",
        isCapital: true,
      },
      {
        id: "home_mods_major",
        name: "Home Modifications — Major / Complex",
        tasks: ["Bathroom redesign and reconstruction", "Kitchen accessibility modification", "Doorway widening", "Ceiling hoist installation", "Wet area drainage and slip-resistant flooring", "Stair lift or platform lift installation"],
        outcomes: ["maintain_safety", "build_capacity", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "inability to safely access essential areas of the home, ongoing manual handling injury risk to carers, and pathway to premature residential placement",
        isCapital: true,
      },
      {
        id: "aac_device",
        name: "AAC Communication Device",
        tasks: ["Specialised AAC device prescription", "Eye-gaze communication system", "Speech-generating device", "Custom symbol and vocabulary setup", "Device training for participant and supporters"],
        outcomes: ["build_capacity", "social_participation", "maintain_safety"],
        exampleConsequenceTemplate: "ongoing inability to express needs, dignity loss in care interactions, missed identification of pain or distress, and inability to participate in decision-making about own life",
        isCapital: true,
      },
      {
        id: "vehicle_modifications",
        name: "Vehicle Modifications",
        tasks: ["Wheelchair-accessible vehicle modification", "Driving control modifications", "Hoist installation", "Specialised seating in vehicle", "Loading and unloading equipment"],
        outcomes: ["build_capacity", "social_participation", "achieve_goals"],
        exampleConsequenceTemplate: "ongoing reliance on specialised transport services, social and community access restricted to where carers can transport the participant, and loss of independence in personal travel",
        isCapital: true,
      },
    ],
  },
  "Capital — Specialised Disability Accommodation (SDA)": {
    color: "#9333ea",
    category: "Capital",
    items: [
      {
        id: "sda_improved_liveability",
        name: "SDA — Improved Liveability",
        tasks: ["Accommodation with enhanced lighting and contrast", "Sensory-friendly design", "Wayfinding features", "Suited to participants with sensory or cognitive disabilities"],
        outcomes: ["maintain_safety", "build_capacity", "social_participation"],
        exampleConsequenceTemplate: "inability to navigate or live safely in standard housing, behavioural escalation in unsuitable environments, and pathway to higher-cost residential placements",
        isCapital: true,
      },
      {
        id: "sda_fully_accessible",
        name: "SDA — Fully Accessible",
        tasks: ["Wheelchair-accessible accommodation", "Step-free entry and circulation", "Accessible bathroom and kitchen", "Suited to participants with significant physical impairment"],
        outcomes: ["maintain_safety", "build_capacity", "social_participation"],
        exampleConsequenceTemplate: "inability to use essential areas of the home independently, full manual-handling dependency, and pathway to high-cost residential placement",
        isCapital: true,
      },
      {
        id: "sda_robust",
        name: "SDA — Robust",
        tasks: ["Resilient construction for participants with behaviours of concern", "Reinforced fixtures and fittings", "Safe environment design", "Appropriate for participants with risks of property damage"],
        outcomes: ["maintain_safety", "prevent_hospitalisation"],
        exampleConsequenceTemplate: "ongoing property damage and unsafe environment for both participant and supporters, escalating placement instability, and increased restrictive practice use in unsuitable environments",
        isCapital: true,
      },
      {
        id: "sda_high_physical_support",
        name: "SDA — High Physical Support",
        tasks: ["Accommodation with ceiling hoists throughout", "Backup power for life-support equipment", "Wide circulation for powered wheelchairs", "Suited to participants with very high physical support needs"],
        outcomes: ["maintain_safety", "prevent_hospitalisation", "build_capacity"],
        exampleConsequenceTemplate: "inability to live safely outside hospital or institutional care, life-threatening medical complications without appropriate environmental supports, and complete loss of community living",
        isCapital: true,
      },
    ],
  },
};
