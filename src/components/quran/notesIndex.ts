'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { listenNotesIndex } from '@/lib/cloud';

/**
 * Live Set<number> of ayahs that have notes for the given surah.
 * - Updates in real time from Firestore
 * - Also responds instantly to global `qs-note-deleted` events
 */
export default function useNotesIndex(surah?: number) {
  const { user } = useAuth();
  const [list, setList] = useState<number[]>([]);

  useEffect(() => {
    if (!user || !surah) {
      setList([]);
      return;
    }

    // Firestore live subscription
    const off = listenNotesIndex(user.uid, surah, setList);

    // Global event: immediate UI de-tint after delete (no flicker)
    const onDeleted = (ev: WindowEventMap['qs-note-deleted']) => {
      if (ev.detail.surah === surah) {
        setList(prev => prev.filter(n => n !== ev.detail.ayah));
      }
    };
    window.addEventListener('qs-note-deleted', onDeleted as any);

    return () => {
      off();
      window.removeEventListener('qs-note-deleted', onDeleted as any);
    };
  }, [user, surah]);

  // Return a Set for O(1) .has() lookups in VerseActions
  const setObj = useMemo(() => new Set(list), [list]);
  return setObj; // Set<number>
}
