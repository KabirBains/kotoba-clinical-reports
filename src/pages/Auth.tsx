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
// Matches the P0001 exception thrown by public.enforce_whitelist_on_signup()
// in the email-whitelist migration; the Supabase auth error wraps that
// message and we surface it to the user verbatim here.
const WHITELIST_ERROR_MESSAGE =
  "This email address is not authorised for Kotoba access. Please contact the administrator to request access.";

/**
 * AUTH ACCESS CONTROL — whitelist enforcement model.
 *
 * Enforcement happens at ONE authoritative layer: the database trigger
 * (public.enforce_whitelist_on_signup) that fires BEFORE INSERT on
 * auth.users. No unwhitelisted account can ever be created.
 *
 * We deliberately do NOT do client-side RPC pre-checks because:
 *   - They added no security (trigger is the hard gate)
 *   - They introduced a fragile dependency on the Supabase-js client's
 *     interpretation of scalar RPC responses. See the Apr 21 2026 bug
 *     where a whitelisted user was signed out immediately after login
 *     because the rpc() call's `data` value was interpreted as not-true
 *     despite the HTTP response body being the literal boolean `true`.
 *
 * For sign-in, no check is needed: a user cannot have a Supabase auth
 * record unless they passed the signup trigger, so a successful sign-in
 * implies they were whitelisted.
 *
 * For sign-up, we rely on signUp's error path — if the trigger blocks,
 * the auth response contains the whitelist error message and we match
 * on it below to show the friendly prompt.
 *
 * Offboarding (revoking a currently-valid session) is explicitly out of
 * scope for this iteration. If we need it later, the cleanest approach
 * is a server-side auth hook or a middleware check in ClientEditor —
 * both avoid the scalar-RPC-shape fragility.
 */

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
        // Sign in — the database trigger guaranteed that this user's email
        // was whitelisted at signup. No runtime whitelist check needed.
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        // Sign up — let the database trigger be the single source of truth.
        // If the email is not on the whitelist, the trigger raises a P0001
        // exception and Supabase surfaces it in the error response. We
        // match the specific message and show the friendly prompt.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          const msg = error.message || "";
          if (
            /not authorised for Kotoba access/i.test(msg) ||
            /is not whitelisted/i.test(msg) ||
            /whitelist/i.test(msg)
          ) {
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
