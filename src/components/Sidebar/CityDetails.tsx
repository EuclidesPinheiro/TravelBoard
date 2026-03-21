import { useState, useRef, useEffect } from 'react';
import { Traveler, CitySegment, TransportSegment, Stay, Attraction, AttractionCategory, ChecklistItem, TravelEvent, EventType, Itinerary, Segment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { MapPin, Calendar, Clock, Users, PlaneLanding, PlaneTakeoff, BedDouble, Plus, Trash2, ExternalLink, Star, ThumbsUp, DollarSign, ListChecks, Square, CheckSquare, Pencil, UserCheck, Lock, CalendarDays, Music, PartyPopper, Trophy, Link } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../utils/cn';

export function CityDetails({ traveler, segmentId }: { traveler: Traveler, segmentId: string }) {
  const { itinerary, setItinerary } = useItinerary();
  const segmentIndex = traveler.segments.findIndex(s => s.id === segmentId);
  const segment = traveler.segments[segmentIndex] as CitySegment;

  if (!segment) return null;

  // Find adjacent transports for exact arrival/departure times
  const prevSeg = segmentIndex > 0 ? traveler.segments[segmentIndex - 1] : null;
  const nextSeg = segmentIndex < traveler.segments.length - 1 ? traveler.segments[segmentIndex + 1] : null;
  const prevTransport = prevSeg && prevSeg.type === 'transport' ? prevSeg as TransportSegment : null;
  const nextTransport = nextSeg && nextSeg.type === 'transport' ? nextSeg as TransportSegment : null;

  // Real arrival: use segment's own times, fallback to transport if needed (though they should be synced)
  const arrivalDate = segment.startDate;
  const arrivalTime = segment.startTime || "";

  // Real departure: use segment's own times
  const departureDate = segment.endDate;
  const departureTime = segment.endTime || "";

  // City time boundaries for stay validation
  const cityMinDt = arrivalTime
    ? `${arrivalDate}T${arrivalTime}`
    : `${arrivalDate}T00:00`;
  const cityMaxDt = departureTime
    ? `${departureDate}T${departureTime}`
    : `${departureDate}T23:59`;

  const days =
    differenceInDays(parseISO(segment.endDate), parseISO(segment.startDate)) + 1;

  function toDateTime(date: string, time: string, defaultTime: string = "00:00"): string {
    return `${date}T${time || defaultTime}`;
  }

  function updateSegment(
    travelerId: string,
    segId: string,
    updater: (seg: any) => any,
  ) {
    setItinerary((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t) => {
        if (t.id !== travelerId) return t;
        return {
          ...t,
          segments: t.segments.map((s) => (s.id === segId ? updater(s) : s)),
        };
      }),
    }));
  }

  function renameRecordKey<T>(
    record: Record<string, T[]> | undefined,
    oldKey: string,
    newKey: string,
  ): Record<string, T[]> | undefined {
    if (!record || oldKey === newKey || !(oldKey in record)) return record;

    const next = { ...record };
    const movedItems = next[oldKey];
    delete next[oldKey];
    next[newKey] = next[newKey] ? [...next[newKey], ...movedItems] : movedItems;
    return next;
  }

  function updateCityAndLinkedSegments(
    segmentUpdater: (current: CitySegment) => CitySegment,
    linkedUpdater?: (context: {
      segment: CitySegment;
      updatedSegment: CitySegment;
      prevTransport: TransportSegment | null;
      nextTransport: TransportSegment | null;
    }) => {
      prevTransport?: TransportSegment | null;
      nextTransport?: TransportSegment | null;
    },
    itineraryUpdater?: (
      prev: Itinerary,
      currentSegment: CitySegment,
      updatedSegment: CitySegment,
    ) => Partial<Itinerary>,
  ) {
    setItinerary((prev) => {
      const travelerIdx = prev.travelers.findIndex((t) => t.id === traveler.id);
      if (travelerIdx === -1) return prev;

      const currentTraveler = prev.travelers[travelerIdx];
      const segIdx = currentTraveler.segments.findIndex((s) => s.id === segmentId);
      if (segIdx === -1) return prev;

      const currentSegment = currentTraveler.segments[segIdx] as CitySegment;
      const nextSegments = [...currentTraveler.segments] as Segment[];
      const prevTransportSegment =
        segIdx > 0 && nextSegments[segIdx - 1].type === 'transport'
          ? (nextSegments[segIdx - 1] as TransportSegment)
          : null;
      const nextTransportSegment =
        segIdx < nextSegments.length - 1 && nextSegments[segIdx + 1].type === 'transport'
          ? (nextSegments[segIdx + 1] as TransportSegment)
          : null;

      const updatedSegment = segmentUpdater(currentSegment);
      nextSegments[segIdx] = updatedSegment;

      const linkedUpdates = linkedUpdater?.({
        segment: currentSegment,
        updatedSegment,
        prevTransport: prevTransportSegment,
        nextTransport: nextTransportSegment,
      });

      if (prevTransportSegment && linkedUpdates?.prevTransport) {
        nextSegments[segIdx - 1] = linkedUpdates.prevTransport;
      }

      if (nextTransportSegment && linkedUpdates?.nextTransport) {
        nextSegments[segIdx + 1] = linkedUpdates.nextTransport;
      }

      const nextTravelers = [...prev.travelers];
      nextTravelers[travelerIdx] = {
        ...currentTraveler,
        segments: nextSegments,
      };

      const nextItinerary = {
        ...prev,
        travelers: nextTravelers,
      };

      return itineraryUpdater
        ? { ...nextItinerary, ...itineraryUpdater(prev, currentSegment, updatedSegment) }
        : nextItinerary;
    });
  }

  function handleArrivalDateChange(newDate: string) {
    if (!newDate) return;
    const newArrival = toDateTime(newDate, arrivalTime);
    const depDt = toDateTime(departureDate, departureTime, "23:59");
    if (newArrival > depDt) return;
    updateCityAndLinkedSegments(
      (s) => ({ ...s, startDate: newDate }),
      ({ prevTransport: linkedPrevTransport }) => ({
        prevTransport: linkedPrevTransport
          ? { ...linkedPrevTransport, arrivalDate: newDate }
          : null,
      }),
    );
  }

  function handleArrivalTimeChange(newTime: string) {
    if (!newTime) return;
    const newArrival = toDateTime(arrivalDate, newTime);
    const depDt = toDateTime(departureDate, departureTime, "23:59");
    if (newArrival > depDt) return;
    updateCityAndLinkedSegments(
      (s) => ({ ...s, startTime: newTime }),
      ({ prevTransport: linkedPrevTransport }) => ({
        prevTransport: linkedPrevTransport
          ? { ...linkedPrevTransport, arrivalTime: newTime }
          : null,
      }),
    );
  }

  function handleDepartureDateChange(newDate: string) {
    if (!newDate) return;
    const arrDt = toDateTime(arrivalDate, arrivalTime);
    const newDeparture = toDateTime(newDate, departureTime, "23:59");
    if (newDeparture < arrDt) return;
    updateCityAndLinkedSegments(
      (s) => ({ ...s, endDate: newDate }),
      ({ nextTransport: linkedNextTransport }) => ({
        nextTransport: linkedNextTransport
          ? { ...linkedNextTransport, departureDate: newDate }
          : null,
      }),
    );
  }

  function handleDepartureTimeChange(newTime: string) {
    if (!newTime) return;
    const arrDt = toDateTime(arrivalDate, arrivalTime);
    const newDeparture = toDateTime(departureDate, newTime);
    if (newDeparture < arrDt) return;
    updateCityAndLinkedSegments(
      (s) => ({ ...s, endTime: newTime }),
      ({ nextTransport: linkedNextTransport }) => ({
        nextTransport: linkedNextTransport
          ? { ...linkedNextTransport, departureTime: newTime }
          : null,
      }),
    );
  }

  // Find co-presence
  const start = parseISO(segment.startDate);
  const end = parseISO(segment.endDate);

  const coPresent = itinerary.travelers.filter(t => t.id !== traveler.id).map(t => {
    const overlappingCities = t.segments.filter(s => {
      if (s.type !== 'city') return false;
      const city = s as CitySegment;
      if (city.cityName.toLowerCase() !== segment.cityName.toLowerCase()) return false;
      const cStart = parseISO(city.startDate);
      const cEnd = parseISO(city.endDate);
      return (cStart <= end && cEnd >= start);
    }) as CitySegment[];
    return { traveler: t, overlaps: overlappingCities };
  }).filter(item => item.overlaps.length > 0);

  // Other travelers for "shared with" picker
  const otherTravelers = itinerary.travelers.filter(t => t.id !== traveler.id);

  // Shared stays: stays from other travelers in the same city that include current traveler in sharedWith
  const sharedStaysFromOthers = otherTravelers.flatMap(t => {
    return t.segments
      .filter(s => s.type === 'city' && (s as CitySegment).cityName.toLowerCase() === segment.cityName.toLowerCase())
      .flatMap(s => ((s as CitySegment).stays ?? []).filter(st => st.sharedWith.includes(traveler.id)))
      .map(st => ({ stay: st, ownerName: t.name, ownerColor: t.color }));
  });

  function formatDateShort(dateStr: string): string {
    return format(parseISO(dateStr), 'dd/MM');
  }

  // --- Stays management ---
  const stays = segment.stays ?? [];

  function updateStays(newStays: Stay[]) {
    updateSegment(traveler.id, segment.id, s => ({ ...s, stays: newStays }));
  }

  function addStay(stay: Stay) {
    updateStays([...stays, stay]);
  }

  function removeStay(stayId: string) {
    updateStays(stays.filter(s => s.id !== stayId));
  }

  function updateStay(stayId: string, updater: (s: Stay) => Stay) {
    updateStays(stays.map(s => s.id === stayId ? updater(s) : s));
  }

  function handleCityNameChange(newName: string) {
    updateCityAndLinkedSegments(
      (s) => ({
        ...s,
        cityName: newName,
      }),
      ({ prevTransport: linkedPrevTransport, nextTransport: linkedNextTransport }) => ({
        prevTransport: linkedPrevTransport
          ? { ...linkedPrevTransport, to: newName }
          : null,
        nextTransport: linkedNextTransport
          ? { ...linkedNextTransport, from: newName }
          : null,
      }),
      (prev, currentSegment, updatedSegment) => ({
        attractions: renameRecordKey(prev.attractions, currentSegment.cityName, updatedSegment.cityName),
        checklists: renameRecordKey(prev.checklists, currentSegment.cityName, updatedSegment.cityName),
        events: renameRecordKey(prev.events, currentSegment.cityName, updatedSegment.cityName),
      }),
    );
  }

  const locked = traveler.locked === true;

  return (
    <div className="space-y-6">
      {locked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 border border-amber-800/50 rounded-lg">
          <Lock size={14} className="text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-amber-400">This traveler is locked</span>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2 text-indigo-400 mb-1">
            <MapPin size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              City Stay
            </span>
          </div>
          {locked ? (
            <>
              <div className="text-xl font-bold text-slate-50 truncate">{segment.cityName}</div>
              {segment.country && <div className="text-sm text-slate-500 truncate">{segment.country}</div>}
            </>
          ) : (
            <>
              <input
                type="text"
                value={segment.cityName}
                onChange={(e) => handleCityNameChange(e.target.value)}
                className="w-full text-xl font-bold text-slate-50 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none truncate"
              />
              <input
                type="text"
                value={segment.country || ""}
                onChange={(e) =>
                  updateSegment(traveler.id, segment.id, (s) => ({
                    ...s,
                    country: e.target.value,
                  }))
                }
                placeholder="Add country..."
                className="w-full text-sm text-slate-500 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none truncate"
              />
            </>
          )}
        </div>
        {!locked && (
          <button
            onClick={() => {
              if (confirm(`Remove ${segment.cityName} from this traveler?`)) {
                setItinerary((prev) => ({
                  ...prev,
                  travelers: prev.travelers.map((t) => {
                    if (t.id !== traveler.id) return t;
                    return {
                      ...t,
                      segments: t.segments.filter((s) => s.id !== segmentId),
                    };
                  }),
                }));
              }
            }}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors shrink-0"
            title="Delete city"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl p-4 space-y-3 border border-slate-800">
        {/* Arrival */}
        <div className="flex items-start gap-3">
          <PlaneLanding className="text-green-500 shrink-0 mt-0.5" size={16} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 mb-1">Arrival</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={arrivalDate}
                max={departureDate}
                onChange={(e) => handleArrivalDateChange(e.target.value)}
                disabled={locked}
                className={cn("text-sm font-medium text-slate-50 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400 w-[130px]", locked && "opacity-60 cursor-not-allowed")}
              />
              <input
                type="time"
                value={arrivalTime}
                onChange={(e) => handleArrivalTimeChange(e.target.value)}
                disabled={locked}
                className={cn("text-sm font-medium text-indigo-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400 w-[90px]", locked && "opacity-60 cursor-not-allowed")}
              />
            </div>
            {prevTransport && (
              <div className="text-xs text-slate-500 mt-1">from {prevTransport.from}</div>
            )}
          </div>
        </div>

        {/* Departure */}
        <div className="flex items-start gap-3 pt-2 border-t border-slate-700/60">
          <PlaneTakeoff className="text-red-400 shrink-0 mt-0.5" size={16} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 mb-1">Departure</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={departureDate}
                min={arrivalDate}
                onChange={(e) => handleDepartureDateChange(e.target.value)}
                disabled={locked}
                className={cn("text-sm font-medium text-slate-50 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400 w-[130px]", locked && "opacity-60 cursor-not-allowed")}
              />
              <input
                type="time"
                value={departureTime}
                onChange={(e) => handleDepartureTimeChange(e.target.value)}
                disabled={locked}
                className={cn("text-sm font-medium text-indigo-400 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400 w-[90px]", locked && "opacity-60 cursor-not-allowed")}
              />
            </div>
            {nextTransport && (
              <div className="text-xs text-slate-500 mt-1">to {nextTransport.to}</div>
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-start gap-3 pt-2 border-t border-slate-700/60">
          <Calendar className="text-slate-500 shrink-0 mt-0.5" size={16} />
          <div>
            <div className="text-xs text-slate-500">Duration</div>
            <div className="text-sm font-medium text-slate-50">{days} {days === 1 ? 'day' : 'days'}</div>
          </div>
        </div>
      </div>

      {/* Stays / Accommodation */}
      <StaysSection
        key={segment.id}
        traveler={traveler}
        stays={stays}
        arrivalDate={arrivalDate}
        arrivalTime={arrivalTime}
        departureDate={departureDate}
        departureTime={departureTime}
        cityMinDt={cityMinDt}
        cityMaxDt={cityMaxDt}
        otherTravelers={otherTravelers}
        sharedStaysFromOthers={sharedStaysFromOthers}
        onAdd={addStay}
        onRemove={removeStay}
        onUpdate={updateStay}
        locked={locked}
      />

      {/* Attractions */}
      <AttractionsSection
        cityName={segment.cityName}
        travelerId={traveler.id}
        allTravelers={itinerary.travelers}
        attractions={itinerary.attractions?.[segment.cityName] ?? []}
        locked={locked}
        onUpdate={(newAttractions) => {
          setItinerary(prev => ({
            ...prev,
            attractions: {
              ...prev.attractions,
              [segment.cityName]: newAttractions,
            },
          }));
        }}
      />

      {/* Checklist */}
      <ChecklistSection
        cityName={segment.cityName}
        travelerId={traveler.id}
        allTravelers={itinerary.travelers}
        items={itinerary.checklists?.[segment.cityName] ?? []}
        locked={locked}
        onUpdate={(newItems) => {
          setItinerary(prev => ({
            ...prev,
            checklists: {
              ...prev.checklists,
              [segment.cityName]: newItems,
            },
          }));
        }}
      />

      {/* Events */}
      <EventsSection
        cityName={segment.cityName}
        travelerId={traveler.id}
        allTravelers={itinerary.travelers}
        events={itinerary.events?.[segment.cityName] ?? []}
        cityStartDate={segment.startDate}
        cityEndDate={segment.endDate}
        locked={locked}
        onUpdate={(newEvents) => {
          setItinerary(prev => ({
            ...prev,
            events: {
              ...prev.events,
              [segment.cityName]: newEvents,
            },
          }));
        }}
      />

      {coPresent.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
            <Users size={16} className="text-indigo-400" />
            Group Overlaps
          </h4>
          <div className="space-y-2">
            {coPresent.map(({ traveler: t, overlaps }) => (
              <div key={t.id} className="flex items-center justify-between bg-slate-950 border border-slate-700 rounded-lg p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: t.color }}>
                    {t.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-600">{t.name}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {overlaps.map(o => `${formatDateShort(o.startDate)} - ${formatDateShort(o.endDate)}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

// --- Stays Section Component ---

interface SharedStayInfo {
  stay: Stay;
  ownerName: string;
  ownerColor: string;
}

interface StaysSectionProps {
  key?: string;
  traveler: Traveler;
  stays: Stay[];
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  cityMinDt: string;
  cityMaxDt: string;
  otherTravelers: Traveler[];
  sharedStaysFromOthers: SharedStayInfo[];
  onAdd: (stay: Stay) => void;
  onRemove: (stayId: string) => void;
  onUpdate: (stayId: string, updater: (s: Stay) => Stay) => void;
  locked?: boolean;
}

function getDefaultTimes(arrDate: string, arrTime: string, depDate: string, depTime: string) {
  let checkIn = arrTime || '14:00';
  let checkOut = depTime || '11:00';
  // If same day (or overlap), ensure checkIn < checkOut
  if (arrDate >= depDate && checkIn >= checkOut) {
    checkIn = arrTime || '00:00';
    checkOut = depTime || '23:59';
  }
  return { checkIn, checkOut };
}

function StaysSection({ traveler, stays, arrivalDate, arrivalTime, departureDate, departureTime, cityMinDt, cityMaxDt, otherTravelers, sharedStaysFromOthers, onAdd, onRemove, onUpdate, locked }: StaysSectionProps) {
  const defaults = getDefaultTimes(arrivalDate, arrivalTime, departureDate, departureTime);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newCheckInDate, setNewCheckInDate] = useState(arrivalDate);
  const [newCheckInTime, setNewCheckInTime] = useState(defaults.checkIn);
  const [newCheckOutDate, setNewCheckOutDate] = useState(departureDate);
  const [newCheckOutTime, setNewCheckOutTime] = useState(defaults.checkOut);
  const [newSharedWith, setNewSharedWith] = useState<string[]>([]);
  const [newCost, setNewCost] = useState('');
  const [newPaidBy, setNewPaidBy] = useState<string>(traveler.id);
  const [newPaidParts, setNewPaidParts] = useState<Record<string, boolean>>({});

  function resetForm() {
    const defs = getDefaultTimes(arrivalDate, arrivalTime, departureDate, departureTime);
    setNewName('');
    setNewLink('');
    setNewCheckInDate(arrivalDate);
    setNewCheckInTime(defs.checkIn);
    setNewCheckOutDate(departureDate);
    setNewCheckOutTime(defs.checkOut);
    setNewSharedWith([]);
    setNewCost('');
    setNewPaidBy(traveler.id);
    setNewPaidParts({});
    setIsAdding(false);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    const checkInDt = `${newCheckInDate}T${newCheckInTime}`;
    const checkOutDt = `${newCheckOutDate}T${newCheckOutTime}`;
    if (checkInDt > checkOutDt) return;
    if (checkInDt < cityMinDt || checkOutDt > cityMaxDt) return;

    const parsedCost = parseFloat(newCost);
    onAdd({
      id: uuidv4(),
      name: newName.trim(),
      link: newLink.trim() || undefined,
      checkInDate: newCheckInDate,
      checkInTime: newCheckInTime,
      checkOutDate: newCheckOutDate,
      checkOutTime: newCheckOutTime,
      sharedWith: newSharedWith,
      cost: !isNaN(parsedCost) && parsedCost > 0 ? parsedCost : undefined,
      paidBy: newPaidBy,
      paidParts: newPaidParts,
    });
    resetForm();
  }

  const newCheckInDt = `${newCheckInDate}T${newCheckInTime}`;
  const newCheckOutDt = `${newCheckOutDate}T${newCheckOutTime}`;
  const isFormValid = newName.trim() !== '' && newCheckInDt <= newCheckOutDt && newCheckInDt >= cityMinDt && newCheckOutDt <= cityMaxDt;

  function toggleShared(travelerId: string) {
    setNewSharedWith(prev =>
      prev.includes(travelerId) ? prev.filter(id => id !== travelerId) : [...prev, travelerId]
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
        <BedDouble size={16} className="text-amber-500" />
        Accommodation
      </h4>

      {/* Existing stays */}
      {stays.map(stay => (
        <StayCard
          key={stay.id}
          traveler={traveler}
          stay={stay}
          otherTravelers={otherTravelers}
          cityMinDt={cityMinDt}
          cityMaxDt={cityMaxDt}
          onRemove={() => onRemove(stay.id)}
          onUpdate={(updater) => onUpdate(stay.id, updater)}
          locked={locked}
        />
      ))}

      {/* Shared stays from other travelers that haven't been adopted yet */}
      {!locked && (() => {
        const existingNames = new Set(stays.map(s => s.name.toLowerCase()));
        const available = sharedStaysFromOthers.filter(s => !existingNames.has(s.stay.name.toLowerCase()));
        if (available.length === 0) return null;

        function handleAdopt(shared: SharedStayInfo) {
          onAdd({
            id: uuidv4(),
            name: shared.stay.name,
            link: shared.stay.link,
            checkInDate: shared.stay.checkInDate,
            checkInTime: shared.stay.checkInTime,
            checkOutDate: shared.stay.checkOutDate,
            checkOutTime: shared.stay.checkOutTime,
            sharedWith: [],
            cost: shared.stay.cost,
          });
        }

        return (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 flex items-center gap-1.5">
              <UserCheck size={12} />
              Shared with you
            </div>
            {available.map(({ stay: s, ownerName, ownerColor }) => (
              <button
                key={s.id}
                onClick={() => handleAdopt({ stay: s, ownerName, ownerColor })}
                className="w-full text-left bg-amber-50/60 border border-amber-200 rounded-lg p-2.5 hover:bg-amber-50 hover:border-amber-300 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold shrink-0"
                    style={{ backgroundColor: ownerColor }}
                  >
                    {ownerName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">{s.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {format(parseISO(s.checkInDate), 'dd/MM')} {s.checkInTime} – {format(parseISO(s.checkOutDate), 'dd/MM')} {s.checkOutTime}
                      {s.cost != null && <span className="ml-1.5 text-emerald-400">${s.cost.toFixed(2)}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    Use
                  </span>
                </div>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Add form */}
      {locked ? null : isAdding ? (
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-3 shadow-sm">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={60}
            placeholder="Accommodation name..."
            className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
            autoFocus
          />
          <input
            type="url"
            value={newLink}
            onChange={e => setNewLink(e.target.value)}
            maxLength={300}
            placeholder="Link (optional)"
            className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
          />

          <div>
            <div className="text-xs text-slate-500 mb-1">Check-in</div>
            <div className="flex gap-2">
              <input type="date" value={newCheckInDate} min={arrivalDate} max={departureDate} onChange={e => setNewCheckInDate(e.target.value)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <input type="time" value={newCheckInTime} onChange={e => setNewCheckInTime(e.target.value)} className="w-[80px] text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Check-out</div>
            <div className="flex gap-2">
              <input type="date" value={newCheckOutDate} min={newCheckInDate} max={departureDate} onChange={e => setNewCheckOutDate(e.target.value)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <input type="time" value={newCheckOutTime} onChange={e => setNewCheckOutTime(e.target.value)} className="w-[80px] text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Cost (total)</div>
            <div className="relative">
              <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                value={newCost}
                onChange={e => setNewCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1.5">Paid by</div>
            <select
              value={newPaidBy}
              onChange={e => setNewPaidBy(e.target.value)}
              className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300"
            >
              {[traveler, ...otherTravelers].map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {otherTravelers.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Shared with</div>
              <div className="flex flex-wrap gap-1.5">
                {otherTravelers.map(t => {
                  const isPayer = t.id === newPaidBy;
                  const selected = isPayer || newSharedWith.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => !isPayer && toggleShared(t.id)}
                      disabled={isPayer}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors border",
                        selected
                          ? "border-indigo-700 bg-indigo-900/40 text-indigo-300"
                          : "border-slate-700 bg-slate-950 text-slate-500 hover:bg-slate-900",
                        isPayer && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name.substring(0, 2).toUpperCase()}
                      </div>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(() => {
            const sharers = [traveler, ...otherTravelers].filter(t => 
              t.id !== newPaidBy && (t.id === traveler.id || newSharedWith.includes(t.id))
            );

            if (sharers.length === 0) return null;

            return (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">Paid his part:</div>
                <div className="flex flex-wrap gap-1.5">
                  {sharers.map(t => {
                    const hasPaid = newPaidParts[t.id] || false;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setNewPaidParts(prev => ({ ...prev, [t.id]: !hasPaid }))}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors border",
                          hasPaid
                            ? "border-emerald-700 bg-emerald-900/40 text-emerald-300"
                            : "border-slate-700 bg-slate-950 text-slate-500 hover:bg-slate-900"
                        )}
                      >
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.name.substring(0, 2).toUpperCase()}
                        </div>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!isFormValid}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                isFormValid
                  ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              Add
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-950 border border-slate-700 rounded-md hover:bg-slate-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-indigo-400 bg-indigo-900/40/50 border border-dashed border-indigo-800 rounded-lg hover:bg-indigo-900/40 hover:border-indigo-700 transition-colors"
        >
          <Plus size={14} />
          Add Accommodation
        </button>
      )}
    </div>
  );
}

// --- Stay Card Component ---

interface StayCardProps {
  key?: string;
  traveler: Traveler;
  stay: Stay;
  otherTravelers: Traveler[];
  cityMinDt: string;
  cityMaxDt: string;
  onRemove: () => void;
  onUpdate: (updater: (s: Stay) => Stay) => void;
  locked?: boolean;
}

function StayCard({ traveler, stay, otherTravelers, cityMinDt, cityMaxDt, onRemove, onUpdate, locked }: StayCardProps) {
  const sharedTravelers = otherTravelers.filter(t => stay.sharedWith.includes(t.id));
  const splitCount = 1 + stay.sharedWith.length;
  const perPerson = stay.cost ? stay.cost / splitCount : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(stay.name);
  const [editLink, setEditLink] = useState(stay.link ?? '');
  const [editCheckInDate, setEditCheckInDate] = useState(stay.checkInDate);
  const [editCheckInTime, setEditCheckInTime] = useState(stay.checkInTime);
  const [editCheckOutDate, setEditCheckOutDate] = useState(stay.checkOutDate);
  const [editCheckOutTime, setEditCheckOutTime] = useState(stay.checkOutTime);
  const [editCost, setEditCost] = useState(stay.cost?.toString() ?? '');
  const [editSharedWith, setEditSharedWith] = useState<string[]>(stay.sharedWith);
  const [editPaidBy, setEditPaidBy] = useState<string>(stay.paidBy ?? traveler.id);
  const [editPaidParts, setEditPaidParts] = useState<Record<string, boolean>>(stay.paidParts ?? {});

  function startEdit() {
    setEditName(stay.name);
    setEditLink(stay.link ?? '');
    setEditCheckInDate(stay.checkInDate);
    setEditCheckInTime(stay.checkInTime);
    setEditCheckOutDate(stay.checkOutDate);
    setEditCheckOutTime(stay.checkOutTime);
    setEditCost(stay.cost?.toString() ?? '');
    setEditSharedWith([...stay.sharedWith]);
    setEditPaidBy(stay.paidBy ?? traveler.id);
    setEditPaidParts(stay.paidParts ?? {});
    setIsEditing(true);
  }

  function handleSave() {
    if (!editName.trim()) return;
    const checkInDt = `${editCheckInDate}T${editCheckInTime}`;
    const checkOutDt = `${editCheckOutDate}T${editCheckOutTime}`;
    if (checkInDt > checkOutDt) return;
    if (checkInDt < cityMinDt || checkOutDt > cityMaxDt) return;

    const parsedCost = parseFloat(editCost);
    onUpdate(s => ({
      ...s,
      name: editName.trim(),
      link: editLink.trim() || undefined,
      checkInDate: editCheckInDate,
      checkInTime: editCheckInTime,
      checkOutDate: editCheckOutDate,
      checkOutTime: editCheckOutTime,
      cost: !isNaN(parsedCost) && parsedCost > 0 ? parsedCost : undefined,
      sharedWith: editSharedWith,
      paidBy: editPaidBy,
      paidParts: editPaidParts,
    }));
    setIsEditing(false);
  }

  const editCheckInDt = `${editCheckInDate}T${editCheckInTime}`;
  const editCheckOutDt = `${editCheckOutDate}T${editCheckOutTime}`;
  const isEditValid = editName.trim() !== '' && editCheckInDt <= editCheckOutDt && editCheckInDt >= cityMinDt && editCheckOutDt <= cityMaxDt;

  function toggleEditShared(travelerId: string) {
    setEditSharedWith(prev =>
      prev.includes(travelerId) ? prev.filter(id => id !== travelerId) : [...prev, travelerId]
    );
  }

  if (isEditing) {
    return (
      <div className="bg-slate-950 border border-indigo-800 rounded-lg p-3 space-y-3 shadow-sm ring-1 ring-indigo-900">
        <input
          type="text"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          maxLength={60}
          placeholder="Accommodation name..."
          className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
          autoFocus
        />
        <input
          type="url"
          value={editLink}
          onChange={e => setEditLink(e.target.value)}
          maxLength={300}
          placeholder="Link (optional)"
          className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
        />

        <div>
          <div className="text-xs text-slate-500 mb-1">Check-in</div>
          <div className="flex gap-2">
            <input type="date" value={editCheckInDate} min={cityMinDt.slice(0, 10)} max={cityMaxDt.slice(0, 10)} onChange={e => setEditCheckInDate(e.target.value)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input type="time" value={editCheckInTime} onChange={e => setEditCheckInTime(e.target.value)} className="w-[80px] text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-1">Check-out</div>
          <div className="flex gap-2">
            <input type="date" value={editCheckOutDate} min={editCheckInDate} max={cityMaxDt.slice(0, 10)} onChange={e => setEditCheckOutDate(e.target.value)} className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input type="time" value={editCheckOutTime} onChange={e => setEditCheckOutTime(e.target.value)} className="w-[80px] text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-1">Cost (total)</div>
          <div className="relative">
            <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="number"
              value={editCost}
              onChange={e => setEditCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-1.5">Paid by</div>
          <select
            value={editPaidBy}
            onChange={e => setEditPaidBy(e.target.value)}
            className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300"
          >
            {[traveler, ...otherTravelers].map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {otherTravelers.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1.5">Shared with</div>
            <div className="flex flex-wrap gap-1.5">
              {otherTravelers.map(t => {
                const isPayer = t.id === editPaidBy;
                const selected = isPayer || editSharedWith.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => !isPayer && toggleEditShared(t.id)}
                    disabled={isPayer}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors border",
                      selected
                        ? "border-indigo-700 bg-indigo-900/40 text-indigo-300"
                        : "border-slate-700 bg-slate-950 text-slate-500 hover:bg-slate-900",
                      isPayer && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.name.substring(0, 2).toUpperCase()}
                    </div>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(() => {
          const sharers = [traveler, ...otherTravelers].filter(t => 
            t.id !== editPaidBy && (t.id === traveler.id || editSharedWith.includes(t.id))
          );

          if (sharers.length === 0) return null;

          return (
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Paid his part:</div>
              <div className="flex flex-wrap gap-1.5">
                {sharers.map(t => {
                  const hasPaid = editPaidParts[t.id] || false;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setEditPaidParts(prev => ({ ...prev, [t.id]: !hasPaid }))}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors border",
                        hasPaid
                          ? "border-emerald-700 bg-emerald-900/40 text-emerald-300"
                          : "border-slate-700 bg-slate-950 text-slate-500 hover:bg-slate-900"
                      )}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name.substring(0, 2).toUpperCase()}
                      </div>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!isEditValid}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              isEditValid
                ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-950 border border-slate-700 rounded-md hover:bg-slate-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{stay.name}</div>
          {stay.link && (
            <a
              href={stay.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 truncate"
            >
              <ExternalLink size={10} />
              <span className="truncate">{stay.link}</span>
            </a>
          )}
        </div>
        {!locked && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={startEdit}
              className="p-1 text-slate-600 hover:text-indigo-400 transition-colors"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onRemove}
              className="p-1 text-slate-600 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 text-xs text-slate-500">
        <div>
          <span className="text-slate-500">In: </span>
          {format(parseISO(stay.checkInDate), 'dd/MM')} {stay.checkInTime}
        </div>
        <div>
          <span className="text-slate-500">Out: </span>
          {format(parseISO(stay.checkOutDate), 'dd/MM')} {stay.checkOutTime}
        </div>
      </div>

      {/* Cost display / edit */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
        <DollarSign size={12} className="text-emerald-500 shrink-0" />
        <div className="relative flex-1">
          <input
            type="number"
            value={stay.cost ?? ''}
            onChange={e => {
              const val = parseFloat(e.target.value);
              onUpdate(s => ({ ...s, cost: !isNaN(val) && val > 0 ? val : undefined }));
            }}
            placeholder="Cost..."
            min="0"
            step="0.01"
            disabled={locked}
            className={cn("w-full text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder-slate-400", locked && "opacity-60 cursor-not-allowed")}
          />
        </div>
        {stay.cost && splitCount > 1 && (
          <span className="text-[10px] text-emerald-400 font-medium whitespace-nowrap">
            ${perPerson.toFixed(2)}/person
          </span>
        )}
      </div>

      {(stay.cost != null || stay.paidBy) && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Paid by:</span>
            {(() => {
              const payerId = stay.paidBy ?? traveler.id;
              const payer = [traveler, ...otherTravelers].find(t => t.id === payerId);
              if (!payer) return null;
              return (
                <div className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold ring-1 ring-white"
                    style={{ backgroundColor: payer.color }}
                    title={payer.name}
                  >
                    {payer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[10px] text-slate-300">{payer.name}</span>
                </div>
              );
            })()}
          </div>

          {(() => {
            const payerId = stay.paidBy ?? traveler.id;
            const sharers = [traveler, ...otherTravelers].filter(t => 
              t.id !== payerId && (t.id === traveler.id || stay.sharedWith.includes(t.id))
            );
            if (sharers.length === 0) return null;
            
            return (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[10px] text-slate-500">Paid his part:</span>
                <div className="flex flex-wrap gap-1.5">
                  {sharers.map(t => {
                    const hasPaid = stay.paidParts?.[t.id] ?? false;
                    return (
                      <div key={t.id} className="flex items-center gap-1 bg-slate-900 rounded-full pl-1 pr-1.5 py-0.5 border border-slate-700">
                        <div className={cn(
                          "w-3 h-3 rounded flex items-center justify-center text-[8px] text-white border",
                          hasPaid ? "bg-emerald-500 border-emerald-600" : "bg-slate-800 border-slate-600"
                        )}>
                          {hasPaid && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                        </div>
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                          style={{ backgroundColor: t.color }}
                          title={t.name}
                        >
                          {t.name.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// --- Attractions Section Component ---

interface AttractionsSectionProps {
  cityName: string;
  travelerId: string;
  allTravelers: Traveler[];
  attractions: Attraction[];
  onUpdate: (newAttractions: Attraction[]) => void;
  locked?: boolean;
}

const CATEGORY_CONFIG: Record<AttractionCategory, { label: string; color: string; bg: string; border: string }> = {
  museum:  { label: 'Museu e Arquitetura',  color: '#8B5CF6', bg: 'bg-violet-50',  border: 'border-violet-300' },
  science: { label: 'Ciência e Tecnologia', color: '#0EA5E9', bg: 'bg-sky-50',     border: 'border-sky-300' },
  nature:  { label: 'Natureza',             color: '#22C55E', bg: 'bg-green-50',   border: 'border-green-300' },
  yolo:    { label: 'YOLO',                 color: '#F97316', bg: 'bg-orange-50',  border: 'border-orange-300' },
};

function AttractionsSection({ cityName, travelerId, allTravelers, attractions, onUpdate, locked }: AttractionsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newCategory, setNewCategory] = useState<AttractionCategory>('museum');
  const [newAttrCost, setNewAttrCost] = useState('');
  const [newComment, setNewComment] = useState('');

  // Sort by votes descending
  const sorted = [...attractions].sort((a, b) => b.votes.length - a.votes.length);
  const topVotes = sorted.length > 0 ? sorted[0].votes.length : 0;

  function resetForm() {
    setNewName('');
    setNewLink('');
    setNewCategory('museum');
    setNewAttrCost('');
    setNewComment('');
    setIsAdding(false);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    const parsedCost = parseFloat(newAttrCost);
    const attraction: Attraction = {
      id: uuidv4(),
      name: newName.trim(),
      link: newLink.trim() || undefined,
      category: newCategory,
      addedBy: travelerId,
      votes: [travelerId], // auto-vote by creator
      cost: !isNaN(parsedCost) && parsedCost > 0 ? parsedCost : undefined,
      comment: newComment.trim() || undefined,
    };
    onUpdate([...attractions, attraction]);
    resetForm();
  }

  function toggleVote(attractionId: string) {
    onUpdate(attractions.map(a => {
      if (a.id !== attractionId) return a;
      const hasVoted = a.votes.includes(travelerId);
      return {
        ...a,
        votes: hasVoted ? a.votes.filter(v => v !== travelerId) : [...a.votes, travelerId],
      };
    }));
  }

  function removeAttraction(attractionId: string) {
    onUpdate(attractions.filter(a => a.id !== attractionId));
  }

  function getTravelerById(id: string) {
    return allTravelers.find(t => t.id === id);
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
        <Star size={16} className="text-yellow-500" />
        Attractions
      </h4>

      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map(attraction => {
            const hasVoted = attraction.votes.includes(travelerId);
            const isTop = attraction.votes.length === topVotes && topVotes > 0;
            const addedByTraveler = getTravelerById(attraction.addedBy);
            const isOwner = attraction.addedBy === travelerId;
            const catConfig = CATEGORY_CONFIG[attraction.category] ?? CATEGORY_CONFIG.museum;

            return (
              <div
                key={attraction.id}
                className={cn(
                  "bg-slate-950 border rounded-lg p-3 shadow-sm space-y-2 transition-colors",
                  isTop ? "border-yellow-700 bg-yellow-900/40/30" : "border-slate-700"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isTop && <Star size={12} className="text-yellow-500 shrink-0 fill-yellow-500" />}
                      <span className="text-sm font-medium text-slate-200 truncate">{attraction.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${catConfig.color}18`, color: catConfig.color }}
                      >
                        {catConfig.label}
                      </span>
                      {attraction.cost && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400">
                          ${attraction.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {attraction.link && (
                      <a
                        href={attraction.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 truncate"
                      >
                        <ExternalLink size={10} />
                        <span className="truncate">{attraction.link}</span>
                      </a>
                    )}
                    {attraction.comment && (
                      <p className="text-xs text-slate-500 mt-1 italic leading-snug">
                        &ldquo;{attraction.comment}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => !locked && toggleVote(attraction.id)}
                      disabled={locked}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                        hasVoted
                          ? "bg-indigo-800/60 text-indigo-300 hover:bg-indigo-200"
                          : "bg-slate-800 text-slate-500 hover:bg-slate-700",
                        locked && "opacity-60 cursor-not-allowed"
                      )}
                      title={hasVoted ? "Remove vote" : "Vote"}
                    >
                      <ThumbsUp size={12} className={hasVoted ? "fill-indigo-600" : ""} />
                      {attraction.votes.length}
                    </button>
                    {isOwner && !locked && (
                      <button
                        onClick={() => removeAttraction(attraction.id)}
                        className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Voter avatars + added by */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {attraction.votes.length > 0 && (
                      <div className="flex -space-x-1">
                        {attraction.votes.map(voterId => {
                          const voter = getTravelerById(voterId);
                          if (!voter) return null;
                          return (
                            <div
                              key={voter.id}
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold ring-1 ring-white"
                              style={{ backgroundColor: voter.color }}
                              title={voter.name}
                            >
                              {voter.name.substring(0, 2).toUpperCase()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {addedByTraveler && (
                    <span className="text-[10px] text-slate-500">added by {addedByTraveler.name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {locked ? null : isAdding ? (
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-3 shadow-sm">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={60}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Attraction name..."
            className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
            autoFocus
          />
          <input
            type="url"
            value={newLink}
            onChange={e => setNewLink(e.target.value)}
            maxLength={300}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Link (optional)"
            className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
          />

          {/* Category selector */}
          <div>
            <div className="text-xs text-slate-500 mb-1.5">Category</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(CATEGORY_CONFIG) as [AttractionCategory, typeof CATEGORY_CONFIG[AttractionCategory]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setNewCategory(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border",
                    newCategory === key
                      ? cfg.border + " " + cfg.bg
                      : "border-slate-700 bg-slate-950 text-slate-500 hover:bg-slate-900"
                  )}
                  style={newCategory === key ? { color: cfg.color } : undefined}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Cost per person</div>
            <div className="relative">
              <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                value={newAttrCost}
                onChange={e => setNewAttrCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Comment (optional)</div>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              maxLength={200}
              placeholder="Why visit this place, tips..."
              rows={2}
              className="w-full text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                newName.trim()
                  ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              Add
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-950 border border-slate-700 rounded-md hover:bg-slate-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-yellow-400 bg-yellow-900/40/50 border border-dashed border-yellow-700 rounded-lg hover:bg-yellow-900/40 hover:border-yellow-400 transition-colors"
        >
          <Plus size={14} />
          Add Attraction
        </button>
      )}
    </div>
  );
}

// --- Checklist Section Component ---

interface ChecklistSectionProps {
  cityName: string;
  travelerId: string;
  allTravelers: Traveler[];
  items: ChecklistItem[];
  onUpdate: (newItems: ChecklistItem[]) => void;
  locked?: boolean;
}

function ChecklistSection({ cityName, travelerId, allTravelers, items, onUpdate, locked }: ChecklistSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');

  function handleAdd() {
    if (!newText.trim()) return;
    const item: ChecklistItem = {
      id: uuidv4(),
      text: newText.trim(),
      addedBy: travelerId,
      completedBy: [],
    };
    onUpdate([...items, item]);
    setNewText('');
  }

  function toggleComplete(itemId: string) {
    onUpdate(items.map(item => {
      if (item.id !== itemId) return item;
      const done = item.completedBy.includes(travelerId);
      return {
        ...item,
        completedBy: done
          ? item.completedBy.filter(id => id !== travelerId)
          : [...item.completedBy, travelerId],
      };
    }));
  }

  function removeItem(itemId: string) {
    onUpdate(items.filter(item => item.id !== itemId));
  }

  function getTravelerById(id: string) {
    return allTravelers.find(t => t.id === id);
  }

  const doneCount = items.filter(item => item.completedBy.includes(travelerId)).length;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
        <ListChecks size={16} className="text-teal-400" />
        Checklist
        {items.length > 0 && (
          <span className="text-[10px] font-medium text-slate-500 ml-auto">
            {doneCount}/{items.length}
          </span>
        )}
      </h4>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map(item => {
            const isDone = item.completedBy.includes(travelerId);
            const addedByTraveler = getTravelerById(item.addedBy);
            const isOwner = item.addedBy === travelerId;
            const completedTravelers = item.completedBy
              .map(id => getTravelerById(id))
              .filter(Boolean) as Traveler[];

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg transition-colors group",
                  isDone ? "bg-teal-900/40/50" : "hover:bg-slate-900"
                )}
              >
                <button
                  onClick={() => !locked && toggleComplete(item.id)}
                  disabled={locked}
                  className={cn(
                    "mt-0.5 shrink-0 text-slate-500 hover:text-teal-400 transition-colors",
                    locked && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {isDone
                    ? <CheckSquare size={16} className="text-teal-400" />
                    : <Square size={16} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-sm",
                    isDone ? "text-slate-500 line-through" : "text-slate-600"
                  )}>
                    {item.text}
                  </span>

                  <div className="flex items-center gap-2 mt-1">
                    {/* Who completed */}
                    {completedTravelers.length > 0 && (
                      <div className="flex -space-x-1">
                        {completedTravelers.map(t => (
                          <div
                            key={t.id}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white font-bold ring-1 ring-white"
                            style={{ backgroundColor: t.color }}
                            title={`${t.name} (done)`}
                          >
                            {t.name.substring(0, 2).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    )}
                    {addedByTraveler && (
                      <span className="text-[10px] text-slate-500">by {addedByTraveler.name}</span>
                    )}
                  </div>
                </div>

                {isOwner && !locked && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-0.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {locked ? null : isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            maxLength={100}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setIsAdding(false); setNewText(''); }
            }}
            placeholder="Task description..."
            className="flex-1 text-sm bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 placeholder-slate-400"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              newText.trim()
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-teal-400 bg-teal-900/40/50 border border-dashed border-teal-800 rounded-lg hover:bg-teal-900/40 hover:border-teal-300 transition-colors"
        >
          <Plus size={14} />
          Add Task
        </button>
      )}
    </div>
  );
}

// ── Events Section ────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: typeof Music; color: string }> = {
  show: { label: 'Show', icon: Music, color: 'text-purple-400' },
  holiday: { label: 'Holiday', icon: CalendarDays, color: 'text-red-400' },
  festival: { label: 'Festival', icon: PartyPopper, color: 'text-amber-400' },
  sports: { label: 'Sports', icon: Trophy, color: 'text-emerald-400' },
};

interface EventsSectionProps {
  cityName: string;
  travelerId: string;
  allTravelers: Traveler[];
  events: TravelEvent[];
  cityStartDate: string;
  cityEndDate: string;
  onUpdate: (newEvents: TravelEvent[]) => void;
  locked?: boolean;
}

function EventsSection({ cityName, travelerId, allTravelers, events, cityStartDate, cityEndDate, onUpdate, locked }: EventsSectionProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [formMode, setFormMode] = useState<'closed' | 'adding' | 'editing'>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newEventType, setNewEventType] = useState<EventType>('show');
  const [newDate, setNewDate] = useState(cityStartDate);
  const [newAllDay, setNewAllDay] = useState(true);
  const [newStartTime, setNewStartTime] = useState('19:00');
  const [newEndTime, setNewEndTime] = useState('23:00');

  useEffect(() => {
    if (formMode !== 'closed' && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [formMode]);

  function resetForm() {
    setNewName('');
    setNewLink('');
    setNewEventType('show');
    setNewDate(cityStartDate);
    setNewAllDay(true);
    setNewStartTime('19:00');
    setNewEndTime('23:00');
    setFormMode('closed');
    setEditingId(null);
  }

  function openEdit(event: TravelEvent) {
    setNewName(event.name);
    setNewLink(event.link ?? '');
    setNewEventType(event.eventType);
    setNewDate(event.date);
    setNewAllDay(event.allDay);
    setNewStartTime(event.startTime ?? '19:00');
    setNewEndTime(event.endTime ?? '23:00');
    setEditingId(event.id);
    setFormMode('editing');
  }

  function clampDate(date: string): string {
    if (date < cityStartDate) return cityStartDate;
    if (date > cityEndDate) return cityEndDate;
    return date;
  }

  function handleSubmit() {
    if (!newName.trim() || !newDate) return;
    const clampedDate = clampDate(newDate);
    const eventData: TravelEvent = {
      id: editingId ?? uuidv4(),
      name: newName.trim(),
      link: newLink.trim() || undefined,
      eventType: newEventType,
      date: clampedDate,
      allDay: newAllDay,
      startTime: newAllDay ? undefined : newStartTime,
      endTime: newAllDay ? undefined : newEndTime,
      addedBy: formMode === 'editing'
        ? (events.find(e => e.id === editingId)?.addedBy ?? travelerId)
        : travelerId,
    };

    if (formMode === 'editing') {
      onUpdate(events.map(e => e.id === editingId ? eventData : e));
      resetForm();
    } else {
      onUpdate([...events, eventData]);
      resetForm();
      setFormMode('adding');
    }
  }

  function removeEvent(eventId: string) {
    onUpdate(events.filter(e => e.id !== eventId));
    if (editingId === eventId) resetForm();
  }

  function getTravelerById(id: string) {
    return allTravelers.find(t => t.id === id);
  }

  const sortedEvents = [...events].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });

  const isFormOpen = formMode !== 'closed';

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
        <CalendarDays size={16} className="text-purple-400" />
        Events
        {events.length > 0 && (
          <span className="text-[10px] font-medium text-slate-500 ml-auto">
            {events.length}
          </span>
        )}
      </h4>

      {/* Event list */}
      {sortedEvents.length > 0 && (
        <div className="space-y-1.5">
          {sortedEvents.map(event => {
            const config = EVENT_TYPE_CONFIG[event.eventType];
            const Icon = config.icon;
            const addedByTraveler = getTravelerById(event.addedBy);
            const isOwner = event.addedBy === travelerId;
            const isBeingEdited = editingId === event.id;

            return (
              <div
                key={event.id}
                onClick={() => { if (!locked && !isBeingEdited) openEdit(event); }}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg transition-colors group",
                  isBeingEdited
                    ? "bg-purple-900/20 ring-1 ring-purple-700"
                    : locked ? "hover:bg-slate-900" : "hover:bg-slate-900 cursor-pointer"
                )}
              >
                <Icon size={14} className={cn("mt-0.5 shrink-0", config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-600 truncate">{event.name}</span>
                    {event.link && (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-500 hover:text-indigo-400"
                        onClick={e => e.stopPropagation()}
                      >
                        <Link size={11} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">
                      {format(parseISO(event.date), 'dd/MM')}
                      {event.allDay ? ' · All day' : ` · ${event.startTime}–${event.endTime}`}
                    </span>
                    <span className={cn("text-[10px] font-medium", config.color)}>
                      {config.label}
                    </span>
                  </div>
                  {addedByTraveler && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] text-white font-bold"
                        style={{ backgroundColor: addedByTraveler.color }}
                      >
                        {addedByTraveler.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-slate-500">by {addedByTraveler.name}</span>
                    </div>
                  )}
                </div>
                {isOwner && !locked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEvent(event.id); }}
                    className="p-0.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit form */}
      {locked ? null : isFormOpen ? (
        <div ref={formRef} className="space-y-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
          {formMode === 'editing' && (
            <p className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">Editing event</p>
          )}

          {/* Name */}
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={100}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Event name..."
            className="w-full text-sm bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder-slate-400"
            autoFocus
          />

          {/* Link */}
          <input
            type="url"
            value={newLink}
            onChange={e => setNewLink(e.target.value)}
            placeholder="Link (optional)"
            className="w-full text-sm bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder-slate-400"
          />

          {/* Event type grid */}
          <div className="grid grid-cols-4 gap-1">
            {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([type, config]) => {
              const TypeIcon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setNewEventType(type)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors",
                    newEventType === type
                      ? "bg-purple-900/50 text-purple-300 ring-1 ring-purple-700"
                      : "bg-slate-950 text-slate-500 hover:text-slate-600"
                  )}
                >
                  <TypeIcon size={14} />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Date */}
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            min={cityStartDate}
            max={cityEndDate}
            className="w-full text-sm bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 [color-scheme:dark]"
          />

          {/* All day toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewAllDay(!newAllDay)}
              className="shrink-0 text-slate-500 hover:text-purple-400 transition-colors"
            >
              {newAllDay ? <CheckSquare size={16} className="text-purple-400" /> : <Square size={16} />}
            </button>
            <span className="text-xs text-slate-600">All day</span>
          </div>

          {/* Time inputs (when not all day) */}
          {!newAllDay && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-0.5 block">Start</label>
                <input
                  type="time"
                  value={newStartTime}
                  onChange={e => setNewStartTime(e.target.value)}
                  className="w-full text-sm bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 [color-scheme:dark]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-0.5 block">End</label>
                <input
                  type="time"
                  value={newEndTime}
                  onChange={e => setNewEndTime(e.target.value)}
                  className="w-full text-sm bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 [color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!newName.trim() || !newDate}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                newName.trim() && newDate
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              {formMode === 'editing' ? 'Save' : 'Add'}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setFormMode('adding')}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-purple-400 bg-purple-900/20 border border-dashed border-purple-800 rounded-lg hover:bg-purple-900/30 hover:border-purple-300 transition-colors"
        >
          <Plus size={14} />
          Add Event
        </button>
      )}
    </div>
  );
}
