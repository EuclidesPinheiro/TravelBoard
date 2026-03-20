import React, { useRef, useEffect, useCallback } from 'react';
import { useItinerary } from '../../store/ItineraryContext';

const SIDEBAR_WIDTH = 256;
const HEADER_HEIGHT = 56;
const STALE_MS = 3000;

function CursorSvg({ color }: { color: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1 1L7.5 20L10 12L18 9.5L1 1Z"
        fill={color}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface RemoteCursorsProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function RemoteCursors({ scrollRef }: RemoteCursorsProps) {
  const { remoteUsers, remoteCursorsRef } = useItinerary();
  const cursorElemsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  const prevPosRef = useRef<Map<string, string>>(new Map());
  const rafRef = useRef<number | null>(null);

  const updatePositions = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const scrollLeft = scrollEl.scrollLeft;
    const scrollTop = scrollEl.scrollTop;
    const rect = scrollEl.getBoundingClientRect();
    const now = performance.now();
    const cursors = remoteCursorsRef.current;

    for (const user of remoteUsers) {
      const elem = cursorElemsRef.current.get(user.sessionId);
      if (!elem) continue;

      const cursor = cursors.get(user.sessionId);
      if (!cursor) {
        elem.style.display = 'none';
        continue;
      }

      const viewportX = cursor.x - scrollLeft;
      const viewportY = cursor.y - scrollTop;

      if (viewportX < SIDEBAR_WIDTH || viewportY < HEADER_HEIGHT || viewportX > rect.width || viewportY > rect.height) {
        elem.style.display = 'none';
        continue;
      }

      elem.style.display = '';
      elem.style.transform = `translate3d(${viewportX}px, ${viewportY}px, 0)`;

      // Track staleness by detecting position changes
      const posKey = `${cursor.x},${cursor.y}`;
      if (prevPosRef.current.get(user.sessionId) !== posKey) {
        lastUpdateRef.current.set(user.sessionId, now);
        prevPosRef.current.set(user.sessionId, posKey);
      }
      const lastUpdate = lastUpdateRef.current.get(user.sessionId) ?? now;
      elem.style.opacity = (now - lastUpdate) > STALE_MS ? '0.3' : '1';
    }
  }, [remoteUsers, scrollRef, remoteCursorsRef]);

  // rAF loop — only runs when there are remote users
  useEffect(() => {
    if (remoteUsers.length === 0) return;

    function loop() {
      updatePositions();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [updatePositions, remoteUsers.length]);

  // Cleanup stale tracking entries when users leave
  useEffect(() => {
    const activeIds = new Set(remoteUsers.map((u) => u.sessionId));
    for (const id of lastUpdateRef.current.keys()) {
      if (!activeIds.has(id)) {
        lastUpdateRef.current.delete(id);
        prevPosRef.current.delete(id);
      }
    }
  }, [remoteUsers]);

  const setElemRef = useCallback((sessionId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      cursorElemsRef.current.set(sessionId, el);
    } else {
      cursorElemsRef.current.delete(sessionId);
    }
  }, []);

  if (remoteUsers.length === 0) return null;

  return (
    <div
      className="pointer-events-none z-[90]"
      style={{ position: 'sticky', top: 0, left: 0, width: 0, height: 0, overflow: 'visible' }}
    >
      {remoteUsers.map((user) => (
        <div
          key={user.sessionId}
          ref={setElemRef(user.sessionId)}
          className="absolute top-0 left-0 transition-opacity duration-300"
          style={{ display: 'none', willChange: 'transform' }}
        >
          <CursorSvg color={user.color} />
          <div
            className="absolute top-5 left-3 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
            style={{ backgroundColor: user.color }}
          >
            {user.displayName}
          </div>
        </div>
      ))}
    </div>
  );
}
