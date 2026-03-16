import { TransportMode } from '../types';

export const TRANSPORT_COLORS: Record<TransportMode, string> = {
  flight: '#E74C3C',
  train: '#F39C12',
  night_train: '#3498DB',
  bus: '#27AE60',
  car: '#9B59B6',
  ferry: '#1ABC9C',
  walking: '#8D6E63',
};

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  flight: 'Avião',
  train: 'Trem',
  night_train: 'Night Train',
  bus: 'Bus',
  car: 'Carro',
  ferry: 'Barco',
  walking: 'A pé',
};
