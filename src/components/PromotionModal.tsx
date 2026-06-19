import React from 'react';
import { PieceType, PieceColor } from '../types';
import { ChessPieceSvg } from './ChessPieceSvg';

interface PromotionModalProps {
  isOpen: boolean;
  color: PieceColor;
  onSelect: (pieceType: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ isOpen, color, onSelect, onCancel }) => {
  if (!isOpen) return null;

  const options: { type: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
    { type: 'q', label: 'Queen' },
    { type: 'r', label: 'Rook' },
    { type: 'b', label: 'Bishop' },
    { type: 'n', label: 'Knight' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700 text-center transform scale-100 transition-all"
        id="promotion-dialog"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Pawn Promotion
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Choose which piece to promote your Pawn into.
        </p>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {options.map((opt) => (
            <button
              key={opt.type}
              id={`promote-to-${opt.type}`}
              onClick={() => onSelect(opt.type)}
              className="group flex flex-col items-center justify-center p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 mb-1 group-hover:scale-110 transition-transform">
                <ChessPieceSvg type={opt.type} color={color} />
              </div>
              <span className="text-xs font-medium text-gray-650 dark:text-gray-350">
                {opt.label}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          id="promotion-cancel-btn"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
        >
          Cancel Move
        </button>
      </div>
    </div>
  );
};
