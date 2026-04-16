// ============================================================
// CLINICAL SPINE PANEL — Stage 1.5 approval checkpoint
// ============================================================
// Read-only display of the generated Clinical Spine plus the
// approval gate that controls whether full-report generation
// is allowed to proceed.
//
// This is the MINIMAL UI per the approved plan — no inline
// editing, no coverage metrics. The full editor + coverage
// metric land in Stage 5.
// ============================================================
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, AlertTriangle, RefreshCw, Sparkles, ChevronDown } from "lucide-react";
import type { SpineCache, ClinicalSpine } from "@/ai/spineCache";

interface ClinicalSpinePanelProps {
  cache: SpineCache | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
  panelRef?: React.RefObject<HTMLDivElement>;
}

function SpineBody({ spine }: { spine: ClinicalSpine }) {
  return (
    <div className="space-y-5 text-sm">
      <section>
        <h4 className="font-semibold text-foreground mb-2">Anchor Impairments</h4>
        {spine.anchor_impairments?.length ? (
          <ul className="space-y-2">
            {spine.anchor_impairments.map((a) => (
              <li key={a.id} className="rounded-md border border-border/60 bg-card px-3 py-2">
                <div className="font-medium text-foreground">{a.label}</div>
                <div className="text-muted-foreground mt-1">{a.evidence}</div>
                {a.expected_domains?.length ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {a.expected_domains.map((d) => (
                      <Badge key={d} variant="secondary" className="text-[10px] font-normal">
                        {d}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground italic">None identified.</p>
        )}
      </section>

      <section>
        <h4 className="font-semibold text-foreground mb-2">Recurring Functional Consequences</h4>
        {spine.recurring_consequences?.length ? (
          <ul className="space-y-1">
            {spine.recurring_consequences.map((c) => (
              <li key={c.id} className="rounded-md border border-border/60 bg-card px-3 py-2">
                <div className="text-foreground">{c.label}</div>
                {c.linked_anchors?.length ? (
                  <div className="text-xs text-muted-foreground mt-1">
                    Linked: {c.linked_anchors.join(", ")}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground italic">None identified.</p>
        )}
      </section>

      <section>
        <h4 className="font-semibold text-foreground mb-2">Cross-Domain Links</h4>
        {spine.cross_domain_links?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border/60">
                  <th className="py-1 pr-3 font-medium">Anchor</th>
                  <th className="py-1 font-medium">Appears in domains</th>
                </tr>
              </thead>
              <tbody>
                {spine.cross_domain_links.map((link, i) => (
                  <tr key={`${link.anchor_id}-${i}`} className="border-b border-border/30 last:border-b-0">
                    <td className="py-1 pr-3 font-mono text-xs text-foreground align-top">{link.anchor_id}</td>
                    <td className="py-1 text-foreground">
                      <div className="flex flex-wrap gap-1">
                        {link.domains?.map((d) => (
                          <Badge key={d} variant="outline" className="text-[10px] font-normal">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground italic">None identified.</p>
        )}
      </section>

      <section>
        <h4 className="font-semibold text-foreground mb-2">Diagnosis → Function Chains</h4>
        {spine.diagnosis_function_chains?.length ? (
          <ul className="space-y-2">
            {spine.diagnosis_function_chains.map((d, i) => (
              <li key={`${d.diagnosis}-${i}`} className="rounded-md border border-border/60 bg-card px-3 py-2">
                <div className="font-medium text-foreground">{d.diagnosis}</div>
                <div className="text-muted-foreground mt-1">{d.chain}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground italic">No diagnoses supplied.</p>
        )}
      </section>
    </div>
  );
}

export function ClinicalSpinePanel({
  cache,
  isGenerating,
  onGenerate,
  onApprove,
  onRegenerate,
  panelRef,
}: ClinicalSpinePanelProps) {
  const [expanded, setExpanded] = useState(false);

  // ── State 1: no spine yet ──
  if (!cache) {
    return (
      <Card ref={panelRef} className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Clinical Spine</CardTitle>
            </div>
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating…" : "Generate Clinical Spine"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground pt-0">
          Generate the Clinical Spine to map this participant's anchor impairments and cross-domain links.
          Approval is required before generating the full report.
        </CardContent>
      </Card>
    );
  }

  const { spine, status, approved_at } = cache;
  const isApproved = status === "approved";
  const isStale = status === "stale";

  // ── State 4: approved (collapsed) ──
  if (isApproved) {
    return (
      <Card ref={panelRef}>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Clinical Spine</CardTitle>
                <Badge variant="secondary" className="ml-1">
                  Approved{approved_at ? ` · ${format(new Date(approved_at), "d MMM, h:mm a")}` : ""}
                </Badge>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={isGenerating}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {isGenerating ? "Regenerating…" : "Regenerate"}
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <SpineBody spine={spine} />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // ── State 2/3: draft or stale ──
  return (
    <Card ref={panelRef} className={isStale ? "border-destructive/60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Clinical Spine</CardTitle>
            <Badge variant={isStale ? "destructive" : "outline"}>
              {isStale ? "Stale — re-approval required" : "Draft — awaiting approval"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isGenerating}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {isGenerating ? "Regenerating…" : "Regenerate"}
            </Button>
            <Button size="sm" onClick={onApprove} disabled={isGenerating}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Approve and proceed
            </Button>
          </div>
        </div>
        {isStale ? (
          <div className="flex items-start gap-2 mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Upstream clinical data has changed (diagnoses, assessments, or functional notes).
              Review the Spine and re-approve before generating the full report.
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <SpineBody spine={spine} />
      </CardContent>
    </Card>
  );
}
