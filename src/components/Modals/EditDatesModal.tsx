import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useItinerary } from '../../store/ItineraryContext';

interface EditDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditDatesModal({ isOpen, onClose }: EditDatesModalProps) {
  const { itinerary, setItinerary } = useItinerary();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStartDate(itinerary.startDate);
      setEndDate(itinerary.endDate);
      setError(null);
    }
  }, [isOpen, itinerary.startDate, itinerary.endDate]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;

    if (new Date(endDate) < new Date(startDate)) {
      setError("A data final não pode ser anterior à data inicial.");
      return;
    }

    setItinerary(prev => {
      return {
        ...prev,
        startDate,
        endDate,
        travelers: prev.travelers.map(traveler => {
          return {
            ...traveler,
            segments: traveler.segments.map(segment => {
              if (segment.type === 'city') {
                const newSeg = { ...segment };
                if (newSeg.startDate < startDate) newSeg.startDate = startDate;
                if (newSeg.endDate > endDate) newSeg.endDate = endDate;
                
                if (newSeg.stays) {
                  newSeg.stays = newSeg.stays
                    .filter(stay => stay.checkOutDate >= startDate && stay.checkInDate <= endDate)
                    .map(stay => {
                      const newStay = { ...stay };
                      if (newStay.checkInDate < startDate) newStay.checkInDate = startDate;
                      if (newStay.checkOutDate > endDate) newStay.checkOutDate = endDate;
                      return newStay;
                    });
                }
                return newSeg;
              } else {
                const newSeg = { ...segment };
                if (newSeg.departureDate < startDate) newSeg.departureDate = startDate;
                if (newSeg.arrivalDate > endDate) newSeg.arrivalDate = endDate;
                return newSeg;
              }
            }).filter(segment => {
              if (segment.type === 'city') {
                return segment.endDate >= startDate && segment.startDate <= endDate;
              } else {
                return segment.arrivalDate >= startDate && segment.departureDate <= endDate;
              }
            })
          };
        })
      };
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Alterar Período</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="bg-red-900/40 text-red-300 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Data Final
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
