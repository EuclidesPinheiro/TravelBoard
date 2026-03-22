import { useItinerary } from '../../store/ItineraryContext';
import { X } from 'lucide-react';
import { TravelerDetails } from './TravelerDetails';
import { CityDetails } from './CityDetails';
import { TransportDetails } from './TransportDetails';
import { DayEventsDetails } from './DayEventsDetails';

export function Sidebar() {
  const { selection, setSelection, itinerary } = useItinerary();

  if (!selection || selection.length === 0) return null;

  if (selection.length > 1) {
    return (
      <div data-sidebar className="w-80 max-md:w-full max-md:absolute max-md:inset-0 max-md:z-50 max-md:border-l-0 shrink-0 bg-slate-950 border-l border-slate-700 shadow-xl flex flex-col h-full z-30 animate-in slide-in-from-right-8 duration-200">
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-200">Multiple Items</h2>
          <button 
            onClick={() => setSelection([])}
            className="p-1.5 max-md:p-2.5 text-slate-500 hover:text-slate-500 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center text-slate-500">
          {selection.length} items selected
        </div>
      </div>
    );
  }

  const singleSelection = selection[0];

  // dayEvents selection doesn't need a traveler
  if (singleSelection.type === 'dayEvents') {
    return (
      <div data-sidebar className="w-80 max-md:w-full max-md:absolute max-md:inset-0 max-md:z-50 max-md:border-l-0 shrink-0 bg-slate-950 border-l border-slate-700 shadow-xl flex flex-col h-full z-30 animate-in slide-in-from-right-8 duration-200">
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-200">Details</h2>
          <button
            onClick={() => setSelection([])}
            className="p-1.5 max-md:p-2.5 text-slate-500 hover:text-slate-500 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <DayEventsDetails date={singleSelection.date} />
        </div>
      </div>
    );
  }

  const traveler = itinerary.travelers.find(t => t.id === (singleSelection as { travelerId: string }).travelerId);
  if (!traveler) return null;

  return (
    <div data-sidebar className="w-80 max-md:w-full max-md:absolute max-md:inset-0 max-md:z-50 max-md:border-l-0 shrink-0 bg-slate-950 border-l border-slate-700 shadow-xl flex flex-col h-full z-30 animate-in slide-in-from-right-8 duration-200">
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <h2 className="font-semibold text-slate-200">Details</h2>
        <button
          onClick={() => setSelection([])}
          className="p-1.5 max-md:p-2.5 text-slate-500 hover:text-slate-500 hover:bg-slate-800 rounded-md transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {singleSelection.type === 'traveler' && <TravelerDetails traveler={traveler} />}
        {singleSelection.type === 'city' && <CityDetails traveler={traveler} segmentId={singleSelection.segmentId} />}
        {singleSelection.type === 'transport' && <TransportDetails traveler={traveler} segmentId={singleSelection.segmentId} />}
      </div>
    </div>
  );
}
