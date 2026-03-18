import { Traveler, TransportSegment, TransportMode, CitySegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { Navigation, Clock, Moon, DollarSign, Plane, TrainFront, Ship, Bus, Car } from 'lucide-react';
import { parseISO, differenceInMinutes } from 'date-fns';
import { cn } from '../../utils/cn';

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: typeof Plane; color: string }[] = [
  { mode: 'flight', label: 'Avião', icon: Plane, color: '#E74C3C' },
  { mode: 'train', label: 'Trem', icon: TrainFront, color: '#F39C12' },
  { mode: 'ferry', label: 'Barco', icon: Ship, color: '#1ABC9C' },
  { mode: 'bus', label: 'Ônibus', icon: Bus, color: '#27AE60' },
  { mode: 'car', label: 'Carro', icon: Car, color: '#9B59B6' },
];

export function TransportDetails({ traveler, segmentId }: { traveler: Traveler, segmentId: string }) {
  const { setItinerary } = useItinerary();
  const segment = traveler.segments.find(s => s.id === segmentId) as TransportSegment;

  if (!segment) return null;

  function updateSegment(updates: Partial<TransportSegment>) {
    setItinerary((prev) => {
      const travelerIdx = prev.travelers.findIndex((t) => t.id === traveler.id);
      if (travelerIdx === -1) return prev;

      const newTravelers = [...prev.travelers];
      const newSegments = [...newTravelers[travelerIdx].segments];
      const segIdx = newSegments.findIndex((s) => s.id === segmentId);
      if (segIdx === -1) return prev;

      const oldTransport = newSegments[segIdx] as TransportSegment;
      const newTransport = { ...oldTransport, ...updates };
      newSegments[segIdx] = newTransport;

      // Sync back to cities
      if (segIdx > 0 && newSegments[segIdx - 1].type === "city") {
        const city = newSegments[segIdx - 1] as CitySegment;
        newSegments[segIdx - 1] = {
          ...city,
          cityName: newTransport.from,
          endDate: newTransport.departureDate,
          endTime: newTransport.departureTime,
        };
      }

      if (
        segIdx < newSegments.length - 1 &&
        newSegments[segIdx + 1].type === "city"
      ) {
        const city = newSegments[segIdx + 1] as CitySegment;
        newSegments[segIdx + 1] = {
          ...city,
          cityName: newTransport.to,
          startDate: newTransport.arrivalDate,
          startTime: newTransport.arrivalTime,
        };
      }

      newTravelers[travelerIdx] = {
        ...newTravelers[travelerIdx],
        segments: newSegments,
      };
      return { ...prev, travelers: newTravelers };
    });
  }

  // Calculate duration using parseISO (never new Date for date strings)
  const dep = parseISO(segment.departureDate);
  const [depH, depM] = segment.departureTime.split(':').map(Number);
  dep.setHours(depH, depM, 0, 0);

  const arr = parseISO(segment.arrivalDate);
  const [arrH, arrM] = segment.arrivalTime.split(':').map(Number);
  arr.setHours(arrH, arrM, 0, 0);

  const totalMinutes = Math.max(0, differenceInMinutes(arr, dep));
  const diffHrs = Math.floor(totalMinutes / 60);
  const diffMins = totalMinutes % 60;

  const isOvernight = segment.overnight || segment.departureDate !== segment.arrivalDate;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-indigo-400 mb-1">
          <Navigation size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">{segment.mode.replace('_', ' ')}</span>
        </div>
        <h3 className="text-xl font-bold text-slate-50 flex items-center gap-2">
          <input
            type="text"
            value={segment.from}
            onChange={e => updateSegment({ from: e.target.value })}
            className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none truncate"
          />
          <span className="shrink-0 text-slate-500">→</span>
          <input
            type="text"
            value={segment.to}
            onChange={e => updateSegment({ to: e.target.value })}
            className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none truncate"
          />
        </h3>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-50">Transport Mode</div>
        <div className="flex gap-1.5">
          {TRANSPORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = segment.mode === opt.mode || (segment.mode === 'night_train' && opt.mode === 'train') || (segment.mode === 'tour_bus' && opt.mode === 'bus');
            return (
              <button
                key={opt.mode}
                onClick={() => {
                  if (opt.mode === 'train' && segment.mode === 'night_train') {
                    updateSegment({ mode: 'night_train' });
                  } else if (opt.mode === 'bus' && segment.mode === 'tour_bus') {
                    updateSegment({ mode: 'tour_bus' });
                  } else {
                    updateSegment({ mode: opt.mode });
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all flex-1",
                  selected
                    ? "ring-2 shadow-sm"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-500"
                )}
                style={selected ? {
                  backgroundColor: `${opt.color}15`,
                  color: opt.color,
                  ringColor: opt.color,
                  ['--tw-ring-color' as string]: opt.color,
                } : undefined}
                title={opt.label}
              >
                <Icon size={16} strokeWidth={selected ? 2.5 : 2} />
                <span className="text-[9px] font-medium leading-none">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {(segment.mode === 'train' || segment.mode === 'night_train') && (
          <div className="mt-3 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Sleeper</span>
            <button
              onClick={() => updateSegment({ mode: segment.mode === 'night_train' ? 'train' : 'night_train' })}
              className={cn(
                "w-8 h-4 rounded-full relative transition-colors",
                segment.mode === 'night_train' ? "bg-indigo-500" : "bg-slate-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  segment.mode === 'night_train' ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )}
        {(segment.mode === 'bus' || segment.mode === 'tour_bus') && (
          <div className="mt-3 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Tour</span>
            <button
              onClick={() => updateSegment({ mode: segment.mode === 'tour_bus' ? 'bus' : 'tour_bus' })}
              className={cn(
                "w-8 h-4 rounded-full relative transition-colors",
                segment.mode === 'tour_bus' ? "bg-indigo-500" : "bg-slate-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  segment.mode === 'tour_bus' ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl p-4 space-y-4 border border-slate-800">
        <div className="flex justify-between items-center relative gap-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-px bg-slate-700 border-dashed border-t-2" />

          <div className="bg-slate-900 relative z-10 space-y-1.5 pr-2 w-full">
            <div className="text-[10px] text-slate-500 uppercase font-medium">Departure</div>
            <input
              type="time"
              value={segment.departureTime}
              onChange={e => updateSegment({ departureTime: e.target.value })}
              className="w-full text-base font-bold text-slate-50 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={segment.departureDate}
              onChange={e => updateSegment({ departureDate: e.target.value })}
              className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-slate-900 relative z-10 space-y-1.5 pl-2 w-full text-right">
            <div className="text-[10px] text-slate-500 uppercase font-medium">Arrival</div>
            <input
              type="time"
              value={segment.arrivalTime}
              onChange={e => updateSegment({ arrivalTime: e.target.value })}
              className="w-full text-base font-bold text-slate-50 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
            />
            <input
              type="date"
              value={segment.arrivalDate}
              onChange={e => updateSegment({ arrivalDate: e.target.value })}
              className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-3 border-t border-slate-700/60">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Clock size={16} className="text-slate-500" />
            {diffHrs}h {diffMins > 0 ? `${diffMins}m` : ''}
          </div>
          {isOvernight && (
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
              updateSegment({ cost: !isNaN(val) && val >= 0 ? val : undefined });
            }}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full text-sm bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-50">Notes</h4>
        <textarea
          value={segment.notes ?? ''}
          onChange={e => updateSegment({ notes: e.target.value })}
          placeholder="Add notes..."
          className="w-full text-sm text-slate-300 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 resize-y"
        />
      </div>
    </div>
  );
}
