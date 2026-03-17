import { Traveler, TransportSegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { Navigation, Clock, Moon, DollarSign } from 'lucide-react';
import { parseISO, format, differenceInMinutes } from 'date-fns';

export function TransportDetails({ traveler, segmentId }: { traveler: Traveler, segmentId: string }) {
  const { setItinerary } = useItinerary();
  const segment = traveler.segments.find(s => s.id === segmentId) as TransportSegment;

  if (!segment) return null;

  function updateCost(cost: number | undefined) {
    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t => {
        if (t.id !== traveler.id) return t;
        return {
          ...t,
          segments: t.segments.map(s => s.id === segmentId ? { ...s, cost } : s),
        };
      }),
    }));
  }

  // Calculate duration using parseISO (never new Date for date strings)
  const dep = parseISO(segment.departureDate);
  const [depH, depM] = segment.departureTime.split(':').map(Number);
  dep.setHours(depH, depM, 0, 0);

  const arr = parseISO(segment.arrivalDate);
  const [arrH, arrM] = segment.arrivalTime.split(':').map(Number);
  arr.setHours(arrH, arrM, 0, 0);

  const totalMinutes = differenceInMinutes(arr, dep);
  const diffHrs = Math.floor(totalMinutes / 60);
  const diffMins = totalMinutes % 60;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-indigo-400 mb-1">
          <Navigation size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">{segment.mode.replace('_', ' ')}</span>
        </div>
        <h3 className="text-xl font-bold text-slate-50">{segment.from} → {segment.to}</h3>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 space-y-4 border border-slate-800">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-px bg-slate-700 border-dashed border-t-2" />

          <div className="bg-slate-900 relative z-10 pr-4">
            <div className="text-xs text-slate-500 uppercase font-medium mb-1">Departure</div>
            <div className="text-lg font-bold text-slate-50">{segment.departureTime}</div>
            <div className="text-xs text-slate-500">{format(parseISO(segment.departureDate), 'dd/MM/yyyy')}</div>
          </div>

          <div className="bg-slate-900 relative z-10 pl-4 text-right">
            <div className="text-xs text-slate-500 uppercase font-medium mb-1">Arrival</div>
            <div className="text-lg font-bold text-slate-50">{segment.arrivalTime}</div>
            <div className="text-xs text-slate-500">{format(parseISO(segment.arrivalDate), 'dd/MM/yyyy')}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-3 border-t border-slate-700/60">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Clock size={16} className="text-slate-500" />
            {diffHrs}h {diffMins > 0 ? `${diffMins}m` : ''}
          </div>
          {segment.overnight && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded-md">
              <Moon size={14} />
              Overnight
            </div>
          )}
        </div>
      </div>

      {/* Cost */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-500" />
          Cost
        </h4>
        <div className="relative">
          <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="number"
            value={segment.cost ?? ''}
            onChange={e => {
              const val = parseFloat(e.target.value);
              updateCost(!isNaN(val) && val > 0 ? val : undefined);
            }}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full text-sm bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder-slate-400"
          />
        </div>
      </div>

      {segment.notes && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-50">Notes</h4>
          <p className="text-sm text-slate-500 bg-slate-900 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
            {segment.notes}
          </p>
        </div>
      )}
    </div>
  );
}
