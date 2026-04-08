# Manual worktree sidebar discovery design

## Summary

Enable manually-created Git worktrees to appear in the session sidebar and open into normal worktree-scoped sessions that use the existing GitView `Commit` tab for file changes.

This design does **not** add a new worktree-specific Git changes UI. It fixes discovery, synchronization, and session entry so existing Git UI works for manual worktrees.

## Problem

Today, a worktree created outside OpenChamber (for example with `git worktree add ...`) may exist in Git but not appear in the sidebar until store/session data is refreshed through unrelated flows. As a result:

- manually-created worktrees are easy to miss
- users cannot reliably open them as sessions from the sidebar
- users incorrectly expect the `Worktree` tab to show file changes, when file changes actually live in the existing `Commit` tab

## Goals

1. Manually-created worktrees appear in the sidebar for the correct project.
2. Newly discovered worktrees can be opened as sessions.
3. Once opened, the session resolves to the worktree directory and GitView `Commit` shows that worktree's file changes.
4. Existing OpenChamber-created worktree flows continue to work.
5. `Worktree` tab remains focused on commit re-integration.

## Non-goals

- No new dedicated "Worktree Changes" panel.
- No file-system watcher for `.git/worktrees` in v1.
- No automatic session creation for every discovered worktree.
- No changes to reintegration semantics.

## Current behavior

### Relevant code paths

- `packages/ui/src/lib/worktrees/worktreeManager.ts`
  - `listProjectWorktrees(project)` already uses `git.worktree.list(...)`
  - This should discover both OpenChamber-created and manually-created worktrees.
- `packages/ui/src/stores/sessionStore.ts`
  - populates `availableWorktrees` and `availableWorktreesByProject`
  - discovery currently happens as part of session-loading flows, not as an independently refreshed sidebar source of truth
- `packages/ui/src/components/session/sidebar/hooks/useSessionSidebarSections.ts`
  - renders project groups from `availableWorktreesByProject`
- `packages/ui/src/components/views/GitView.tsx`
  - `Commit` tab renders `ChangesSection`
  - `Worktree` tab renders `IntegrateCommitsSection`
  - worktree mode is inferred from `worktreeMetadata`

### Root cause

The sidebar depends on store-managed discovered worktrees, but manual `git worktree add` does not reliably trigger a refresh of that discovery state. The discovery logic exists; refresh timing is incomplete.

## Proposed approach

Implement lightweight automatic worktree discovery refresh centered on sidebar/project lifecycle events, plus optional low-frequency polling as a safety net.

### 1. Add explicit refresh path for discovered worktrees

Add a store-level action that refreshes worktrees for one project or all active projects without requiring a full session reload.

Expected responsibilities:

- call `listProjectWorktrees(project)`
- normalize and group results by canonical project root
- diff against existing `availableWorktrees` / `availableWorktreesByProject`
- update state only when discovery output changed
- preserve existing `worktreeMetadata` for sessions already attached to valid worktrees

This becomes the reusable source for both sidebar refreshes and create/remove completion refreshes.

### 2. Trigger refresh from lightweight auto-monitoring events

Refresh discovered worktrees on:

- app/window focus regain
- active project change
- sidebar/session area mount or re-entry
- worktree create/remove success paths

Optional safety net:

- low-frequency throttled polling only while app is visible and a Git project is active

Polling is a fallback, not the primary mechanism. Event-triggered refresh should do most of the work.

### 3. Keep sidebar UX unchanged, improve data freshness

No major sidebar redesign.

Expected UX:

- manually-created worktrees appear under the correct project section
- they behave like existing discovered worktrees
- selecting one opens or associates a session scoped to the worktree path

If a tiny manual refresh control already fits nearby patterns, it can be added as a secondary affordance, but this is not required for v1.

### 4. Reuse existing GitView for file changes

No new file changes UI is needed.

When session directory resolves to a discovered worktree path:

- `GitView` uses that worktree directory as `currentDirectory`
- `Commit` tab shows staged/unstaged changes for that worktree
- `Worktree` tab remains for re-integrating commits back to a base branch

GitView should also continue relying on inferred worktree metadata from discovered `availableWorktrees` when the current directory matches a worktree path. This fallback allows worktree-specific UI, including reintegration, to behave correctly even before session-scoped `worktreeMetadata` is fully hydrated.

This aligns behavior with existing architecture and avoids duplicating Git changes UI.

## Data flow

1. User runs `git worktree add ...` outside OpenChamber.
2. OpenChamber regains focus or hits another refresh trigger.
3. Store refresh action calls `listProjectWorktrees(project)`.
4. New worktree metadata is added to `availableWorktreesByProject`.
5. Sidebar re-renders and shows the new worktree under the owning project.
6. User opens the worktree from sidebar.
7. Worktrees appear as groups in the sidebar. Clicking a worktree group opens a new session draft with `directoryOverride` set to the worktree path.
8. Session resolves to the worktree path.
9. Existing GitView `Commit` tab shows that worktree's file changes.

## Edge cases

### Worktree without upstream

Still show it in the sidebar. Upstream is not required for discovery or for `Commit` tab file changes.

### Worktree with no sessions

Still show it as an empty group in the sidebar. Clicking it should open a new session draft scoped to that worktree.

### Manually removed worktree

If refresh no longer finds the worktree path, remove it from discovered worktree lists. Sessions pointing there should degrade safely instead of crashing.

### Nested directories inside a worktree

Project resolution should continue using `availableWorktreesByProject` path matching so nested paths inside a worktree still map back to the correct project.

### Refresh failures

Discovery failures should not block sidebar or session rendering. Keep prior state and retry on future triggers.

## Verification plan

### Manual verification

1. Open project in OpenChamber.
2. Run `git worktree add ../some-worktree` outside the app.
3. Refocus app.
4. Confirm sidebar shows the new worktree.
5. Open it as a session.
6. Create or modify a file in that worktree.
7. Confirm GitView `Commit` shows the change.
8. Confirm `Worktree` tab still shows reintegration behavior only.

### Regression checks

- OpenChamber-created worktrees still appear.
- Remove-worktree flows still clean up discovered entries.
- No repeated sidebar churn when discovery results are unchanged.
- No visible performance issues from refresh triggers.

## Risks

### Too-frequent refreshes

Mitigation:

- throttle focus-driven refreshes
- skip refresh when project is not a Git repository
- skip state updates when results are unchanged

### Session metadata drift

Mitigation:

- do not overwrite attached session `worktreeMetadata` unless discovery proves the worktree disappeared or canonical metadata needs normalization

## Recommended implementation slices

1. Add store action to refresh discovered worktrees by project.
2. Wire sidebar/project lifecycle triggers to that action.
3. Ensure sidebar opens newly discovered worktrees into correct sessions.
4. Verify GitView `Commit` path resolution works for manual worktree sessions.
5. Verify inferred worktree metadata correctly identifies manual worktree context for new session drafts.
6. Add low-frequency throttled refresh only if event-only refresh is insufficient.

## Out of scope follow-ups

- clearer UX copy explaining `Commit` vs `Worktree` tabs
- explicit refresh control for worktree discovery
- richer worktree status metadata in sidebar
