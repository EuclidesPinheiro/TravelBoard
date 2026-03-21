import { useItinerary } from '../../store/ItineraryContext';
import { TravelEvent, EventType, Traveler } from '../../types';
import { Music, CalendarDays, PartyPopper, Trophy, Link, Clock } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { cn } from '../../utils/cn';
import { getCityColor } from '../../utils/cityColors';

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: typeof Music; color: string; bg: string }> = {
  show: { label: 'Show', icon: Music, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  holiday: { label: 'Holiday', icon: CalendarDays, color: 'text-red-400', bg: 'bg-red-900/30' },
  festival: { label: 'Festival', icon: PartyPopper, color: 'text-amber-400', bg: 'bg-amber-900/30' },
  sports: { label: 'Sports', icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
};

interface EventWithCity extends TravelEvent {
  cityName: string;
}

export function DayEventsDetails({ date }: { date: string }) {
  const { itinerary } = useItinerary();

  const travelerMap = new Map<string, Traveler>();
  for (const t of itinerary.travelers) travelerMap.set(t.id, t);

  // Collect all events for this date across all cities
  const eventsForDay: EventWithCity[] = [];
  if (itinerary.events) {
    for (const [cityName, cityEvents] of Object.entries(itinerary.events)) {
      for (const ev of cityEvents as TravelEvent[]) {
        if (ev.date === date) {
          eventsForDay.push({ ...ev, cityName });
        }
      }
    }
  }

  // Sort: all-day first, then by start time
  eventsForDay.sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });

  // Group by city
  const citiesWithEvents = new Map<string, EventWithCity[]>();
  for (const ev of eventsForDay) {
    const list = citiesWithEvents.get(ev.cityName) ?? [];
    list.push(ev);
    citiesWithEvents.set(ev.cityName, list);
  }

  const formattedDate = format(parseISO(date), 'EEEE, dd/MM/yyyy');

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-purple-400 mb-1">
          <CalendarDays size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Events
          </span>
        </div>
        <div className="text-lg font-bold text-slate-50">{formattedDate}</div>
        <p className="text-xs text-slate-500 mt-0.5">
          {eventsForDay.length} event{eventsForDay.length !== 1 ? 's' : ''}
        </p>
      </div>

      {eventsForDay.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">No events for this date.</p>
      ) : (
        <div className="space-y-4">
          {Array.from(citiesWithEvents.entries()).map(([cityName, events]) => {
            const cityColor = getCityColor(cityName);
            return (
              <div key={cityName} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cityColor }} />
                  <span className="text-sm font-semibold text-slate-600">{cityName}</span>
                </div>

                <div className="space-y-1.5">
                  {events.map(event => {
                    const config = EVENT_TYPE_CONFIG[event.eventType];
                    const Icon = config.icon;
                    const addedBy = travelerMap.get(event.addedBy);

                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
                          <Icon size={16} className={config.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-300 truncate">{event.name}</span>
                            {event.link && (
                              <a href={event.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-500 hover:text-indigo-400">
                                <Link size={12} />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                              <Clock size={9} />
                              {event.allDay ? 'All day' : `${event.startTime} – ${event.endTime}`}
                            </span>
                            <span className={cn("text-[10px] font-medium", config.color)}>
                              {config.label}
                            </span>
                          </div>
                          {addedBy && (
                            <div className="flex items-center gap-1 mt-1">
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white font-bold"
                                style={{ backgroundColor: addedBy.color }}
                              >
                                {addedBy.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-[10px] text-slate-500">{addedBy.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
