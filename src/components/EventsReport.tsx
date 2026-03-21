import { useMemo } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { TravelEvent, EventType, Traveler } from '../types';
import { getCityColor } from '../utils/cityColors';
import { Music, CalendarDays, PartyPopper, Trophy, Link, Clock } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { cn } from '../utils/cn';

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: typeof Music; color: string; bg: string }> = {
  show: { label: 'Show', icon: Music, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  holiday: { label: 'Holiday', icon: CalendarDays, color: 'text-red-400', bg: 'bg-red-900/30' },
  festival: { label: 'Festival', icon: PartyPopper, color: 'text-amber-400', bg: 'bg-amber-900/30' },
  sports: { label: 'Sports', icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
};

interface EventWithCity extends TravelEvent {
  cityName: string;
}

interface CityEvents {
  cityName: string;
  events: TravelEvent[];
}

export function EventsReport() {
  const { itinerary } = useItinerary();

  const travelerMap = useMemo(() => {
    const map = new Map<string, Traveler>();
    for (const t of itinerary.travelers) map.set(t.id, t);
    return map;
  }, [itinerary.travelers]);

  const cityEvents = useMemo(() => {
    const cityOrder: string[] = [];
    const seen = new Set<string>();
    for (const t of itinerary.travelers) {
      for (const seg of t.segments) {
        if (seg.type === 'city' && !seen.has(seg.cityName)) {
          seen.add(seg.cityName);
          cityOrder.push(seg.cityName);
        }
      }
    }
    if (itinerary.events) {
      for (const city of Object.keys(itinerary.events)) {
        if (!seen.has(city)) {
          seen.add(city);
          cityOrder.push(city);
        }
      }
    }

    const result: CityEvents[] = [];
    for (const cityName of cityOrder) {
      const events = itinerary.events?.[cityName] ?? [];
      if (events.length === 0) continue;
      const sorted = [...events].sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      });
      result.push({ cityName, events: sorted });
    }
    return result;
  }, [itinerary]);

  const totalEvents = cityEvents.reduce((s, c) => s + c.events.length, 0);

  if (cityEvents.length === 0) {
    return (
      <div className="bg-slate-900 px-6 py-8 text-center">
        <p className="text-sm text-slate-500">No events added yet.</p>
        <p className="text-xs text-slate-500 mt-1">Add events from city details in the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 max-h-[45vh] overflow-y-auto space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-500">
          {totalEvents} event{totalEvents !== 1 ? 's' : ''} across {cityEvents.length} {cityEvents.length !== 1 ? 'cities' : 'city'}
        </span>
      </div>

      {/* Per-city cards */}
      {cityEvents.map(({ cityName, events }) => {
        const cityColor = getCityColor(cityName);
        return (
          <div key={cityName} className="border border-slate-700 rounded-lg overflow-hidden">
            {/* City header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cityColor }} />
              <span className="text-sm font-semibold text-slate-600 flex-1">{cityName}</span>
              <span className="text-[10px] font-medium text-slate-500">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Events list */}
            <div className="divide-y divide-slate-800">
              {events.map(event => {
                const config = EVENT_TYPE_CONFIG[event.eventType];
                const Icon = config.icon;
                const addedBy = travelerMap.get(event.addedBy);

                return (
                  <div key={event.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-900/50 transition-colors">
                    {/* Type icon */}
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", config.bg)}>
                      <Icon size={14} className={config.color} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-600 truncate">{event.name}</span>
                        {event.link && (
                          <a href={event.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-500 hover:text-indigo-400">
                            <Link size={11} />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">
                          {format(parseISO(event.date), 'dd/MM/yyyy')}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <Clock size={9} />
                          {event.allDay ? 'All day' : `${event.startTime}–${event.endTime}`}
                        </span>
                        <span className={cn("text-[10px] font-medium", config.color)}>
                          {config.label}
                        </span>
                      </div>
                    </div>

                    {/* Added by */}
                    {addedBy && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                          style={{ backgroundColor: addedBy.color }}
                          title={addedBy.name}
                        >
                          {addedBy.name.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
