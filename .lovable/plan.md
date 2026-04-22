

## Goal

Add report-level collaboration on the **primary Lovable Cloud backend** (where `reports`, `clients`, `auth.users`, and the existing whitelist all live). Owners can share a report with whitelisted Kotoba users as `editor` or `viewer`; permissions are enforced via RLS; meaningful actions are logged; and the editor surfaces "last edited by" when relevant.

> Note: per your clarification, the Kotoba project (`rxczgtazoyvbdtlwnidu`) stays reserved for AI edge functions. Nothing in this feature touches it.

## Database (single migration)

### 1. New tables

**`public.report_collaborators`**
- `id uuid pk`, `report_id uuid not null`, `user_id uuid not null`, `role app_collab_role not null`, `added_by uuid not null`, `added_at timestamptz default now()`
- Enum `app_collab_role`: `owner | editor | viewer`
- Unique `(report_id, user_id)`; FK `report_id → reports(id) on delete cascade`
- RLS enabled

**`public.report_activity`**
- `id uuid pk`, `report_id uuid not null`, `user_id uuid not null`, `action text not null`, `metadata jsonb default '{}'`, `created_at timestamptz default now()`
- FK `report_id → reports(id) on delete cascade`
- Index on `(report_id, created_at desc)`
- RLS enabled

### 2. Helper functions (all `SECURITY DEFINER`, fixed search_path)

- `public.is_report_collaborator(_report uuid, _user uuid) returns boolean` — exists check
- `public.report_role(_report uuid, _user uuid) returns app_collab_role` — returns role or null
- `public.find_user_id_by_email(_email text) returns uuid` — case-insensitive lookup against `auth.users`. Returns null unless the email is whitelisted (so it can't be used to enumerate non-Kotoba accounts). Callable by any authenticated user.
- `public.get_collaborator_emails(_report uuid) returns table(user_id uuid, email text)` — returns emails only for collaborators of a report the caller can see. Used by the manage-access modal.
- `public.last_editor_for_report(_report uuid) returns table(user_id uuid, email text, clinician_name text, edited_at timestamptz)` — returns the most recent `edited_section` activity row's author (and their profile name), excluding the caller. Used for the "Edited by …" indicator.

### 3. Triggers

- `after_insert_reports_seed_owner` on `reports`: inserts an `owner` row into `report_collaborators` for `NEW.user_id`, and writes a `created` activity row.

### 4. Backfill

- For every existing row in `reports`, insert a matching `owner` collaborator row (idempotent via the unique constraint).

### 5. RLS policy updates

**`reports` (replace existing user_id-only policies):**
- SELECT: `is_report_collaborator(id, auth.uid())`
- UPDATE: `report_role(id, auth.uid()) in ('owner','editor')`
- INSERT: `auth.uid() = user_id` (creator becomes owner via trigger)
- DELETE: `report_role(id, auth.uid()) = 'owner'`

**`collateral_interviews` (replace existing user_id-only policies):**
- SELECT: collaborator on the parent report
- INSERT/UPDATE: role in (`owner`,`editor`) on the parent report
- DELETE: `owner` only

**`report_collaborators`:**
- SELECT: caller is a collaborator on the same report
- INSERT/UPDATE/DELETE: caller is `owner` on the same report

**`report_activity`:**
- SELECT: caller is a collaborator on the same report
- INSERT: caller is a collaborator (role check enforced in client-side actions)
- UPDATE/DELETE: none

## UI changes

### 1. `src/pages/ClientEditor.tsx`

- Query the caller's role from `report_role(...)` once the report loads. Cache as `myRole`.
- Add a **"Manage access"** button to the editor header — visible only when `myRole === 'owner'`. Opens the new modal.
- On report load, call `last_editor_for_report(report.id)`. If a non-self editor is returned, render an unobtrusive line near the autosave indicator: *"Edited by {name or email} · {relative time}"*. No banner, no toast.
- Wherever the report is mutated (autosave, full-report generate, single-section regenerate, manual edit save), insert a row into `report_activity` with the corresponding action: `edited_section` (with `metadata.section` if applicable), `regenerated_section`, `generated_full_report`. Use a small helper `logActivity(action, metadata?)` colocated in `src/lib/reportActivity.ts`.
- Disable edit affordances (Notes inputs, Generate buttons) when `myRole === 'viewer'` and show a small "View only" badge.

### 2. New: `src/components/editor/ManageAccessDialog.tsx`

- Lists current collaborators (email · role · added date) loaded via `get_collaborator_emails(report_id)` joined with `report_collaborators`.
- Add form: email input + role select (`editor` / `viewer`) + Add button.
  - On submit: call `find_user_id_by_email`. If null → toast "No Kotoba account found for that email. Ask your colleague to sign up first."
  - Otherwise insert into `report_collaborators` and log `added_collaborator` activity.
- Each non-owner row has a role select (editor/viewer) and a Remove button. Owner row is read-only.
- Owner cannot remove self or change own role (UI disables it; RLS would block anyway).
- All mutations log to `report_activity` (`removed_collaborator`, `changed_role`).

### 3. `src/pages/Dashboard.tsx`

- Replace `clients` query with one that returns clients owned by the user **or** clients whose current report has the user as a collaborator. Implementation: a new `SECURITY DEFINER` view/RPC `get_accessible_clients()` that returns the union, sorted by `updated_at desc`. Add a small "Shared" badge on rows where the current user is not the owner.

## What is NOT built (per your scope)

- No invitation/email sending — adds only existing Kotoba users; UI tells the inviter to ask their colleague to create an account first.
- No practice/org entities, no roles beyond owner/editor/viewer, no realtime, no diffing, no version history of edits beyond an action log.

## Verification

1. **Backfill:** every existing report has exactly one `owner` collaborator row matching its `user_id`.
2. **Owner flow:** as the report owner, "Manage access" appears; add a whitelisted colleague as editor → they appear in their dashboard with a "Shared" badge and can open + edit the report.
3. **Viewer flow:** add a whitelisted colleague as viewer → they can open the report read-only; Notes inputs are disabled, Generate buttons hidden.
4. **Permission boundary:** a non-collaborator user gets `PGRST` "no rows" when fetching the report (RLS blocks it).
5. **Email lookup:** entering a non-existent or non-whitelisted email shows the "No Kotoba account" error and never leaks whether the email exists elsewhere.
6. **Activity log:** creating a report, adding/removing a collaborator, generating the full report, and regenerating a section each insert one row into `report_activity`.
7. **Last-editor indicator:** when User B saves edits and User A reopens, User A sees "Edited by {B} · {time}". User B sees nothing (self-edit excluded).
8. **Owner self-protection:** API and UI both reject an owner trying to remove themselves or downgrade their own role.

