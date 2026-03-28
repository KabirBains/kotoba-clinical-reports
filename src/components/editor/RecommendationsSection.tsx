import { useState, useMemo } from "react";
import {
  type RecommendationInstance,
  SUPPORT_LIBRARY,
} from "@/lib/recommendations-library";
import { RecommendationCard } from "./RecommendationCard";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface RecommendationsSectionProps {
  recommendations: RecommendationInstance[];
  onUpdateRecommendations: (recommendations: RecommendationInstance[]) => void;
}

export function RecommendationsSection({
  recommendations,
  onUpdateRecommendations,
}: RecommendationsSectionProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);

  const alreadyAdded = new Set(recommendations.map((r) => r.supportId));

  const addSupport = (
    supportId: string,
    supportName: string,
    categoryName: string,
    ndisCategory: "Core" | "Capacity Building" | "Capital",
    catColor: string,
    tasks: string[],
    outcomes: string[],
    consequence: string,
    sections: string[],
    isCapital?: boolean,
    isConsumable?: boolean
  ) => {
    const instance: RecommendationInstance = {
      id: crypto.randomUUID(),
      supportId,
      supportName,
      categoryName,
      ndisCategory,
      catColor,
      currentHours: "",
      recommendedHours: "",
      ratio: "",
      tasks: [...tasks],
      customTask: "",
      justification: "",
      outcomes: [...outcomes],
      consequence,
      linkedSections: [...sections],
      s34Justification: "",
      estimatedCost: "",
      isCapital,
      isConsumable,
    };
    onUpdateRecommendations([...recommendations, instance]);
    setLibraryOpen(false);
    toast.success(`${supportName} added`);
  };

  const updateRec = (index: number, updated: RecommendationInstance) => {
    const next = [...recommendations];
    next[index] = updated;
    onUpdateRecommendations(next);
  };

  const removeRec = (index: number) => {
    onUpdateRecommendations(recommendations.filter((_, i) => i !== index));
  };

  const summary = useMemo(() => {
    const core = recommendations.filter(
      (r) => r.ndisCategory === "Core" && !r.isConsumable && !r.isCapital
    ).length;
    const cb = recommendations.filter((r) => r.ndisCategory === "Capacity Building").length;
    const capital = recommendations.filter(
      (r) => r.ndisCategory === "Capital" || r.isCapital || r.isConsumable
    ).length;
    return { core, cb, capital, total: recommendations.length };
  }, [recommendations]);

  return (
    <div data-section-id="recommendations" className="border-b border-border/30">
      {/* Section header */}
      <div className="w-full flex items-center gap-3 px-5 py-3 text-left">
        <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 ml-[1.75rem]">
          18
        </span>
        <span className="text-sm font-semibold text-foreground flex-1">
          Recommendations
        </span>
      </div>

      {/* Summary bar */}
      {recommendations.length > 0 && (
        <div className="px-5 pb-2 pl-[4.5rem] flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <strong className="text-blue-600">{summary.core}</strong> Core
          </span>
          <span>
            <strong className="text-violet-600">{summary.cb}</strong> Capacity Building
          </span>
          <span>
            <strong className="text-red-600">{summary.capital}</strong> Capital
          </span>
          <span className="font-semibold text-foreground">{summary.total} total</span>
        </div>
      )}

      {/* Add button */}
      <div className="px-5 pb-4 pl-[4.5rem]">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setLibraryOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add support recommendation
        </Button>
      </div>

      {/* Recommendation cards */}
      {recommendations.length > 0 && (
        <div className="px-5 pb-5 pl-[4.5rem] space-y-3">
          {recommendations.map((rec, index) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              index={index}
              onUpdate={updateRec}
              onRemove={removeRec}
            />
          ))}
        </div>
      )}

      {/* Summary table */}
      {recommendations.length > 0 && (
        <div className="px-5 pb-5 pl-[4.5rem]">
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="bg-foreground px-4 py-3">
              <h3 className="text-sm font-bold text-background">Recommendations Summary</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Support</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-20">Category</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-24">Current</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-28">Recommended</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-14">Ratio</th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground w-20">Sections</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec, idx) => (
                  <tr
                    key={rec.id}
                    className={cn(
                      "border-t border-border/30",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-[3px] h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: rec.catColor }}
                        />
                        <span className="font-medium text-foreground">{rec.supportName}</span>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: rec.catColor + "15",
                          color: rec.catColor,
                        }}
                      >
                        {rec.ndisCategory}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[11px] text-muted-foreground">
                      {rec.currentHours || "nil"}
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[11px] font-semibold" style={{ color: rec.recommendedHours ? rec.catColor : undefined }}>
                      {rec.recommendedHours || "—"}
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[11px]">
                      {rec.ratio || "—"}
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-[10px] text-muted-foreground">
                      {rec.linkedSections.length > 0
                        ? rec.linkedSections.map((s) => "S." + s).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-muted/30 border-t border-border/50 flex gap-5 text-xs text-muted-foreground">
              <span><strong className="text-blue-600">Core:</strong> {summary.core} supports</span>
              <span><strong className="text-violet-600">Capacity Building:</strong> {summary.cb} supports</span>
              <span><strong className="text-red-600">Capital:</strong> {summary.capital} items</span>
            </div>
          </div>
        </div>
      )}

      {/* Library modal */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Support Library</DialogTitle>
            <DialogDescription>
              Select a support to add to your recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {Object.entries(SUPPORT_LIBRARY).map(([catName, cat]) => (
              <div key={catName}>
                <div
                  className="text-xs font-bold mb-1.5 pb-1 border-b-2"
                  style={{ color: cat.color, borderColor: cat.color + "30" }}
                >
                  {catName}
                </div>
                <div className="space-y-1">
                  {cat.items.map((item) => {
                    const added = alreadyAdded.has(item.id);
                    return (
                      <button
                        key={item.id}
                        disabled={added}
                        onClick={() =>
                          addSupport(
                            item.id,
                            item.name,
                            catName,
                            cat.category,
                            cat.color,
                            item.tasks,
                            item.outcomes,
                            item.consequence,
                            item.sections,
                            item.isCapital,
                            item.isConsumable
                          )
                        }
                        className={cn(
                          "w-full text-left p-2.5 rounded-md border transition-colors",
                          added
                            ? "border-border/30 bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border/50 hover:bg-muted/50 hover:border-accent/30 cursor-pointer"
                        )}
                      >
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                        {added && (
                          <span className="text-[10px] text-muted-foreground ml-2">(already added)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
