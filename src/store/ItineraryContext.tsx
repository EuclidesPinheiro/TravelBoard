import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
import { Itinerary, SelectionType, CitySegment, Segment } from '../types';
import { createBoardSupabaseClient } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { differenceInDays, parseISO, startOfDay, addDays, format } from 'date-fns';
import { syncedStore, getYjsDoc, observeDeep } from '@syncedstore/core';
import * as Y from 'yjs';
import base64js from 'base64-js';

const MAX_UNDO = 50;
const SYNC_DEBOUNCE_MS = 500;

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
  focusedCell: { travelerId: string; dayIndex: number } | null;
  setFocusedCell: (cell: { travelerId: string; dayIndex: number } | null) => void;
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
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

// --- Helpers ---

function deepCloneItinerary(it: Itinerary): Itinerary {
  return JSON.parse(JSON.stringify(it, (key, value) => {
    if (key === 'id') return uuidv4();
    return value;
  }));
}

function cleanupOrphanedCityData(it: Itinerary): Itinerary {
  const activeCities = new Set<string>();
  for (const t of it.travelers) {
    for (const seg of t.segments) {
      if (seg.type === "city") activeCities.add((seg as CitySegment).cityName);
    }
  }

  let changed = false;

  let attractions = it.attractions;
  if (attractions) {
    for (const city of Object.keys(attractions)) {
      if (!activeCities.has(city)) {
        changed = true;
        break;
      }
    }
    if (changed) {
      attractions = Object.fromEntries(
        Object.entries(attractions).filter(([city]) => activeCities.has(city)),
      );
    }
  }

  let checklists = it.checklists;
  if (checklists) {
    let clChanged = false;
    for (const city of Object.keys(checklists)) {
      if (!activeCities.has(city)) {
        clChanged = true;
        break;
      }
    }
    if (clChanged) {
      checklists = Object.fromEntries(
        Object.entries(checklists).filter(([city]) => activeCities.has(city)),
      );
      changed = true;
    }
  }

  return changed ? { ...it, attractions, checklists } : it;
}

function syncTravelSegments(it: Itinerary): Itinerary {
  return {
    ...it,
    travelers: it.travelers.map((t) => {
      // 1. Separate cities and existing transports
      const cities = t.segments
        .filter((s) => s.type === "city")
        .sort(
          (a, b) =>
            (a as CitySegment).startDate.localeCompare(
              (b as CitySegment).startDate,
            ) ||
            (a as CitySegment).startTime?.localeCompare(
              (b as CitySegment).startTime || "00:00",
            ) ||
            0,
        ) as CitySegment[];

      const existingTransports = t.segments.filter(
        (s) => s.type === "transport",
      ) as any[];

      // Map current transport positions to their data to try and preserve it even if cities rename
      // We can find where a transport WAS in the sequence of cities
      const oldCityOrder = t.segments
        .filter((s) => s.type === "city")
        .map((s) => s.id);

      const newSegments: Segment[] = [];

      for (let i = 0; i < cities.length; i++) {
        const currentCity = cities[i];
        newSegments.push(currentCity);

        if (i < cities.length - 1) {
          const nextCity = cities[i + 1];

          // 1. Try exact name match
          let transport = existingTransports.find(
            (tr) => tr.from === currentCity.cityName && tr.to === nextCity.cityName,
          );

          // 2. Try positional match if the IDs of the flanking cities matched an old pair
          if (!transport) {
            const oldIdxCurrent = oldCityOrder.indexOf(currentCity.id);
            const oldIdxNext = oldCityOrder.indexOf(nextCity.id);
            if (
              oldIdxCurrent !== -1 &&
              oldIdxNext !== -1 &&
              oldIdxNext === oldIdxCurrent + 1
            ) {
              // These cities were adjacent before! Find the transport that was between them.
              // In the original segments array, it would be at some index.
              // Actually, simpler: find transport that 'from' the old name of currentCity.
              // But we have the old segments, let's just find it.
              const oldSegIdx = t.segments.findIndex(s => s.id === currentCity.id);
              if (oldSegIdx !== -1 && oldSegIdx < t.segments.length - 1) {
                const maybeTrans = t.segments[oldSegIdx + 1];
                if (maybeTrans.type === 'transport') {
                  transport = maybeTrans;
                }
              }
            }
          }

          const departureDate = currentCity.endDate;
          const departureTime = currentCity.endTime || "23:59";
          const arrivalDate = nextCity.startDate;
          const arrivalTime = nextCity.startTime || "00:00";

          if (transport) {
            newSegments.push({
              ...transport,
              from: currentCity.cityName,
              to: nextCity.cityName,
              departureDate,
              departureTime,
              arrivalDate,
              arrivalTime,
            });
          } else {
            // Create new automatic transport
            newSegments.push({
              type: "transport",
              id: uuidv4(),
              mode: "flight", // default
              from: currentCity.cityName,
              to: nextCity.cityName,
              departureDate,
              departureTime,
              arrivalDate,
              arrivalTime,
            });
          }
        }
      }

      return { ...t, segments: newSegments };
    }),
  };
}

