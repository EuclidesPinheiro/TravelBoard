import { Traveler, CitySegment, TransportSegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { MapPin, Calendar, Home, Users, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

export function CityDetails({ traveler, segmentId }: { traveler: Traveler, segmentId: string }) {
  const { itinerary } = useItinerary();
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
  const arrivalTime = prevTransport ? prevTransport.arrivalTime : null;

  // Real departure: transport departure or end of endDate
  const departureDate = nextTransport ? nextTransport.departureDate : segment.endDate;
  const departureTime = nextTransport ? nextTransport.departureTime : null;

  const days = differenceInDays(parseISO(segment.endDate), parseISO(segment.startDate));

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

      // Check overlap
      return (cStart < end && cEnd > start);
    }) as CitySegment[];

    return { traveler: t, overlaps: overlappingCities };
  }).filter(item => item.overlaps.length > 0);

  function formatDateDisplay(dateStr: string): string {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  }

  function formatDateShort(dateStr: string): string {
    return format(parseISO(dateStr), 'dd/MM');
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
          <div>
            <div className="text-xs text-slate-500">Arrival</div>
            <div className="text-sm font-medium text-slate-900">
              {formatDateDisplay(arrivalDate)}
              {arrivalTime && <span className="text-indigo-600 ml-1.5">at {arrivalTime}</span>}
            </div>
            {prevTransport && (
              <div className="text-xs text-slate-400 mt-0.5">from {prevTransport.from}</div>
            )}
          </div>
        </div>

        {/* Departure */}
        <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
          <PlaneTakeoff className="text-red-500 shrink-0 mt-0.5" size={16} />
          <div>
            <div className="text-xs text-slate-500">Departure</div>
            <div className="text-sm font-medium text-slate-900">
              {formatDateDisplay(departureDate)}
              {departureTime && <span className="text-indigo-600 ml-1.5">at {departureTime}</span>}
            </div>
            {nextTransport && (
              <div className="text-xs text-slate-400 mt-0.5">to {nextTransport.to}</div>
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

        {segment.accommodation && (
          <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
            <Home className="text-slate-400 shrink-0 mt-0.5" size={16} />
            <div>
              <div className="text-xs text-slate-500">Accommodation</div>
              <div className="text-sm font-medium text-slate-900">{segment.accommodation}</div>
            </div>
          </div>
        )}
      </div>

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

      <button className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors">
        Edit Stay
      </button>
    </div>
  );
}
