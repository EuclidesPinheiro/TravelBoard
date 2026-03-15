import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Itinerary, SelectionType } from '../types';
import { initialItinerary } from '../data/initialData';
import { v4 as uuidv4 } from 'uuid';

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
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

function deepCloneItinerary(it: Itinerary): Itinerary {
  return JSON.parse(JSON.stringify(it, (key, value) => {
    if (key === 'id') return uuidv4();
    return value;
  }));
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
  const [zoomLevel, setZoomLevel] = useState<number>(80);

  const safeIndex = Math.min(activeVersionIndex, versions.length - 1);
  const itinerary = versions[safeIndex];

  const setItinerary: React.Dispatch<React.SetStateAction<Itinerary>> = (action) => {
    setVersions(prev => {
      const updated = [...prev];
      updated[safeIndex] = typeof action === 'function' ? action(prev[safeIndex]) : action;
      return updated;
    });
  };

  const switchVersion = (index: number) => {
    setActiveVersionIndex(index);
    setSelection(null);
  };

  const cloneVersion = () => {
    const cloned = deepCloneItinerary(itinerary);
    setVersions(prev => [...prev, cloned]);
    setActiveVersionIndex(versions.length);
    setSelection(null);
  };

  const deleteVersion = (index: number) => {
    if (versions.length <= 1) return;
    setVersions(prev => prev.filter((_, i) => i !== index));
    if (activeVersionIndex >= index && activeVersionIndex > 0) {
      setActiveVersionIndex(prev => prev - 1);
    }
    setSelection(null);
  };

  useEffect(() => {
    localStorage.setItem('travelboard_versions', JSON.stringify(versions));
    localStorage.setItem('travelboard_active_version', String(safeIndex));
  }, [versions, safeIndex]);

  return (
    <ItineraryContext.Provider value={{
      itinerary, setItinerary,
      versions, activeVersionIndex: safeIndex, switchVersion, cloneVersion, deleteVersion,
      selection, setSelection,
      zoomLevel, setZoomLevel,
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
