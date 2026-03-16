// src/types.ts
export type TransportMode = 'flight' | 'train' | 'night_train' | 'bus' | 'car' | 'ferry' | 'walking';

export interface Stay {
  id: string;
  name: string;
  link?: string;
  checkInDate: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm
  checkOutDate: string; // YYYY-MM-DD
  checkOutTime: string; // HH:mm
  sharedWith: string[]; // traveler IDs
  cost?: number; // total cost (split among owner + sharedWith)
}

export interface CitySegment {
  type: 'city';
  id: string;
  cityName: string;
  country: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  notes?: string;
  accommodation?: string;
  stays?: Stay[];
}

export interface TransportSegment {
  type: 'transport';
  id: string;
  mode: TransportMode;
  from: string;
  to: string;
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  arrivalDate: string; // YYYY-MM-DD
  arrivalTime: string; // HH:mm
  notes?: string;
  overnight?: boolean;
  cost?: number;
}

export type Segment = CitySegment | TransportSegment;

export interface Traveler {
  id: string;
  name: string;
  color: string;
  segments: Segment[];
}

export type AttractionCategory = 'museum' | 'science' | 'nature' | 'yolo';

export interface Attraction {
  id: string;
  name: string;
  link?: string;
  category: AttractionCategory;
  addedBy: string; // traveler ID
  votes: string[]; // traveler IDs who voted
  cost?: number;
  comment?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  addedBy: string; // traveler ID
  completedBy: string[]; // traveler IDs who marked it done
}

export interface Itinerary {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  travelers: Traveler[];
  attractions?: Record<string, Attraction[]>; // keyed by cityName
  checklists?: Record<string, ChecklistItem[]>; // keyed by cityName
}

export type SelectionType =
  | { type: 'traveler'; travelerId: string }
  | { type: 'city'; travelerId: string; segmentId: string }
  | { type: 'transport'; travelerId: string; segmentId: string }
  | null;
