import { Traveler, CitySegment, TransportSegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { Navigation, Calendar, Trash2 } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useState } from 'react';

export function TravelerDetails({ traveler }: { traveler: Traveler }) {
  const { setItinerary, setSelection } = useItinerary();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cities = traveler.segments.filter(s => s.type === 'city') as CitySegment[];
  const transports = traveler.segments.filter(s => s.type === 'transport') as TransportSegment[];
  
  const totalDays = cities.reduce((acc, city) => {
    return acc + differenceInDays(parseISO(city.endDate), parseISO(city.startDate)) + 1;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm"
          style={{ backgroundColor: traveler.color }}
        >
          {traveler.name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{traveler.name}</h3>
          <p className="text-sm text-slate-500">{cities.length} cities • {totalDays} days</p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Itinerary Overview</h4>
        <div className="relative border-l-2 border-slate-100 ml-3 space-y-4 pb-2">
          {traveler.segments.map((segment) => {
            if (segment.type === 'city') {
              const city = segment as CitySegment;
              const days = differenceInDays(parseISO(city.endDate), parseISO(city.startDate)) + 1;
              return (
                <div key={segment.id} className="relative pl-4">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-300" style={{ borderColor: traveler.color }} />
                  <div className="font-medium text-slate-800 text-sm">{city.cityName}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Calendar size={12} />
                    {city.startDate.substring(5).replace('-', '/')} - {city.endDate.substring(5).replace('-', '/')} ({days} days)
                  </div>
                </div>
              );
            } else {
              const trans = segment as TransportSegment;
              return (
                <div key={segment.id} className="relative pl-4">
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300" />
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Navigation size={12} />
                    {trans.mode} to {trans.to}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      <button className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors">
        Edit Traveler
      </button>

      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full py-2 px-4 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={14} />
          Delete Traveler
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-red-700 font-medium">Remove {traveler.name} and all their cities/transports?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setItinerary(prev => ({
                  ...prev,
                  travelers: prev.travelers.filter(t => t.id !== traveler.id),
                }));
                setSelection(null);
              }}
              className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-xs transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-md text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
