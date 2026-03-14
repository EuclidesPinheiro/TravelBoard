import { CitySegment, Traveler } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { cn } from '../../utils/cn';

interface CityBlockProps {
  key?: string;
  segment: CitySegment;
  traveler: Traveler;
  left: number;
  width: number;
}

export function CityBlock({ segment, traveler, left, width }: CityBlockProps) {
  const { setSelection, selection } = useItinerary();
  const isSelected = selection?.type === 'city' && selection.segmentId === segment.id;

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-10 rounded-md shadow-sm border flex items-center justify-center px-2 cursor-pointer transition-all hover:shadow-md hover:z-10 overflow-hidden group",
        isSelected ? "ring-2 ring-indigo-500 z-10" : "border-slate-200/60"
      )}
      style={{ 
        left: `${left + 2}px`,
        width: `${width - 4}px`, 
        backgroundColor: `${traveler.color}15`,
        borderColor: `${traveler.color}40`,
      }}
      onClick={() => setSelection({ type: 'city', travelerId: traveler.id, segmentId: segment.id })}
      title={`${segment.cityName} (${segment.startDate} to ${segment.endDate})`}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1" 
        style={{ backgroundColor: traveler.color }} 
      />
      <span className="text-xs font-semibold text-slate-700 truncate px-1">
        {segment.cityName}
      </span>
    </div>
  );
}
