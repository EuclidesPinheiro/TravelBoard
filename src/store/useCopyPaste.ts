import React, { useState, useCallback } from 'react';
import { Itinerary, SelectionType, Segment } from '../types';
import { differenceInDays, parseISO, startOfDay, addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { FocusedCell } from './helpers';

type SetItinerary = React.Dispatch<React.SetStateAction<Itinerary>>;

export function useCopyPaste(
  itinerary: Itinerary | null,
  selection: SelectionType,
  focusedCell: FocusedCell | null,
  setItinerary: SetItinerary,
) {
  const [clipboard, setClipboard] = useState<{
    travelers: {
      relativeRowIndex: number;
      segments: Segment[];
    }[];
    anchorDayOffset: number;
  } | null>(null);

  const getDayOffset = useCallback((dateStr: string) => {
    if (!itinerary) return 0;
    return differenceInDays(startOfDay(parseISO(dateStr)), startOfDay(parseISO(itinerary.startDate)));
  }, [itinerary]);

  const copy = useCallback(() => {
    if (!itinerary || selection.length === 0) return;
    const segmentSelection = selection.filter(s => s.type === 'city' || s.type === 'transport');
    if (segmentSelection.length === 0) return;

    console.log('Copying segments:', segmentSelection.length);

    const travelerIndices = new Map<string, number>();
    itinerary.travelers.forEach((t, i) => travelerIndices.set(t.id, i));

    const travelerGroups = new Map<string, Segment[]>();
    segmentSelection.forEach(sel => {
      const traveler = itinerary.travelers.find(t => t.id === sel.travelerId);
      if (!traveler) return;
      const segment = traveler.segments.find(s => s.id === sel.segmentId);
      if (!segment) return;
      if (!travelerGroups.has(traveler.id)) travelerGroups.set(traveler.id, []);
      travelerGroups.get(traveler.id)!.push(segment);
    });

    if (travelerGroups.size === 0) return;

    const sortedTravelerIds = Array.from(travelerGroups.keys()).sort((a, b) => travelerIndices.get(a)! - travelerIndices.get(b)!);
    const baseTravelerId = sortedTravelerIds[0];
    const baseTravelerIdx = travelerIndices.get(baseTravelerId)!;

    let minDay = Infinity;
    travelerGroups.forEach((segments) => {
      segments.forEach(seg => {
        if (seg.type === 'city') {
          minDay = Math.min(minDay, getDayOffset(seg.startDate));
        } else {
          minDay = Math.min(minDay, getDayOffset(seg.departureDate));
        }
      });
    });

    const anchorDayOffset = minDay;

    setClipboard({
      travelers: sortedTravelerIds.map(tid => ({
        relativeRowIndex: travelerIndices.get(tid)! - baseTravelerIdx,
        segments: JSON.parse(JSON.stringify(travelerGroups.get(tid)!)) as Segment[],
      })),
      anchorDayOffset,
    });
  }, [itinerary, selection, getDayOffset]);

  const paste = useCallback(() => {
    if (!itinerary || !clipboard || !focusedCell) {
      console.log('Paste conditions not met:', { itinerary: !!itinerary, clipboard: !!clipboard, focusedCell: !!focusedCell });
      return;
    }

    console.log('Pasting onto:', focusedCell.travelerId, 'at day', focusedCell.dayIndex);

    const targetTravelerIdx = itinerary.travelers.findIndex(t => t.id === focusedCell.travelerId);
    if (targetTravelerIdx === -1) return;
    const dayShift = focusedCell.dayIndex - clipboard.anchorDayOffset;
    setItinerary(prev => {
      const newItinerary = { ...prev, travelers: [...prev.travelers] };
      clipboard.travelers.forEach(cbTraveler => {
        const travelerIdx = targetTravelerIdx + cbTraveler.relativeRowIndex;
        if (travelerIdx < 0 || travelerIdx >= newItinerary.travelers.length) return;
        if (newItinerary.travelers[travelerIdx].locked) return;
        const traveler = { ...newItinerary.travelers[travelerIdx], segments: [...newItinerary.travelers[travelerIdx].segments] };
        const newSegments: Segment[] = cbTraveler.segments.map(seg => {
          const s = JSON.parse(JSON.stringify(seg)) as Segment;
          s.id = uuidv4();
          if (s.type === 'city') {
            const startOff = getDayOffset(seg.type === 'city' ? seg.startDate : '');
            const endOff = getDayOffset(seg.type === 'city' ? seg.endDate : '');
            const length = endOff - startOff;
            const newStartOff = Math.round(startOff + dayShift);
            s.startDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff), 'yyyy-MM-dd');
            s.endDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff + length), 'yyyy-MM-dd');
            if (s.stays) {
              s.stays.forEach(stay => {
                const stayStartOff = differenceInDays(startOfDay(parseISO(stay.checkInDate)), startOfDay(parseISO(seg.type === 'city' ? seg.startDate : '')));
                const stayLen = differenceInDays(startOfDay(parseISO(stay.checkOutDate)), startOfDay(parseISO(stay.checkInDate)));
                stay.checkInDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff + stayStartOff), 'yyyy-MM-dd');
                stay.checkOutDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newStartOff + stayStartOff + stayLen), 'yyyy-MM-dd');
              });
            }
          } else {
            const depOff = getDayOffset(seg.type === 'transport' ? seg.departureDate : '');
            const arrOff = getDayOffset(seg.type === 'transport' ? seg.arrivalDate : '');
            const length = arrOff - depOff;
            const newDepOff = Math.round(depOff + dayShift);
            s.departureDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newDepOff), 'yyyy-MM-dd');
            s.arrivalDate = format(addDays(startOfDay(parseISO(newItinerary.startDate)), newDepOff + length), 'yyyy-MM-dd');
          }
          return s;
        });
        console.log(`Pasting ${newSegments.length} segments to traveler index ${travelerIdx}`);
        newSegments.forEach(newSeg => {
          const nStart = newSeg.type === 'city' ? getDayOffset(newSeg.startDate) : getDayOffset(newSeg.departureDate);
          const nEnd = newSeg.type === 'city' ? getDayOffset(newSeg.endDate) : getDayOffset(newSeg.arrivalDate);
          traveler.segments = traveler.segments.filter(oldSeg => {
            const oStart = oldSeg.type === 'city' ? getDayOffset(oldSeg.startDate) : getDayOffset(oldSeg.departureDate);
            const oEnd = oldSeg.type === 'city' ? getDayOffset(oldSeg.endDate) : getDayOffset(oldSeg.arrivalDate);
            return !(Math.max(nStart, oStart) <= Math.min(nEnd, oEnd));
          });
        });
        traveler.segments.push(...newSegments);
        newItinerary.travelers[travelerIdx] = traveler;
      });
      return newItinerary;
    });
  }, [itinerary, clipboard, focusedCell, getDayOffset, setItinerary]);

  return { copy, paste };
}
