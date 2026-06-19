export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  square: string;
}

export interface CapturedPieces {
  w: PieceType[]; // Captured white pieces (captured by Black)
  b: PieceType[]; // Captured black pieces (captured by White)
}

export interface MoveHistoryItem {
  san: string;
  from: string;
  to: string;
  color: PieceColor;
  piece: PieceType;
  captured?: PieceType;
  timestamp: string;
}

export interface GameStats {
  whiteTime: number; // in seconds
  blackTime: number; // in seconds
  moveCount: number;
}
