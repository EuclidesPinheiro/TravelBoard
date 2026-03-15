import { useState } from 'react';
import { Traveler, CitySegment, TransportSegment, Stay } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { MapPin, Calendar, Users, PlaneLanding, PlaneTakeoff, BedDouble, Plus, Trash2, ExternalLink } from 'lucide-react';
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

function StaysSection({ stays, arrivalDate, arrivalTime, departureDate, departureTime, cityMinDt, cityMaxDt, otherTravelers, onAdd, onRemove, onUpdate }: StaysSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newCheckInDate, setNewCheckInDate] = useState(arrivalDate);
  const [newCheckInTime, setNewCheckInTime] = useState(arrivalTime || '14:00');
  const [newCheckOutDate, setNewCheckOutDate] = useState(departureDate);
  const [newCheckOutTime, setNewCheckOutTime] = useState(departureTime || '11:00');
  const [newSharedWith, setNewSharedWith] = useState<string[]>([]);

  function resetForm() {
    setNewName('');
    setNewLink('');
    setNewCheckInDate(arrivalDate);
    setNewCheckInTime(arrivalTime || '14:00');
    setNewCheckOutDate(departureDate);
    setNewCheckOutTime(departureTime || '11:00');
    setNewSharedWith([]);
    setIsAdding(false);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    const checkInDt = `${newCheckInDate}T${newCheckInTime}`;
    const checkOutDt = `${newCheckOutDate}T${newCheckOutTime}`;
    if (checkInDt > checkOutDt) return;
    if (checkInDt < cityMinDt || checkOutDt > cityMaxDt) return;

    onAdd({
      id: uuidv4(),
      name: newName.trim(),
      link: newLink.trim() || undefined,
      checkInDate: newCheckInDate,
      checkInTime: newCheckInTime,
      checkOutDate: newCheckOutDate,
      checkOutTime: newCheckOutTime,
      sharedWith: newSharedWith,
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

function StayCard({ stay, otherTravelers, cityMinDt, cityMaxDt, onRemove }: StayCardProps) {
  const sharedTravelers = otherTravelers.filter(t => stay.sharedWith.includes(t.id));

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
