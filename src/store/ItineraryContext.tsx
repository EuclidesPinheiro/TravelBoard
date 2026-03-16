import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Itinerary, SelectionType } from '../types';
import { initialItinerary } from '../data/initialData';
import { v4 as uuidv4 } from 'uuid';

const MAX_UNDO = 50;

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
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

function deepCloneItinerary(it: Itinerary): Itinerary {
  return JSON.parse(JSON.stringify(it, (key, value) => {
    if (key === 'id') return uuidv4();
    return value;
  }));
}

interface UndoEntry {
  versions: Itinerary[];
  activeVersionIndex: number;
}

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [versions, setVersions] = useState<Itinerary[]>(() => {
    const saved = localStorage.getItem('travelboard_versions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved versions', e);
      }
    }
    // Migrate from old single-itinerary format
    const oldSaved = localStorage.getItem('travelboard_itinerary');
    if (oldSaved) {
      try {
        return [JSON.parse(oldSaved)];
      } catch (e) {
        console.error('Failed to parse old itinerary', e);
      }
    }
    return [initialItinerary];
  });

  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(() => {
    const saved = localStorage.getItem('travelboard_active_version');
    if (saved) {
      const idx = parseInt(saved, 10);
      if (!isNaN(idx)) return idx;
    }
    return 0;
  });

  const [selection, setSelection] = useState<SelectionType>(null);
  const [highlightedTravelerId, setHighlightedTravelerId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(80);

  // Undo/Redo stacks
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [undoRedoVersion, setUndoRedoVersion] = useState(0); // trigger re-render for canUndo/canRedo
  const skipSnapshotRef = useRef(false); // flag to skip snapshot during undo/redo

  const safeIndex = Math.min(activeVersionIndex, versions.length - 1);
  const itinerary = versions[safeIndex];

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), entry];
    redoStackRef.current = [];
    setUndoRedoVersion(v => v + 1);
  }, []);

  const setItinerary: React.Dispatch<React.SetStateAction<Itinerary>> = useCallback((action) => {
    setVersions(prev => {
      if (!skipSnapshotRef.current) {
        undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), { versions: prev, activeVersionIndex: safeIndex }];
        redoStackRef.current = [];
        setUndoRedoVersion(v => v + 1);
      }
      const updated = [...prev];
      updated[safeIndex] = typeof action === 'function' ? action(prev[safeIndex]) : action;
      return updated;
    });
  }, [safeIndex]);

  const switchVersion = (index: number) => {
    setActiveVersionIndex(index);
    setSelection(null);
  };

  const cloneVersion = () => {
    pushUndo({ versions, activeVersionIndex: safeIndex });
    const cloned = deepCloneItinerary(itinerary);
    setVersions(prev => [...prev, cloned]);
    setActiveVersionIndex(versions.length);
    setSelection(null);
  };

  const deleteVersion = (index: number) => {
    if (versions.length <= 1) return;
    pushUndo({ versions, activeVersionIndex: safeIndex });
    setVersions(prev => prev.filter((_, i) => i !== index));
    if (activeVersionIndex >= index && activeVersionIndex > 0) {
      setActiveVersionIndex(prev => prev - 1);
    }
    setSelection(null);
  };

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
  }, [versions, safeIndex]);

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
  }, [versions, safeIndex]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  useEffect(() => {
    localStorage.setItem('travelboard_versions', JSON.stringify(versions));
    localStorage.setItem('travelboard_active_version', String(safeIndex));
  }, [versions, safeIndex]);

  return (
    <ItineraryContext.Provider value={{
      itinerary, setItinerary,
      versions, activeVersionIndex: safeIndex, switchVersion, cloneVersion, deleteVersion,
      selection, setSelection,
      highlightedTravelerId, setHighlightedTravelerId,
      zoomLevel, setZoomLevel,
      undo, redo, canUndo, canRedo,
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
