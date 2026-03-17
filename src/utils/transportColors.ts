import { TransportMode } from "../types";

export const TRANSPORT_COLORS: Record<TransportMode, string> = {
  train: "#ff453a",
  night_train: "#6e5cff",
  flight: "#3ea6ff",
  ferry: "#00bfa5",
  bus: "#ff9f0a",
  tour_bus: "#a3e635",
  car: "#249a3e",
  walking: "#8D6E63",
};

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  flight: "Avião",
  train: "Trem",
  night_train: "Night Train",
  bus: "Ônibus",
  tour_bus: "Tour",
  car: "Carro",
  ferry: "Barco",
  walking: "A pé",
};
