import { useState } from "react";
import { 
  ASSESSMENT_LIBRARY, 
  type AssessmentDefinition, 
  type AssessmentInstance, 
  calculateTotal, 
  calculateSubscaleTotal, 
  getClassification 
} from "@/lib/assessment-library";
import { WHODASScoring } from "./WHODASScoring";
import { FRATScoring } from "./FRATScoring";
import { LawtonIADLScoring } from "./LawtonIADLScoring";
import { ZaritScoring } from "./ZaritScoring";
import { CANSScoring } from "./CANSScoring";
import { LSP16Scoring } from "./LSP16Scoring";
import { SensoryProfileScoring } from "./SensoryProfileScoring";
import { 
  ChevronDown, ChevronRight, Plus, Library, PenLine, 
  Trash2, GripVertical, Calendar, Sparkles, FileInput 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";

interface AssessmentsSectionProps {
  assessments: AssessmentInstance[];
  onUpdateAssessments: (assessments: AssessmentInstance[]) => void;
}

function AssessmentCard({
  instance,
  index,
  definition,
  onUpdate,
  onRemove,
}: {
  instance: AssessmentInstance;
  index: number;
  definition: AssessmentDefinition | null;
  onUpdate: (updated: AssessmentInstance) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const total = definition ? calculateTotal(definition, instance.scores) : 0;
  const classification = definition ? getClassification(definition, total) : "";

  const updateScore = (itemId: string, value: string) => {
    onUpdate({ ...instance, scores: { ...instance.scores, [itemId]: value } });
  };

  const updateCustomItem = (itemId: string, value: string) => {
    const items = (instance.customItems || []).map(i =>
      i.id === itemId ? { ...i, value } : i
    );
    onUpdate({ ...instance, customItems: items });
  };

  return (
    <div
      data-section-id={`assessment-${instance.id}`}
      className="border border-border/50 rounded-lg bg-card overflow-hidden"
    >
      {/* Card header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 cursor-grab" />
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">
          15.{index + 1}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">{instance.name}</span>
        {definition && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
            {total} — {classification}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border/30">
          {/* Date administered */}
          <div className="flex items-center gap-3 pt-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <label className="text-xs font-medium text-muted-foreground">Date administered</label>
            <input
              type="date"
              value={instance.dateAdministered}
              onChange={(e) => onUpdate({ ...instance, dateAdministered: e.target.value })}
              className="h-8 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </div>

          {/* Synopsis */}
          {definition && (
            <div className="bg-muted/20 border border-border/30 rounded-md p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {definition.synopsis}
              </p>
            </div>
          )}

          {/* Scoring interface */}
          {definition && definition.id === "whodas-2.0" ? (
            <WHODASScoring
              scores={instance.scores}
              onUpdateScores={(newScores) => onUpdate({ ...instance, scores: newScores })}
            />
          ) : definition && definition.subscales.map((subscale) => {
            const subscaleTotal = calculateSubscaleTotal(definition, subscale.id, instance.scores);
            return (
              <div key={subscale.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground tracking-wide">
                    {subscale.label}
                  </h4>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Subtotal: {subscaleTotal}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {subscale.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="text-xs text-foreground/80 flex-1 min-w-0 truncate">
                        {item.label}
                      </span>
                      {item.options && (
                        <Select
                          value={instance.scores[item.id] || ""}
                          onValueChange={(val) => updateScore(item.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-48 bg-background border-border/60 shrink-0">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {item.options.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom assessment items */}
          {instance.isCustom && (
            <div className="space-y-2">
              {(instance.customItems || []).map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-xs text-foreground/80 flex-1">{item.label}</span>
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => updateCustomItem(item.id, e.target.value)}
                    placeholder="Enter score or result"
                    className="h-8 w-48 px-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Results table (non-WHODAS only — WHODAS has its own summary) */}
          {definition && definition.id !== "whodas-2.0" && definition.subscales.length > 0 && (
            <div className="border border-border/40 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Domain</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {definition.subscales.map((sub) => (
                    <tr key={sub.id} className="border-t border-border/30">
                      <td className="px-3 py-1.5 text-foreground/80">{sub.label}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {calculateSubscaleTotal(definition, sub.id, instance.scores)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/50 bg-muted/20 font-semibold">
                    <td className="px-3 py-2 text-foreground">Total</td>
                    <td className="px-3 py-2 text-right font-mono text-accent">{total}</td>
                  </tr>
                  <tr className="border-t border-border/30">
                    <td className="px-3 py-2 text-foreground">Classification</td>
                    <td className="px-3 py-2 text-right font-medium text-accent">{classification}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* AI interpretation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <h4 className="text-xs font-semibold text-foreground">AI Interpretation</h4>
            </div>
            <textarea
              value={instance.interpretation}
              onChange={(e) => onUpdate({ ...instance, interpretation: e.target.value })}
              placeholder="Click 'Generate interpretation' to create an AI-written summary of results, or type your own."
              className="w-full min-h-[80px] p-3 text-xs bg-muted/30 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => toast.info("AI interpretation will be available once the API is configured.")}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Generate interpretation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => toast.info("Insert into report will be available once Report mode is active.")}
              >
                <FileInput className="h-3 w-3 mr-1" />
                Insert into report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssessmentsSection({ assessments, onUpdateAssessments }: AssessmentsSectionProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customItemLabels, setCustomItemLabels] = useState("");

  const addFromLibrary = (def: AssessmentDefinition) => {
    const instance: AssessmentInstance = {
      id: crypto.randomUUID(),
      definitionId: def.id,
      name: def.name,
      dateAdministered: new Date().toISOString().split("T")[0],
      scores: {},
      interpretation: "",
    };
    onUpdateAssessments([...assessments, instance]);
    setLibraryOpen(false);
    toast.success(`${def.shortName} added`);
  };

  const addCustom = () => {
    if (!customName.trim()) return;
    const labels = customItemLabels.split("\n").filter(l => l.trim());
    const instance: AssessmentInstance = {
      id: crypto.randomUUID(),
      definitionId: "custom",
      name: customName.trim(),
      dateAdministered: new Date().toISOString().split("T")[0],
      scores: {},
      interpretation: "",
      isCustom: true,
      customItems: labels.map((l, i) => ({ id: `custom-${i}`, label: l.trim(), value: "" })),
    };
    onUpdateAssessments([...assessments, instance]);
    setCustomOpen(false);
    setCustomName("");
    setCustomItemLabels("");
    toast.success("Custom assessment added");
  };

  const updateAssessment = (index: number, updated: AssessmentInstance) => {
    const next = [...assessments];
    next[index] = updated;
    onUpdateAssessments(next);
  };

  const removeAssessment = (index: number) => {
    onUpdateAssessments(assessments.filter((_, i) => i !== index));
  };

  return (
    <div data-section-id="assessments" className="border-b border-border/30">
      {/* Section header */}
      <div className="w-full flex items-center gap-3 px-5 py-3 text-left">
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 ml-[1.75rem]">
          15
        </span>
        <span className="text-sm font-semibold text-foreground flex-1">
          Assessments
        </span>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-4 pl-[4.5rem] flex gap-2">
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setLibraryOpen(true)}>
          <Library className="h-3.5 w-3.5 mr-1.5" />
          Add assessment from library
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setCustomOpen(true)}>
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          Add custom assessment
        </Button>
      </div>

      {/* Assessment cards */}
      {assessments.length > 0 && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-3">
          {assessments.map((instance, index) => {
            const def = ASSESSMENT_LIBRARY.find(d => d.id === instance.definitionId) || null;
            return (
              <AssessmentCard
                key={instance.id}
                instance={instance}
                index={index}
                definition={def}
                onUpdate={(updated) => updateAssessment(index, updated)}
                onRemove={() => removeAssessment(index)}
              />
            );
          })}
        </div>
      )}

      {/* Library modal */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assessment Library</DialogTitle>
            <DialogDescription>
              Select a standardised assessment to add to this report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {ASSESSMENT_LIBRARY.map((def) => {
              const alreadyAdded = assessments.some(a => a.definitionId === def.id);
              return (
                <button
                  key={def.id}
                  onClick={() => !alreadyAdded && addFromLibrary(def)}
                  disabled={alreadyAdded}
                  className={cn(
                    "w-full text-left p-3 rounded-md border transition-colors",
                    alreadyAdded
                      ? "border-border/30 bg-muted/30 opacity-50 cursor-not-allowed"
                      : "border-border/50 hover:bg-muted/50 hover:border-accent/30 cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{def.name}</span>
                    {alreadyAdded && (
                      <span className="text-[10px] text-muted-foreground">Already added</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {def.synopsis}
                  </p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom assessment modal */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Assessment</DialogTitle>
            <DialogDescription>
              Enter the assessment name and scoring items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-foreground">Assessment name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Canadian Occupational Performance Measure"
                className="mt-1 w-full h-9 px-3 text-sm bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">
                Scoring items (one per line)
              </label>
              <textarea
                value={customItemLabels}
                onChange={(e) => setCustomItemLabels(e.target.value)}
                placeholder={"Performance score\nSatisfaction score\nPriority area 1\nPriority area 2"}
                className="mt-1 w-full min-h-[100px] p-3 text-sm bg-muted/30 border border-border/50 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
            <Button onClick={addCustom} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1.5" />
              Add assessment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
