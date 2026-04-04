import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface ParticipantReportDetailsProps {
  notes: Record<string, string>;
  onUpdateNote: (key: string, value: string) => void;
  clientName?: string;
  ndisNumber?: string;
  clinicianProfile: {
    clinician_name: string | null;
    qualifications: string | null;
    ahpra_number: string | null;
    practice_name: string | null;
  } | null;
}

// Note keys used for participant details
const PARTICIPANT_KEYS = {
  fullName: "__participant__fullName",
  dob: "__participant__dob",
  ndisNumber: "__participant__ndisNumber",
  address: "__participant__address",
  primaryContact: "__participant__primaryContact",
} as const;

const CLINICIAN_KEYS = {
  phoneEmail: "__clinician__phoneEmail",
  dateOfAssessment: "__clinician__dateOfAssessment",
  dateOfReport: "__clinician__dateOfReport",
} as const;

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  mono = false,
  half = false,
  readonly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
  half?: boolean;
  readonly?: boolean;
}) {
  return (
    <div className={cn("min-w-0", half ? "flex-[1_1_48%] min-w-[200px]" : "flex-[1_1_100%]")}>
      <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-0.5">
        {label}
        {required && <span className="text-destructive text-[9px]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readonly}
        className={cn(
          "w-full px-2.5 py-[7px] rounded-md border text-xs text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50",
          "placeholder:text-muted-foreground/50",
          mono && "font-mono",
          readonly ? "bg-muted/50 cursor-default" : "bg-background",
          required && !value.trim() ? "border-destructive/40" : "border-border/60"
        )}
      />
    </div>
  );
}

function SectionBlock({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-1 h-[18px] rounded-sm"
          style={{ backgroundColor: accent || "hsl(var(--foreground))" }}
        />
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <div className="border border-border/50 rounded-lg p-3.5 bg-card flex flex-wrap gap-2.5">
        {children}
      </div>
    </div>
  );
}

export function ParticipantReportDetails({
  notes,
  onUpdateNote,
  clientName,
  ndisNumber,
  clinicianProfile,
}: ParticipantReportDetailsProps) {
  const fullName = notes[PARTICIPANT_KEYS.fullName] || clientName || "";
  const dob = notes[PARTICIPANT_KEYS.dob] || "";
  const ndis = notes[PARTICIPANT_KEYS.ndisNumber] || ndisNumber || "";
  const address = notes[PARTICIPANT_KEYS.address] || "";
  const primaryContact = notes[PARTICIPANT_KEYS.primaryContact] || "";
  const phoneEmail = notes[CLINICIAN_KEYS.phoneEmail] || "";
  const dateOfAssessment = notes[CLINICIAN_KEYS.dateOfAssessment] || "";
  const dateOfReport = notes[CLINICIAN_KEYS.dateOfReport] || "";

  const age = useMemo(() => {
    if (!dob) return "";
    const birth = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--;
    return years >= 0 ? `${years} years` : "";
  }, [dob]);

  const requiredFields = useMemo(() => {
    const checks = [
      { label: "Full Name", filled: !!fullName.trim() },
      { label: "Date of Birth", filled: !!dob },
      { label: "NDIS Number", filled: !!ndis.trim() },
      { label: "Address", filled: !!address.trim() },
      { label: "Clinician Name", filled: !!(clinicianProfile?.clinician_name || "").trim() },
      { label: "Qualifications", filled: !!(clinicianProfile?.qualifications || "").trim() },
      { label: "AHPRA", filled: !!(clinicianProfile?.ahpra_number || "").trim() },
      { label: "Organisation", filled: !!(clinicianProfile?.practice_name || "").trim() },
      { label: "Date of Assessment", filled: !!dateOfAssessment },
    ];
    return {
      total: checks.length,
      filled: checks.filter((c) => c.filled).length,
      missing: checks.filter((c) => !c.filled).map((c) => c.label),
    };
  }, [fullName, dob, ndis, address, clinicianProfile, dateOfAssessment]);

  const allComplete = requiredFields.filled === requiredFields.total;

  return (
    <div className="border-b border-border/30">
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">1</span>
        <span className="text-sm font-semibold text-foreground flex-1">
          Participant & Report Details
        </span>
        {allComplete && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
      </div>

      {/* Completion indicator */}
      <div className="px-5 pb-3">
        <div
          className={cn(
            "flex justify-between items-center px-3.5 py-2 rounded-lg border text-xs",
            allComplete
              ? "bg-success/10 border-success/30 text-success"
              : "bg-warning/10 border-warning/30 text-warning"
          )}
        >
          <div>
            <strong>
              {requiredFields.filled}/{requiredFields.total}
            </strong>{" "}
            required fields completed
            {requiredFields.missing.length > 0 && requiredFields.missing.length <= 4 && (
              <span className="text-muted-foreground ml-2">
                Missing: {requiredFields.missing.join(", ")}
              </span>
            )}
          </div>
          {allComplete && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success uppercase tracking-wide">
              Complete
            </span>
          )}
        </div>
      </div>

      {/* Participant Details */}
      <div className="px-5 pb-4">
        <SectionBlock title="Participant Details">
          <Field
            label="Full Name"
            value={fullName}
            onChange={(v) => onUpdateNote(PARTICIPANT_KEYS.fullName, v)}
            placeholder="e.g. Daniel James Mitchell"
            required
          />
          <Field
            label="Date of Birth"
            value={dob}
            onChange={(v) => onUpdateNote(PARTICIPANT_KEYS.dob, v)}
            type="date"
            required
            half
          />
          <Field
            label="Age"
            value={age}
            onChange={() => {}}
            readonly
            placeholder="Auto-calculated"
            half
          />
          <Field
            label="NDIS Number"
            value={ndis}
            onChange={(v) => onUpdateNote(PARTICIPANT_KEYS.ndisNumber, v)}
            placeholder="e.g. 431 234 567"
            mono
            required
            half
          />
          <Field
            label="Primary Contact / Guardian"
            value={primaryContact}
            onChange={(v) => onUpdateNote(PARTICIPANT_KEYS.primaryContact, v)}
            placeholder="e.g. Mary Mitchell (Mother) — 0412 345 678"
            half
          />
          <Field
            label="Address"
            value={address}
            onChange={(v) => onUpdateNote(PARTICIPANT_KEYS.address, v)}
            placeholder="e.g. 14 Banksia Drive, Springfield QLD 4300"
            required
          />
        </SectionBlock>

        {/* Clinician Details — read-only from profile, except phone/email and dates */}
        <SectionBlock title="Clinician Details" accent="hsl(160, 84%, 39%)">
          <Field
            label="Report Author"
            value={clinicianProfile?.clinician_name || ""}
            onChange={() => {}}
            placeholder="Set in Profile settings"
            readonly
            required
            half
          />
          <Field
            label="Qualifications"
            value={clinicianProfile?.qualifications || ""}
            onChange={() => {}}
            placeholder="Set in Profile settings"
            readonly
            required
            half
          />
          <Field
            label="AHPRA Registration No."
            value={clinicianProfile?.ahpra_number || ""}
            onChange={() => {}}
            placeholder="Set in Profile settings"
            mono
            readonly
            required
            half
          />
          <Field
            label="Organisation / Practice"
            value={clinicianProfile?.practice_name || ""}
            onChange={() => {}}
            placeholder="Set in Profile settings"
            readonly
            required
            half
          />
          <Field
            label="Phone / Email"
            value={phoneEmail}
            onChange={(v) => onUpdateNote(CLINICIAN_KEYS.phoneEmail, v)}
            placeholder="e.g. 07 3456 7890 / sarah@ahp.com.au"
          />
          <Field
            label="Date of Assessment"
            value={dateOfAssessment}
            onChange={(v) => onUpdateNote(CLINICIAN_KEYS.dateOfAssessment, v)}
            type="date"
            required
            half
          />
          <Field
            label="Date of Report"
            value={dateOfReport}
            onChange={(v) => onUpdateNote(CLINICIAN_KEYS.dateOfReport, v)}
            type="date"
            half
          />
        </SectionBlock>
      </div>
    </div>
  );
}

// Export keys so ReportMode can read them
export { PARTICIPANT_KEYS, CLINICIAN_KEYS };
