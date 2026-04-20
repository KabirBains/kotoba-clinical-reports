export const TEMPLATE_SECTIONS = [
  { id: "participant-details", number: "1", title: "Participant & Report Details" },
  { id: "decision-maker", number: "1a", title: "Participant Decision Maker" },
  { id: "intervention-team", number: "2", title: "Intervention Team & Current Supports" },
  { id: "reason-referral", number: "3", title: "Reason for Referral" },
  { id: "background", number: "4", title: "Background Information" },
  { id: "participant-goals", number: "5", title: "Participant Goals" },
  { id: "diagnoses", number: "6", title: "Diagnoses" },
  { id: "ot-case-history", number: "7", title: "Allied Health Case History" },
  { id: "methodology", number: "8", title: "Methodology & Assessments Used" },
  { id: "informal-supports", number: "9", title: "Informal Supports" },
  { id: "home-environment", number: "10", title: "Home Environment" },
  { id: "social-environment", number: "11", title: "Social Environment" },
  { id: "typical-week", number: "12", title: "Typical Week" },
  { id: "risk-safety", number: "13", title: "Risk & Safety Profile" },
  {
    id: "functional-capacity",
    number: "14",
    title: "Functional Capacity — Domain Observations",
    subsections: [
      { id: "mobility", number: "14.1", title: "Mobility" },
      { id: "transfers", number: "14.2", title: "Transfers" },
      { id: "personal-adls", number: "14.3", title: "Personal ADLs" },
      { id: "domestic-iadls", number: "14.4", title: "Domestic IADLs" },
      { id: "executive-iadls", number: "14.5", title: "Executive IADLs" },
      { id: "cognition", number: "14.6", title: "Cognition" },
      { id: "communication", number: "14.7", title: "Communication" },
      { id: "social-functioning", number: "14.8", title: "Social Functioning" },
    ],
  },
  { id: "assessments", number: "15", title: "Assessments" },
  { id: "limitations-barriers", number: "16", title: "Limitations & Barriers to Progress" },
  { id: "functional-impact", number: "17", title: "Risks if No Funding" },
  { id: "recommendations", number: "18", title: "Recommendations" },
  { id: "review-monitoring", number: "19", title: "Barriers to Accessing/Utilising Supports" },
] as const;

export type TemplateSection = (typeof TEMPLATE_SECTIONS)[number];

export const REPORT_STATUSES = {
  NOTES_IN_PROGRESS: "Notes in progress",
  REPORT_GENERATED: "Report generated",
  FINALISED: "Finalised",
} as const;
