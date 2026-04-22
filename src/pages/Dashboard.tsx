import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { KotobaLogo } from "@/components/KotobaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    client_name: "",
    ndis_number: "",
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accessible_clients" as any);
      if (error) throw error;
      const rows = (data as Array<{
        id: string;
        client_name: string;
        ndis_number: string | null;
        status: string;
        updated_at: string;
        owner_user_id: string;
        is_shared: boolean;
      }> | null) ?? [];
      // RPC sorts by id; re-sort by updated_at desc for the UI
      return [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    },
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...newClient, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Create initial report for client
      const { error: reportError } = await supabase
        .from("reports")
        .insert({ client_id: data.id, user_id: user!.id, notes: {} });
      if (reportError) throw reportError;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setNewClientOpen(false);
      setNewClient({ client_name: "", ndis_number: "" });
      toast.success("Client created");
      navigate(`/client/${data.id}`);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const filteredClients = clients?.filter(
    (c) =>
      c.client_name.toLowerCase().includes(search.toLowerCase()) ||
      c.ndis_number?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case "Report generated": return "bg-accent/10 text-accent border-accent/20";
      case "Finalised": return "bg-success/10 text-success border-success/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <KotobaLogo size="sm" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Client Files</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {clients?.length ?? 0} client{(clients?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New client file</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createClient.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Client name or pseudonym *</Label>
                  <Input
                    value={newClient.client_name}
                    onChange={(e) => setNewClient({ ...newClient, client_name: e.target.value })}
                    placeholder="e.g. Jane D."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>NDIS number (optional)</Label>
                  <Input
                    value={newClient.ndis_number}
                    onChange={(e) => setNewClient({ ...newClient, ndis_number: e.target.value })}
                    placeholder="e.g. 431 234 567"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createClient.isPending}>
                  {createClient.isPending ? "Creating..." : "Create client"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Client list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse-subtle" />
            ))}
          </div>
        ) : filteredClients?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{search ? "No clients match your search" : "No clients yet. Create your first client file to get started."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients?.map((client) => (
              <Card
                key={client.id}
                className="cursor-pointer hover:border-accent/30 transition-colors border-border/50"
                onClick={() => navigate(`/client/${client.id}`)}
              >
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {client.client_name}
                      {(client as any).is_shared && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-accent/30 text-accent">
                          Shared
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {client.ndis_number && `NDIS: ${client.ndis_number} · `}
                      Updated {format(new Date(client.updated_at), "d MMM yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusColor(client.status)}>
                    {client.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
