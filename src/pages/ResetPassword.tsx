import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KotobaLogo } from "@/components/KotobaLogo";
import { toast } from "sonner";

/**
 * Password reset landing page.
 *
 * Flow:
 *   1. User clicks the link in their reset email → Supabase parses the
 *      recovery token in the URL hash and fires onAuthStateChange with
 *      event === "PASSWORD_RECOVERY". At that point a temporary session
 *      is established that allows ONLY a password update.
 *   2. We render a form to capture the new password and call
 *      supabase.auth.updateUser({ password }).
 *   3. On success we sign the user out (so they re-enter with the new
 *      password) and bounce back to /auth.
 *
 * This route MUST be public (no auth guard) — when the user lands here
 * from the email link they technically already have a session, but if we
 * routed them through /dashboard they would never see the password form
 * and would just be auto-logged in without resetting anything. That was
 * the documented failure mode in the auth knowledge guide.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Detect the recovery handshake. Supabase fires PASSWORD_RECOVERY
    // exactly once after parsing the hash fragment from the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true);
      },
    );

    // Fallback: if the user already has a session when they land here
    // (e.g. they refreshed the page after the recovery event fired) we
    // still allow them to set a new password rather than redirecting away.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Please sign in with your new password.");
      // Sign out the temporary recovery session so the user has to
      // re-authenticate with the new credentials — clean state.
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <KotobaLogo size="lg" className="justify-center" />
          <p className="text-muted-foreground text-sm">Reset your password</p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <h1 className="text-base font-medium">Choose a new password</h1>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-sm text-muted-foreground">
                Verifying reset link…
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}