// src/data/initialData.ts
import { Itinerary } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const initialItinerary: Itinerary = {
  id: uuidv4(),
  name: "Europa Junho 2026",
  startDate: "2026-05-20",
  endDate: "2026-12-31",
  travelers: [
    {
      id: uuidv4(),
      name: "Souto",
      color: "#9B59B6", // roxo
      segments: [
        { type: 'city', id: uuidv4(), cityName: 'Roma', country: 'IT', startDate: '2026-05-20', endDate: '2026-05-22' },
        { type: 'transport', id: uuidv4(), mode: 'flight', from: 'Roma', to: 'Milão', departureDate: '2026-05-23', departureTime: '10:00', arrivalDate: '2026-05-23', arrivalTime: '11:15' },
        { type: 'city', id: uuidv4(), cityName: 'Milão', country: 'IT', startDate: '2026-05-23', endDate: '2026-05-24' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Milão', to: 'Genebra', departureDate: '2026-05-25', departureTime: '09:00', arrivalDate: '2026-05-25', arrivalTime: '13:00' },
        { type: 'city', id: uuidv4(), cityName: 'Genebra', country: 'CH', startDate: '2026-05-25', endDate: '2026-05-28' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Genebra', to: 'Zurique', departureDate: '2026-05-29', departureTime: '10:00', arrivalDate: '2026-05-29', arrivalTime: '12:45' },
        { type: 'city', id: uuidv4(), cityName: 'Zurique', country: 'CH', startDate: '2026-05-29', endDate: '2026-05-30' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Zurique', to: 'Munich', departureDate: '2026-05-31', departureTime: '08:30', arrivalDate: '2026-05-31', arrivalTime: '12:30' },
        { type: 'city', id: uuidv4(), cityName: 'Munich', country: 'DE', startDate: '2026-05-31', endDate: '2026-06-02' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Munich', to: 'Salzburgo', departureDate: '2026-06-03', departureTime: '09:00', arrivalDate: '2026-06-03', arrivalTime: '10:30' },
        { type: 'city', id: uuidv4(), cityName: 'Salzburgo', country: 'AT', startDate: '2026-06-03', endDate: '2026-06-03' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Salzburgo', to: 'Viena', departureDate: '2026-06-04', departureTime: '11:00', arrivalDate: '2026-06-04', arrivalTime: '13:30' },
        { type: 'city', id: uuidv4(), cityName: 'Viena', country: 'AT', startDate: '2026-06-04', endDate: '2026-06-06' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Viena', to: 'Praga', departureDate: '2026-06-07', departureTime: '09:00', arrivalDate: '2026-06-07', arrivalTime: '13:00' },
        { type: 'city', id: uuidv4(), cityName: 'Praga', country: 'CZ', startDate: '2026-06-07', endDate: '2026-06-08' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Praga', to: 'Berlim', departureDate: '2026-06-09', departureTime: '10:30', arrivalDate: '2026-06-09', arrivalTime: '15:00' },
        { type: 'city', id: uuidv4(), cityName: 'Berlim', country: 'DE', startDate: '2026-06-09', endDate: '2026-06-10' },
      ]
    },
    {
      id: uuidv4(),
      name: "Joao",
      color: "#3498DB", // azul
      segments: [
        { type: 'city', id: uuidv4(), cityName: 'Copenhagen', country: 'DK', startDate: '2026-05-31', endDate: '2026-06-02' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Copenhagen', to: 'Viena', departureDate: '2026-06-03', departureTime: '08:00', arrivalDate: '2026-06-03', arrivalTime: '20:00' },
        { type: 'city', id: uuidv4(), cityName: 'Viena', country: 'AT', startDate: '2026-06-03', endDate: '2026-06-05' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Viena', to: 'Praga', departureDate: '2026-06-06', departureTime: '09:00', arrivalDate: '2026-06-06', arrivalTime: '13:00' },
        { type: 'city', id: uuidv4(), cityName: 'Praga', country: 'CZ', startDate: '2026-06-06', endDate: '2026-06-07' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Praga', to: 'Berlim', departureDate: '2026-06-08', departureTime: '10:30', arrivalDate: '2026-06-08', arrivalTime: '15:00' },
        { type: 'city', id: uuidv4(), cityName: 'Berlim', country: 'DE', startDate: '2026-06-08', endDate: '2026-06-10' },
      ]
    },
    {
      id: uuidv4(),
      name: "Tollini",
      color: "#F39C12", // laranja
      segments: [
        { type: 'city', id: uuidv4(), cityName: 'Frankfurt', country: 'DE', startDate: '2026-06-02', endDate: '2026-06-02' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Frankfurt', to: 'Viena', departureDate: '2026-06-03', departureTime: '09:00', arrivalDate: '2026-06-03', arrivalTime: '16:00' },
        { type: 'city', id: uuidv4(), cityName: 'Viena', country: 'AT', startDate: '2026-06-03', endDate: '2026-06-05' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Viena', to: 'Praga', departureDate: '2026-06-06', departureTime: '09:00', arrivalDate: '2026-06-06', arrivalTime: '13:00' },
        { type: 'city', id: uuidv4(), cityName: 'Praga', country: 'CZ', startDate: '2026-06-06', endDate: '2026-06-07' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Praga', to: 'Berlim', departureDate: '2026-06-08', departureTime: '10:30', arrivalDate: '2026-06-08', arrivalTime: '15:00' },
        { type: 'city', id: uuidv4(), cityName: 'Berlim', country: 'DE', startDate: '2026-06-08', endDate: '2026-06-10' },
      ]
    },
    {
      id: uuidv4(),
      name: "Euclides",
      color: "#27AE60", // verde
      segments: [
        { type: 'city', id: uuidv4(), cityName: 'Frankfurt', country: 'DE', startDate: '2026-06-01', endDate: '2026-06-01' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Frankfurt', to: 'Viena', departureDate: '2026-06-02', departureTime: '09:00', arrivalDate: '2026-06-02', arrivalTime: '16:00' },
        { type: 'city', id: uuidv4(), cityName: 'Viena', country: 'AT', startDate: '2026-06-02', endDate: '2026-06-05' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Viena', to: 'Praga', departureDate: '2026-06-06', departureTime: '09:00', arrivalDate: '2026-06-06', arrivalTime: '13:00' },
        { type: 'city', id: uuidv4(), cityName: 'Praga', country: 'CZ', startDate: '2026-06-06', endDate: '2026-06-07' },
        { type: 'transport', id: uuidv4(), mode: 'train', from: 'Praga', to: 'Berlim', departureDate: '2026-06-08', departureTime: '10:30', arrivalDate: '2026-06-08', arrivalTime: '15:00' },
        { type: 'city', id: uuidv4(), cityName: 'Berlim', country: 'DE', startDate: '2026-06-08', endDate: '2026-06-10' },
      ]
    },
    {
      id: uuidv4(),
      name: "Caiafa",
      color: "#E84393", // rosa
      segments: [
        { type: 'city', id: uuidv4(), cityName: 'Lisboa', country: 'PT', startDate: '2026-05-20', endDate: '2026-05-24' },
        { type: 'transport', id: uuidv4(), mode: 'flight', from: 'Lisboa', to: 'Madrid', departureDate: '2026-05-25', departureTime: '14:00', arrivalDate: '2026-05-25', arrivalTime: '16:15' },
        { type: 'city', id: uuidv4(), cityName: 'Madrid', country: 'ES', startDate: '2026-05-25', endDate: '2026-05-27' },
        { type: 'transport', id: uuidv4(), mode: 'flight', from: 'Madrid', to: 'Berlim', departureDate: '2026-05-28', departureTime: '10:00', arrivalDate: '2026-05-28', arrivalTime: '13:30' },
        { type: 'city', id: uuidv4(), cityName: 'Berlim', country: 'DE', startDate: '2026-05-28', endDate: '2026-06-10' },
      ]
    }
  ]
};
