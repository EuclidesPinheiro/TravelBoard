import { Itinerary } from '../types';
import { v4 as uuidv4 } from 'uuid';

const today = new Date();
const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 7);

export const initialItinerary: Itinerary = {
  id: uuidv4(),
  name: "Novo Roteiro",
  startDate: today.toISOString().split('T')[0],
  endDate: nextWeek.toISOString().split('T')[0],
  travelers: []
};
