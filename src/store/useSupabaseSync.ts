import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Itinerary } from '../types';
import { createBoardSupabaseClient } from '../lib/supabase';
import { DbRow, itineraryToRow, rowToItinerary, SYNC_DEBOUNCE_MS, SyncedStore } from './helpers';
import * as Y from 'yjs';
import base64js from 'base64-js';

export function useSupabaseSync(
  boardId: string,
  accessToken: string,
  store: SyncedStore,
  doc: Y.Doc,
  sessionId: string,
) {
  const supabase = useMemo(
    () => createBoardSupabaseClient(accessToken),
    [accessToken],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  const syncToSupabase = useCallback(async () => {
    const current = JSON.parse(JSON.stringify(store.versions)) as Itinerary[];
    if (current.length === 0) return;

    try {
      const yjsState = base64js.fromByteArray(Y.encodeStateAsUpdate(doc));

      const rows: DbRow[] = current.map((v, i) => {
        const row = itineraryToRow(v, boardId, i, sessionId);
        if (i === 0) row.yjs_state = yjsState;
        return row;
      });

      const { error } = await supabase.from('itinerary_versions').upsert(rows, { onConflict: 'id' });
      if (error) console.error('Sync to Supabase failed:', error.message);
    } catch (e) {
      console.error('Failed to encode/sync Yjs state:', e);
    }
  }, [boardId, supabase, doc, store]);

  const scheduleSyncToSupabase = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      syncToSupabase();
    }, SYNC_DEBOUNCE_MS);
  }, [syncToSupabase]);

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error: fetchError } = await supabase
          .from('itinerary_versions')
          .select('*')
          .eq('board_id', boardId)
          .order('version_index', { ascending: true });

        if (cancelled) return;
        if (fetchError) { setError(fetchError.message); setLoading(false); return; }
        if (!data || data.length === 0) { setError('Board not found'); setLoading(false); return; }

        const firstRow = data[0];
        if (firstRow.yjs_state) {
          const uint8Array = base64js.toByteArray(firstRow.yjs_state);
          Y.applyUpdate(doc, uint8Array, 'remote');
        } else {
          const loadedVersions = data.map(rowToItinerary);
          store.versions.splice(0, store.versions.length, ...loadedVersions);
        }
      } catch (e) {
        console.error('Error during initial load:', e);
        setError('Failed to load board data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [boardId, supabase, doc, store]);

  // Realtime broadcast
  useEffect(() => {
    if (loading) return;

    const channel = supabase.channel(`board-${boardId}-yjs`, {
      config: { broadcast: { ack: false } },
    });

    channel
      .on('broadcast', { event: 'yjs-update' }, (payload) => {
        if (payload.payload.sessionId === sessionId) return;
        console.log('Remote Yjs update received!');
        const update = new Uint8Array(payload.payload.update);
        Y.applyUpdate(doc, update, 'remote');
      })
      .subscribe((status, err) => {
        console.log('Realtime broadcast status:', status);
        if (err) console.error('Realtime broadcast error:', err);
      });

    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') {
        channel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: { update: Array.from(update), sessionId }
        });
        scheduleSyncToSupabase();
      }
    };

    doc.on('update', onUpdate);

    return () => {
      doc.off('update', onUpdate);
      supabase.removeChannel(channel);
    };
  }, [boardId, loading, supabase, doc, scheduleSyncToSupabase]);

  // Cleanup sync timeout
  useEffect(() => {
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, []);

  return { loading, error, supabase };
}
