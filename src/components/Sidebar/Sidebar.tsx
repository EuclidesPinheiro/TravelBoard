import { useItinerary } from '../../store/ItineraryContext';
import { X } from 'lucide-react';
import { TravelerDetails } from './TravelerDetails';
import { CityDetails } from './CityDetails';
import { TransportDetails } from './TransportDetails';

export function Sidebar() {
  const { selection, setSelection, itinerary } = useItinerary();

  if (!selection) return null;

  const traveler = itinerary.travelers.find(t => t.id === selection.travelerId);
  if (!traveler) return null;

  return (
    <div data-sidebar className="w-80 shrink-0 bg-slate-950 border-l border-slate-700 shadow-xl flex flex-col h-full z-30 animate-in slide-in-from-right-8 duration-200">
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <h2 className="font-semibold text-slate-200">Details</h2>
        <button 
          onClick={() => setSelection(null)}
          className="p-1.5 text-slate-500 hover:text-slate-500 hover:bg-slate-800 rounded-md transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selection.type === 'traveler' && <TravelerDetails traveler={traveler} />}
        {selection.type === 'city' && <CityDetails traveler={traveler} segmentId={selection.segmentId} />}
        {selection.type === 'transport' && <TransportDetails traveler={traveler} segmentId={selection.segmentId} />}
      </div>
    </div>
  );
}
