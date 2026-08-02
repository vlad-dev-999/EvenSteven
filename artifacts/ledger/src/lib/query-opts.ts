import type { UseQueryOptions } from '@tanstack/react-query';

/**
 * Helper to pass partial query options to orval-generated hooks.
 * The generated hooks provide queryKey automatically, but TypeScript
 * requires it in UseQueryOptions. This cast resolves the mismatch cleanly.
 */
export function qo<TData = unknown, TError = unknown>(
  opts: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
): UseQueryOptions<TData, TError> {
  return opts as UseQueryOptions<TData, TError>;
}
