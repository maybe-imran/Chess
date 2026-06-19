import { Chess, PieceSymbol, Color } from 'chess.js';
import { CapturedPieces, PieceType, PieceColor } from '../types';

/**
 * Calculates current captured pieces by comparing the current board state 
 * with the standard starting set of 16 pieces for each side.
 */
export function getCapturedPieces(game: Chess): CapturedPieces {
  const startingCounts: Record<PieceColor, Record<PieceType, number>> = {
    w: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 },
    b: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 }
  };

  const currentCounts: Record<PieceColor, Record<PieceType, number>> = {
    w: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
    b: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 }
  };

  // Scan the 8x8 board
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const color = piece.color as PieceColor;
        const type = piece.type as PieceType;
        currentCounts[color][type]++;
      }
    }
  }

  const captured: CapturedPieces = {
    w: [], // White pieces captured (by Black)
    b: []  // Black pieces captured (by White)
  };

  // Compare starting counts and current counts
  const pieceTypes: PieceType[] = ['p', 'n', 'b', 'r', 'q']; // Kings can never be captured

  for (const type of pieceTypes) {
    // White pieces captured (starting white counts minus current white counts)
    const capturedWhiteCount = startingCounts.w[type] - currentCounts.w[type];
    for (let i = 0; i < capturedWhiteCount; i++) {
      captured.w.push(type);
    }

    // Black pieces captured (starting black counts minus current black counts)
    const capturedBlackCount = startingCounts.b[type] - currentCounts.b[type];
    for (let i = 0; i < capturedBlackCount; i++) {
      captured.b.push(type);
    }
  }

  // Sort them by standard value order for elegant display: p, n, b, r, q
  const valOrder: Record<PieceType, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  captured.w.sort((x, y) => valOrder[x] - valOrder[y]);
  captured.b.sort((x, y) => valOrder[x] - valOrder[y]);

  return captured;
}

/**
 * Calculates current material score relative advantage.
 * White pieces: p=1, n=3, b=3, r=5, q=9
 * Black pieces: p=-1, n=-3, b=-3, r=-5, q=-9
 */
export function getMaterialAdvantage(game: Chess): { whiteAdvantage: number; blackAdvantage: number } {
  const values: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  
  let whiteTotal = 0;
  let blackTotal = 0;
  
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const type = piece.type as PieceType;
        if (piece.color === 'w') {
          whiteTotal += values[type] || 0;
        } else {
          blackTotal += values[type] || 0;
        }
      }
    }
  }

  if (whiteTotal > blackTotal) {
    return { whiteAdvantage: whiteTotal - blackTotal, blackAdvantage: 0 };
  } else if (blackTotal > whiteTotal) {
    return { whiteAdvantage: 0, blackAdvantage: blackTotal - whiteTotal };
  }
  return { whiteAdvantage: 0, blackAdvantage: 0 };
}

/**
 * Translates single piece letter to standard English name for assistance.
 */
export function getPieceName(type: PieceType): string {
  const names: Record<PieceType, string> = {
    p: 'Pawn',
    n: 'Knight',
    b: 'Bishop',
    r: 'Rook',
    q: 'Queen',
    k: 'King'
  };
  return names[type] || '';
}

/**
 * Checks if a square is a light square or a dark square.
 * Custom coordinates: columns a-h (0-7), rows 8-1 (0-7)
 */
export function isLightSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}
