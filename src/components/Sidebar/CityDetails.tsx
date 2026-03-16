import { useState } from 'react';
import { Traveler, CitySegment, TransportSegment, Stay, Attraction, AttractionCategory, ChecklistItem } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { MapPin, Calendar, Users, PlaneLanding, PlaneTakeoff, BedDouble, Plus, Trash2, ExternalLink, Star, ThumbsUp, DollarSign, ListChecks, Square, CheckSquare } from 'lucide-react';
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

  // Real arrival: transport arrival or start of startDate
  const arrivalDate = prevTransport ? prevTransport.arrivalDate : segment.startDate;
  const arrivalTime = prevTransport ? prevTransport.arrivalTime : '';

  // Real departure: transport departure or end of endDate
  const departureDate = nextTransport ? nextTransport.departureDate : segment.endDate;
  const departureTime = nextTransport ? nextTransport.departureTime : '';

  // City time boundaries for stay validation
  const cityMinDt = arrivalTime ? `${arrivalDate}T${arrivalTime}` : `${arrivalDate}T00:00`;
  const cityMaxDt = departureTime ? `${departureDate}T${departureTime}` : `${departureDate}T23:59`;

  const days = differenceInDays(parseISO(segment.endDate), parseISO(segment.startDate)) + 1;

  function toDateTime(date: string, time: string): string {
    return time ? `${date}T${time}` : `${date}T00:00`;
  }

  function updateSegment(travelerId: string, segId: string, updater: (seg: any) => any) {
    setItinerary(prev => ({
      ...prev,
      travelers: prev.travelers.map(t => {
        if (t.id !== travelerId) return t;
        return {
          ...t,
          segments: t.segments.map(s => s.id === segId ? updater(s) : s),
        };
      }),
    }));
  }

  function handleArrivalDateChange(newDate: string) {
    if (!newDate) return;
    const newArrival = toDateTime(newDate, arrivalTime);
    const depDt = toDateTime(departureDate, departureTime);
    if (newArrival > depDt) return;
    updateSegment(traveler.id, segment.id, s => ({ ...s, startDate: newDate }));
    if (prevTransport) {
      updateSegment(traveler.id, prevTransport.id, s => ({ ...s, arrivalDate: newDate }));
    }
  }

  function handleArrivalTimeChange(newTime: string) {
    if (!prevTransport || !newTime) return;
    const newArrival = toDateTime(arrivalDate, newTime);
    const depDt = toDateTime(departureDate, departureTime);
    if (newArrival > depDt) return;
    updateSegment(traveler.id, prevTransport.id, s => ({ ...s, arrivalTime: newTime }));
  }

  function handleDepartureDateChange(newDate: string) {
    if (!newDate) return;
    const arrDt = toDateTime(arrivalDate, arrivalTime);
    const newDeparture = toDateTime(newDate, departureTime);
    if (newDeparture < arrDt) return;
    updateSegment(traveler.id, segment.id, s => ({ ...s, endDate: newDate }));
    if (nextTransport) {
      updateSegment(traveler.id, nextTransport.id, s => ({ ...s, departureDate: newDate }));
    }
  }

  function handleDepartureTimeChange(newTime: string) {
    if (!nextTransport || !newTime) return;
    const arrDt = toDateTime(arrivalDate, arrivalTime);
    const newDeparture = toDateTime(departureDate, newTime);
    if (newDeparture < arrDt) return;
    updateSegment(traveler.id, nextTransport.id, s => ({ ...s, departureTime: newTime }));
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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-indigo-600 mb-1">
          <MapPin size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">City Stay</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900">{segment.cityName}</h3>
        <p className="text-sm text-slate-500">{segment.country}</p>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
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
                onChange={e => handleArrivalDateChange(e.target.value)}
                className="text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 w-[130px]"
              />
              {prevTransport ? (
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={e => handleArrivalTimeChange(e.target.value)}
                  className="text-sm font-medium text-indigo-600 bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 w-[90px]"
                />
              ) : (
                <span className="text-xs text-slate-400 italic">no transport</span>
              )}
            </div>
            {prevTransport && (
              <div className="text-xs text-slate-400 mt-1">from {prevTransport.from}</div>
            )}
          </div>
        </div>

        {/* Departure */}
        <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
          <PlaneTakeoff className="text-red-500 shrink-0 mt-0.5" size={16} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 mb-1">Departure</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={departureDate}
                min={arrivalDate}
                onChange={e => handleDepartureDateChange(e.target.value)}
                className="text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 w-[130px]"
              />
              {nextTransport ? (
                <input
                  type="time"
                  value={departureTime}
                  onChange={e => handleDepartureTimeChange(e.target.value)}
                  className="text-sm font-medium text-indigo-600 bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 w-[90px]"
                />
              ) : (
                <span className="text-xs text-slate-400 italic">no transport</span>
              )}
            </div>
            {nextTransport && (
              <div className="text-xs text-slate-400 mt-1">to {nextTransport.to}</div>
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
          <Calendar className="text-slate-400 shrink-0 mt-0.5" size={16} />
          <div>
            <div className="text-xs text-slate-500">Duration</div>
            <div className="text-sm font-medium text-slate-900">{days} {days === 1 ? 'day' : 'days'}</div>
          </div>
        </div>
      </div>

      {/* Stays / Accommodation */}
      <StaysSection
        key={segment.id}
        stays={stays}
        arrivalDate={arrivalDate}
        arrivalTime={arrivalTime}
        departureDate={departureDate}
        departureTime={departureTime}
        cityMinDt={cityMinDt}
        cityMaxDt={cityMaxDt}
        otherTravelers={otherTravelers}
        onAdd={addStay}
        onRemove={removeStay}
        onUpdate={updateStay}
      />

      {/* Attractions */}
      <AttractionsSection
        cityName={segment.cityName}
        travelerId={traveler.id}
        allTravelers={itinerary.travelers}
        attractions={itinerary.attractions?.[segment.cityName] ?? []}
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

      {coPresent.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            Group Overlaps
          </h4>
          <div className="space-y-2">
            {coPresent.map(({ traveler: t, overlaps }) => (
              <div key={t.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: t.color }}>
                    {t.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{t.name}</span>
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
          <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
            {segment.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Stays Section Component ---

interface StaysSectionProps {
  key?: string;
  stays: Stay[];
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  cityMinDt: string;
  cityMaxDt: string;
  otherTravelers: Traveler[];
  onAdd: (stay: Stay) => void;
  onRemove: (stayId: string) => void;
  onUpdate: (stayId: string, updater: (s: Stay) => Stay) => void;
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

function StaysSection({ stays, arrivalDate, arrivalTime, departureDate, departureTime, cityMinDt, cityMaxDt, otherTravelers, onAdd, onRemove, onUpdate }: StaysSectionProps) {
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
      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <BedDouble size={16} className="text-amber-500" />
        Accommodation
      </h4>

      {/* Existing stays */}
      {stays.map(stay => (
        <StayCard
          key={stay.id}
          stay={stay}
          otherTravelers={otherTravelers}
          cityMinDt={cityMinDt}
          cityMaxDt={cityMaxDt}
          onRemove={() => onRemove(stay.id)}
          onUpdate={(updater) => onUpdate(stay.id, updater)}
        />
      ))}

      {/* Add form */}
      {isAdding ? (
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-sm">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Accommodation name..."
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
            autoFocus
          />
          <input
            type="url"
            value={newLink}
            onChange={e => setNewLink(e.target.value)}
            placeholder="Link (optional)"
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
          />

          <div>
            <div className="text-xs text-slate-500 mb-1">Check-in</div>
            <div className="flex gap-2">
              <input type="date" value={newCheckInDate} min={arrivalDate} max={departureDate} onChange={e => setNewCheckInDate(e.target.value)} className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <input type="time" value={newCheckInTime} onChange={e => setNewCheckInTime(e.target.value)} className="w-[80px] text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Check-out</div>
            <div className="flex gap-2">
              <input type="date" value={newCheckOutDate} min={newCheckInDate} max={departureDate} onChange={e => setNewCheckOutDate(e.target.value)} className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <input type="time" value={newCheckOutTime} onChange={e => setNewCheckOutTime(e.target.value)} className="w-[80px] text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Cost (total)</div>
            <div className="relative">
              <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                value={newCost}
                onChange={e => setNewCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
              />
            </div>
          </div>

          {otherTravelers.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Shared with</div>
              <div className="flex flex-wrap gap-1.5">
                {otherTravelers.map(t => {
                  const selected = newSharedWith.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleShared(t.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors border",
                        selected
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
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

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!isFormValid}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                isFormValid
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              Add
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-indigo-500 bg-indigo-50/50 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
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
  stay: Stay;
  otherTravelers: Traveler[];
  cityMinDt: string;
  cityMaxDt: string;
  onRemove: () => void;
  onUpdate: (updater: (s: Stay) => Stay) => void;
}

function StayCard({ stay, otherTravelers, cityMinDt, cityMaxDt, onRemove, onUpdate }: StayCardProps) {
  const sharedTravelers = otherTravelers.filter(t => stay.sharedWith.includes(t.id));
  const splitCount = 1 + stay.sharedWith.length; // owner + shared
  const perPerson = stay.cost ? stay.cost / splitCount : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">{stay.name}</div>
          {stay.link && (
            <a
              href={stay.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mt-0.5 truncate"
            >
              <ExternalLink size={10} />
              <span className="truncate">{stay.link}</span>
            </a>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex gap-3 text-xs text-slate-600">
        <div>
          <span className="text-slate-400">In: </span>
          {format(parseISO(stay.checkInDate), 'dd/MM')} {stay.checkInTime}
        </div>
        <div>
          <span className="text-slate-400">Out: </span>
          {format(parseISO(stay.checkOutDate), 'dd/MM')} {stay.checkOutTime}
        </div>
      </div>

      {/* Cost display / edit */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
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
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder-slate-400"
          />
        </div>
        {stay.cost && splitCount > 1 && (
          <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
            ${perPerson.toFixed(2)}/person
          </span>
        )}
      </div>

      {sharedTravelers.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] text-slate-400">with</span>
          <div className="flex -space-x-1">
            {sharedTravelers.map(t => (
              <div
                key={t.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold ring-1 ring-white"
                style={{ backgroundColor: t.color }}
                title={t.name}
              >
                {t.name.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
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
}

const CATEGORY_CONFIG: Record<AttractionCategory, { label: string; color: string; bg: string; border: string }> = {
  museum:  { label: 'Museu e Arquitetura',  color: '#8B5CF6', bg: 'bg-violet-50',  border: 'border-violet-300' },
  science: { label: 'Ciência e Tecnologia', color: '#0EA5E9', bg: 'bg-sky-50',     border: 'border-sky-300' },
  nature:  { label: 'Natureza',             color: '#22C55E', bg: 'bg-green-50',   border: 'border-green-300' },
  yolo:    { label: 'YOLO',                 color: '#F97316', bg: 'bg-orange-50',  border: 'border-orange-300' },
};

function AttractionsSection({ cityName, travelerId, allTravelers, attractions, onUpdate }: AttractionsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newCategory, setNewCategory] = useState<AttractionCategory>('museum');
  const [newAttrCost, setNewAttrCost] = useState('');

  // Sort by votes descending
  const sorted = [...attractions].sort((a, b) => b.votes.length - a.votes.length);
  const topVotes = sorted.length > 0 ? sorted[0].votes.length : 0;

  function resetForm() {
    setNewName('');
    setNewLink('');
    setNewCategory('museum');
    setNewAttrCost('');
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
      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
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
                  "bg-white border rounded-lg p-3 shadow-sm space-y-2 transition-colors",
                  isTop ? "border-yellow-300 bg-yellow-50/30" : "border-slate-200"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isTop && <Star size={12} className="text-yellow-500 shrink-0 fill-yellow-500" />}
                      <span className="text-sm font-medium text-slate-800 truncate">{attraction.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${catConfig.color}18`, color: catConfig.color }}
                      >
                        {catConfig.label}
                      </span>
                      {attraction.cost && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                          ${attraction.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {attraction.link && (
                      <a
                        href={attraction.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mt-0.5 truncate"
                      >
                        <ExternalLink size={10} />
                        <span className="truncate">{attraction.link}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleVote(attraction.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                        hasVoted
                          ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                      title={hasVoted ? "Remove vote" : "Vote"}
                    >
                      <ThumbsUp size={12} className={hasVoted ? "fill-indigo-600" : ""} />
                      {attraction.votes.length}
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => removeAttraction(attraction.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
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
                    <span className="text-[10px] text-slate-400">added by {addedByTraveler.name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdding ? (
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-sm">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Attraction name..."
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
            autoFocus
          />
          <input
            type="url"
            value={newLink}
            onChange={e => setNewLink(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Link (optional)"
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
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
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
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
              <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                value={newAttrCost}
                onChange={e => setNewAttrCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                newName.trim()
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              Add
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-yellow-600 bg-yellow-50/50 border border-dashed border-yellow-300 rounded-lg hover:bg-yellow-50 hover:border-yellow-400 transition-colors"
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
}

function ChecklistSection({ cityName, travelerId, allTravelers, items, onUpdate }: ChecklistSectionProps) {
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
      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <ListChecks size={16} className="text-teal-500" />
        Checklist
        {items.length > 0 && (
          <span className="text-[10px] font-medium text-slate-400 ml-auto">
            {doneCount}/{items.length}
          </span>
        )}
      </h4>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                  isDone ? "bg-teal-50/50" : "hover:bg-slate-50"
                )}
              >
                <button
                  onClick={() => toggleComplete(item.id)}
                  className="mt-0.5 shrink-0 text-slate-400 hover:text-teal-500 transition-colors"
                >
                  {isDone
                    ? <CheckSquare size={16} className="text-teal-500" />
                    : <Square size={16} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-sm",
                    isDone ? "text-slate-400 line-through" : "text-slate-700"
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
                      <span className="text-[10px] text-slate-400">by {addedByTraveler.name}</span>
                    )}
                  </div>
                </div>

                {isOwner && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-0.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
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
      {isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setIsAdding(false); setNewText(''); }
            }}
            placeholder="Task description..."
            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 placeholder-slate-400"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              newText.trim()
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-teal-500 bg-teal-50/50 border border-dashed border-teal-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors"
        >
          <Plus size={14} />
          Add Task
        </button>
      )}
    </div>
  );
}
