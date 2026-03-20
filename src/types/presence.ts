export interface CursorPosition {
  x: number; // grid-content space (px from left edge of scrollable content)
  y: number; // grid-content space (px from top edge of scrollable content)
}

export interface PresencePayload {
  sessionId: string;
  displayName: string;
  colorIndex: number;
}

export interface CursorBroadcastPayload {
  sessionId: string;
  cursor: CursorPosition | null; // null = cursor outside the board viewport
  sentAt: number;
}

export interface RemoteCursorState {
  cursor: CursorPosition | null;
  lastUpdatedAt: number;
}

export interface RemoteUser {
  sessionId: string;
  displayName: string;
  colorIndex: number;
  color: string; // resolved hex from PRESENCE_PALETTE
}

export interface LocalUser {
  sessionId: string;
  displayName: string;
  color: string;
  colorIndex: number;
}
