

## Goal

Lock Kotoba sign-up and sign-in to exactly four whitelisted emails. Revoke any existing accounts that aren't on the list.

## Current state

- A whitelist migration was authored in `supabase/migrations/20260421201712_email_whitelist.sql` but **was never applied** to the live database — no `whitelisted_emails` table, no trigger, no RPC. So today any email can sign up.
- `src/pages/Auth.tsx` already has the client-side defensive handling that surfaces "This email address is not authorised…" when the database trigger blocks signup. Once the DB layer is live, that UX will just work.

## Allowed emails (case-insensitive)

1. `kabirbains99@hotmail.com`
2. `tinkoo.malhi@gmail.com`
3. `kyle@livingwithmeaning.com.au`
4. `sara@livingwithmeaning.com.au`

## Changes

### 1. New migration — apply whitelist + seed exact list + purge non-whitelisted users

Create a new migration that does the following in one transaction (idempotent so re-running is safe):

**A. Whitelist infrastructure** (re-applies the previously-authored but un-applied schema):
- Create `public.whitelisted_emails` table (PK on email, plus `added_at`, `note`).
- Create `public.is_email_whitelisted(text)` SECURITY DEFINER function (case-insensitive).
- Create `public.enforce_whitelist_on_signup()` SECURITY DEFINER trigger function that raises `P0001` with the user-facing whitelist message.
- Attach `BEFORE INSERT` trigger `before_user_insert_check_whitelist` on `auth.users`.
- Enable RLS on `whitelisted_emails` with no policies (service-role only).

**B. Seed the exact 4-email allowlist**:
- `TRUNCATE public.whitelisted_emails` then insert the four emails (lowercased) so the table contains *only* these four. This guarantees no stale entries from prior testing.

**C. Revoke access from any existing non-whitelisted users**:
- `DELETE FROM auth.users WHERE lower(email) NOT IN (<the 4 emails>)`. This cascades to `profiles`, `clients`, `reports`, `collateral_interviews` via existing FK relationships and RLS ownership, so non-whitelisted users lose all data alongside their account. Whitelisted users keep their existing data intact.

### 2. No client code changes

`src/pages/Auth.tsx` and `src/hooks/useAuth.tsx` already handle the trigger's error path and surface the right message. No edits needed.

## What's NOT changed

- Whitelisted users' existing data (clients, reports, collateral, profiles) is preserved.
- Auth UX, password rules, session handling — untouched.
- No admin UI for managing the whitelist (out of scope; you can add/remove emails directly via SQL when needed — same workflow documented in the original migration's header comment).

## Important confirmations before I run this

- Only the four emails above will retain access. If any other email currently has an account (including any test accounts you've made), it will be **permanently deleted** along with that user's clients, reports, and collateral interviews.
- The match is case-insensitive, so `Tinkoo.Malhi@gmail.com` and `tinkoo.malhi@gmail.com` are treated as the same address.

## Verification

1. After the migration runs, attempt to sign up with an email NOT on the list → should see "This email address is not authorised for Kotoba access…"
2. Sign in with one of the four whitelisted emails → succeeds.
3. Query confirms only the four allowed emails exist in `auth.users` and `whitelisted_emails`.
4. Adding a new clinician later: insert into `whitelisted_emails` then ask them to sign up.

