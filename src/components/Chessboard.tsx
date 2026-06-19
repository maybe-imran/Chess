import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { PieceColor, PieceType } from '../types';
import { isLightSquare } from '../utils/chessHelpers';
import { ChessPieceSvg } from './ChessPieceSvg';
import { PromotionModal } from './PromotionModal';
import { ChessTheme } from '../utils/theme';
import { motion } from 'motion/react';

interface ChessboardProps {
  game: Chess;
  onMove?: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  disabled?: boolean;
  flipped?: boolean;
  activeTheme: ChessTheme;
  highlightSquares?: string[];
}

export const Chessboard: React.FC<ChessboardProps> = ({ 
  game, 
  onMove = (_from: string, _to: string, _promo?: 'q' | 'r' | 'b' | 'n') => false, 
  disabled = false, 
  flipped = false,
  activeTheme,
  highlightSquares = []
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<string[]>([]);
  
  // State for pawn promotion dialog
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);

  // Core board structure (row 8 to 1, column a to h)
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  // Rotate display coordinates if flipped is true (Black perspective)
  const displayFiles = flipped ? [...files].reverse() : files;
  const displayRanks = flipped ? [...ranks].reverse() : ranks;

  // Clear selections if game is reset or changed externally
  useEffect(() => {
    setSelectedSquare(null);
    setLegalDestinations([]);
  }, [game]);

  // Find if currently checked King's square needs highlighting
  const getKingInCheckSquare = (): string | null => {
    if (!game.inCheck()) return null;
    const turnColor = game.turn();
    const board = game.board();
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turnColor) {
          return files[c] + ranks[r];
        }
      }
    }
    return null;
  };

  const kingInCheckSq = getKingInCheckSquare();

  // Convert row, col index (0-7, 0-7) to algebraic notation (e.g. "e4")
  const getAlgebraicCoordinate = (rowIdx: number, colIdx: number): string => {
    return files[colIdx] + ranks[rowIdx];
  };

  const handleSquareClick = (squareStr: string) => {
    if (disabled) return;

    const piece = game.get(squareStr as any);
    const turnColor = game.turn();

    // 1. If a coordinate is clicked that is in our legal destinations, execute the move!
    if (legalDestinations.includes(squareStr)) {
      if (selectedSquare) {
        // Check if movement is promotion
        const isPromo = isPromotionMove(selectedSquare, squareStr);
        if (isPromo) {
          setPromotionPending({ from: selectedSquare, to: squareStr });
        } else {
          onMove(selectedSquare, squareStr);
          setSelectedSquare(null);
          setLegalDestinations([]);
        }
      }
      return;
    }

    // 2. Select a piece of the current player's turn color
    if (piece && piece.color === turnColor) {
      setSelectedSquare(squareStr);
      // Retrieve legal moves using chess.js helper
      const moves = game.moves({ square: squareStr as any, verbose: true });
      const destinations = moves.map(m => m.to);
      setLegalDestinations(destinations);
    } else {
      // Clicked on empty space or enemy piece without legal destination -> Deselect
      setSelectedSquare(null);
      setLegalDestinations([]);
    }
  };

  const isPromotionMove = (from: string, to: string): boolean => {
    const piece = game.get(from as any);
    if (piece && piece.type === 'p') {
      const destinationRank = to[1];
      return (piece.color === 'w' && destinationRank === '8') || (piece.color === 'b' && destinationRank === '1');
    }
    return false;
  };

  const handlePromotionSelect = (chosenType: 'q' | 'r' | 'b' | 'n') => {
    if (promotionPending) {
      onMove(promotionPending.from, promotionPending.to, chosenType);
      setPromotionPending(null);
      setSelectedSquare(null);
      setLegalDestinations([]);
    }
  };

  const handlePromotionCancel = () => {
    setPromotionPending(null);
    setSelectedSquare(null);
    setLegalDestinations([]);
  };

  // Convert a 1D index representation to coordinates 0-63
  const boardLayout = game.board();

  return (
    <div 
      className="relative w-full max-w-[512px] aspect-square mx-auto p-1 rounded-sm shadow-2xl border-4 transition-colors duration-350"
      style={{ backgroundColor: activeTheme.borderColor, borderColor: activeTheme.borderColor }}
    >
      
      {/* 8x8 Chessboard Column/Row Grid */}
      <div 
        id="chessboard-grid"
        className="w-full h-full grid grid-cols-8 grid-rows-8 overflow-hidden"
      >
        {displayRanks.map((rankName, visualRowIdx) => (
          <React.Fragment key={rankName}>
            {displayFiles.map((fileName, visualColIdx) => {
              const rowIdx = ranks.indexOf(rankName);
              const colIdx = files.indexOf(fileName);
              const squareStr = fileName + rankName;
              const piece = boardLayout[rowIdx][colIdx];
              const isLight = isLightSquare(rowIdx, colIdx);
              
              // Determine Square background color
              let squareColor = isLight ? activeTheme.lightSquare : activeTheme.darkSquare;

              const isSelected = selectedSquare === squareStr;
              const isDestination = legalDestinations.includes(squareStr);
              const isKingChecked = kingInCheckSq === squareStr;
              const isLastMoveHighlight = highlightSquares?.includes(squareStr);

              // Override highlighting
              if (isSelected) {
                squareColor = '#fbbf24'; // beautiful highlight gold
              } else if (isKingChecked) {
                squareColor = '#f87171'; // soft warning red
              } else if (isLastMoveHighlight) {
                squareColor = isLight ? '#fef08a' : '#fde047'; // beautiful soft yellow/amber highlight
              }

              return (
                <div
                  key={squareStr}
                  id={`square-${squareStr}`}
                  onClick={() => handleSquareClick(squareStr)}
                  className="relative flex items-center justify-center aspect-square select-none cursor-pointer group transition-colors duration-150"
                  style={{ backgroundColor: squareColor }}
                >
                  {/* Chess piece if present */}
                  {piece && (() => {
                    const isLastMovedPiece = highlightSquares && highlightSquares.length === 2 && highlightSquares[1] === squareStr;
                    const pieceKey = `${squareStr}-${piece.type}-${piece.color}-${isLastMovedPiece ? highlightSquares.join('-') : 'static'}`;

                    let motionProps: any = {
                      initial: { x: 0, y: 0 },
                      animate: { x: 0, y: 0 },
                      transition: { duration: 0 }
                    };

                    if (isLastMovedPiece) {
                      const fromColVisual = displayFiles.indexOf(highlightSquares[0][0]);
                      const fromRowVisual = displayRanks.indexOf(highlightSquares[0][1]);
                      const toColVisual = displayFiles.indexOf(highlightSquares[1][0]);
                      const toRowVisual = displayRanks.indexOf(highlightSquares[1][1]);

                      const deltaX = (fromColVisual - toColVisual) * 100;
                      const deltaY = (fromRowVisual - toRowVisual) * 100;

                      motionProps = {
                        initial: { x: `${deltaX}%`, y: `${deltaY}%` },
                        animate: { x: 0, y: 0 },
                        transition: { type: 'spring', stiffness: 220, damping: 22 }
                      };
                    }

                    return (
                      <motion.div 
                        key={pieceKey}
                        className="w-[85%] h-[85%] flex items-center justify-center z-10 transform group-hover:scale-105 active:scale-95 transition-transform duration-100"
                        initial={motionProps.initial}
                        animate={motionProps.animate}
                        transition={motionProps.transition}
                      >
                        <ChessPieceSvg 
                          type={piece.type as PieceType} 
                          color={piece.color as PieceColor} 
                          customWhiteFill={activeTheme.whitePieceFill}
                          customWhiteStroke={activeTheme.whitePieceStroke}
                          customBlackFill={activeTheme.blackPieceFill}
                          customBlackStroke={activeTheme.blackPieceStroke}
                        />
                      </motion.div>
                    );
                  })()}

                  {/* Legal move indicators */}
                  {isDestination && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      {piece ? (
                        // Destination with landing capture: ring on border
                        <div className="w-[88%] h-[88%] border-4 border-[#10b981]/50 rounded-full" />
                      ) : (
                        // Destination is empty: simple centered dot
                        <div className="w-4 h-4 bg-[#10b981]/50 rounded-full animate-scale-in" />
                      )}
                    </div>
                  )}

                  {/* Coordinate labels embedded beautifully on board edges */}
                  {/* Rank Numbers on the very left column */}
                  {visualColIdx === 0 && (
                    <span 
                      className="absolute top-0.5 left-1 text-[9px] md:text-[10px] font-bold pointer-events-none select-none"
                      style={{ color: isLight ? activeTheme.textColorLight : activeTheme.textColorDark }}
                    >
                      {rankName}
                    </span>
                  )}

                  {/* File Letters on the bottom row */}
                  {visualRowIdx === 7 && (
                    <span 
                      className="absolute bottom-0.5 right-1 text-[9px] md:text-[10px] font-bold pointer-events-none select-none"
                      style={{ color: isLight ? activeTheme.textColorLight : activeTheme.textColorDark }}
                    >
                      {fileName}
                    </span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Pawn Promotion choice overlay */}
      <PromotionModal
        isOpen={promotionPending !== null}
        color={game.turn()}
        onSelect={handlePromotionSelect}
        onCancel={handlePromotionCancel}
      />
    </div>
  );
};
