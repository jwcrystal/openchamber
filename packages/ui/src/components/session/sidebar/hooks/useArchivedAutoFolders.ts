import React from 'react';
import type { Session } from '@opencode-ai/sdk/v2';
import type { WorktreeMetadata } from '@/types/worktree';
import { dedupeSessionsById, getArchivedScopeKey, isSessionRelatedToProject, normalizePath, resolveArchivedFolderName } from '../utils';

export type ProjectForArchivedFolders = {
  normalizedPath: string;
};

type FolderEntry = {
  id: string;
  name: string;
  sessionIds: string[];
};

type Args = {
  normalizedProjects: ProjectForArchivedFolders[];
  sessions: Session[];
  archivedSessions: Session[];
  availableWorktreesByProject: Map<string, WorktreeMetadata[]>;
  isVSCode: boolean;
  isSessionsLoading: boolean;
  foldersMap: Record<string, FolderEntry[]>;
  createFolder: (scopeKey: string, name: string, parentId?: string | null) => FolderEntry;
  addSessionToFolder: (scopeKey: string, folderId: string, sessionId: string) => void;
  cleanupSessions: (scopeKey: string, existingSessionIds: Set<string>) => void;
  deleteFolder?: (scopeKey: string, folderId: string) => void;
};

const getArchivedSessionsForProject = (
  project: ProjectForArchivedFolders,
  params: Pick<Args, 'sessions' | 'archivedSessions' | 'availableWorktreesByProject' | 'isVSCode'>,
): Session[] => {
  const worktreesForProject = params.isVSCode ? [] : (params.availableWorktreesByProject.get(project.normalizedPath) ?? []);
  const validDirectories = new Set<string>([
    project.normalizedPath,
    ...worktreesForProject
      .map((meta) => normalizePath(meta.path) ?? meta.path)
      .filter((value): value is string => Boolean(value)),
  ]);

  const collect = (input: Session[]): Session[] => input.filter((session) =>
    isSessionRelatedToProject(session, project.normalizedPath, validDirectories),
  );

  const archived = collect(params.archivedSessions);
  const unassignedLive = params.sessions.filter((session) => {
    if (session.time?.archived) {
      return false;
    }
    const sessionDirectory = normalizePath((session as Session & { directory?: string | null }).directory ?? null);
    if (sessionDirectory) {
      return false;
    }
    return isSessionRelatedToProject(session, project.normalizedPath, validDirectories);
  });

  return dedupeSessionsById([...archived, ...unassignedLive]);
};

export const useArchivedAutoFolders = (args: Args): void => {
  const {
    normalizedProjects,
    sessions,
    archivedSessions,
    availableWorktreesByProject,
    isVSCode,
    isSessionsLoading,
    foldersMap,
    createFolder,
    addSessionToFolder,
    cleanupSessions,
    deleteFolder,
  } = args;

  React.useEffect(() => {
    if (isSessionsLoading) {
      return;
    }

    normalizedProjects.forEach((project) => {
      const scopeKey = getArchivedScopeKey(project.normalizedPath);
      const projectArchivedSessions = getArchivedSessionsForProject(project, {
        sessions,
        archivedSessions,
        availableWorktreesByProject,
        isVSCode,
      });
      const sessionIds = new Set(projectArchivedSessions.map((session) => session.id));

      const existingFolders = foldersMap[scopeKey] ?? [];
      const folderByName = new Map(existingFolders.map((folder) => [folder.name.toLowerCase(), folder]));

      projectArchivedSessions.forEach((session) => {
        const folderName = resolveArchivedFolderName(session, project.normalizedPath);
        const key = folderName.toLowerCase();
        let folder = folderByName.get(key);
        if (!folder) {
          folder = createFolder(scopeKey, folderName);
          folderByName.set(key, folder);
        }

        if (!folder.sessionIds.includes(session.id)) {
          addSessionToFolder(scopeKey, folder.id, session.id);
        }
      });

      // Clean up sessions first
      cleanupSessions(scopeKey, sessionIds);

      // Then clean up empty folders (only for archived scopes with no sessions)
      const currentFolders = foldersMap[scopeKey] ?? [];
      if (currentFolders.length > 0 && projectArchivedSessions.length === 0 && scopeKey.startsWith('__archived__:')) {
        // Delete all folders in this archived scope when there are no archived sessions
        // This prevents showing empty "project root" folders that confuse users
        console.log('[useArchivedAutoFolders] Auto-cleaning empty archived folders:', {
          scopeKey,
          folderCount: currentFolders.length,
          folderNames: currentFolders.map(f => f.name),
        });
        if (deleteFolder) {
          currentFolders.forEach((folder) => {
            console.log('[useArchivedAutoFolders] Deleting folder:', folder.name);
            deleteFolder(scopeKey, folder.id);
          });
        } else {
          console.error('[useArchivedAutoFolders] deleteFolder is not available!');
        }
      }
    });
  }, [
    normalizedProjects,
    sessions,
    archivedSessions,
    availableWorktreesByProject,
    isVSCode,
    isSessionsLoading,
    foldersMap,
    createFolder,
    addSessionToFolder,
    cleanupSessions,
    deleteFolder,
  ]);
};
