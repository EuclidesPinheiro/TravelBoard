import React, { useState } from 'react';
import { useItinerary } from '../../store/ItineraryContext';
import { v4 as uuidv4 } from 'uuid';
import { X } from 'lucide-react';

interface AddTravelerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#E74C3C', '#E84393', '#9B59B6', '#3498DB', 
  '#1ABC9C', '#27AE60', '#F1C40F', '#F39C12', '#D35400', '#34495E'
];

export function AddTravelerModal({ isOpen, onClose }: AddTravelerModalProps) {
  const { setItinerary } = useItinerary();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setItinerary(prev => ({
      ...prev,
      travelers: [
        ...prev.travelers,
        {
          id: uuidv4(),
          name: name.trim(),
          color,
          segments: []
        }
      ]
    }));
    
    setName('');
    setColor(COLORS[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-50">Add Traveler</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-600">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. Maria Silva"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-950 border border-slate-600 rounded-lg hover:bg-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Traveler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
