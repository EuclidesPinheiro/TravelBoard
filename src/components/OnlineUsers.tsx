import React, { useState, useRef, useEffect } from 'react';
import { useItinerary } from '../store/ItineraryContext';
import { cn } from '../utils/cn';
import { Check } from 'lucide-react';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const MAX_VISIBLE = 5;

export function OnlineUsers() {
  const {
    localUser, remoteUsers, setDisplayName, needsNameSelection, itinerary,
  } = useItinerary();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isUnnamed = needsNameSelection;

  // Auto-open picker when name selection is needed
  useEffect(() => {
    if (needsNameSelection) {
      setPickerOpen(true);
    }
  }, [needsNameSelection]);

  // Close picker on outside click — but not if the user still needs to pick a name
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        if (!needsNameSelection) {
          setPickerOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen, needsNameSelection]);

  // Focus input when picker opens
  useEffect(() => {
    if (pickerOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pickerOpen]);

  const allUsers = [localUser, ...remoteUsers];
  const visibleUsers = allUsers.slice(0, MAX_VISIBLE);
  const overflowCount = allUsers.length - MAX_VISIBLE;

  const handleSelectTraveler = (name: string) => {
    setDisplayName(name);
    setPickerOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (trimmed) {
      setDisplayName(trimmed);
      setCustomName('');
      setPickerOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 relative" ref={pickerRef}>
      {visibleUsers.map((user) => {
        const isLocal = user.sessionId === localUser.sessionId;
        return (
          <div
            key={user.sessionId}
            className="relative group"
          >
            <button
              onClick={isLocal ? () => setPickerOpen(!pickerOpen) : undefined}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-110',
                isLocal && 'ring-2 ring-white/60 cursor-pointer',
                !isLocal && 'cursor-default',
                isLocal && isUnnamed && 'animate-pulse ring-amber-400',
              )}
              style={{ backgroundColor: isLocal && isUnnamed ? '#64748b' : user.color }}
            >
              {isLocal && isUnnamed ? '?' : getInitials(user.displayName)}
            </button>
            {/* Tooltip — hidden while picker is open to avoid overlap */}
            {!pickerOpen && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-slate-200 text-[10px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {isLocal && isUnnamed ? 'Click to set your name' : user.displayName}{isLocal && !isUnnamed ? ' (you)' : ''}
              </div>
            )}
          </div>
        );
      })}

      {overflowCount > 0 && (
        <div
          className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300"
          title={`${overflowCount} more`}
        >
          +{overflowCount}
        </div>
      )}

      {/* Traveler picker dropdown */}
      {pickerOpen && (
        <div className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 min-w-[200px] py-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {isUnnamed ? 'Who are you?' : 'Change identity'}
          </div>

          {itinerary.travelers.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTraveler(t.name)}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-between gap-2',
                localUser.displayName === t.name && 'text-indigo-300',
              )}
            >
              <span>{t.name}</span>
              {localUser.displayName === t.name && <Check size={14} className="text-indigo-400" />}
            </button>
          ))}

          <div className="border-t border-slate-600 mt-1 pt-1 px-3 pb-2">
            <form onSubmit={handleCustomSubmit} className="flex gap-1.5 mt-1">
              <input
                ref={inputRef}
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Custom name..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
              >
                Set
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
