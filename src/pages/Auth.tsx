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
  // Three modes: "login" | "signup" | "forgot"
  // We split forgot-password out as a distinct mode (rather than a separate
  // route) so the user stays in the same auth shell — keeps the flow simple
  // and matches the existing tab-style toggle UX.
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        // Send the reset link. We deliberately do NOT pre-check whether the
        // email is whitelisted or registered — Supabase's resetPasswordForEmail
        // does not reveal whether an address exists (no error returned for
        // unknown emails), and we want to preserve that non-enumeration
        // behaviour. The reset link only works for accounts that actually
        // exist (which, by definition, were whitelisted at signup).
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(
          "If that email is registered, a password reset link has been sent. Please check your inbox.",
        );
        setMode("login");
      } else if (mode === "login") {
        // Sign in — the database trigger guaranteed that this user's email
        // was whitelisted at signup. No runtime whitelist check needed.
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        // Sign up — the database trigger is the single source of truth for
        // whitelist enforcement. Apr 21 2026 bug: unwhitelisted signups
        // appeared to succeed in the UI even though auth.users stayed
        // empty. Root causes we defend against here:
        //
        //   (1) Supabase-js may translate the trigger's 500 response into
        //       an error whose message doesn't match our regex (e.g. when
        //       Supabase has email-enumeration obfuscation turned on, it
        //       can return a generic "Database error saving new user" or
        //       swallow the P0001 message entirely).
        //   (2) In some auth configurations Supabase returns a 200 with
        //       data.user set to an obfuscated placeholder (no real row in
        //       auth.users) to prevent attackers learning whether an email
        //       exists. A successful whitelisted signup returns a user
        //       object with a real UUID and populated identities metadata.
        //
        // Strategy: treat ANY of the following as "signup was blocked":
        //   - error is present (any reason)
        //   - data.user is missing / lacks an id
        //   - data.user.identities is an empty array (obfuscated response)
        //
        // In every blocked case we show the WHITELIST_ERROR_MESSAGE because
        // for a whitelist-gated app, whitelist rejection is by far the
        // most likely failure mode. If the clinician needs a finer-grained
        // error (e.g. weak password), Supabase's error message is shown
        // when the specific password-strength regex matches.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        // Password-strength / validation errors we want to surface directly
        // so the clinician can correct them.
        const passwordErrorRegex = /password|should be at least|at least \d+ characters/i;

        if (error) {
          const msg = error.message || "";
          if (passwordErrorRegex.test(msg)) {
            toast.error(msg);
            return;
          }
          // Any other error on signup — default to the whitelist explanation
          // since the trigger is the only gate that blocks this path.
          console.warn("[auth] signup error:", error);
          toast.error(WHITELIST_ERROR_MESSAGE);
          return;
        }

        // Defence-in-depth against obfuscated responses. A real successful
        // signup has data.user.id (valid UUID). The identities array
        // should contain at least one entry with a provider.
        const userId = data?.user?.id;
        const identities = data?.user?.identities;
        const identitiesLooksValid = Array.isArray(identities) && identities.length > 0;

        if (!userId || !identitiesLooksValid) {
          console.warn("[auth] signup returned obfuscated/placeholder user:", data);
          toast.error(WHITELIST_ERROR_MESSAGE);
          return;
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
                variant={mode === "login" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("login")}
                className="flex-1"
              >
                Sign in
              </Button>
              <Button
                variant={mode === "signup" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("signup")}
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
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
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
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
              </Button>
            </form>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Kotoba access is by invitation during beta. If your email
                isn't recognised, contact the administrator to request access.
              </p>
            )}
            {mode === "forgot" && (
              <div className="mt-4 space-y-2 text-center">
                <p className="text-xs text-muted-foreground">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
