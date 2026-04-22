import { supabase } from "@/integrations/supabase/client";

/**
 * Log a report-level activity row. Fire-and-forget — failures are logged
 * to the console but never block the calling user action.
 *
 * Common actions: "created", "edited_section", "regenerated_section",
 * "generated_full_report", "added_collaborator", "removed_collaborator",
 * "changed_role".
 */
export async function logActivity(
  reportId: string,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!reportId || !userId || !action) return;
  try {
    const { error } = await supabase
      .from("report_activity" as any)
      .insert({ report_id: reportId, user_id: userId, action, metadata });
    if (error) console.warn("[reportActivity] insert failed:", error.message);
  } catch (err) {
    console.warn("[reportActivity] insert threw:", err);
  }
}