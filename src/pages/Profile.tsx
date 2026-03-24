import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KotobaLogo } from "@/components/KotobaLogo";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    practice_name: "",
    clinician_name: "",
    qualifications: "",
    ahpra_number: "",
  });

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile({
              practice_name: data.practice_name ?? "",
              clinician_name: data.clinician_name ?? "",
              qualifications: data.qualifications ?? "",
              ahpra_number: data.ahpra_number ?? "",
            });
          }
        });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("user_id", user!.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <KotobaLogo size="sm" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Clinician Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Practice name</Label>
                <Input
                  value={profile.practice_name}
                  onChange={(e) => setProfile({ ...profile, practice_name: e.target.value })}
                  placeholder="e.g. Allied Health Solutions"
                />
              </div>
              <div className="space-y-2">
                <Label>Clinician name</Label>
                <Input
                  value={profile.clinician_name}
                  onChange={(e) => setProfile({ ...profile, clinician_name: e.target.value })}
                  placeholder="e.g. Dr. Sarah Chen"
                />
              </div>
              <div className="space-y-2">
                <Label>Qualifications</Label>
                <Input
                  value={profile.qualifications}
                  onChange={(e) => setProfile({ ...profile, qualifications: e.target.value })}
                  placeholder="e.g. BOccThy, MOccThy"
                />
              </div>
              <div className="space-y-2">
                <Label>AHPRA number</Label>
                <Input
                  value={profile.ahpra_number}
                  onChange={(e) => setProfile({ ...profile, ahpra_number: e.target.value })}
                  placeholder="e.g. OCC0001234567"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
