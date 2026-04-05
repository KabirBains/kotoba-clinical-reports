import { useState } from "react";
import { generateSection, qualityCheck, assembleReportContext } from "@/ai/reportEngine";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, Info, RotateCcw, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportSectionGeneratorProps {
  sectionId: string;
  sectionName: string;
  clientName: string;
  participantName?: string;
  participantFirstName?: string;
  clinicianInput: Record<string, any>;
  onApprove: (approvedText: string) => void;
  reportData?: Record<string, any>;
}

export default function ReportSectionGenerator({
  sectionId,
  sectionName,
  clientName,
  participantName,
  participantFirstName,
  clinicianInput,
  onApprove,
  reportData,
}: ReportSectionGeneratorProps) {
  const [editableText, setEditableText] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [nameWarnings, setNameWarnings] = useState<string[]>([]);
  const [corrections, setCorrections] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "generating" | "checking" | "ready" | "approved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerate = async () => {
    setStatus("generating");
    setErrorMsg("");
    setFlags([]);
    setCorrections([]);

    try {
      const inputWithContext = { ...clinicianInput };
      if (reportData && (sectionId.startsWith("interpretation_") || sectionId === "recommendations" || sectionId === "impact_summary")) {
        inputWithContext.report_context = assembleReportContext(reportData);
      }

      const prose = await generateSection(sectionId, clientName, inputWithContext);

      setStatus("checking");
      const rubricResult = await qualityCheck(
        sectionName,
        prose,
        JSON.stringify(clinicianInput)
      );

      setEditableText(rubricResult.auto_corrected_text || prose);
      setFlags(rubricResult.flags_for_clinician || []);
      setCorrections(rubricResult.corrections_made || []);
      setStatus("ready");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Check your backend function and try again.");
      setStatus("error");
    }
  };

  const handleApprove = () => {
    onApprove(editableText);
    setStatus("approved");
    setIsEditing(false);
  };

  const handleRegenerate = () => {
    setEditableText("");
    setFlags([]);
    setCorrections([]);
    setStatus("generating");
    setTimeout(handleGenerate, 100);
  };

  const statusLabel: Record<string, string> = {
    idle: "Ready to generate",
    generating: "Generating...",
    checking: "Quality checking...",
    ready: "Review and approve",
    approved: "Approved",
    error: "Error",
  };

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden mt-4 mb-4 border",
        status === "approved" ? "border-green-600 border-2" : "border-border"
      )}
    >
      {/* Header bar */}
      <div
        className={cn(
          "px-4 py-2.5 border-b border-border flex justify-between items-center",
          status === "approved" ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              status === "approved" && "bg-green-600",
              status === "ready" && "bg-primary",
              status === "error" && "bg-destructive",
              !["approved", "ready", "error"].includes(status) && "bg-muted-foreground/40"
            )}
          />
          <span className="text-[13px] font-semibold text-foreground">AI Report Writer</span>
          <span className="text-xs text-muted-foreground">{sectionName}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{statusLabel[status]}</span>
      </div>

      <div className="p-3 px-4">
        {/* Idle — generate button */}
        {status === "idle" && (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Click below to transform your observations into formal NDIS clinical prose.
            </p>
            <Button onClick={handleGenerate} size="sm" className="font-bold">
              Generate Clinical Prose
            </Button>
          </div>
        )}

        {/* Loading */}
        {(status === "generating" || status === "checking") && (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">
              {status === "generating"
                ? "Generating clinical prose from your observations..."
                : "Running quality rubric check..."}
            </p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold text-[13px]">Generation failed</p>
              <p className="text-xs mt-1">{errorMsg}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("idle")}
                className="mt-2 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Corrections banner */}
        {status === "ready" && corrections.length > 0 && (
          <div className="p-2 px-3 bg-primary/10 rounded-md mb-2.5 text-xs text-primary flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span><strong>Auto-corrections applied:</strong> {corrections.join("; ")}</span>
          </div>
        )}

        {/* Flags banner */}
        {status === "ready" && flags.length > 0 && (
          <div className="p-2 px-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-md mb-2.5 text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Flags for review:</strong>
            {flags.map((flag, i) => (
              <div key={i} className="mt-1">{flag}</div>
            ))}
          </div>
        )}

        {/* Generated text */}
        {(status === "ready" || status === "approved") && (
          <div>
            {isEditing ? (
              <Textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="min-h-[200px] text-[13px] leading-relaxed resize-y border-primary"
              />
            ) : (
              <div className="p-3 bg-card rounded-md border border-border text-[13px] leading-[1.7] text-foreground whitespace-pre-wrap">
                {editableText}
              </div>
            )}

            {/* Action buttons */}
            {status === "ready" && (
              <div className="flex gap-2 mt-2.5 flex-wrap">
                <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} className="text-xs text-primary border-primary">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {isEditing ? "Done Editing" : "Edit"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleRegenerate} className="text-xs">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Regenerate
                </Button>
              </div>
            )}

            {status === "approved" && (
              <div className="flex gap-2 mt-2.5 items-center">
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approved and saved
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setStatus("ready"); setIsEditing(false); }}
                  className="text-[11px] h-7"
                >
                  Edit Again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
