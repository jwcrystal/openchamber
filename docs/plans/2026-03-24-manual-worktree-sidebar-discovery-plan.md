# Manual Worktree Sidebar Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manually-created Git worktrees show up in the sidebar automatically and open into worktree-scoped sessions that use the existing GitView `Commit` tab for file changes.

**Architecture:** Add a store-level worktree discovery refresh action, then centralize refresh triggers in a dedicated hook shared by app lifecycle and sidebar entry points. Reuse existing session grouping, `useEffectiveDirectory`, and GitView inferred worktree metadata so no new worktree-specific Git UI is introduced.

**Tech Stack:** React, TypeScript, Zustand, existing OpenChamber worktree/session stores, Bun test/typecheck tooling.

---

## Spec Reference

- Spec: `docs/plans/2026-03-24-manual-worktree-sidebar-discovery-design.md`

## File map

- Modify: `packages/ui/src/stores/types/sessionTypes.ts`
  - Add store API typing for manual worktree refresh action if missing.
- Modify: `packages/ui/src/stores/sessionStore.ts`
  - Implement refresh logic for discovered worktrees with throttle/dedupe.
- Modify: `packages/ui/src/stores/useSessionStore.ts`
  - Expose the refresh action through the UI-facing store wrapper.
- Create: `packages/ui/src/hooks/useWorktreeDiscoveryRefresh.ts`
  - Centralize focus / visibility / active-project refresh triggers and expose `refresh()`.
- Modify: `packages/ui/src/App.tsx`
  - Mount the centralized worktree discovery hook once.
- Modify: `packages/ui/src/components/session/SessionSidebar.tsx`
  - Call hook-provided `refresh()` on sidebar mount/entry.
- Test: `packages/ui/src/stores/__tests__/sessionStore.worktreeDiscovery.test.ts`
  - Cover refresh diffing, unchanged results, and project-scoped updates.
- Test: `packages/ui/src/hooks/__tests__/useWorktreeDiscoveryRefresh.test.tsx`
  - Cover focus / visibility / project-change trigger behavior and throttle coordination.

## Constraints and invariants

- Do not add a new GitView worktree changes panel.
- Do not require upstream tracking for manual worktree discovery.
- Do not auto-create sessions for every discovered worktree.
- Preserve current `Worktree` tab semantics for reintegration.
- Skip redundant state updates when discovered worktree results are unchanged.

### Task 1: Add store-level worktree discovery refresh

**Files:**
- Modify: `packages/ui/src/stores/types/sessionTypes.ts`
- Modify: `packages/ui/src/stores/sessionStore.ts`
- Modify: `packages/ui/src/stores/useSessionStore.ts`

- [ ] **Step 1: Add the store API typing**

Add a typed action to `SessionStore` for refreshing discovered worktrees. Shape:

```ts
refreshDiscoveredWorktrees: (options?: {
  projectPaths?: string[]
  reason?: 'focus' | 'visibility' | 'sidebar-mount' | 'project-change' | 'manual'
  force?: boolean
}) => Promise<void>
```

- [ ] **Step 2: Add a failing unit test for new worktree discovery**

Create `packages/ui/src/stores/__tests__/sessionStore.worktreeDiscovery.test.ts` with a test that:

1. seeds store with one project and no discovered worktrees
2. mocks `listProjectWorktrees()` to return a manual worktree
3. calls `refreshDiscoveredWorktrees()`
4. expects `availableWorktrees` and `availableWorktreesByProject` to include that path

- [ ] **Step 3: Run the unit test and confirm it fails**

Run:

```bash
bun test packages/ui/src/stores/__tests__/sessionStore.worktreeDiscovery.test.ts
```

Expected: failure because the action does not exist yet or state is not updated.

- [ ] **Step 4: Implement the refresh action in `sessionStore.ts`**

Implementation requirements:

- resolve target projects from current projects/session context
- call `listProjectWorktrees({ id, path })` for each target project
- normalize project path and worktree paths
- rebuild `availableWorktrees` and `availableWorktreesByProject` only for refreshed projects
- preserve non-refreshed project entries
- preserve existing `worktreeMetadata` for attached sessions unless a worktree disappeared
- use a module-local in-flight promise + last-refresh timestamp to avoid duplicate refreshes inside a 5s window unless `force` is true

- [ ] **Step 5: Add unchanged-results coverage**

Extend the same unit test file with a case that calls `refreshDiscoveredWorktrees()` twice with identical mock results and asserts the second call does not rewrite store data unnecessarily.

- [ ] **Step 6: Expose the action through `useSessionStore.ts`**

Mirror the session-management store action in the UI-facing store wrapper so React hooks/components can call it.

- [ ] **Step 7: Re-run targeted tests**

Run:

```bash
bun test packages/ui/src/stores/__tests__/sessionStore.worktreeDiscovery.test.ts
```

Expected: PASS.

### Task 2: Centralize refresh triggers in a hook

**Files:**
- Create: `packages/ui/src/hooks/useWorktreeDiscoveryRefresh.ts`
- Test: `packages/ui/src/hooks/__tests__/useWorktreeDiscoveryRefresh.test.tsx`

