import { Traveler, CitySegment, TransportSegment } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { CityBlock } from './CityBlock';
import { TransportConnector } from './TransportConnector';
import { cn } from '../../utils/cn';

interface TravelerRowProps {
  key?: string;
  traveler: Traveler;
  days: Date[];
}

export function TravelerRow({ traveler, days }: TravelerRowProps) {
  const { itinerary, zoomLevel, setSelection, selection } = useItinerary();
  const itineraryStart = startOfDay(parseISO(itinerary.startDate));

  const isSelected = selection?.type === 'traveler' && selection.travelerId === traveler.id;

  return (
    <div className={cn(
      "flex border-b border-slate-100 group transition-colors relative h-[72px]",
      isSelected ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
    )}>
      {/* Sticky Left Column */}
      <div 
        className={cn(
          "w-64 shrink-0 border-r border-slate-200 sticky left-0 z-20 flex items-center px-4 cursor-pointer transition-colors",
          isSelected ? "bg-indigo-50/80" : "bg-white group-hover:bg-slate-50/80"
        )}
        onClick={() => setSelection({ type: 'traveler', travelerId: traveler.id })}
      >
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white"
          style={{ backgroundColor: traveler.color }}
        >
          {traveler.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="ml-3 truncate">
          <div className="font-medium text-slate-900 truncate">{traveler.name}</div>
          <div className="text-xs text-slate-500 truncate">{traveler.segments.filter(s => s.type === 'city').length} cities</div>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="flex relative" style={{ width: days.length * zoomLevel }}>
        {/* Background Grid Lines */}
        {days.map((day, i) => (
          <div 
            key={i} 
            className="absolute top-0 bottom-0 border-r border-slate-100/50 pointer-events-none"
            style={{ left: i * zoomLevel, width: zoomLevel }}
          />
        ))}

        {/* Segments */}
        {traveler.segments.map((segment, index) => {
          if (segment.type === 'city') {
            const citySeg = segment as CitySegment;
            
            // Find previous transport
            const prevSeg = index > 0 ? traveler.segments[index - 1] : null;
            let startFraction = 0;
            let startOffsetDays = differenceInDays(startOfDay(parseISO(citySeg.startDate)), itineraryStart);
            
            if (prevSeg && prevSeg.type === 'transport') {
                const trans = prevSeg as TransportSegment;
                startOffsetDays = differenceInDays(startOfDay(parseISO(trans.arrivalDate)), itineraryStart);
                const [h, m] = trans.arrivalTime.split(':').map(Number);
                startFraction = (h + m / 60) / 24;
            }

            // Find next transport
            const nextSeg = index < traveler.segments.length - 1 ? traveler.segments[index + 1] : null;
            let endFraction = 1; // default to end of the day
            let endOffsetDays = differenceInDays(startOfDay(parseISO(citySeg.endDate)), itineraryStart);
            
            if (nextSeg && nextSeg.type === 'transport') {
                const trans = nextSeg as TransportSegment;
                endOffsetDays = differenceInDays(startOfDay(parseISO(trans.departureDate)), itineraryStart);
                const [h, m] = trans.departureTime.split(':').map(Number);
                endFraction = (h + m / 60) / 24;
            }

            const left = (startOffsetDays + startFraction) * zoomLevel;
            const right = (endOffsetDays + endFraction) * zoomLevel;
            const width = Math.max(0, right - left);

            if (right < 0 || left > days.length * zoomLevel) return null;

            return (
              <CityBlock 
                key={segment.id} 
                segment={citySeg} 
                traveler={traveler}
                left={left} 
                width={width} 
              />
            );
          } else {
            const transSeg = segment as TransportSegment;
            const depOffsetDays = differenceInDays(startOfDay(parseISO(transSeg.departureDate)), itineraryStart);
            
            const [depH, depM] = transSeg.departureTime.split(':').map(Number);
            const depFraction = (depH + depM / 60) / 24;
            
            const [arrH, arrM] = transSeg.arrivalTime.split(':').map(Number);
            const arrFraction = (arrH + arrM / 60) / 24;
            
            const arrOffsetDays = differenceInDays(startOfDay(parseISO(transSeg.arrivalDate)), itineraryStart);
            
            const left = (depOffsetDays + depFraction) * zoomLevel;
            const right = (arrOffsetDays + arrFraction) * zoomLevel;
            const width = Math.max(0, right - left);

            if (right < 0 || left > days.length * zoomLevel) return null;

            return (
              <TransportConnector 
                key={segment.id} 
                segment={transSeg} 
                traveler={traveler}
                left={left} 
                width={width} 
              />
            );
          }
        })}
      </div>
    </div>
  );
}
