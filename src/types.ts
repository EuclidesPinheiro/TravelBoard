// src/types.ts
export type TransportMode = 'flight' | 'train' | 'night_train' | 'bus' | 'car' | 'ferry';

export interface CitySegment {
  type: 'city';
  id: string;
  cityName: string;
  country: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  notes?: string;
  accommodation?: string;
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
}

export type Segment = CitySegment | TransportSegment;

export interface Traveler {
  id: string;
  name: string;
  color: string;
  segments: Segment[];
}

export interface Itinerary {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  travelers: Traveler[];
}

export type SelectionType =
  | { type: 'traveler'; travelerId: string }
  | { type: 'city'; travelerId: string; segmentId: string }
  | { type: 'transport'; travelerId: string; segmentId: string }
  | null;