- [ ] **Step 1: Write a failing hook test for app visibility/focus refresh**

Create a hook test that mounts `useWorktreeDiscoveryRefresh()` with mocked stores and verifies:

- `document.visibilitychange` to visible triggers one refresh
- repeated triggers inside throttle window do not trigger multiple refreshes

- [ ] **Step 2: Run the hook test and confirm it fails**

Run:

```bash
bun test packages/ui/src/hooks/__tests__/useWorktreeDiscoveryRefresh.test.tsx
```

Expected: failure because the hook does not exist.

- [ ] **Step 3: Implement `useWorktreeDiscoveryRefresh.ts`**

Hook responsibilities:

- subscribe once to `visibilitychange`
- optionally subscribe to `window.focus`
- read `activeProjectId` / project list from `useProjectsStore`
- call `refreshDiscoveredWorktrees({ reason: ..., projectPaths?: ... })`
- expose a `refresh(options?)` callback for component-level entry points
- share the same 5s throttle window with store-level protection; hook-level guard should avoid noisy duplicate calls within one mounted lifecycle

- [ ] **Step 4: Add a failing hook test for active-project change**

Add a test that changes active project and expects one refresh call for the new project's path.

- [ ] **Step 5: Implement active-project change handling**

Use a React effect keyed on active project identity/path. Skip initial duplicate refresh if the hook already refreshed on mount for the same project inside the throttle window.

- [ ] **Step 6: Re-run hook tests**

Run:

```bash
bun test packages/ui/src/hooks/__tests__/useWorktreeDiscoveryRefresh.test.tsx
```

Expected: PASS.

### Task 3: Integrate hook into app and sidebar

**Files:**
- Modify: `packages/ui/src/App.tsx`
- Modify: `packages/ui/src/components/session/SessionSidebar.tsx`

- [ ] **Step 1: Add a failing integration-oriented test or component smoke test if nearby patterns exist**

If there is an existing hook/component test pattern for app lifecycle hooks, extend it; otherwise keep this step as manual verification and document why no automated component test is added.

- [ ] **Step 2: Mount the hook in `App.tsx`**

Initialize `useWorktreeDiscoveryRefresh()` once near other app-wide lifecycle hooks.

- [ ] **Step 3: Use the hook in `SessionSidebar.tsx`**

Call the hook and invoke its exposed `refresh({ reason: 'sidebar-mount' })` from a mount effect so sidebar entry catches manual worktrees quickly even if app focus did not change.

- [ ] **Step 4: Ensure no duplicate behavior is introduced**

Confirm App-level mount + sidebar mount do not cause repeated refresh storms because of the shared throttle/in-flight protection.

### Task 4: Verify GitView path resolution for manual worktrees

**Files:**
- Modify if needed: `packages/ui/src/components/views/GitView.tsx`
- Verify: `packages/ui/src/hooks/useEffectiveDirectory.ts`

- [ ] **Step 1: Add a focused verification test or document manual verification path**

If there is an existing test pattern for `useEffectiveDirectory` or GitView worktree inference, add/extend it. Otherwise record this as a manual verification slice only.

- [ ] **Step 2: Verify `useEffectiveDirectory` behavior**

Confirm a new session draft opened from a discovered worktree group resolves to the worktree path via `directoryOverride` / `bootstrapPendingDirectory` logic.

- [ ] **Step 3: Verify `inferredWorktreeMetadata` behavior in `GitView.tsx`**

Check explicitly that:

1. current directory equals discovered manual worktree path
2. `availableWorktrees` contains that path
3. `inferredWorktreeMetadata` resolves correctly
4. existing `Commit` tab shows file changes without new UI code

- [ ] **Step 4: Only patch GitView if verification reveals a real gap**

If current fallback logic already works, make no GitView code changes.

### Task 5: Manual verification and repo checks

**Files:**
- No new code unless issues found during verification

- [ ] **Step 1: Manual verification — discovery**

From repo root, run:

```bash
git worktree add ../openchamber-manual-test
```

Then refocus the app and verify the worktree appears in the sidebar under the correct project.

- [ ] **Step 2: Manual verification — session open**

Click the new worktree group and confirm a new draft/session opens scoped to that worktree path.

- [ ] **Step 3: Manual verification — file changes**

Inside the manual worktree, create or modify a file, then verify GitView `Commit` shows the change.

- [ ] **Step 4: Manual verification — reintegration unaffected**

Confirm the `Worktree` tab still represents reintegration only.

- [ ] **Step 5: Run repository verification commands**

Run:

```bash
bun run type-check
bun run lint
bun run build
```

Expected: all pass, ignoring only pre-existing unrelated baseline failures if any are confirmed to predate this work.

## Notes for implementer

- Prefer a small local helper in `sessionStore.ts` for comparing discovered worktrees by normalized path and branch.
- Do not introduce a filesystem watcher in this plan.
- If an automated test is impractical for one verification slice, note the reason in the PR/summary and keep the rest covered.

## Execution handoff

Plan complete. Recommended execution mode: **Subagent-Driven** using `superpowers:subagent-driven-development`.
