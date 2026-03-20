import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Itinerary } from '../types';
import { createBoardSupabaseClient } from '../lib/supabase';
import { DbRow, itineraryToRow, rowToItinerary, SYNC_DEBOUNCE_MS, SyncedStore } from './helpers';
import * as Y from 'yjs';
import base64js from 'base64-js';

const YJS_UPDATE_EVENT = 'yjs-update';
const YJS_SYNC_REQUEST_EVENT = 'yjs-sync-request';
const YJS_SYNC_RESPONSE_EVENT = 'yjs-sync-response';
const SYNC_RETRY_MS = 5_000;
const MAX_SYNC_RETRY_MS = 30_000;
const ANTI_ENTROPY_INTERVAL_MS = 10_000;
const UPSERT_BATCH_SIZE = 1;

interface YjsUpdatePayload {
  sessionId: string;
  update: string;
}

interface YjsSyncRequestPayload {
  sessionId: string;
  stateVector: string;
}

interface YjsSyncResponsePayload {
  sessionId: string;
  targetSessionId: string;
  update: string;
}

function encodeBinary(value: Uint8Array): string {
  return base64js.fromByteArray(value);
}

function decodeBinary(value: string): Uint8Array {
  return base64js.toByteArray(value);
}

async function upsertRowsInBatches(
  supabase: SupabaseClient,
  rows: DbRow[],
) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('itinerary_versions')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      throw new Error(error.message);
    }
  }
}

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
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null);
  const subscribedRef = useRef(false);
  const pendingUpdateRef = useRef<Uint8Array | null>(null);
  const pendingSyncRevisionRef = useRef(0);
  const persistedSyncRevisionRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const syncRetryDelayRef = useRef(SYNC_RETRY_MS);
  const needsSnapshotBootstrapRef = useRef(false);
  const resyncInFlightRef = useRef<Promise<void> | null>(null);
  const providerOriginRef = useRef({ source: 'supabase-yjs-provider' });
  const pendingBroadcastRef = useRef<Uint8Array | null>(null);
  const broadcastTimeoutRef = useRef<number | null>(null);

  const syncToSupabase = useCallback(async () => {
    if (syncInFlightRef.current) return;

    const targetRevision = pendingSyncRevisionRef.current;
    if (targetRevision === persistedSyncRevisionRef.current) return;

    const current = JSON.parse(JSON.stringify(store.versions)) as Itinerary[];
    if (current.length === 0) return;

    syncInFlightRef.current = true;
    try {
      const yjsState = encodeBinary(Y.encodeStateAsUpdate(doc));

      const rows: DbRow[] = current.map((v, i) => {
        const row = itineraryToRow(v, boardId, i, sessionId);
        if (i === 0) row.yjs_state = yjsState;
        return row;
      });

      await upsertRowsInBatches(supabase, rows);
      persistedSyncRevisionRef.current = targetRevision;
      syncRetryDelayRef.current = SYNC_RETRY_MS;
    } catch (e) {
      console.error('Failed to encode/sync Yjs state:', e);
    } finally {
      syncInFlightRef.current = false;

      if (pendingSyncRevisionRef.current > targetRevision) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = window.setTimeout(() => {
          void syncToSupabase();
        }, SYNC_DEBOUNCE_MS);
      } else if (persistedSyncRevisionRef.current < pendingSyncRevisionRef.current) {
        const retryDelay = syncRetryDelayRef.current;
        syncRetryDelayRef.current = Math.min(syncRetryDelayRef.current * 2, MAX_SYNC_RETRY_MS);
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = window.setTimeout(() => {
          void syncToSupabase();
        }, retryDelay);
      }
    }
  }, [boardId, supabase, doc, store]);

  const scheduleSyncToSupabase = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      syncToSupabase();
    }, SYNC_DEBOUNCE_MS);
  }, [syncToSupabase]);

  const markDirtyAndScheduleSync = useCallback(() => {
    pendingSyncRevisionRef.current += 1;
    scheduleSyncToSupabase();
  }, [scheduleSyncToSupabase]);

  const loadFromSupabase = useCallback(async (mode: 'initial' | 'resync') => {
    const { data, error: fetchError } = await supabase
      .from('itinerary_versions')
      .select('*')
      .eq('board_id', boardId)
      .order('version_index', { ascending: true });

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    if (!data || data.length === 0) {
      if (mode === 'initial') {
        throw new Error('Board not found');
      }
      return;
    }

    const firstRow = data[0];
    if (firstRow.yjs_state) {
      Y.applyUpdate(doc, decodeBinary(firstRow.yjs_state), providerOriginRef.current);
      return;
    }

    if (mode === 'initial') {
      const loadedVersions = data.map(rowToItinerary);
      store.versions.splice(0, store.versions.length, ...loadedVersions);
      needsSnapshotBootstrapRef.current = true;
    }
  }, [boardId, doc, store, supabase]);

  const requestPeerSync = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;

    const payload: YjsSyncRequestPayload = {
      sessionId,
      stateVector: encodeBinary(Y.encodeStateVector(doc)),
    };

    channel.send({
      type: 'broadcast',
      event: YJS_SYNC_REQUEST_EVENT,
      payload,
    });
  }, [doc, sessionId]);

  const sendDocumentUpdate = useCallback((update: Uint8Array) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) {
      pendingUpdateRef.current = pendingUpdateRef.current
        ? Y.mergeUpdates([pendingUpdateRef.current, update])
        : update;
      return;
    }

    pendingBroadcastRef.current = pendingBroadcastRef.current
      ? Y.mergeUpdates([pendingBroadcastRef.current, update])
      : update;

    if (broadcastTimeoutRef.current === null) {
      broadcastTimeoutRef.current = window.setTimeout(() => {
        if (!pendingBroadcastRef.current) return;
        const toSend = pendingBroadcastRef.current;
        pendingBroadcastRef.current = null;
        broadcastTimeoutRef.current = null;

        const payload: YjsUpdatePayload = {
          sessionId,
          update: encodeBinary(toSend),
        };

        channel.send({
          type: 'broadcast',
          event: YJS_UPDATE_EVENT,
          payload,
        });
      }, 100);
    }
  }, [sessionId]);

  const flushPendingUpdates = useCallback(() => {
    if (!pendingUpdateRef.current) return;

    const pendingUpdate = pendingUpdateRef.current;
    pendingUpdateRef.current = null;
    sendDocumentUpdate(pendingUpdate);
  }, [sendDocumentUpdate]);

  const refreshFromSupabase = useCallback(async () => {
    if (resyncInFlightRef.current) {
      await resyncInFlightRef.current;
      return;
    }

    const task = (async () => {
      try {
        await loadFromSupabase('resync');
      } catch (e) {
        console.error('Failed to refresh Yjs state from Supabase:', e);
      }
    })();

    resyncInFlightRef.current = task;
    await task.finally(() => {
      if (resyncInFlightRef.current === task) {
        resyncInFlightRef.current = null;
      }
    });
  }, [loadFromSupabase]);

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (cancelled) return;
        await loadFromSupabase('initial');
      } catch (e) {
        console.error('Error during initial load:', e);
        setError(e instanceof Error ? e.message : 'Failed to load board data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [loadFromSupabase]);

  useEffect(() => {
    if (loading || !needsSnapshotBootstrapRef.current) return;
    needsSnapshotBootstrapRef.current = false;
    markDirtyAndScheduleSync();
  }, [loading, markDirtyAndScheduleSync]);

  // Realtime broadcast
  useEffect(() => {
    if (loading) return;

    const channel = supabase.channel(`board-${boardId}-yjs`, {
      config: { broadcast: { ack: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: YJS_UPDATE_EVENT }, ({ payload }) => {
        const nextPayload = payload as YjsUpdatePayload;
        if (!nextPayload || nextPayload.sessionId === sessionId) return;

        Y.applyUpdate(doc, decodeBinary(nextPayload.update), providerOriginRef.current);
        markDirtyAndScheduleSync();
      })
      .on('broadcast', { event: YJS_SYNC_REQUEST_EVENT }, ({ payload }) => {
        const nextPayload = payload as YjsSyncRequestPayload;
        if (!nextPayload || nextPayload.sessionId === sessionId) return;

        const diff = Y.encodeStateAsUpdate(doc, decodeBinary(nextPayload.stateVector));
        if (diff.byteLength === 0) return;

        const response: YjsSyncResponsePayload = {
          sessionId,
          targetSessionId: nextPayload.sessionId,
          update: encodeBinary(diff),
        };

        channel.send({
          type: 'broadcast',
          event: YJS_SYNC_RESPONSE_EVENT,
          payload: response,
        });
      })
      .on('broadcast', { event: YJS_SYNC_RESPONSE_EVENT }, ({ payload }) => {
        const nextPayload = payload as YjsSyncResponsePayload;
        if (!nextPayload || nextPayload.targetSessionId !== sessionId || nextPayload.sessionId === sessionId) return;

        Y.applyUpdate(doc, decodeBinary(nextPayload.update), providerOriginRef.current);
        markDirtyAndScheduleSync();
      })
      .subscribe((status, err) => {
        if (err) console.error('Realtime broadcast error:', err);
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          void (async () => {
            await refreshFromSupabase();
            requestPeerSync();
            flushPendingUpdates();
            if (pendingSyncRevisionRef.current > persistedSyncRevisionRef.current) {
              scheduleSyncToSupabase();
            }
          })();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          subscribedRef.current = false;
        }
      });

    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === providerOriginRef.current) return;

      markDirtyAndScheduleSync();
      sendDocumentUpdate(update);
    };

    doc.on('update', onUpdate);

    const handleResume = () => {
      if (!subscribedRef.current) return;
      void refreshFromSupabase();
      requestPeerSync();
      if (pendingSyncRevisionRef.current > persistedSyncRevisionRef.current) {
        scheduleSyncToSupabase();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
        return;
      }

      if (pendingSyncRevisionRef.current > persistedSyncRevisionRef.current) {
        void syncToSupabase();
      }
    };

    const handlePageHide = () => {
      if (pendingSyncRevisionRef.current > persistedSyncRevisionRef.current) {
        void syncToSupabase();
      }
    };

    const antiEntropyInterval = window.setInterval(() => {
      if (!subscribedRef.current || document.visibilityState !== 'visible') return;
      requestPeerSync();
      void refreshFromSupabase();
    }, ANTI_ENTROPY_INTERVAL_MS);

    window.addEventListener('focus', handleResume);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      doc.off('update', onUpdate);
      clearInterval(antiEntropyInterval);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [
    boardId,
    loading,
    supabase,
    doc,
    sessionId,
    sendDocumentUpdate,
    markDirtyAndScheduleSync,
    refreshFromSupabase,
    requestPeerSync,
    flushPendingUpdates,
    scheduleSyncToSupabase,
    syncToSupabase,
  ]);

  // Cleanup sync timeout
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
    };
  }, []);

  return { loading, error, supabase };
}
