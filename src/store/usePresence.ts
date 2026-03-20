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
const PRESENCE_LEAVE_GRACE_MS = 5_000;

function sameRemoteUsers(a: RemoteUser[], b: RemoteUser[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((user, index) =>
    user.sessionId === b[index].sessionId &&
    user.displayName === b[index].displayName &&
    user.colorIndex === b[index].colorIndex,
  );
}

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
  const remoteUsersStateRef = useRef<RemoteUser[]>([]);
  // Cursor positions live in a ref to avoid React re-renders on every move
  const remoteCursorsRef = useRef<Map<string, RemoteCursorState>>(new Map());
  const pendingRemovalTimeoutsRef = useRef<Map<string, number>>(new Map());

  // Keep the presence identity stable for the whole session. Recomputing it from
  // remote presence state can make this client appear to leave/rejoin as peers change.
  const colorIndexRef = useRef(assignColorIndex(sessionId, []));
  const colorIndex = colorIndexRef.current;

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
  const subscribedRef = useRef(false);

  useEffect(() => {
    remoteUsersStateRef.current = remoteUsers;
  }, [remoteUsers]);

  const clearPendingRemoval = useCallback((sessionIdToKeep: string) => {
    const timeoutId = pendingRemovalTimeoutsRef.current.get(sessionIdToKeep);
    if (timeoutId === undefined) return;
    clearTimeout(timeoutId);
    pendingRemovalTimeoutsRef.current.delete(sessionIdToKeep);
  }, []);

  const removeRemoteUser = useCallback((sessionIdToRemove: string) => {
    clearPendingRemoval(sessionIdToRemove);
    setRemoteUsers((prev) => prev.filter((user) => user.sessionId !== sessionIdToRemove));

    const nextCursors = new Map(remoteCursorsRef.current);
    nextCursors.delete(sessionIdToRemove);
    remoteCursorsRef.current = nextCursors;
  }, [clearPendingRemoval]);

  const scheduleRemoteUserRemoval = useCallback((sessionIdToRemove: string) => {
    if (pendingRemovalTimeoutsRef.current.has(sessionIdToRemove)) return;

    const timeoutId = window.setTimeout(() => {
      pendingRemovalTimeoutsRef.current.delete(sessionIdToRemove);
      removeRemoteUser(sessionIdToRemove);
    }, PRESENCE_LEAVE_GRACE_MS);

    pendingRemovalTimeoutsRef.current.set(sessionIdToRemove, timeoutId);
  }, [removeRemoteUser]);

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
    if (!channel || !subscribedRef.current) return;

    lastCursorSendTimeRef.current = performance.now();
    const payload: CursorBroadcastPayload = {
      sessionId,
      cursor: cursorRef.current,
      sentAt: Date.now(),
    };
    void channel.send({
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
    if (!loading && channelRef.current && subscribedRef.current) {
      void trackPresence();
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
      for (const user of newUsers) {
        clearPendingRemoval(user.sessionId);
      }

      for (const user of remoteUsersStateRef.current) {
        if (!activeIds.has(user.sessionId)) {
          scheduleRemoteUserRemoval(user.sessionId);
        }
      }

      const retainedUsers = remoteUsersStateRef.current.filter(
        (user) => !activeIds.has(user.sessionId) && pendingRemovalTimeoutsRef.current.has(user.sessionId),
      );
      const mergedUsers = [...newUsers];
      for (const user of retainedUsers) {
        if (!mergedUsers.some((nextUser) => nextUser.sessionId === user.sessionId)) {
          mergedUsers.push(user);
        }
      }

      mergedUsers.sort((a, b) =>
        a.displayName.localeCompare(b.displayName) || a.sessionId.localeCompare(b.sessionId),
      );

      setRemoteUsers((prev) => sameRemoteUsers(prev, mergedUsers) ? prev : mergedUsers);
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

      for (const leavingId of leavingIds) {
        scheduleRemoteUserRemoval(leavingId);
      }
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
        subscribedRef.current = true;
        void trackPresence();
        if (cursorRef.current !== null) {
          flushCursorBroadcast();
        }
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        subscribedRef.current = false;
      }
    });

    return () => {
      subscribedRef.current = false;
      for (const timeoutId of pendingRemovalTimeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }
      pendingRemovalTimeoutsRef.current.clear();
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [boardId, loading, supabase, sessionId, clearPendingRemoval, scheduleRemoteUserRemoval]); // eslint-disable-line react-hooks/exhaustive-deps

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
