import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Itinerary, SelectionType } from '../types';
import { initialItinerary } from '../data/initialData';

interface ItineraryContextType {
  itinerary: Itinerary;
  setItinerary: React.Dispatch<React.SetStateAction<Itinerary>>;
  selection: SelectionType;
  setSelection: React.Dispatch<React.SetStateAction<SelectionType>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [itinerary, setItinerary] = useState<Itinerary>(() => {
    const saved = localStorage.getItem('travelboard_itinerary');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved itinerary', e);
      }
    }
    return initialItinerary;
  });

  const [selection, setSelection] = useState<SelectionType>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(80); // Default column width 80px

  useEffect(() => {
    localStorage.setItem('travelboard_itinerary', JSON.stringify(itinerary));
  }, [itinerary]);

  return (
    <ItineraryContext.Provider value={{ itinerary, setItinerary, selection, setSelection, zoomLevel, setZoomLevel }}>
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
