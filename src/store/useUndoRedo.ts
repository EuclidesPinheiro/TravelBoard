import { useRef, useState, useCallback } from 'react';
import { Itinerary } from '../types';
import { UndoEntry, MAX_UNDO, SyncedStore } from './helpers';

export function useUndoRedo(store: SyncedStore, safeIndex: number) {
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const skipSnapshotRef = useRef(false);
  const [undoRedoVersion, setUndoRedoVersion] = useState(0);

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), entry];
    redoStackRef.current = [];
    setUndoRedoVersion(v => v + 1);
  }, []);

  const undo = useCallback((): number | null => {
    if (undoStackRef.current.length === 0) return null;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, { versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex }];
    skipSnapshotRef.current = true;
    store.versions.splice(0, store.versions.length, ...entry.versions);
    skipSnapshotRef.current = false;
    setUndoRedoVersion(v => v + 1);
    return entry.activeVersionIndex;
  }, [store, safeIndex]);

  const redo = useCallback((): number | null => {
    if (redoStackRef.current.length === 0) return null;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, { versions: JSON.parse(JSON.stringify(store.versions)), activeVersionIndex: safeIndex }];
    skipSnapshotRef.current = true;
    store.versions.splice(0, store.versions.length, ...entry.versions);
    skipSnapshotRef.current = false;
    setUndoRedoVersion(v => v + 1);
    return entry.activeVersionIndex;
  }, [store, safeIndex]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  return { pushUndo, undo, redo, canUndo, canRedo, skipSnapshotRef, undoRedoVersion };
}
