import { Chess } from 'chess.js';

// Piece values for evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Piece-Square Tables (PST) from the perspective of White.
// High values represent favorable squares.
// For Black, the indices are mirrored vertically.

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-25,-25,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const PSTS: Record<string, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_PST
};

/**
 * Evaluates the board score from White's perspective.
 * Positive is better for White. Negative is better for Black.
 */
function evaluateBoard(game: Chess): number {
  let score = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = board[r][c];
      if (square) {
        const type = square.type;
        const color = square.color;
        
        let positionVal = 0;
        const psts = PSTS[type];
        if (psts) {
          if (color === 'w') {
            positionVal = psts[r][c];
          } else {
            // Mirror row vertically for black
            positionVal = psts[7 - r][c];
          }
        }

        const materialVal = PIECE_VALUES[type] || 0;
        const totalPieceVal = materialVal + positionVal;

        if (color === 'w') {
          score += totalPieceVal;
        } else {
          score -= totalPieceVal;
        }
      }
    }
  }

  return score;
}

/**
 * Minimax with Alpha-Beta Pruning.
 * Returns [bestMove, bestScore]
 */
function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): [any, number] {
  if (depth === 0 || game.isGameOver()) {
    return [null, evaluateBoard(game)];
  }

  const moves = game.moves({ verbose: true });
  
  // Sort moves to maximize Alpha-Beta Pruning effectiveness
  // Searching captures of high-value pieces first helps prune empty/bad branches immediately!
  moves.sort((x, y) => {
    const scoreX = (x.captured ? (PIECE_VALUES[x.captured] || 0) * 10 - (PIECE_VALUES[x.piece] || 0) : 0) + (x.san.includes('+') ? 50 : 0);
    const scoreY = (y.captured ? (PIECE_VALUES[y.captured] || 0) * 10 - (PIECE_VALUES[y.piece] || 0) : 0) + (y.san.includes('+') ? 50 : 0);
    return scoreY - scoreX;
  });

  let bestMove: any = null;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const [_, evaluation] = minimax(game, depth - 1, alpha, beta, false);
      game.undo();

      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // beta prune
      }
    }
    return [bestMove, maxEval];
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const [_, evaluation] = minimax(game, depth - 1, alpha, beta, true);
      game.undo();

      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // alpha prune
      }
    }
    return [bestMove, minEval];
  }
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Computes the computer's turn/move based on difficulty.
 */
export function getComputerMove(
  game: Chess,
  difficulty: DifficultyLevel
): { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Easy mode:
  // Random move 65% of the time, 1-depth lookahead 35% of the time.
  if (difficulty === 'easy') {
    if (Math.random() < 0.65) {
      const idx = Math.floor(Math.random() * moves.length);
      const chosen = moves[idx];
      return { from: chosen.from, to: chosen.to, promotion: chosen.promotion as any };
    } else {
      const isComputerWhite = game.turn() === 'w';
      const [bestMove] = minimax(game, 1, -Infinity, Infinity, isComputerWhite);
      if (bestMove) {
        return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion as any };
      }
    }
  }

  // Medium mode:
  // Random move 15% of the time, depth-2 lookahead 85% of the time.
  if (difficulty === 'medium') {
    if (Math.random() < 0.15) {
      const idx = Math.floor(Math.random() * moves.length);
      const chosen = moves[idx];
      return { from: chosen.from, to: chosen.to, promotion: chosen.promotion as any };
    } else {
      const isComputerWhite = game.turn() === 'w';
      const [bestMove] = minimax(game, 2, -Infinity, Infinity, isComputerWhite);
      if (bestMove) {
        return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion as any };
      }
    }
  }

  // Hard mode:
  // Solid depth-2 search (completed instantly). Extremely safe and tactically alert.
  if (difficulty === 'hard') {
    const isComputerWhite = game.turn() === 'w';
    const [bestMove] = minimax(game, 2, -Infinity, Infinity, isComputerWhite);
    if (bestMove) {
      return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion as any };
    }
  }

  // Expert mode:
  // Depth-3 search (highly tactical 3-ply lookahead, fully optimized with capture sorting so it finishes in <100ms lag-free).
  const isComputerWhite = game.turn() === 'w';
  const [bestMove] = minimax(game, 3, -Infinity, Infinity, isComputerWhite);
  if (bestMove) {
    return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion as any };
  }

  // Fallback
  const fallbackIdx = Math.floor(Math.random() * moves.length);
  const fallback = moves[fallbackIdx];
  return { from: fallback.from, to: fallback.to, promotion: fallback.promotion as any };
}
