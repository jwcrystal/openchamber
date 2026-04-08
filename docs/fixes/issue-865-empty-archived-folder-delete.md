# Fix for Issue #865: Auto-Hide Empty Archived Folders

## Problem
Empty "project root" folders appeared in the archived section even when there were no archived sessions, confusing users.

## Solution: Auto-Hide Empty Folders

Empty archived folders are now **automatically removed** when they have no sessions.

## Implementation

### 1. Auto-Cleanup in useArchivedAutoFolders
**File**: `packages/ui/src/components/session/sidebar/hooks/useArchivedAutoFolders.ts`

When a project has no archived sessions, all folders in its archived scope are automatically deleted:

```typescript
// Clean up sessions first
cleanupSessions(scopeKey, sessionIds);

// Then clean up empty folders (only for archived scopes with no sessions)
const currentFolders = foldersMap[scopeKey] ?? [];
if (currentFolders.length > 0 && projectArchivedSessions.length === 0 && scopeKey.startsWith('__archived__:')) {
  // Delete all folders in this archived scope when there are no archived sessions
  currentFolders.forEach((folder) => {
    deleteFolder(scopeKey, folder.id);
  });
}
```

### 2. Simplified Delete Handler
**File**: `packages/ui/src/components/session/sidebar/SessionGroupSection.tsx`

The delete handler for archived folders simply deletes the sessions. Empty folders are handled by auto-cleanup:

```typescript
onDelete={() => {
  if (group.isArchivedBucket) {
    // Delete sessions in the folder
    // Empty folders are auto-hidden by useArchivedAutoFolders
    sessionEvents.requestDelete({
      sessions: folderSessionsForDelete,
      mode: 'session',
    });
    return;
  }
  // ... non-archived folder logic
}}
```

### 3. Wire Up deleteFolder Parameter
**Files Modified**:
- `useArchivedAutoFolders.ts`: Added `deleteFolder?` to `Args` type
- `SessionSidebar.tsx`: Passed `deleteFolder` to `useArchivedAutoFolders`

## Behavior Changes

### Before
- ❌ Empty "project root" folders always visible
- ❌ Users confused by mysterious empty folders
- ❌ Delete button did nothing

### After
- ✅ Empty archived folders automatically hidden
- ✅ Folders appear only when they contain sessions
- ✅ Clean, intuitive UI

## Test Scenarios

1. **No archived sessions**: Archived section should be completely empty
2. **Archive a session**: Corresponding folder should appear automatically
3. **Delete all sessions in a folder**: Folder should disappear automatically
4. **Un-archive all sessions**: All archived folders should disappear

## Files Modified
- `packages/ui/src/components/session/sidebar/hooks/useArchivedAutoFolders.ts`
- `packages/ui/src/components/session/SessionSidebar.tsx`
- `packages/ui/src/components/session/sidebar/SessionGroupSection.tsx`

## Related
- Issue: https://github.com/openchamber/openchamber/issues/865
- Version affected: 1.9.3
