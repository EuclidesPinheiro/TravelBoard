import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CursorBroadcastPayload,
  CursorPosition,
  PresencePayload,
  RemoteCursorState,
  RemoteUser,
  LocalUser,
} from '../types/presence';
import { Traveler } from '../types';
import { assignColorIndex, getPresenceColor } from '../utils/presenceColors';
import { generatePresenceName } from '../utils/generatePresenceName';

const PRESENCE_STORAGE_PREFIX = 'travelboard_presence_';
const CURSOR_BROADCAST_INTERVAL_MS = 33;

export function usePresence(
  boardId: string,
  supabase: SupabaseClient,
  sessionId: string,
  loading: boolean,
  travelers: Traveler[],
) {
  const storageKey = `${PRESENCE_STORAGE_PREFIX}${boardId}`;

  // --- Display name ---
  const savedName = useMemo(
    () => sessionStorage.getItem(storageKey),
    [storageKey],
  );
  const [displayName, setDisplayNameState] = useState(savedName ?? '');
  const [needsNameSelection, setNeedsNameSelection] = useState(false);
  const nameResolvedRef = useRef(!!savedName);

  // Resolve name once after loading completes
  useEffect(() => {
    if (loading || nameResolvedRef.current) return;
    nameResolvedRef.current = true;
    if (travelers.length > 0) {
      setNeedsNameSelection(true);
    } else {
      const name = generatePresenceName();
      setDisplayNameState(name);
      sessionStorage.setItem(storageKey, name);
    }
  }, [loading, travelers.length, storageKey]);

  const setDisplayName = useCallback((name: string) => {
    setDisplayNameState(name);
    sessionStorage.setItem(storageKey, name);
    setNeedsNameSelection(false);
  }, [storageKey]);

  // --- Remote users (metadata only — no cursor positions) ---
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  // Cursor positions live in a ref to avoid React re-renders on every move
  const remoteCursorsRef = useRef<Map<string, RemoteCursorState>>(new Map());

  // --- Color assignment ---
  const colorIndex = useMemo(() => {
    const existingIndices = remoteUsers.map((u) => u.colorIndex);
    return assignColorIndex(sessionId, existingIndices);
  }, [sessionId, remoteUsers]);

  // Use the matched traveler's color when the name matches, otherwise fallback to presence palette
  const localUser: LocalUser = useMemo(() => {
    const traveler = travelers.find((t) => t.name === displayName);
    return {
      sessionId,
      displayName: displayName || 'Anonymous',
      color: traveler?.color ?? getPresenceColor(colorIndex),
      colorIndex,
    };
  }, [sessionId, displayName, colorIndex, travelers]);

  // --- Channel refs ---
  const cursorRef = useRef<CursorPosition | null>(null);
  const lastCursorSendTimeRef = useRef(0);
  const cursorAnimationFrameRef = useRef<number | null>(null);
  const cursorFlushTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null);

  // Track presence on the channel
  const trackPresence = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const payload: PresencePayload = {
      sessionId,
      displayName: displayName || 'Anonymous',
      colorIndex,
    };
    channel.track(payload);
  }, [sessionId, displayName, colorIndex]);

  const flushCursorBroadcast = useCallback(() => {
    cursorFlushTimeoutRef.current = null;
    cursorAnimationFrameRef.current = null;
    const channel = channelRef.current;
    if (!channel) return;

    lastCursorSendTimeRef.current = performance.now();
    const payload: CursorBroadcastPayload = {
      sessionId,
      cursor: cursorRef.current,
      sentAt: Date.now(),
    };
    channel.send({
      type: 'broadcast',
      event: 'cursor-pos',
      payload,
    });
  }, [sessionId]);

  const scheduleCursorBroadcast = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastCursorSendTimeRef.current;

    if (elapsed >= CURSOR_BROADCAST_INTERVAL_MS) {
      if (cursorFlushTimeoutRef.current !== null) {
        clearTimeout(cursorFlushTimeoutRef.current);
        cursorFlushTimeoutRef.current = null;
      }
      flushCursorBroadcast();
      return;
    }

    if (cursorFlushTimeoutRef.current !== null) return;

    cursorFlushTimeoutRef.current = window.setTimeout(() => {
      flushCursorBroadcast();
    }, CURSOR_BROADCAST_INTERVAL_MS - elapsed);
  }, [flushCursorBroadcast]);

  // Re-track when name or colorIndex changes
  useEffect(() => {
    if (!loading && channelRef.current) {
      trackPresence();
    }
  }, [trackPresence, loading]);

  // --- Channel setup ---
  useEffect(() => {
    if (loading) return;

    const channel = supabase.channel(`board-${boardId}-presence`, {
      config: {
        broadcast: { ack: false },
        presence: { key: sessionId },
      },
    });
    channelRef.current = channel;

    const syncRemoteUsers = () => {
      const state = channel.presenceState<PresencePayload>();
      const newUsers: RemoteUser[] = [];

      for (const key of Object.keys(state)) {
        for (const presence of state[key]) {
          if (presence.sessionId === sessionId) continue;
          newUsers.push({
            sessionId: presence.sessionId,
            displayName: presence.displayName,
            colorIndex: presence.colorIndex,
            color: getPresenceColor(presence.colorIndex),
          });
        }
      }

      newUsers.sort((a, b) =>
        a.displayName.localeCompare(b.displayName) || a.sessionId.localeCompare(b.sessionId),
      );

      const activeIds = new Set<string>(newUsers.map((user) => user.sessionId));
      const nextCursors = new Map(remoteCursorsRef.current);
      for (const sessionKey of Array.from(nextCursors.keys()) as string[]) {
        if (!activeIds.has(sessionKey)) {
          nextCursors.delete(sessionKey);
        }
      }
      remoteCursorsRef.current = nextCursors;

      // Only update React state when the user list actually changes
      setRemoteUsers((prev) => {
        if (prev.length !== newUsers.length) return newUsers;
        const changed = newUsers.some((u, i) =>
          u.sessionId !== prev[i].sessionId ||
          u.displayName !== prev[i].displayName ||
          u.colorIndex !== prev[i].colorIndex,
        );
        return changed ? newUsers : prev;
      });
    };

    channel.on('presence', { event: 'sync' }, syncRemoteUsers);
    channel.on('presence', { event: 'join' }, syncRemoteUsers);
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      syncRemoteUsers();
      if (!leftPresences) return;

      const leavingIds = new Set(
        leftPresences
          .map((presence) => presence.sessionId)
          .filter((id): id is string => typeof id === 'string'),
      );
      if (leavingIds.size === 0) return;

      const next = new Map(remoteCursorsRef.current);
      for (const leavingId of leavingIds) {
        next.delete(leavingId);
      }
      remoteCursorsRef.current = next;
    });
    channel.on('broadcast', { event: 'cursor-pos' }, (payload) => {
      const nextPayload = payload.payload as CursorBroadcastPayload;
      if (!nextPayload || nextPayload.sessionId === sessionId) return;

      const next = new Map(remoteCursorsRef.current);
      next.set(nextPayload.sessionId, {
        cursor: nextPayload.cursor,
        lastUpdatedAt: nextPayload.sentAt || Date.now(),
      });
      remoteCursorsRef.current = next;
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        trackPresence();
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [boardId, loading, supabase, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Throttled local cursor update ---
  const updateCursor = useCallback((pos: CursorPosition | null) => {
    cursorRef.current = pos;
    if (cursorAnimationFrameRef.current !== null) return;

    cursorAnimationFrameRef.current = requestAnimationFrame(() => {
      scheduleCursorBroadcast();
    });
  }, [scheduleCursorBroadcast]);

  useEffect(() => {
    return () => {
      if (cursorAnimationFrameRef.current !== null) {
        cancelAnimationFrame(cursorAnimationFrameRef.current);
      }
      if (cursorFlushTimeoutRef.current !== null) {
        clearTimeout(cursorFlushTimeoutRef.current);
      }
    };
  }, []);

  // Resolve remote user colors: traveler color when name matches, otherwise presence palette
  const resolvedRemoteUsers = useMemo(() =>
    remoteUsers.map((u) => {
      const traveler = travelers.find((t) => t.name === u.displayName);
      return traveler ? { ...u, color: traveler.color } : u;
    }),
    [remoteUsers, travelers],
  );

  return {
    localUser, remoteUsers: resolvedRemoteUsers, remoteCursorsRef, updateCursor,
    setDisplayName, needsNameSelection,
  };
}
