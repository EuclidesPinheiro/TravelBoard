import React, { useRef, useEffect, useCallback } from 'react';
import { useItinerary } from '../../store/ItineraryContext';

const CURSOR_FADE_AFTER_MS = 2500;
const CURSOR_HIDE_AFTER_MS = 10000;
const CURSOR_INSET = 10;
const CURSOR_WIDTH = 18;
const CURSOR_HEIGHT = 22;
const LABEL_EDGE_BUFFER = 160;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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
  const labelElemsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const displayPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number | null>(null);

  const updatePositions = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const scrollLeft = scrollEl.scrollLeft;
    const scrollTop = scrollEl.scrollTop;
    const rect = scrollEl.getBoundingClientRect();
    const now = Date.now();
    const cursors = remoteCursorsRef.current;

    for (const user of remoteUsers) {
      const elem = cursorElemsRef.current.get(user.sessionId);
      const label = labelElemsRef.current.get(user.sessionId);
      if (!elem) continue;

      const state = cursors.get(user.sessionId);
      const cursor = state?.cursor;
      const age = state ? now - state.lastUpdatedAt : CURSOR_HIDE_AFTER_MS + 1;
      if (!cursor || age > CURSOR_HIDE_AFTER_MS) {
        elem.style.display = 'none';
        displayPosRef.current.delete(user.sessionId);
        continue;
      }

      const viewportX = cursor.x - scrollLeft;
      const viewportY = cursor.y - scrollTop;
      const targetX = clamp(viewportX, CURSOR_INSET, rect.width - CURSOR_WIDTH - CURSOR_INSET);
      const targetY = clamp(viewportY, CURSOR_INSET, rect.height - CURSOR_HEIGHT - CURSOR_INSET);
      const offscreen = viewportX !== targetX || viewportY !== targetY;

      const previousDisplayPos = displayPosRef.current.get(user.sessionId) ?? { x: targetX, y: targetY };
      const nextDisplayPos = {
        x: previousDisplayPos.x + (targetX - previousDisplayPos.x) * 0.35,
        y: previousDisplayPos.y + (targetY - previousDisplayPos.y) * 0.35,
      };
      if (Math.abs(nextDisplayPos.x - targetX) < 0.5) nextDisplayPos.x = targetX;
      if (Math.abs(nextDisplayPos.y - targetY) < 0.5) nextDisplayPos.y = targetY;
      displayPosRef.current.set(user.sessionId, nextDisplayPos);

      elem.style.display = '';
      elem.style.transform = `translate3d(${nextDisplayPos.x}px, ${nextDisplayPos.y}px, 0)`;

      const fadeProgress = Math.min(Math.max((age - CURSOR_FADE_AFTER_MS) / (CURSOR_HIDE_AFTER_MS - CURSOR_FADE_AFTER_MS), 0), 1);
      const baseOpacity = 1 - fadeProgress * 0.6;
      elem.style.opacity = `${offscreen ? baseOpacity * 0.72 : baseOpacity}`;

      if (label) {
        const placeLabelLeft = targetX > rect.width - LABEL_EDGE_BUFFER;
        const placeLabelAbove = targetY > rect.height - 56;
        label.style.left = placeLabelLeft ? '-8px' : '12px';
        label.style.right = placeLabelLeft ? '12px' : 'auto';
        label.style.top = placeLabelAbove ? '-6px' : '18px';
        label.style.bottom = placeLabelAbove ? '18px' : 'auto';
        label.style.transform = placeLabelLeft
          ? `translateX(-100%)${placeLabelAbove ? ' translateY(-100%)' : ''}`
          : (placeLabelAbove ? 'translateY(-100%)' : 'none');
      }
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
    for (const id of displayPosRef.current.keys()) {
      if (!activeIds.has(id)) {
        displayPosRef.current.delete(id);
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

  const setLabelRef = useCallback((sessionId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      labelElemsRef.current.set(sessionId, el);
    } else {
      labelElemsRef.current.delete(sessionId);
    }
  }, []);

  if (remoteUsers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[90] overflow-hidden">
      {remoteUsers.map((user) => (
        <div
          key={user.sessionId}
          ref={setElemRef(user.sessionId)}
          className="absolute top-0 left-0 transition-opacity duration-200"
          style={{ display: 'none', willChange: 'transform' }}
        >
          <CursorSvg color={user.color} />
          <div
            ref={setLabelRef(user.sessionId)}
            className="absolute px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-[0_6px_16px_rgba(15,23,42,0.38)]"
            style={{ backgroundColor: user.color }}
          >
            {user.displayName}
          </div>
        </div>
      ))}
    </div>
  );
}
