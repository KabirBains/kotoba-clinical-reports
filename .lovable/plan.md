

## Goal

Make the left sidebar truly persistent on screen — it should follow the viewport as the user scrolls down the page (not just sit at the top and scroll out of view). Also add a collapse/expand toggle so users can hide the sidebar and bring it back.

## Root cause

Today `EditorSidebar` uses `sticky top-14 h-[calc(100vh-3.5rem)]` and lives inside `ClientEditor`'s flex layout. The page itself scrolls the document body — `sticky` only works as long as the sidebar's parent is in view. Once the user scrolls past the parent's bottom, the sidebar scrolls away with it.

The reliable fix: switch to `position: fixed` so the sidebar is anchored to the viewport regardless of page scroll position, and offset the main content to compensate.

## Changes

### 1. `src/components/editor/EditorSidebar.tsx` — fixed positioning + collapse

- Change desktop positioning from `sticky top-14 h-[calc(100vh-3.5rem)] self-start` to `fixed left-0 top-14 bottom-0` (anchored to viewport, full-height minus the app header).
- Add a controlled `collapsed` state (desktop only — mobile keeps its existing open/closed sheet behaviour).
- When collapsed: render a narrow 12px-wide rail with just an expand button (chevron-right icon) so the user can bring it back. Width transitions smoothly (`transition-all duration-200`).
- When expanded: render the full `w-64` sidebar with a small collapse button (chevron-left icon) in the top-right corner of the sidebar header.
- Persist the collapsed preference in `localStorage` under key `kotoba-sidebar-collapsed` so it survives reloads and route changes.
- Expose the current width via a prop callback `onWidthChange?: (px: number) => void` so the parent can offset main content.

### 2. `src/pages/ClientEditor.tsx` — offset main content

- Track sidebar width in local state (`sidebarWidth`, default 256px desktop / 0 mobile).
- Pass `onWidthChange={setSidebarWidth}` to `EditorSidebar`.
- Apply a left margin/padding to the main content wrapper equal to `sidebarWidth` on desktop only (mobile sidebar is overlay, no offset needed). Use inline style `style={{ marginLeft: isMobile ? 0 : sidebarWidth }}` with a `transition-[margin] duration-200` class so the content slides smoothly when the sidebar collapses/expands.
- Remove the existing flex layout dependency between sidebar and main (the sidebar is now `fixed`, so it's out of normal flow).

## What's NOT changed

- Mobile sidebar behaviour (overlay sheet with hamburger) stays as-is.
- Active section tracking, scroll-spy, group expansion logic — untouched.
- Header (`top-14` offset) — unchanged.
- All other layout, no other components touched.

## Verification

1. Open a client → Notes mode. The sidebar should be visible at the left edge.
2. Scroll the page all the way to the bottom — the sidebar stays pinned to the viewport the entire time, never scrolls out of view.
3. Click the collapse chevron (top-right of sidebar) — sidebar shrinks to a narrow rail with just an expand chevron; main content slides left to reclaim the space.
4. Click the expand chevron — sidebar returns to full width; main content slides right.
5. Reload the page — collapsed/expanded state persists.
6. Resize to mobile width — desktop collapse button hidden; existing hamburger overlay behaviour still works.

