import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // catalog-ish default; availability queries override to 0
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
