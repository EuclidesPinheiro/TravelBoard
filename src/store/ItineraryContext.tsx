import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Itinerary, SelectionType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { syncedStore, getYjsDoc, observeDeep } from '@syncedstore/core';
import { deepCloneItinerary, cleanupOrphanedCityData, syncTravelSegments, FocusedCell } from './helpers';
import { useUndoRedo } from './useUndoRedo';
import { useCopyPaste } from './useCopyPaste';
import { useSupabaseSync } from './useSupabaseSync';
import { usePresence } from './usePresence';
import { createBoardSupabaseClient } from '../lib/supabase';
import { CursorPosition, RemoteCursorState, RemoteUser, LocalUser } from '../types/presence';

export const ZOOM_MIN = 40;
export const ZOOM_MAX = 500;
export const ZOOM_DEFAULT = 80;
export const ZOOM_BUTTON_STEP = 20;
export const ZOOM_WHEEL_STEP = 8;

interface ItineraryContextType {
  itinerary: Itinerary;
  setItinerary: React.Dispatch<React.SetStateAction<Itinerary>>;
  versions: Itinerary[];
  activeVersionIndex: number;
  switchVersion: (index: number) => void;
  cloneVersion: () => void;
  deleteVersion: (index: number) => void;
  selection: SelectionType;
  setSelection: React.Dispatch<React.SetStateAction<SelectionType>>;
  focusedCell: FocusedCell | null;
  setFocusedCell: (cell: FocusedCell | null) => void;
  copy: () => void;
  paste: () => void;
  highlightedTravelerId: string | null;
  setHighlightedTravelerId: React.Dispatch<React.SetStateAction<string | null>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  boardId: string;
  isMarqueeActive: boolean;
  setIsMarqueeActive: (active: boolean) => void;
  localUser: LocalUser;
  remoteUsers: RemoteUser[];
  remoteCursorsRef: React.RefObject<Map<string, RemoteCursorState>>;
  updateCursor: (pos: CursorPosition | null) => void;
  setDisplayName: (name: string) => void;
  needsNameSelection: boolean;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

interface ItineraryProviderProps {
  children: ReactNode;
  boardId: string;
  accessToken: string;
}

export function ItineraryProvider({ children, boardId, accessToken }: ItineraryProviderProps) {
  // --- Yjs / SyncedStore ---
  const { store, doc } = useMemo(() => {
    const s = syncedStore({ versions: [] as Itinerary[] });
    return { store: s, doc: getYjsDoc(s) };
  }, [boardId]);

  const [, setTick] = useState(0);
  useEffect(() => {
    return observeDeep(store, () => {
      setTick((t) => t + 1);
    });
  }, [store]);

  const versions = store.versions as Itinerary[];

  // --- UI State ---
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);
  const [selection, setSelection] = useState<SelectionType>([]);
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const [highlightedTravelerId, setHighlightedTravelerId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_DEFAULT);
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);

  // --- Derived State ---
  const safeIndex = Math.min(activeVersionIndex, Math.max(versions.length - 1, 0));
  const itinerary = versions[safeIndex] || null;

  // --- Session ID (shared between sync + presence) ---
  const sessionId = useMemo(() => uuidv4(), [boardId]); // eslint-disable-line react-hooks/exhaustive-deps
  const presenceSupabase = useMemo(() => createBoardSupabaseClient(accessToken), [accessToken]);

  // --- Composed Hooks ---
  const { loading, error } = useSupabaseSync(boardId, accessToken, store, doc, sessionId);
  const { pushUndo, undo: undoRaw, redo: redoRaw, canUndo, canRedo, skipSnapshotRef } = useUndoRedo(store, safeIndex);
  const {
    localUser, remoteUsers, remoteCursorsRef, updateCursor, setDisplayName, needsNameSelection,
  } = usePresence(boardId, presenceSupabase, sessionId, loading, itinerary?.travelers ?? []);

  const setItinerary: React.Dispatch<React.SetStateAction<Itinerary>> = useCallback((action) => {
    if (!skipSnapshotRef.current) {
      pushUndo({
        versions: JSON.parse(JSON.stringify(store.versions)),
        activeVersionIndex: safeIndex,
      });
    }

    const plainCurrent = JSON.parse(JSON.stringify(store.versions[safeIndex]));
    let newItinerary = typeof action === 'function' ? action(plainCurrent) : action;
    // Ensure the result is fully plain — updater closures may capture Yjs proxies
    // from component props (e.g. spreading itinerary.attractions), which would
    // corrupt the store when spliced back in.
    newItinerary = JSON.parse(JSON.stringify(newItinerary));
    newItinerary = cleanupOrphanedCityData(newItinerary);
    newItinerary = syncTravelSegments(newItinerary);

    if (JSON.stringify(plainCurrent) !== JSON.stringify(newItinerary)) {
      doc.transact(() => {
        // Deep update to avoid large Yjs diffs from full object replacement
        const updateNode = (target: any, source: any) => {
          if (Array.isArray(source)) {
            if (target.length !== source.length) {
              target.splice(0, target.length, ...source);
            } else {
              for (let i = 0; i < source.length; i++) {
                if (typeof source[i] === 'object' && source[i] !== null) {
                  updateNode(target[i], source[i]);
                } else if (target[i] !== source[i]) {
                  target[i] = source[i];
                }
              }
            }
          } else {
            for (const key in source) {
              if (typeof source[key] === 'object' && source[key] !== null) {
                if (!target[key]) {
                  target[key] = source[key];
                } else {
                  updateNode(target[key], source[key]);
                }
              } else if (target[key] !== source[key]) {
                target[key] = source[key];
              }
            }
            // Remove deleted keys
            for (const key in target) {
              if (!(key in source)) {
                delete target[key];
              }
            }
          }
        };
        updateNode(store.versions[safeIndex], newItinerary);
      });
    }
  }, [safeIndex, store, doc, pushUndo, skipSnapshotRef]);

  const { copy, paste } = useCopyPaste(itinerary, selection, focusedCell, setItinerary);

  // --- Undo/Redo wrappers ---
  const undo = useCallback(() => {
    const idx = undoRaw();
    if (idx !== null) { setActiveVersionIndex(idx); setSelection([]); }
  }, [undoRaw]);
  const redo = useCallback(() => {
    const idx = redoRaw();
    if (idx !== null) { setActiveVersionIndex(idx); setSelection([]); }
  }, [redoRaw]);

  // --- Version management ---
  const switchVersion = (index: number) => { setActiveVersionIndex(index); setSelection([]); setFocusedCell(null); };

  const cloneVersion = useCallback(() => {
    if (!itinerary) return;
    pushUndo({ versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex });
    const cloned = deepCloneItinerary(JSON.parse(JSON.stringify(itinerary)));
    store.versions.push(cloned);
    setActiveVersionIndex(store.versions.length - 1);
    setSelection([]);
  }, [itinerary, store, safeIndex, pushUndo]);

  const deleteVersion = useCallback((index: number) => {
    if (store.versions.length <= 1) return;
    pushUndo({ versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex });
    store.versions.splice(index, 1);
    if (activeVersionIndex >= index && activeVersionIndex > 0) setActiveVersionIndex(prev => prev - 1);
    setSelection([]);
  }, [store, safeIndex, activeVersionIndex, pushUndo]);

  // --- Render ---
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-slate-500">Loading board...</p>
      </div>
    </div>
  );

  if (error || !itinerary) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-950 rounded-2xl shadow-lg p-8 max-w-md text-center">
        <p className="text-red-600 font-medium mb-2">Board not found</p>
        <p className="text-slate-500 text-sm">{error || 'No data available for this board.'}</p>
        <a href="/" className="inline-block mt-4 text-blue-600 hover:underline text-sm">Back to home</a>
      </div>
    </div>
  );

  return (
    <ItineraryContext.Provider value={{
      itinerary, setItinerary, versions, activeVersionIndex: safeIndex, switchVersion, cloneVersion, deleteVersion,
      selection, setSelection, focusedCell, setFocusedCell, copy, paste, highlightedTravelerId, setHighlightedTravelerId,
      zoomLevel, setZoomLevel, undo, redo, canUndo, canRedo, boardId,
      isMarqueeActive, setIsMarqueeActive,
      localUser, remoteUsers, remoteCursorsRef, updateCursor, setDisplayName, needsNameSelection,
    }}>
      {children}
    </ItineraryContext.Provider>
  );
}

export function useItinerary() {
  const context = useContext(ItineraryContext);
  if (context === undefined) throw new Error('useItinerary must be used within an ItineraryProvider');
  return context;
}
