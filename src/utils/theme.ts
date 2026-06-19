export interface ChessTheme {
  id: string;
  name: string;
  // Board Colors
  lightSquare: string;
  darkSquare: string;
  borderColor: string;
  textColorLight: string; // Coordinate label color on light squares
  textColorDark: string;  // Coordinate label color on dark squares
  // Pieces Colors
  whitePieceFill: string;
  whitePieceStroke: string;
  blackPieceFill: string;
  blackPieceStroke: string;
}

export const CHESS_THEMES: ChessTheme[] = [
  {
    id: 'classic',
    name: 'Classic Wood',
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    borderColor: '#3e2719',
    textColorLight: '#b58863',
    textColorDark: '#f0d9b5',
    whitePieceFill: '#ffffff',
    whitePieceStroke: '#3a2216',
    blackPieceFill: '#3a2216',
    blackPieceStroke: '#f0d9b5',
  },
  {
    id: 'midnight',
    name: 'Midnight Slate',
    lightSquare: '#64748b', // slate-500
    darkSquare: '#1e293b', // slate-800
    borderColor: '#0f172a', // slate-900
    textColorLight: '#1e293b',
    textColorDark: '#64748b',
    whitePieceFill: '#f8fafc',
    whitePieceStroke: '#0f172a',
    blackPieceFill: '#020617',
    blackPieceStroke: '#cbd5e1',
  },
  {
    id: 'marble',
    name: 'Carrara Marble',
    lightSquare: '#eae9d2',
    darkSquare: '#4b7399',
    borderColor: '#2b3d52',
    textColorLight: '#4b7399',
    textColorDark: '#eae9d2',
    whitePieceFill: '#ffffff',
    whitePieceStroke: '#1e293b',
    blackPieceFill: '#1b2d3f',
    blackPieceStroke: '#f1f5f9',
  },
  {
    id: 'emerald',
    name: 'Royal Emerald',
    lightSquare: '#ececd7',
    darkSquare: '#739552',
    borderColor: '#2e431d',
    textColorLight: '#739552',
    textColorDark: '#ececd7',
    whitePieceFill: '#ffffff',
    whitePieceStroke: '#1d2c14',
    blackPieceFill: '#13210b',
    blackPieceStroke: '#e2efda',
  },
];

const THEME_STORAGE_KEY = 'chess_active_theme';

export function getSavedTheme(): ChessTheme {
  if (typeof window === 'undefined') return CHESS_THEMES[0];
  const savedId = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = CHESS_THEMES.find((t) => t.id === savedId);
  return theme || CHESS_THEMES[0];
}

export function saveThemePreference(themeId: string): void {
  localStorage.setItem(THEME_STORAGE_KEY, themeId);
}
