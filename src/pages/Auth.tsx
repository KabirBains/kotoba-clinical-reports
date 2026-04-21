import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KotobaLogo } from "@/components/KotobaLogo";
import { toast } from "sonner";

// User-facing message when an email is not on the whitelist.
// Kept consistent across signup-blocked and login-blocked paths so users
// get the same clear instruction regardless of which door they tried.
const WHITELIST_ERROR_MESSAGE =
  "This email address is not authorised for Kotoba access. Please contact the administrator to request access.";

/**
 * Check whether an email is on the app's access whitelist.
 *
 * Uses the is_email_whitelisted RPC (SECURITY DEFINER) which bypasses RLS
 * and can be called from the anonymous role before auth. Returns false on
 * any error (including network) to fail-closed — if we can't verify the
 * user is allowed, we don't let them in. The caller is expected to surface
 * a generic-but-clear message to the user.
 */
async function isEmailWhitelisted(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_email_whitelisted", {
      check_email: email.trim(),
    });
    if (error) {
      console.error("[auth] whitelist RPC error:", error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error("[auth] whitelist check threw:", err);
    return false;
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // ── LOGIN FLOW ─────────────────────────────────────────────────
        // 1. Sign in normally.
        // 2. After sign-in succeeds, verify the email is still whitelisted.
        //    This handles the offboarding case — if someone's access is
        //    revoked while their account still exists, the next sign-in
        //    gets them signed straight back out with a clear message.
        // Checking POST sign-in (rather than pre-sign-in) means we don't
        // leak whitelist membership to unauthenticated callers via the
        // login-vs-notfound-vs-wrongpassword error behaviour.
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const allowed = await isEmailWhitelisted(email);
        if (!allowed) {
          await supabase.auth.signOut();
          toast.error(WHITELIST_ERROR_MESSAGE);
          return;
        }

        navigate("/dashboard");
      } else {
        // ── SIGNUP FLOW ────────────────────────────────────────────────
        // 1. Pre-check the whitelist so we can give a clean error without
        //    the user burning through email-verification retries.
        // 2. Call supabase.auth.signUp — if the client check is somehow
        //    bypassed (e.g. stale JS, direct REST call), the database
        //    trigger also blocks signup at the auth layer. The trigger's
        //    error message matches WHITELIST_ERROR_MESSAGE, so either
        //    path surfaces the same UX.
        const allowed = await isEmailWhitelisted(email);
        if (!allowed) {
          toast.error(WHITELIST_ERROR_MESSAGE);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          // The database trigger raises a specific error message that we
          // surface cleanly. Supabase wraps it — we detect the substring
          // to show the friendly whitelist message instead of a raw
          // Postgres error.
          const msg = error.message || "";
          if (/not authorised for Kotoba access/i.test(msg) || /is not whitelisted/i.test(msg)) {
            toast.error(WHITELIST_ERROR_MESSAGE);
            return;
          }
          throw error;
        }
        toast.success("Account created. Please check your email to verify.");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <KotobaLogo size="lg" className="justify-center" />
          <p className="text-muted-foreground text-sm">
            Clinical report writing for NDIS clinicians
          </p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex gap-2">
              <Button
                variant={isLogin ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsLogin(true)}
                className="flex-1"
              >
                Sign in
              </Button>
              <Button
                variant={!isLogin ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsLogin(false)}
                className="flex-1"
              >
                Create account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="clinician@practice.com.au"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
              </Button>
            </form>
            {!isLogin && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Kotoba access is by invitation during beta. If your email
                isn't recognised, contact the administrator to request access.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
