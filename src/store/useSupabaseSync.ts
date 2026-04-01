import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { createBoardSupabaseClient, invokeBoardFunction } from '../lib/supabase';
import { rowToItinerary, SYNC_DEBOUNCE_MS, SyncedStore } from './helpers';
import * as Y from 'yjs';
import base64js from 'base64-js';

const YJS_UPDATE_EVENT = 'yjs-update';
const YJS_SYNC_REQUEST_EVENT = 'yjs-sync-request';
const YJS_SYNC_RESPONSE_EVENT = 'yjs-sync-response';
const SYNC_RETRY_MS = 5_000;
const MAX_SYNC_RETRY_MS = 30_000;

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
  const syncInFlightRef = useRef(false);
  const syncRetryDelayRef = useRef(SYNC_RETRY_MS);
  const needsSnapshotBootstrapRef = useRef(false);
  const providerOriginRef = useRef({ source: 'supabase-yjs-provider' });
  const pendingBroadcastRef = useRef<Uint8Array | null>(null);
  const broadcastTimeoutRef = useRef<number | null>(null);
  const localRevisionRef = useRef(0);
  const pendingDiffRef = useRef<Uint8Array | null>(null);

  // ---------------------------------------------------------------------------
  // Persist accumulated Yjs diff to board_documents via edge function
  // ---------------------------------------------------------------------------
  const syncToSupabase = useCallback(async () => {
    if (syncInFlightRef.current) return;

    const diff = pendingDiffRef.current;
    if (!diff) return;

    syncInFlightRef.current = true;
    pendingDiffRef.current = null;

    try {
      const result = await invokeBoardFunction<{ revision: number }>(
        'apply-board-update',
        accessToken,
        { boardId, update: encodeBinary(diff) },
      );
      localRevisionRef.current = result.revision;
      syncRetryDelayRef.current = SYNC_RETRY_MS;
    } catch (e) {
      console.error('Failed to sync to Supabase:', e);
      // Merge failed diff back with any new diffs that arrived during the attempt
      pendingDiffRef.current = pendingDiffRef.current
        ? Y.mergeUpdates([diff, pendingDiffRef.current])
        : diff;

      const retryDelay = syncRetryDelayRef.current;
      syncRetryDelayRef.current = Math.min(retryDelay * 2, MAX_SYNC_RETRY_MS);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
        void syncToSupabase();
      }, retryDelay);
    } finally {
      syncInFlightRef.current = false;

      // If new diffs accumulated while we were syncing, schedule another round
      if (pendingDiffRef.current) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = window.setTimeout(() => {
          void syncToSupabase();
        }, SYNC_DEBOUNCE_MS);
      }
    }
  }, [accessToken, boardId]);

  const scheduleSyncToSupabase = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      void syncToSupabase();
    }, SYNC_DEBOUNCE_MS);
  }, [syncToSupabase]);

  const markDirtyAndScheduleSync = useCallback(() => {
    scheduleSyncToSupabase();
  }, [scheduleSyncToSupabase]);

  // ---------------------------------------------------------------------------
  // Load: board_documents first, fallback to legacy itinerary_versions
  // ---------------------------------------------------------------------------
  const loadFromSupabase = useCallback(async (mode: 'initial' | 'resync') => {
    // Try the new board_documents table first
    const { data: docData, error: docError } = await supabase
      .from('board_documents')
      .select('yjs_state, revision')
      .eq('board_id', boardId)
      .maybeSingle();

    if (!docError && docData?.yjs_state) {
      if (mode === 'resync' && docData.revision <= localRevisionRef.current) return;
      Y.applyUpdate(doc, decodeBinary(docData.yjs_state), providerOriginRef.current);
      localRevisionRef.current = docData.revision;
      return;
    }

    // Fallback to itinerary_versions (legacy boards / first-time migration)
    const { data, error: fetchError } = await supabase
      .from('itinerary_versions')
      .select('*')
      .eq('board_id', boardId)
      .order('version_index', { ascending: true });

    if (fetchError) throw new Error(fetchError.message);
    if (!data || data.length === 0) {
      if (mode === 'initial') throw new Error('Board not found');
      return;
    }

    const firstRow = data[0];
    if (firstRow.yjs_state) {
      Y.applyUpdate(doc, decodeBinary(firstRow.yjs_state), providerOriginRef.current);
      needsSnapshotBootstrapRef.current = true;
      return;
    }

    if (mode === 'initial') {
      const loadedVersions = data.map(rowToItinerary);
      store.versions.splice(0, store.versions.length, ...loadedVersions);
      needsSnapshotBootstrapRef.current = true;
    }
  }, [boardId, doc, store, supabase]);

  // ---------------------------------------------------------------------------
  // Peer sync helpers (unchanged — broadcast is still the real-time channel)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Revision-gated refresh (replaces 10s polling)
  // ---------------------------------------------------------------------------
  const refreshFromSupabase = useCallback(async () => {
    try {
      await loadFromSupabase('resync');
    } catch (e) {
      console.error('Failed to refresh from Supabase:', e);
    }
  }, [loadFromSupabase]);

  // ---------------------------------------------------------------------------
  // Initial data load
  // ---------------------------------------------------------------------------
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

  // Bootstrap: migrate legacy data → board_documents on first sync
  useEffect(() => {
    if (loading || !needsSnapshotBootstrapRef.current) return;
    needsSnapshotBootstrapRef.current = false;
    // Send full Yjs state as the initial "diff" to seed board_documents
    pendingDiffRef.current = Y.encodeStateAsUpdate(doc);
    markDirtyAndScheduleSync();
  }, [loading, markDirtyAndScheduleSync, doc]);

  // ---------------------------------------------------------------------------
  // Realtime: broadcast (peer sync) + postgres_changes (revision notifications)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (loading) return;

    const channel = supabase.channel(`board-${boardId}-yjs`, {
      config: { broadcast: { ack: false } },
    });
    channelRef.current = channel;

    channel
      // --- Peer Yjs updates via broadcast ---
      .on('broadcast', { event: YJS_UPDATE_EVENT }, ({ payload }) => {
        const nextPayload = payload as YjsUpdatePayload;
        if (!nextPayload || nextPayload.sessionId === sessionId) return;
        Y.applyUpdate(doc, decodeBinary(nextPayload.update), providerOriginRef.current);
        // The author persists; receivers do NOT re-write to DB.
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
      })
      // --- DB revision notifications (replaces 10s anti-entropy polling) ---
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_documents',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const newRevision = (payload.new as { revision?: number }).revision;
          if (typeof newRevision === 'number' && newRevision > localRevisionRef.current) {
            void refreshFromSupabase();
          }
        },
      )
      .subscribe((status, err) => {
        if (err) console.error('Realtime error:', err);
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          void (async () => {
            await refreshFromSupabase();
            requestPeerSync();
            flushPendingUpdates();
            if (pendingDiffRef.current) {
              scheduleSyncToSupabase();
            }
          })();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          subscribedRef.current = false;
        }
      });

    // --- Local Yjs changes → accumulate diff + broadcast ---
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === providerOriginRef.current) return;

      // Accumulate diff for DB persistence
      pendingDiffRef.current = pendingDiffRef.current
        ? Y.mergeUpdates([pendingDiffRef.current, update])
        : update;

      markDirtyAndScheduleSync();
      sendDocumentUpdate(update);
    };

    doc.on('update', onUpdate);

    // --- Visibility / focus handlers ---
    const handleResume = () => {
      if (!subscribedRef.current) return;
      void refreshFromSupabase();
      requestPeerSync();
      if (pendingDiffRef.current) {
        scheduleSyncToSupabase();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
        return;
      }
      // Flush pending diffs when tab goes hidden
      if (pendingDiffRef.current) {
        void syncToSupabase();
      }
    };

    const handlePageHide = () => {
      if (pendingDiffRef.current) {
        void syncToSupabase();
      }
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      doc.off('update', onUpdate);
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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
    };
  }, []);

  return { loading, error, supabase };
}