// --- DB row <-> Itinerary conversion ---

interface DbRow {
  id: string;
  board_id: string;
  version_index: number;
  name: string;
  start_date: string;
  end_date: string;
  travelers: any;
  attractions: any;
  checklists: any;
  session_id?: string;
  updated_at?: string;
  yjs_state?: string | null;
}

function rowToItinerary(row: DbRow): Itinerary {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    travelers: row.travelers || [],
    attractions: row.attractions || {},
    checklists: row.checklists || {},
  };
}

function itineraryToRow(
  itinerary: Itinerary,
  boardId: string,
  versionIndex: number,
  sessionId: string
): DbRow {
  return {
    id: itinerary.id,
    board_id: boardId,
    version_index: versionIndex,
    name: itinerary.name,
    start_date: itinerary.startDate,
    end_date: itinerary.endDate,
    travelers: itinerary.travelers,
    attractions: itinerary.attractions || {},
    checklists: itinerary.checklists || {},
    session_id: sessionId,
    updated_at: new Date().toISOString(),
  };
}

// --- Undo types ---

interface UndoEntry {
  versions: Itinerary[];
  activeVersionIndex: number;
}

// --- Provider ---

interface ItineraryProviderProps {
  children: ReactNode;
  boardId: string;
  accessToken: string;
}

