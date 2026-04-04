import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** 5 minutes — reasonable for session lists, file trees, provider config */
      staleTime: 1000 * 60 * 5,
      /** Only retry once on failure — avoids hammering an offline server */
      retry: 1,
      /** Don't refetch when the app comes back to the foreground by default */
      refetchOnWindowFocus: false,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** Export for cases where the client is needed outside React (e.g. imperative invalidation) */
export { queryClient };
