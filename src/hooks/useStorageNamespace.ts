'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { sanitizeStorageNamespace } from '@/lib/storageKeys';

export function useStorageNamespace(): string | null {
  const searchParams = useSearchParams();
  const pane = searchParams.get('pane');

  return useMemo(() => sanitizeStorageNamespace(pane), [pane]);
}