export function ItineraryProvider({ children, boardId, accessToken }: ItineraryProviderProps) {
  const supabase = React.useMemo(
    () => createBoardSupabaseClient(accessToken),
    [accessToken],
  );

  // --- Yjs / SyncedStore ---
  const { store, doc } = useMemo(() => {
    const s = syncedStore({ versions: [] as Itinerary[] });
    return { store: s, doc: getYjsDoc(s) };
  }, [boardId]);

  // Local replacement for useSyncedStore to avoid React 19 / bundling issues
  const [, setTick] = useState(0);
  useEffect(() => {
    return observeDeep(store, () => {
      setTick((t) => t + 1);
    });
  }, [store]);

  const versions = store.versions as Itinerary[]; // Reactive proxy

  // --- Basic State ---
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<SelectionType>([]);
  const [focusedCell, setFocusedCell] = useState<{ travelerId: string; dayIndex: number } | null>(null);
  const [clipboard, setClipboard] = useState<{
    travelers: {
      relativeRowIndex: number;
      segments: Segment[];
    }[];
    anchorDayOffset: number;
  } | null>(null);

  const [highlightedTravelerId, setHighlightedTravelerId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_DEFAULT);
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);

  // --- Refs & Internal Sync State ---
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [undoRedoVersion, setUndoRedoVersion] = useState(0); 
  const skipSnapshotRef = useRef(false);
  const sessionIdRef = useRef(uuidv4());
  const syncTimeoutRef = useRef<number | null>(null);

  // --- Derived State ---
  const safeIndex = Math.min(activeVersionIndex, Math.max(versions.length - 1, 0));
  const itinerary = versions[safeIndex] || null;

  // --- Sync logic ---
  const syncToSupabase = useCallback(async () => {
    // Read the current state directly from the store
    const current = JSON.parse(JSON.stringify(store.versions)) as Itinerary[];
    if (current.length === 0) return;
    
    try {
      const yjsState = base64js.fromByteArray(Y.encodeStateAsUpdate(doc));

      const rows: DbRow[] = current.map((v, i) => {
        const row = itineraryToRow(v, boardId, i, sessionIdRef.current);
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

  // --- Mutation helpers ---
  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), entry];
    redoStackRef.current = [];
    setUndoRedoVersion(v => v + 1);
  }, []);

  const setItinerary: React.Dispatch<React.SetStateAction<Itinerary>> = useCallback((action) => {
    if (!skipSnapshotRef.current) {
      undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), { 
        versions: JSON.parse(JSON.stringify(store.versions)), 
        activeVersionIndex: safeIndex 
      }];
      redoStackRef.current = [];
      setUndoRedoVersion(v => v + 1);
    }
    
    const plainCurrent = JSON.parse(JSON.stringify(store.versions[safeIndex]));
    let newItinerary = typeof action === 'function' ? action(plainCurrent) : action;
    newItinerary = cleanupOrphanedCityData(newItinerary);
    newItinerary = syncTravelSegments(newItinerary);
    
    // Check if changed
    if (JSON.stringify(plainCurrent) !== JSON.stringify(newItinerary)) {
      store.versions.splice(safeIndex, 1, newItinerary);
    }
  }, [safeIndex, store, pushUndo]);

  // --- Data Loading & Realtime ---
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
          // Apply initial state with 'remote' origin to avoid triggering immediate broadcast/sync
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

  useEffect(() => {
    if (loading) return;
    
    const channel = supabase.channel(`board-${boardId}-yjs`, {
      config: { broadcast: { ack: false } },
    });

    channel
      .on('broadcast', { event: 'yjs-update' }, (payload) => {
        if (payload.payload.sessionId === sessionIdRef.current) return;
        console.log('Remote Yjs update received!');
        const update = new Uint8Array(payload.payload.update);
        Y.applyUpdate(doc, update, 'remote');
      })
      .subscribe((status, err) => {
        console.log('Realtime broadcast status:', status);
        if (err) console.error('Realtime broadcast error:', err);
      });

    const onUpdate = (update: Uint8Array, origin: any) => {
      // Only broadcast and sync if the change originated locally.
      // In SyncedStore, local mutations default to an origin of null.
      if (origin !== 'remote') {
        channel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: { update: Array.from(update), sessionId: sessionIdRef.current }
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

  // --- Navigation & Copy/Paste ---
  const getDayOffset = useCallback((dateStr: string) => {
    if (!itinerary) return 0;
    return differenceInDays(startOfDay(parseISO(dateStr)), startOfDay(parseISO(itinerary.startDate)));
  }, [itinerary]);

  const copy = useCallback(() => {
    if (!itinerary || selection.length === 0) return;
    const segmentSelection = selection.filter(s => s.type === 'city' || s.type === 'transport');
    if (segmentSelection.length === 0) return;
    
    console.log('Copying segments:', segmentSelection.length);

    const travelerIndices = new Map<string, number>();
    itinerary.travelers.forEach((t, i) => travelerIndices.set(t.id, i));
    
    const travelerGroups = new Map<string, Segment[]>();
    segmentSelection.forEach(sel => {
      const traveler = itinerary.travelers.find(t => t.id === (sel as any).travelerId);
      if (!traveler) return;
      const segment = traveler.segments.find(s => s.id === (sel as any).segmentId);
      if (!segment) return;
      if (!travelerGroups.has(traveler.id)) travelerGroups.set(traveler.id, []);
      travelerGroups.get(traveler.id)!.push(segment);
    });

    if (travelerGroups.size === 0) return;

    const sortedTravelerIds = Array.from(travelerGroups.keys()).sort((a, b) => travelerIndices.get(a)! - travelerIndices.get(b)!);
    const baseTravelerId = sortedTravelerIds[0];
    const baseTravelerIdx = travelerIndices.get(baseTravelerId)!;
    
    let minDay = Infinity;
    travelerGroups.forEach((segments) => {
      segments.forEach(seg => {
        if (seg.type === 'city') {
          minDay = Math.min(minDay, getDayOffset(seg.startDate));
        } else {
          minDay = Math.min(minDay, getDayOffset(seg.departureDate));
        }
      });
    });
    
    const anchorDayOffset = minDay;
    
    setClipboard({
      travelers: sortedTravelerIds.map(tid => ({
        relativeRowIndex: travelerIndices.get(tid)! - baseTravelerIdx,
        segments: JSON.parse(JSON.stringify(travelerGroups.get(tid)!)) as Segment[],
      })),
      anchorDayOffset,
    });
  }, [itinerary, selection, getDayOffset]);

  const paste = useCallback(() => {
    if (!itinerary || !clipboard || !focusedCell) {
      console.log('Paste conditions not met:', { itinerary: !!itinerary, clipboard: !!clipboard, focusedCell: !!focusedCell });
      return;
    }

    console.log('Pasting onto:', focusedCell.travelerId, 'at day', focusedCell.dayIndex);
    
    const targetTravelerIdx = itinerary.travelers.findIndex(t => t.id === focusedCell.travelerId);
    if (targetTravelerIdx === -1) return;
    const dayShift = focusedCell.dayIndex - clipboard.anchorDayOffset;
    setItinerary(prev => {
      const newItinerary = { ...prev, travelers: [...prev.travelers] };
      clipboard.travelers.forEach(cbTraveler => {
        const travelerIdx = targetTravelerIdx + cbTraveler.relativeRowIndex;
        if (travelerIdx < 0 || travelerIdx >= newItinerary.travelers.length) return;
        if (newItinerary.travelers[travelerIdx].locked) return;
        const traveler = { ...newItinerary.travelers[travelerIdx], segments: [...newItinerary.travelers[travelerIdx].segments] };
        const newSegments: Segment[] = cbTraveler.segments.map(seg => {
          const s = JSON.parse(JSON.stringify(seg)) as Segment;
          s.id = uuidv4();
          if (s.type === 'city') {
            const startOff = getDayOffset(seg.type === 'city' ? seg.startDate : '');
            const endOff = getDayOffset(seg.type === 'city' ? seg.endDate : '');
            const length = endOff - startOff;
            const newStartOff = Math.round(startOff + dayShift);
            s.startDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff), 'yyyy-MM-dd');
            s.endDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff + length), 'yyyy-MM-dd');
            if (s.stays) {
              s.stays.forEach(stay => {
                const stayStartOff = differenceInDays(startOfDay(parseISO(stay.checkInDate)), startOfDay(parseISO(seg.type === 'city' ? seg.startDate : '')));
                const stayLen = differenceInDays(startOfDay(parseISO(stay.checkOutDate)), startOfDay(parseISO(stay.checkInDate)));
                stay.checkInDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff + stayStartOff), 'yyyy-MM-dd');
                stay.checkOutDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff + stayStartOff + stayLen), 'yyyy-MM-dd');
              });
            }
          } else {
            const depOff = getDayOffset(seg.type === 'transport' ? seg.departureDate : '');
            const arrOff = getDayOffset(seg.type === 'transport' ? seg.arrivalDate : '');
            const length = arrOff - depOff;
            const newDepOff = Math.round(depOff + dayShift);
            s.departureDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newDepOff), 'yyyy-MM-dd');
            s.arrivalDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newDepOff + length), 'yyyy-MM-dd');
          }
          return s;
        });
        console.log(`Pasting ${newSegments.length} segments to traveler index ${travelerIdx}`);
        newSegments.forEach(newSeg => {
          const nStart = newSeg.type === 'city' ? getDayOffset(newSeg.startDate) : getDayOffset(newSeg.departureDate);
          const nEnd = newSeg.type === 'city' ? getDayOffset(newSeg.endDate) : getDayOffset(newSeg.arrivalDate);
          traveler.segments = traveler.segments.filter(oldSeg => {
            const oStart = oldSeg.type === 'city' ? getDayOffset(oldSeg.startDate) : getDayOffset(oldSeg.departureDate);
            const oEnd = oldSeg.type === 'city' ? getDayOffset(oldSeg.endDate) : getDayOffset(oldSeg.arrivalDate);
            return !(Math.max(nStart, oStart) <= Math.min(nEnd, oEnd));
          });
        });
        traveler.segments.push(...newSegments);
        newItinerary.travelers[travelerIdx] = traveler;
      });
      return newItinerary;
    });
  }, [itinerary, clipboard, focusedCell, getDayOffset, setItinerary]);

  const switchVersion = (index: number) => { setActiveVersionIndex(index); setSelection([]); setFocusedCell(null); };
  
  const cloneVersion = useCallback(() => {
    if (!itinerary) return;
    pushUndo({ versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex });
    const cloned = deepCloneItinerary(JSON.parse(JSON.stringify(itinerary)));
    store.versions.push(cloned);
    setActiveVersionIndex(store.versions.length - 1);
    setSelection([]);
  }, [itinerary, store, safeIndex, pushUndo]);

  const deleteVersion = useCallback(async (index: number) => {
    if (store.versions.length <= 1) return;
    const deletedId = (store.versions[index] as any).id;
    pushUndo({ versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex });
    store.versions.splice(index, 1);
    if (activeVersionIndex >= index && activeVersionIndex > 0) setActiveVersionIndex(prev => prev - 1);
    setSelection([]);
    await supabase.from('itinerary_versions').delete().eq('id', deletedId);
  }, [store, safeIndex, activeVersionIndex, pushUndo, supabase]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, { versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex }];
    skipSnapshotRef.current = true;
    store.versions.splice(0, store.versions.length, ...entry.versions);
    setActiveVersionIndex(entry.activeVersionIndex);
    setSelection([]);
    skipSnapshotRef.current = false;
    setUndoRedoVersion(v => v + 1);
  }, [store, safeIndex]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, { versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex }];
    skipSnapshotRef.current = true;
    store.versions.splice(0, store.versions.length, ...entry.versions);
    setActiveVersionIndex(entry.activeVersionIndex);
    setSelection([]);
    skipSnapshotRef.current = false;
    setUndoRedoVersion(v => v + 1);
  }, [store, safeIndex]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  useEffect(() => { return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); }; }, []);

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
