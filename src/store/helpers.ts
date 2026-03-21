import { Itinerary, CitySegment, Segment, TransportSegment, Traveler, Attraction, ChecklistItem, TravelEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const MAX_UNDO = 50;
export const SYNC_DEBOUNCE_MS = 1500;

export function deepCloneItinerary(it: Itinerary): Itinerary {
  return JSON.parse(JSON.stringify(it, (key, value) => {
    if (key === 'id') return uuidv4();
    return value;
  }));
}

export function cleanupOrphanedCityData(it: Itinerary): Itinerary {
  const activeCities = new Set<string>();
  for (const t of it.travelers) {
    for (const seg of t.segments) {
      if (seg.type === "city") activeCities.add((seg as CitySegment).cityName);
    }
  }

  let changed = false;

  let attractions = it.attractions;
  if (attractions) {
    for (const city of Object.keys(attractions)) {
      if (!activeCities.has(city)) {
        changed = true;
        break;
      }
    }
    if (changed) {
      attractions = Object.fromEntries(
        Object.entries(attractions).filter(([city]) => activeCities.has(city)),
      );
    }
  }

  let checklists = it.checklists;
  if (checklists) {
    let clChanged = false;
    for (const city of Object.keys(checklists)) {
      if (!activeCities.has(city)) {
        clChanged = true;
        break;
      }
    }
    if (clChanged) {
      checklists = Object.fromEntries(
        Object.entries(checklists).filter(([city]) => activeCities.has(city)),
      );
      changed = true;
    }
  }

  let events = it.events;
  if (events) {
    let evChanged = false;
    for (const city of Object.keys(events)) {
      if (!activeCities.has(city)) {
        evChanged = true;
        break;
      }
    }
    if (evChanged) {
      events = Object.fromEntries(
        Object.entries(events).filter(([city]) => activeCities.has(city)),
      );
      changed = true;
    }
  }

  return changed ? { ...it, attractions, checklists, events } : it;
}

export function syncTravelSegments(it: Itinerary): Itinerary {
  return {
    ...it,
    travelers: it.travelers.map((t) => {
      const cities = t.segments
        .filter((s) => s.type === "city")
        .sort(
          (a, b) =>
            (a as CitySegment).startDate.localeCompare(
              (b as CitySegment).startDate,
            ) ||
            (a as CitySegment).startTime?.localeCompare(
              (b as CitySegment).startTime || "00:00",
            ) ||
            0,
        ) as CitySegment[];

      const existingTransports = t.segments.filter(
        (s) => s.type === "transport",
      ) as TransportSegment[];

      const oldCityOrder = t.segments
        .filter((s) => s.type === "city")
        .map((s) => s.id);

      const newSegments: Segment[] = [];

      for (let i = 0; i < cities.length; i++) {
        const currentCity = cities[i];
        newSegments.push(currentCity);

        if (i < cities.length - 1) {
          const nextCity = cities[i + 1];

          let transport: TransportSegment | undefined = existingTransports.find(
            (tr) => tr.from === currentCity.cityName && tr.to === nextCity.cityName,
          );

          if (!transport) {
            const oldIdxCurrent = oldCityOrder.indexOf(currentCity.id);
            const oldIdxNext = oldCityOrder.indexOf(nextCity.id);
            if (
              oldIdxCurrent !== -1 &&
              oldIdxNext !== -1 &&
              oldIdxNext === oldIdxCurrent + 1
            ) {
              const oldSegIdx = t.segments.findIndex(s => s.id === currentCity.id);
              if (oldSegIdx !== -1 && oldSegIdx < t.segments.length - 1) {
                const maybeTrans = t.segments[oldSegIdx + 1];
                if (maybeTrans.type === 'transport') {
                  transport = maybeTrans;
                }
              }
            }
          }

          const departureDate = currentCity.endDate;
          const departureTime = currentCity.endTime || "23:59";
          const arrivalDate = nextCity.startDate;
          const arrivalTime = nextCity.startTime || "00:00";

          if (transport) {
            newSegments.push({
              ...transport,
              from: currentCity.cityName,
              to: nextCity.cityName,
              departureDate,
              departureTime,
              arrivalDate,
              arrivalTime,
            });
          } else {
            newSegments.push({
              type: "transport",
              id: uuidv4(),
              mode: "flight",
              from: currentCity.cityName,
              to: nextCity.cityName,
              departureDate,
              departureTime,
              arrivalDate,
              arrivalTime,
            });
          }
        }
      }

      return { ...t, segments: newSegments };
    }),
  };
}

export interface DbRow {
  id: string;
  board_id: string;
  version_index: number;
  name: string;
  start_date: string;
  end_date: string;
  travelers: Traveler[];
  attractions: Record<string, Attraction[]>;
  checklists: Record<string, ChecklistItem[]>;
  events: Record<string, TravelEvent[]>;
  session_id?: string;
  updated_at?: string;
  yjs_state?: string | null;
}

export function rowToItinerary(row: DbRow): Itinerary {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    travelers: row.travelers || [],
    attractions: row.attractions || {},
    checklists: row.checklists || {},
    events: row.events || {},
  };
}

export function itineraryToRow(
  itinerary: Itinerary,
  boardId: string,
  versionIndex: number,
  sessionId: string
): DbRow {
  return {
    id: itinerary.id,
    board_id: boardId,
    version_index: versionIndex,
    name: itinerary.name,
    start_date: itinerary.startDate,
    end_date: itinerary.endDate,
    travelers: itinerary.travelers,
    attractions: itinerary.attractions || {},
    checklists: itinerary.checklists || {},
    events: itinerary.events || {},
    session_id: sessionId,
    updated_at: new Date().toISOString(),
  };
}

export interface UndoEntry {
  versions: Itinerary[];
  activeVersionIndex: number;
}

export interface SyncedStore {
  versions: Itinerary[];
}

export interface FocusedCell {
  travelerId: string;
  dayIndex: number;
}
