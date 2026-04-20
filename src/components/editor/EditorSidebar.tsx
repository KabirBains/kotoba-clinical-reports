import { useState, useEffect, useCallback } from "react";
import { TEMPLATE_SECTIONS } from "@/lib/constants";
import { type AssessmentInstance } from "@/lib/assessment-library";
import { type RecommendationInstance } from "@/lib/recommendations-library";
import { CheckCircle2, ChevronDown, ChevronRight, Menu, X, ChevronLeft, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const SIDEBAR_LABELS: Record<string, string> = {
  "mobility": "Mobility & Upper Limb Function",
  "personal-adls": "Personal ADLs — Self-Care",
};

interface EditorSidebarProps {
  notes: Record<string, string>;
  assessments: AssessmentInstance[];
  recommendations: RecommendationInstance[];
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  onWidthChange?: (px: number) => void;
}

function getSidebarTitle(id: string, title: string) {
  return SIDEBAR_LABELS[id] ?? title;
}

function hasSectionContent(sectionId: string, notes: Record<string, string>): boolean {
  if (typeof notes[sectionId] === 'string' && notes[sectionId].trim()) return true;
  return Object.keys(notes).some(
    (k) => k.startsWith(`${sectionId}__`) && typeof notes[k] === 'string' && notes[k].trim()
  );
}

export function EditorSidebar({ notes, assessments, recommendations, scrollContainerRef }: EditorSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!isMobile);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [fcExpanded, setFcExpanded] = useState(true);
  const [assessmentsExpanded, setAssessmentsExpanded] = useState(true);
  const [recsExpanded, setRecsExpanded] = useState(true);

  const updateActiveSection = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const allIds: string[] = [];
    TEMPLATE_SECTIONS.forEach((s) => {
      if (s.id !== "functional-capacity") allIds.push(s.id);
      if ("subsections" in s && s.subsections) {
        s.subsections.forEach((sub) => allIds.push(sub.id));
      }
    });
    // Add assessment card IDs
    assessments.forEach((a) => allIds.push(`assessment-${a.id}`));
    // Add recommendation card IDs
    recommendations.forEach((r) => allIds.push(`recommendation-${r.id}`));

    let closest = "";
    let closestDist = Infinity;

    for (const id of allIds) {
      const el = container.querySelector(`[data-section-id="${id}"]`);
      if (!el) continue;
      const rect = (el as HTMLElement).getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const dist = Math.abs(rect.top - containerRect.top - 60);
      if (rect.top <= containerRect.top + 120 && dist < closestDist) {
        closestDist = dist;
        closest = id;
      }
    }
    if (closest && closest !== activeSectionId) {
      setActiveSectionId(closest);
    }
  }, [scrollContainerRef, activeSectionId, assessments, recommendations]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = () => updateActiveSection();
    container.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => container.removeEventListener("scroll", handler);
  }, [scrollContainerRef, updateActiveSection]);

  const scrollTo = (sectionId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-section-id="${sectionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (isMobile) setOpen(false);
  };

  const fcSection = TEMPLATE_SECTIONS.find((s) => s.id === "functional-capacity");
  const fcSubIds: string[] = fcSection && "subsections" in fcSection ? (fcSection.subsections?.map((s) => s.id) ?? []) : [];
  const isFcSubActive = fcSubIds.includes(activeSectionId);
  const isAssessmentSubActive = activeSectionId.startsWith("assessment-");
  const isRecommendationSubActive = activeSectionId.startsWith("recommendation-");
  if (isMobile && !open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-2 top-16 z-20 bg-card border border-border/50 shadow-sm"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <aside
      className={cn(
        "bg-card border-r border-border/50 flex flex-col shrink-0",
        isMobile
          ? "fixed left-0 top-14 bottom-0 z-20 w-64 shadow-lg"
          : "w-64 sticky top-14 h-[calc(100vh-3.5rem)] self-start"
      )}
    >
      {isMobile && (
        <div className="flex justify-end p-2 border-b border-border/30">
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-2 px-1">
          {TEMPLATE_SECTIONS.map((section) => {
            const isFc = section.id === "functional-capacity";
            const isAssessments = section.id === "assessments";
            const isRecs = section.id === "recommendations";
            const isActive = activeSectionId === section.id;
            const hasContent = isFc
              ? fcSubIds.some((id) => hasSectionContent(id, notes))
              : isAssessments
              ? assessments.length > 0
              : isRecs
              ? recommendations.length > 0
              : hasSectionContent(section.id, notes);

            return (
              <div key={section.id}>
                <button
                  onClick={() => {
                    if (isFc) {
                      setFcExpanded(!fcExpanded);
                      if (!fcExpanded && fcSubIds[0]) scrollTo(fcSubIds[0]);
                    } else if (isAssessments) {
                      if (assessments.length > 0) {
                        setAssessmentsExpanded(!assessmentsExpanded);
                      }
                      scrollTo(section.id);
                    } else if (isRecs) {
                      if (recommendations.length > 0) {
                        setRecsExpanded(!recsExpanded);
                      }
                      scrollTo(section.id);
                    } else {
                      scrollTo(section.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs rounded-md transition-colors group",
                    isActive || (isFc && isFcSubActive) || (isAssessments && isAssessmentSubActive) || (isRecs && isRecommendationSubActive)
                      ? "bg-accent/10 text-accent border-l-2 border-accent"
                      : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                  )}
                >
                  <span className="font-mono w-5 shrink-0 text-[10px] opacity-60">
                    {section.number}
                  </span>
                  <span className="flex-1 leading-tight break-words text-left">
                    {getSidebarTitle(section.id, section.title)}
                  </span>
                  {hasContent && !isFc && !isAssessments && !isRecs && (
                    <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                  )}
                  {isAssessments && assessments.length > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {assessments.length}
                    </span>
                  )}
                  {isRecs && recommendations.length > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {recommendations.length}
                    </span>
                  )}
                  {(isFc || (isAssessments && assessments.length > 0) || (isRecs && recommendations.length > 0)) && (
                    (isFc ? fcExpanded : isAssessments ? assessmentsExpanded : recsExpanded)
                      ? <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                      : <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                  )}
                </button>

                {/* FC Subsections */}
                {isFc && fcExpanded && "subsections" in section && section.subsections?.map((sub) => {
                  const subActive = activeSectionId === sub.id;
                  const subHasContent = hasSectionContent(sub.id, notes);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => scrollTo(sub.id)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-8 pr-3 py-1 text-left text-[11px] rounded-md transition-colors",
                        subActive
                          ? "bg-accent/10 text-accent border-l-2 border-accent"
                          : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                      )}
                    >
                      <span className="font-mono w-6 shrink-0 text-[10px] opacity-50">
                        {sub.number}
                      </span>
                      <span className="flex-1 leading-tight break-words text-left">
                        {getSidebarTitle(sub.id, sub.title)}
                      </span>
                      {subHasContent && (
                        <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                      )}
                    </button>
                  );
                })}

                {/* Assessment subsections (dynamic) */}
                {isAssessments && assessmentsExpanded && assessments.map((a, i) => {
                  const subActive = activeSectionId === `assessment-${a.id}`;
                  return (
                    <button
                      key={a.id}
                      onClick={() => scrollTo(`assessment-${a.id}`)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-8 pr-3 py-1 text-left text-[11px] rounded-md transition-colors",
                        subActive
                          ? "bg-accent/10 text-accent border-l-2 border-accent"
                          : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                      )}
                    >
                      <span className="font-mono w-6 shrink-0 text-[10px] opacity-50">
                        15.{i + 1}
                      </span>
                      <span className="flex-1 leading-tight break-words text-left">
                        {a.name}
                      </span>
                    </button>
                  );
                })}

                {/* Recommendation subsections (dynamic) */}
                {isRecs && recsExpanded && recommendations.map((r, i) => {
                  const subActive = activeSectionId === `recommendation-${r.id}`;
                  return (
                    <button
                      key={r.id}
                      onClick={() => scrollTo(`recommendation-${r.id}`)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-8 pr-3 py-1 text-left text-[11px] rounded-md transition-colors",
                        subActive
                          ? "bg-accent/10 text-accent border-l-2 border-accent"
                          : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                      )}
                    >
                      <span className="font-mono w-6 shrink-0 text-[10px] opacity-50">
                        18.{i + 1}
                      </span>
                      <span className="flex-1 leading-tight break-words text-left">
                        {r.supportName}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
