import { useCallback, useEffect, useRef, useState } from "react";
import { Memory } from "@/lib/memories";
import { useMemories } from "@/hooks/useMemories";
import { insertAtRandomIndex, secureShuffle } from "@/lib/shuffle";

/**
 * Maintains a shuffled view of the user's memories that:
 *  - is generated lazily on first read (or explicit reshuffle)
 *  - reconciles new/removed memories without disrupting current order
 *  - propagates in-place edits (note/image_url) by swapping the object reference
 */
export function useRelive() {
  const { memories, refresh, loading } = useMemories();
  const orderRef = useRef<Memory[] | null>(null);
  // Bump to force re-render after we mutate the ref.
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Reconcile orderRef with upstream memories list whenever it changes.
  useEffect(() => {
    if (orderRef.current === null) {
      orderRef.current = secureShuffle(memories);
      bump();
      return;
    }

    const upstreamById = new Map(memories.map((m) => [m.id, m]));
    const currentIds = new Set(orderRef.current.map((m) => m.id));

    // Remove deleted + swap edited objects in place.
    let next = orderRef.current
      .filter((m) => upstreamById.has(m.id))
      .map((m) => upstreamById.get(m.id)!);

    // Splice in any newly-added memories at random indices.
    for (const m of memories) {
      if (!currentIds.has(m.id)) {
        next = insertAtRandomIndex(next, m);
      }
    }

    orderRef.current = next;
    bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories]);

  const reshuffle = useCallback(() => {
    orderRef.current = secureShuffle(memories);
    bump();
  }, [memories, bump]);

  return {
    memories: orderRef.current ?? [],
    reshuffle,
    refresh,
    loading,
    // version is consumed implicitly via state; expose for debugging if needed
    version,
  };
}
