import { TransportSegment, Traveler } from '../../types';
import { useItinerary } from '../../store/ItineraryContext';
import { cn } from '../../utils/cn';

interface TransportConnectorProps {
  key?: string;
  segment: TransportSegment;
  traveler: Traveler;
  left: number;
  width: number;
}

const TRANSPORT_COLORS: Record<string, string> = {
  flight: '#E74C3C',
  train: '#F39C12',
  night_train: '#3498DB',
  bus: '#27AE60',
  car: '#9B59B6',
  ferry: '#1ABC9C',
  walking: '#8D6E63',
};

export function TransportConnector({ segment, traveler, left, width }: TransportConnectorProps) {
  const { setSelection, selection } = useItinerary();
  const isSelected = selection?.type === 'transport' && selection.segmentId === segment.id;
  const color = TRANSPORT_COLORS[segment.mode] || '#95a5a6';

  return (
    <div
      className="absolute top-0 bottom-0 z-20"
      style={{ left: `${left}px`, width: `${Math.max(width, 16)}px` }}
    >
      {/* Dashed column lines — only visible when selected */}
      {isSelected && (
        <>
          <div className="absolute top-0 bottom-0 left-0 border-l border-dashed border-red-400 pointer-events-none" style={{ top: '-9999px', bottom: '-9999px' }} />
          <div className="absolute top-0 bottom-0 right-0 border-r border-dashed border-red-400 pointer-events-none" style={{ top: '-9999px', bottom: '-9999px' }} />
        </>
      )}

      {/* The connector block */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 rounded-sm border-2 border-slate-800 flex items-center justify-center cursor-pointer transition-all hover:shadow-md hover:scale-110",
          isSelected ? "ring-2 ring-offset-1 ring-slate-800" : "shadow-sm"
        )}
        style={{ backgroundColor: color }}
        onClick={() => setSelection(isSelected ? null : { type: 'transport', travelerId: traveler.id, segmentId: segment.id })}
        title={`${segment.mode}: ${segment.from} to ${segment.to} (${segment.departureTime} - ${segment.arrivalTime})`}
      />
    </div>
  );
}
