import React from 'react';
import { PieceType, PieceColor } from '../types';

interface PieceSvgProps {
  type: PieceType;
  color: PieceColor;
  className?: string;
  customWhiteFill?: string;
  customWhiteStroke?: string;
  customBlackFill?: string;
  customBlackStroke?: string;
}

export const ChessPieceSvg: React.FC<PieceSvgProps> = ({ 
  type, 
  color, 
  className = "w-full h-full",
  customWhiteFill,
  customWhiteStroke,
  customBlackFill,
  customBlackStroke
}) => {
  // Styling details based on color or theme customization
  const outlineColor = color === 'w' 
    ? (customWhiteStroke || '#374151') 
    : (customBlackStroke || '#f3f4f6');
  const fillColor = color === 'w' 
    ? (customWhiteFill || '#ffffff') 
    : (customBlackFill || '#1f2937');
  
  // Custom styled SVGs with high-fidelity curves representing chess pieces beautifully.
  switch (type) {
    case 'p': // Pawn
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fillColor} stroke={outlineColor} strokeWidth="1.5" strokeLinejoin="miter">
            <path d="M 16,9 A 4,4 0 0,1 24,9 A 4,4 0 0,1 16,9" />
            <path d="M 22,9 C 22,11.5 20,13 20,13 L 25,13 C 25,13 23,11.5 23,9" />
            <path d="M 11.5,32 C 11.5,32 15,30 15,22 C 15,14 20,14 20,14 C 20,14 25,14 25,22 C 25,30 28.5,32 28.5,32" />
            <path d="M 11.5,32 L 28.5,32" />
            <path d="M 11.5,34 L 28.5,34" />
            <path d="M 9,38 L 31,38 L 31,36 L 9,36 z" />
            <circle cx="20" cy="9" r="3" fill={color === 'w' ? '#fff' : '#1f2937'} />
          </g>
        </svg>
      );

    case 'r': // Rook
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fillColor} stroke={outlineColor} strokeWidth="1.5" strokeLinejoin="miter">
            <path d="M 9,39 L 31,39 L 31,36 L 9,36 z" />
            <path d="M 12,36 L 28,36 L 28,32 L 12,32 z" />
            <path d="M 12,32 L 28,32 L 26,14 L 14,14 z" />
            <path d="M 14,14 L 26,14 L 28,9 L 24,9 L 24,12 L 20,12 L 20,9 L 16,9 L 16,12 L 12,12 L 12,9 L 14,14 Z" />
            <path d="M 11,14 L 29,14" />
            <path d="M 12,32 L 28,32" />
          </g>
        </svg>
      );

    case 'n': // Knight
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fillColor} stroke={outlineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 31,38.5 C 31,38.5 33,35.5 33,31 C 33,26.5 28.5,23.5 28.5,23.5 C 28.5,23.5 29,17 25,13 C 21,9.5 14,11 14,11 C 14,11 11,13 10,18.5 C 9,24 12,28.5 12,28.5 C 12,28.5 13,29.5 11,31 C 9,32.5 6,34 6,34 C 6,34 9,36 13,36 C 17,36 18,34.5 21,34.5 C 24,34.5 26,38.5 31,38.5 Z" />
            <path d="M 11,18 C 12,16 15,15.5 17,16 C 19,16.5 20,18.5 20,18.5" />
            <path d="M 8.5,26.5 C 10.5,26 12,28.5 12,28.5" />
            <circle cx="15.5" cy="16.5" r="1.5" fill={color === 'w' ? '#374151' : '#f3f4f6'} />
          </g>
        </svg>
      );

    case 'b': // Bishop
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fillColor} stroke={outlineColor} strokeWidth="1.5" strokeLinejoin="miter">
            <path d="M 9,36 A 4,4 0 0,1 13,32 A 4,4 0 0,1 17,36" />
            <path d="M 9,36 L 27,36 L 27,39 L 9,39 z" />
            <path d="M 12.5,32 L 23.5,32 L 23.5,29 L 12.5,29 z" />
            <path d="M 18,9 C 13,11.5 13,18 13,22 C 13,25.5 14.5,29 18,29 C 21.5,29 23,25.5 23,22 C 23,18 23,11.5 18,9" />
            <circle cx="18" cy="6.5" r="2.25" fill={color === 'w' ? '#fff' : '#1f2937'} />
            <path d="M 18,11 L 18,21" strokeWidth="1.25" stroke={outlineColor} />
            <path d="M 13.5,15 L 22.5,15" strokeWidth="1.25" stroke={outlineColor} />
          </g>
        </svg>
      );

    case 'q': // Queen
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fillColor} stroke={outlineColor} strokeWidth="1.5" strokeLinejoin="miter">
            <path d="M 9,39 L 31,39 L 31,36 L 9,36 z" />
            <path d="M 11.5,32 L 28.5,32 C 28.5,32 30.5,23.5 27,15 L 20,29 L 13,15 C 9.5,23.5 11.5,32 11.5,32 Z" />
            <circle cx="6" cy="14" r="2" />
            <circle cx="13" cy="10" r="2" />
            <circle cx="20" cy="8" r="2" />
            <circle cx="27" cy="10" r="2" />
            <circle cx="34" cy="14" r="2" />
          </g>
        </svg>
      );

    case 'k': // King
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fillColor} stroke={outlineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,39 L 31,39 L 31,36 L 9,36 z" />
            <path d="M 11.5,32 L 28.5,32 C 28.5,32 31.5,23 27.5,19 L 20,26 L 12.5,19 C 8.5,23 11.5,32 11.5,32 Z" />
            <path d="M 11.5,32 L 28.5,32" />
            <path d="M 11.5,34 L 28.5,34" />
            {/* The Cross at the top */}
            <path d="M 20,8 L 20,15" strokeWidth="2" />
            <path d="M 16.5,11.5 L 23.5,11.5" strokeWidth="2" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};
