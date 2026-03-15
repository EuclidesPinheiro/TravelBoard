import { useState, useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { TransportSegment, TransportMode } from '../types';
import { parseISO, differenceInMinutes } from 'date-fns';
import { ChevronDown, ChevronRight, Navigation } from 'lucide-react';
import { cn } from '../utils/cn';

const TRANSPORT_COLORS: Record<string, string> = {
  flight: '#E74C3C',
  train: '#F39C12',
  night_train: '#3498DB',
  bus: '#27AE60',
  car: '#9B59B6',
  ferry: '#1ABC9C',
  walking: '#8D6E63',
};

const MODE_LABELS: Record<string, string> = {
  flight: 'Avião',
  train: 'Trem',
  night_train: 'Night Train',
  bus: 'Bus',
  car: 'Carro',
  ferry: 'Barco',
  walking: 'A pé',
};

interface TravelerTransportTime {
  name: string;
  color: string;
  hours: number;
}

interface TransportData {
  mode: TransportMode;
  totalHours: number;
  travelers: TravelerTransportTime[];
}

function formatHours(totalHours: number): string {
  const days = Math.floor(totalHours / 24);
  const h = Math.floor(totalHours % 24);
  const m = Math.round((totalHours - Math.floor(totalHours)) * 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && days === 0) parts.push(`${m}min`);
  return parts.length > 0 ? parts.join(' ') : '0h';
}

function getTransportHours(segment: TransportSegment): number {
  const [depH, depM] = segment.departureTime.split(':').map(Number);
  const dep = parseISO(segment.departureDate);
  dep.setHours(depH, depM, 0, 0);

  const [arrH, arrM] = segment.arrivalTime.split(':').map(Number);
  const arr = parseISO(segment.arrivalDate);
  arr.setHours(arrH, arrM, 0, 0);

  const minutes = differenceInMinutes(arr, dep);
  return Math.max(0, minutes / 60);
}

export function TransportReport() {
  const { itinerary, highlightedTravelerId } = useItinerary();
  const [expandedMode, setExpandedMode] = useState<string | null>(null);

  const filteredTravelers = highlightedTravelerId
    ? itinerary.travelers.filter(t => t.id === highlightedTravelerId)
    : itinerary.travelers;

  const transportData = useMemo(() => {
    const map = new Map<TransportMode, TransportData>();

    for (const traveler of filteredTravelers) {
      for (const segment of traveler.segments) {
        if (segment.type !== 'transport') continue;
        const trans = segment as TransportSegment;

        const hours = getTransportHours(trans);
        if (hours <= 0) continue;

        if (!map.has(trans.mode)) {
          map.set(trans.mode, { mode: trans.mode, totalHours: 0, travelers: [] });
        }
        const entry = map.get(trans.mode)!;
        entry.totalHours += hours;
        entry.travelers.push({ name: traveler.name, color: traveler.color, hours });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredTravelers]);

  const maxHours = useMemo(() => Math.max(...transportData.map(t => t.totalHours), 1), [transportData]);

  const highlightedTraveler = highlightedTravelerId
    ? itinerary.travelers.find(t => t.id === highlightedTravelerId)
    : null;

  if (transportData.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Navigation size={14} />
        Time per Transport
        {highlightedTraveler && (
          <span className="normal-case tracking-normal text-xs font-medium text-slate-400">
            — {highlightedTraveler.name}
          </span>
        )}
      </h2>

      <div className="space-y-1">
        {transportData.map(transport => {
          const isExpanded = expandedMode === transport.mode;
          const modeColor = TRANSPORT_COLORS[transport.mode] || '#95a5a6';
          const barWidth = (transport.totalHours / maxHours) * 100;

          return (
            <div key={transport.mode}>
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group",
                  isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
                )}
                onClick={() => !highlightedTravelerId && setExpandedMode(isExpanded ? null : transport.mode)}
              >
                {!highlightedTravelerId && (
                  <div className="flex items-center gap-1 text-slate-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700 w-28 shrink-0 truncate">
                  {MODE_LABELS[transport.mode] || transport.mode}
                </span>
                <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center px-2 transition-all"
                    style={{ width: `${Math.max(barWidth, 8)}%`, backgroundColor: `${modeColor}30`, borderLeft: `3px solid ${modeColor}` }}
                  >
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {formatHours(transport.totalHours)}
                    </span>
                  </div>
                </div>
                {!highlightedTravelerId && (
                  <span className="text-xs text-slate-400 shrink-0">
                    {transport.travelers.length} {transport.travelers.length === 1 ? 'traveler' : 'travelers'}
                  </span>
                )}
              </button>

              {isExpanded && !highlightedTravelerId && (
                <div className="ml-12 mr-3 mb-2 space-y-1 mt-1">
                  {transport.travelers.map((t, i) => {
                    const tBarWidth = (t.hours / transport.totalHours) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-24 shrink-0">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-600 truncate">{t.name}</span>
                        </div>
                        <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full rounded flex items-center px-1.5 transition-all"
                            style={{ width: `${Math.max(tBarWidth, 8)}%`, backgroundColor: `${t.color}30`, borderLeft: `2px solid ${t.color}` }}
                          >
                            <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                              {formatHours(t.hours)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
