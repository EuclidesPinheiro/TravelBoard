import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { CursorPosition, PresencePayload, RemoteUser, LocalUser } from '../types/presence';
import { Traveler } from '../types';
import { assignColorIndex, getPresenceColor } from '../utils/presenceColors';
import { generatePresenceName } from '../utils/generatePresenceName';

const PRESENCE_STORAGE_PREFIX = 'travelboard_presence_';
const CURSOR_THROTTLE_MS = 50;

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
  const remoteCursorsRef = useRef(new Map<string, CursorPosition | null>());

  // --- Color assignment ---
  const colorIndex = useMemo(() => {
    const existingIndices = remoteUsers.map((u) => u.colorIndex);
    return assignColorIndex(sessionId, existingIndices);
  }, [sessionId, remoteUsers]);

  const localUser: LocalUser = useMemo(() => ({
    sessionId,
    displayName: displayName || 'Anonymous',
    color: getPresenceColor(colorIndex),
    colorIndex,
  }), [sessionId, displayName, colorIndex]);

  // --- Channel refs ---
  const cursorRef = useRef<CursorPosition | null>(null);
  const lastTrackTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null);

  // Track presence on the channel
  const trackPresence = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const payload: PresencePayload = {
      sessionId,
      displayName: displayName || 'Anonymous',
      colorIndex,
      cursor: cursorRef.current,
    };
    channel.track(payload);
  }, [sessionId, displayName, colorIndex]);

  // Re-track when name or colorIndex changes
  useEffect(() => {
    if (!loading && channelRef.current) {
      trackPresence();
    }
  }, [trackPresence, loading]);

  // --- Channel setup ---
  useEffect(() => {
    if (loading) return;

    const channel = supabase.channel(`board-${boardId}-presence`);
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      const newUsers: RemoteUser[] = [];
      const newCursors = new Map<string, CursorPosition | null>();

      for (const key of Object.keys(state)) {
        for (const presence of state[key]) {
          if (presence.sessionId === sessionId) continue;
          newUsers.push({
            sessionId: presence.sessionId,
            displayName: presence.displayName,
            colorIndex: presence.colorIndex,
            color: getPresenceColor(presence.colorIndex),
          });
          newCursors.set(presence.sessionId, presence.cursor);
        }
      }

      // Cursor positions update the ref (no re-render)
      remoteCursorsRef.current = newCursors;

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
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const now = performance.now();
      if (now - lastTrackTimeRef.current < CURSOR_THROTTLE_MS) return;
      lastTrackTimeRef.current = now;
      trackPresence();
    });
  }, [trackPresence]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return {
    localUser, remoteUsers, remoteCursorsRef, updateCursor,
    setDisplayName, needsNameSelection,
  };
}
