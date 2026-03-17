import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Itinerary, SelectionType, CitySegment } from '../types';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const MAX_UNDO = 50;
const SYNC_DEBOUNCE_MS = 500;

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
  highlightedTravelerId: string | null;
  setHighlightedTravelerId: React.Dispatch<React.SetStateAction<string | null>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  boardId: string;
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
      if (seg.type === 'city') activeCities.add((seg as CitySegment).cityName);
    }
  }

  let changed = false;

  let attractions = it.attractions;
  if (attractions) {
    for (const city of Object.keys(attractions)) {
      if (!activeCities.has(city)) { changed = true; break; }
    }
    if (changed) {
      attractions = Object.fromEntries(
        Object.entries(attractions).filter(([city]) => activeCities.has(city))
      );
    }
  }

  let checklists = it.checklists;
  if (checklists) {
    let clChanged = false;
    for (const city of Object.keys(checklists)) {
      if (!activeCities.has(city)) { clChanged = true; break; }
    }
    if (clChanged) {
      checklists = Object.fromEntries(
        Object.entries(checklists).filter(([city]) => activeCities.has(city))
      );
      changed = true;
    }
  }

  return changed ? { ...it, attractions, checklists } : it;
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
}

export function ItineraryProvider({ children, boardId }: ItineraryProviderProps) {
  const [versions, setVersions] = useState<Itinerary[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<SelectionType>(null);
  const [highlightedTravelerId, setHighlightedTravelerId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(80);

  // Undo/Redo stacks (local only, not synced)
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [undoRedoVersion, setUndoRedoVersion] = useState(0);
  const skipSnapshotRef = useRef(false);

  // Session ID for echo prevention
  const sessionIdRef = useRef(uuidv4());

  // Ref that always mirrors the latest versions state
  const versionsRef = useRef<Itinerary[]>(versions);
  useEffect(() => { versionsRef.current = versions; });

  // Debounce timer ref
  const syncTimeoutRef = useRef<number | null>(null);

  const safeIndex = Math.min(activeVersionIndex, Math.max(versions.length - 1, 0));
  const itinerary = versions[safeIndex] || null;

  // --- Sync to Supabase (debounced) ---

  const syncToSupabase = useCallback(async () => {
    const current = versionsRef.current;
    if (current.length === 0) return;

    const rows = current.map((v, i) => itineraryToRow(v, boardId, i, sessionIdRef.current));

    const { error } = await supabase
      .from('itinerary_versions')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('Sync to Supabase failed:', error.message);
    }
  }, [boardId]);

  const scheduleSyncToSupabase = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      syncToSupabase();
    }, SYNC_DEBOUNCE_MS);
  }, [syncToSupabase]);

  // --- Load from Supabase on mount ---

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('itinerary_versions')
        .select('*')
        .eq('board_id', boardId)
        .order('version_index', { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('Board not found');
        setLoading(false);
        return;
      }

      setVersions(data.map(rowToItinerary));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [boardId]);

  // --- Realtime subscription ---

  useEffect(() => {
    if (loading) return;

    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itinerary_versions',
          filter: `board_id=eq.${boardId}`,
        },
        (payload: any) => {
          // Skip our own changes
          if (payload.new?.session_id === sessionIdRef.current) return;

          const eventType = payload.eventType;

          if (eventType === 'UPDATE' && payload.new) {
            const updated = rowToItinerary(payload.new);
            setVersions(prev => prev.map(v => v.id === payload.new.id ? updated : v));
          }

          if (eventType === 'INSERT' && payload.new) {
            const newVersion = rowToItinerary(payload.new);
            setVersions(prev => {
              if (prev.some(v => v.id === payload.new.id)) return prev;
              const next = [...prev, newVersion];
              next.sort((a, b) => {
                const aIdx = payload.new.version_index ?? 0;
                const bIdx = payload.new.version_index ?? 0;
                return aIdx - bIdx;
              });
              return next;
            });
          }

          if (eventType === 'DELETE' && payload.old) {
            setVersions(prev => {
              const filtered = prev.filter(v => v.id !== payload.old.id);
              return filtered.length > 0 ? filtered : prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, loading]);

  // --- Undo helpers ---

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), entry];
    redoStackRef.current = [];
    setUndoRedoVersion(v => v + 1);
  }, []);

  // --- Mutations ---

  const setItinerary: React.Dispatch<React.SetStateAction<Itinerary>> = useCallback((action) => {
    setVersions(prev => {
      if (!skipSnapshotRef.current) {
        undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), { versions: prev, activeVersionIndex: safeIndex }];
        redoStackRef.current = [];
        setUndoRedoVersion(v => v + 1);
      }
      const updated = [...prev];
      let newItinerary = typeof action === 'function' ? action(prev[safeIndex]) : action;
      updated[safeIndex] = cleanupOrphanedCityData(newItinerary);
      return updated;
    });
    scheduleSyncToSupabase();
  }, [safeIndex, scheduleSyncToSupabase]);

  const switchVersion = (index: number) => {
    setActiveVersionIndex(index);
    setSelection(null);
  };

  const cloneVersion = useCallback(() => {
    if (!itinerary) return;
    pushUndo({ versions, activeVersionIndex: safeIndex });
    const cloned = deepCloneItinerary(itinerary);
    setVersions(prev => [...prev, cloned]);
    setActiveVersionIndex(versions.length);
    setSelection(null);
    scheduleSyncToSupabase();
  }, [itinerary, versions, safeIndex, pushUndo, scheduleSyncToSupabase]);

  const deleteVersion = useCallback(async (index: number) => {
    if (versions.length <= 1) return;
    const deletedId = versions[index].id;

    pushUndo({ versions, activeVersionIndex: safeIndex });
    setVersions(prev => prev.filter((_, i) => i !== index));
    if (activeVersionIndex >= index && activeVersionIndex > 0) {
      setActiveVersionIndex(prev => prev - 1);
    }
    setSelection(null);

    // Delete from Supabase immediately
    await supabase.from('itinerary_versions').delete().eq('id', deletedId);
    // Re-sync remaining versions to update version_index
    scheduleSyncToSupabase();
  }, [versions, safeIndex, activeVersionIndex, pushUndo, scheduleSyncToSupabase]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, { versions, activeVersionIndex: safeIndex }];
    skipSnapshotRef.current = true;
    setVersions(entry.versions);
    setActiveVersionIndex(entry.activeVersionIndex);
    setSelection(null);
    skipSnapshotRef.current = false;
    setUndoRedoVersion(v => v + 1);
    scheduleSyncToSupabase();
  }, [versions, safeIndex, scheduleSyncToSupabase]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, { versions, activeVersionIndex: safeIndex }];
    skipSnapshotRef.current = true;
    setVersions(entry.versions);
    setActiveVersionIndex(entry.activeVersionIndex);
    setSelection(null);
    skipSnapshotRef.current = false;
    setUndoRedoVersion(v => v + 1);
    scheduleSyncToSupabase();
  }, [versions, safeIndex, scheduleSyncToSupabase]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  // --- Cleanup on unmount ---

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // --- Loading / Error states ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-500">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-950 rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-red-600 font-medium mb-2">Board not found</p>
          <p className="text-slate-500 text-sm">{error || 'No data available for this board.'}</p>
          <a href="/" className="inline-block mt-4 text-blue-600 hover:underline text-sm">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <ItineraryContext.Provider value={{
      itinerary, setItinerary,
      versions, activeVersionIndex: safeIndex, switchVersion, cloneVersion, deleteVersion,
      selection, setSelection,
      highlightedTravelerId, setHighlightedTravelerId,
      zoomLevel, setZoomLevel,
      undo, redo, canUndo, canRedo,
      boardId,
    }}>
      {children}
    </ItineraryContext.Provider>
  );
}

export function useItinerary() {
  const context = useContext(ItineraryContext);
  if (context === undefined) {
    throw new Error('useItinerary must be used within an ItineraryProvider');
  }
  return context;
}
