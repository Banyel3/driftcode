import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOpenCodeClient,
  switchProjectBranch,
} from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';
import { serverProjectKeys } from './useServerProjects';

export function useProjectBranchSwitch() {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, { worktreePath: string; branch: string }>({
    mutationFn: async ({ worktreePath, branch }) => {
      if (!serverUrl || !serverPassword) {
        throw new Error('Not connected to a server.');
      }

      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });

      await switchProjectBranch(client, worktreePath, branch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: serverProjectKeys.all });
    },
  });

  return {
    switchBranch: mutation.mutateAsync,
    isSwitching: mutation.isPending,
    error: mutation.error ?? null,
  };
}
