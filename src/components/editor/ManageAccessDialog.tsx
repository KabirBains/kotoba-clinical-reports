import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logActivity } from "@/lib/reportActivity";

type CollabRole = "owner" | "editor" | "viewer";

interface CollaboratorRow {
  id: string;
  user_id: string;
  role: CollabRole;
  added_at: string;
  email: string | null;
}

interface ManageAccessDialogProps {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageAccessDialog({ reportId, open, onOpenChange }: ManageAccessDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const { data: collaborators, isLoading } = useQuery({
    queryKey: ["collaborators", reportId],
    enabled: open && !!reportId,
    queryFn: async (): Promise<CollaboratorRow[]> => {
      const [rowsRes, emailsRes] = await Promise.all([
        supabase
          .from("report_collaborators" as any)
          .select("id, user_id, role, added_at")
          .eq("report_id", reportId)
          .order("added_at", { ascending: true }),
        supabase.rpc("get_collaborator_emails" as any, { _report: reportId }),
      ]);
      if (rowsRes.error) throw rowsRes.error;
      const emailMap = new Map<string, string>();
      const emailRows = (emailsRes.data as Array<{ user_id: string; email: string }> | null) ?? [];
      emailRows.forEach((r) => emailMap.set(r.user_id, r.email));
      return ((rowsRes.data as any[]) ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as CollabRole,
        added_at: r.added_at,
        email: emailMap.get(r.user_id) ?? null,
      }));
    },
  });

  const addCollaborator = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      if (!trimmed) throw new Error("Enter an email address");
      const { data: foundId, error: lookupErr } = await supabase.rpc(
        "find_user_id_by_email" as any,
        { _email: trimmed },
      );
      if (lookupErr) throw lookupErr;
      if (!foundId) {
        throw new Error("No Kotoba account found for that email. Ask your colleague to sign up first.");
      }
      if (collaborators?.some((c) => c.user_id === foundId)) {
        throw new Error("That user is already a collaborator on this report.");
      }
      const { error: insertErr } = await supabase.from("report_collaborators" as any).insert({
        report_id: reportId,
        user_id: foundId,
        role,
        added_by: user!.id,
      });
      if (insertErr) throw insertErr;
      await logActivity(reportId, user!.id, "added_collaborator", {
        invitee_email: trimmed,
        role,
      });
    },
    onSuccess: () => {
      toast.success("Collaborator added");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["collaborators", reportId] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to add collaborator"),
  });

  const updateRole = useMutation({
    mutationFn: async ({ collabId, userId, newRole }: { collabId: string; userId: string; newRole: CollabRole }) => {
      const { error } = await supabase
        .from("report_collaborators" as any)
        .update({ role: newRole })
        .eq("id", collabId);
      if (error) throw error;
      await logActivity(reportId, user!.id, "changed_role", { target_user_id: userId, new_role: newRole });
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["collaborators", reportId] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update role"),
  });

  const removeCollaborator = useMutation({
    mutationFn: async ({ collabId, userId }: { collabId: string; userId: string }) => {
      const { error } = await supabase
        .from("report_collaborators" as any)
        .delete()
        .eq("id", collabId);
      if (error) throw error;
      await logActivity(reportId, user!.id, "removed_collaborator", { target_user_id: userId });
    },
    onSuccess: () => {
      toast.success("Collaborator removed");
      queryClient.invalidateQueries({ queryKey: ["collaborators", reportId] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to remove collaborator"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Share this report with other Kotoba users. They must already have a Kotoba account.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            addCollaborator.mutate();
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="collab-email">Colleague email</Label>
            <Input
              id="collab-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 sm:w-40">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={addCollaborator.isPending}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            {addCollaborator.isPending ? "Adding…" : "Add"}
          </Button>
        </form>

        <div className="mt-2 border border-border/50 rounded-md divide-y divide-border/50">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : !collaborators || collaborators.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No collaborators yet.</div>
          ) : (
            collaborators.map((c) => {
              const isSelf = c.user_id === user?.id;
              const isOwner = c.role === "owner";
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {c.email ?? "Unknown user"}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {format(new Date(c.added_at), "d MMM yyyy")}
                    </p>
                  </div>
                  {isOwner ? (
                    <Badge variant="outline" className="capitalize">{c.role}</Badge>
                  ) : (
                    <>
                      <Select
                        value={c.role}
                        onValueChange={(v) =>
                          updateRole.mutate({ collabId: c.id, userId: c.user_id, newRole: v as CollabRole })
                        }
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCollaborator.mutate({ collabId: c.id, userId: c.user_id })}
                        disabled={removeCollaborator.isPending}
                        title="Remove collaborator"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}