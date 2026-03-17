import { TransportMode } from "../types";

export const TRANSPORT_COLORS: Record<TransportMode, string> = {
  train: "#ff7a6b",
  night_train: "#8e7cc3",
  flight: "#4ea1ff",
  ferry: "#1c7c7d",
  bus: "#ffb366",
  tour_bus: "#ffd966",
  car: "#5cc48d",
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
