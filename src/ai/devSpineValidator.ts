// ============================================================
// DEV-ONLY SPINE VALIDATOR
// ============================================================
// Not wired to any UI. Exposed on window for manual testing
// from the browser console:
//
//   await window.__kotobaRunSpineOnReport("<reportId>")
//
// Loads a completed report from the Loveable DB, derives the
// spine inputs, calls build-clinical-spine on Kotoba, and logs
// the resulting Spine alongside the existing report content so
// you can eyeball whether the Spine actually maps to the
// downstream sections it should be threading.
// ============================================================
import { supabase } from "@/integrations/supabase/client";
import { buildClinicalSpine } from "@/ai/reportEngine";

export async function runSpineOnExistingReport(reportId: string): Promise<void> {
  if (!reportId) {
    console.warn("[spine-validator] reportId required");
    return;
  }

  const { data: report, error } = await supabase
    .from("reports")
    .select("id, notes, report_content, client_id")
    .eq("id", reportId)
    .single();

  if (error || !report) {
    console.error("[spine-validator] failed to load report", error);
    return;
  }

  const { data: client } = await supabase
    .from("clients")
    .select("client_name, primary_diagnosis")
    .eq("id", report.client_id)
    .single();

  const notes = (report.notes as Record<string, any>) || {};
  const reportContent = (report.report_content as Record<string, string>) || {};

  const fullName = notes["__participant__fullName"] || client?.client_name || "the participant";
  const firstName = String(fullName).split(/\s+/)[0] || String(fullName);
  const pronouns = String(notes["__participant__pronouns"] || "they/them");

  console.group(`[spine-validator] ${client?.client_name || reportId}`);
  console.log("Inputs:", { firstName, pronouns });

  try {
    const spine = await buildClinicalSpine({
      diagnoses: notes["__diagnoses__"] ?? client?.primary_diagnosis ?? "",
      collateral_summary: "[validator: collateral pulled separately]",
      clinician_notes: JSON.stringify(notes, null, 2).slice(0, 8000),
      assessment_summary: JSON.stringify(notes["__assessments__"] ?? [], null, 2),
      participant_first_name: firstName,
      participant_pronouns: pronouns,
    });

    console.log("Generated Spine:", spine);
    console.log("Existing report sections:", Object.keys(reportContent));
    console.log("Sample section text (first key):", reportContent[Object.keys(reportContent)[0]]?.slice(0, 500));
  } catch (e) {
    console.error("[spine-validator] generation failed", e);
  } finally {
    console.groupEnd();
  }
}

// Attach to window in dev for console access.
if (typeof window !== "undefined") {
  (window as any).__kotobaRunSpineOnReport = runSpineOnExistingReport;
}
