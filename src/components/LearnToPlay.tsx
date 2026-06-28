import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from './Chessboard';
import { ChessTheme } from '../utils/theme';
import { 
  ArrowLeft, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Award, 
  CheckCircle, 
  Compass, 
  Sword,
  AlertOctagon,
  TrendingUp
} from 'lucide-react';

interface PieceDemoCardProps {
  name: string;
  desc: string;
  fen: string;
  activeTheme: ChessTheme;
}

const PieceDemoCard: React.FC<PieceDemoCardProps> = ({ name, desc, fen, activeTheme }) => {
  const [game, setGame] = useState(() => new Chess(fen));

  const handleMove = (from: string, to: string, promotion?: any) => {
    try {
      const res = game.move({ from, to, promotion: promotion || 'q' });
      if (res) {
        setGame(new Chess(game.fen()));
        return true;
      }
    } catch (e) {}
    return false;
  };

  const handleReset = () => {
    setGame(new Chess(fen));
  };

  const history = game.history({ verbose: true });
  const highlightSquares = history.length > 0 ? [history[history.length - 1].from, history[history.length - 1].to] : [];

  return (
    <div className="bg-white dark:bg-[#151f32] border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-3xs flex flex-col justify-between items-center gap-3">
      <div className="text-center w-full">
        <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-500 mb-1">{name}</h3>
        <p className="text-xs text-slate-600 leading-relaxed min-h-[40px] text-center px-1">{desc}</p>
      </div>

      <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
        <Chessboard 
          game={game}
          onMove={handleMove}
          activeTheme={activeTheme}
          highlightSquares={highlightSquares}
          disabled={game.isCheckmate() || game.isStalemate() || game.isDraw()}
        />
      </div>

      <button
        onClick={handleReset}
        className="w-full py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-605 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-mono uppercase font-bold tracking-widest rounded transition-all cursor-pointer"
      >
        🔄 Reset Position
      </button>
    </div>
  );
};

interface Lesson {
  title: string;
  fen: string;
  desc: string;
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  lessons: Lesson[];
}

const LESSON_CATEGORIES = (theme: ChessTheme): Category[] => [
  {
    id: 'openings',
    name: 'Opening Principles',
    icon: <Compass className="w-4 h-4" />,
    lessons: [
      {
        title: '1. Control the Center',
        fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
        desc: 'Controlling the center squares (d4, d5, e4, e5) is the most fundamental opening rule. Center control grants your pieces greater mobility and restricts the movement of enemy pieces.'
      },
      {
        title: '2. Develop Your Pieces',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        desc: 'Bring your Knights and Bishops into active positions in the first few moves. Do not move the same piece multiple times or bring your Queen out too early, as she can be easily chased around.'
      },
      {
        title: '3. King Safety & Castling',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5',
        desc: 'Getting your King out of the vulnerable center and into safety behind a wall of pawns is crucial. Castling accomplishes this in a single move while activating your Rook!'
      }
    ]
  },
  {
    id: 'tactics',
    name: 'Basic Tactics',
    icon: <Sword className="w-4 h-4" />,
    lessons: [
      {
        title: '1. The Fork',
        fen: 'r3k3/8/3p4/4N3/8/5r2/8/4K3 w - - 0 1',
        desc: 'A fork is a powerful double-attack where a single piece simultaneously threatens two or more of your opponent\'s pieces. Knights and Queens are famously effective at performing forks.'
      },
      {
        title: '2. The Pin',
        fen: '4k3/8/3r4/8/8/3R4/8/4K3 w - - 0 1',
        desc: 'A pin occurs when an attacked piece cannot move without exposing a more valuable shielding piece behind it (often the King or Queen). A pinned piece is restricted and becomes an easy target.'
      },
      {
        title: '3. The Skewer',
        fen: '7r/8/8/4q3/8/8/8/B3K3 w - - 0 1',
        desc: 'A skewer is the reverse of a pin. You attack a valuable piece (here the Black Queen), which is forced to move, exposing a secondary, less valuable piece behind it (the Black Rook) for capture.'
      },
      {
        title: '4. Discovered Attacks',
        fen: '3k4/8/8/8/4B3/8/8/4R3 w - - 0 1',
        desc: 'A discovered attack happens when you move a shielding piece (like the White Bishop) out of the way, unmasking a deadly attack from a line piece behind it (the White Rook targeting the Black King).'
      }
    ]
  },
  {
    id: 'mistakes',
    name: 'Common Mistakes',
    icon: <AlertOctagon className="w-4 h-4" />,
    lessons: [
      {
        title: '1. Scholar\'s Mate',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 0 3',
        desc: 'Scholar\'s mate is a 4-move trap where the Queen and Bishop target the weak f7 square. Beware of bringing the Queen out too early, and defend f7 by blockading with Nf6 or Qe7.'
      },
      {
        title: '2. Hanging Pieces',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
        desc: 'Leaving a piece completely undefended is called an "hanging piece." Always check if your pieces can be captured for free before pressing make move, and keep your pieces coordinated.'
      }
    ]
  },
  {
    id: 'endgames',
    name: 'Endgame Basics',
    icon: <TrendingUp className="w-4 h-4" />,
    lessons: [
      {
        title: '1. King + Queen Mate',
        fen: 'k7/8/1Q6/8/8/3K4/8/8 w - - 0 1',
        desc: 'To deliver checkmate with King and Queen, work together to push the opponent\'s lone King into a "box" towards the edge or corner. Secure the King helper, and deliver the final blow without causing stalemate.'
      },
      {
        title: '2. Opposition',
        fen: '4k3/8/8/4K3/8/8/8/8 w - - 0 1',
        desc: 'Opposition occurs when Kings face each other with exactly one square between them. The player who does NOT have to move holds the opposition, forcing the other King to step aside and yield control!'
      }
    ]
  }
];

interface LearnToPlayProps {
  onBack: () => void;
  activeTheme: ChessTheme;
}

export const LearnToPlay: React.FC<LearnToPlayProps> = ({ onBack, activeTheme }) => {
  const [activeTab, setActiveTab] = useState<'moves' | 'lessons'>('moves');
  
  // Lesson state management
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);

  const categories = LESSON_CATEGORIES(activeTheme);
  const currentCategory = categories[activeCategoryIdx];
  const currentLesson = currentCategory.lessons[activeLessonIdx];

  const handleNextLesson = () => {
    if (activeLessonIdx < currentCategory.lessons.length - 1) {
      setActiveLessonIdx(activeLessonIdx + 1);
    }
  };

  const handlePrevLesson = () => {
    if (activeLessonIdx > 0) {
      setActiveLessonIdx(activeLessonIdx - 1);
    }
  };

  const handleCategorySelect = (idx: number) => {
    setActiveCategoryIdx(idx);
    setActiveLessonIdx(0);
  };

  return (
    <div className="w-full flex flex-col items-center animate-fade-in text-slate-800 dark:text-slate-100 font-sans">
      {/* Header Bar */}
      <div className="w-full max-w-[1024px] flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest">Learn to Play Chess</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-505 font-mono">Master piece movements, tactics and endgames</p>
          </div>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Guide</span>
        </button>
      </div>

      {/* Mode Sub tabs selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 w-full max-w-[1024px] mb-6 font-mono text-xs text-slate-505 dark:text-slate-400 uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('moves')}
          className={`flex-1 text-center py-2.5 border-b-2 font-bold cursor-pointer transition-all ${
            activeTab === 'moves'
              ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-350 dark:hover:border-slate-700'
          }`}
        >
          🎮 How Pieces Move (Interactive)
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex-1 text-center py-2.5 border-b-2 font-bold cursor-pointer transition-all ${
            activeTab === 'lessons'
              ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-350 dark:hover:border-slate-700'
          }`}
        >
          📚 Practical Lessons (Tactics)
        </button>
      </div>

      {/* Content Areas */}
      <div className="w-full max-w-[1024px]">
        {activeTab === 'moves' ? (
          <div className="space-y-6">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 text-center">
              <span className="text-xl mr-2">💡</span>
              <span className="text-xs text-slate-605 dark:text-slate-300 font-semibold font-sans">
                Click any chess piece below to highlight its legal squares! Then click a highlighted dot to see it glide there in real-time.
              </span>
            </div>

            {/* Grid of mini-boards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <PieceDemoCard 
                name="Pawn (P)"
                desc="Pawns move forward 1 square, or 2 on their first move. They capture diagonally."
                fen="4k3/8/8/8/3n4/8/4P3/4K3 w - - 0 1"
                activeTheme={activeTheme}
              />
              <PieceDemoCard 
                name="Rook (R)"
                desc="Rooks move horizontally or vertically any number of unoccupied squares."
                fen="7k/8/8/8/3R4/8/8/K7 w - - 0 1"
                activeTheme={activeTheme}
              />
              <PieceDemoCard 
                name="Knight (N)"
                desc="Knights move in an L-shape and can jump over other pieces on the board."
                fen="7k/8/8/8/3N4/8/8/K7 w - - 0 1"
                activeTheme={activeTheme}
              />
              <PieceDemoCard 
                name="Bishop (B)"
                desc="Bishops move diagonally any number of squares, staying on their original color."
                fen="7k/8/8/8/3B4/8/8/K7 w - - 0 1"
                activeTheme={activeTheme}
              />
              <PieceDemoCard 
                name="Queen (Q)"
                desc="Queens combine the movement of a Rook and Bishop: any line or diagonal."
                fen="6k1/8/8/8/3Q4/8/8/K7 w - - 0 1"
                activeTheme={activeTheme}
              />
              <PieceDemoCard 
                name="King (K)"
                desc="Kings move exactly one square in any direction. Keep your King safe at all costs!"
                fen="k7/8/8/8/3K4/8/8/8 w - - 0 1"
                activeTheme={activeTheme}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Category list panels */}
            <div className="w-full lg:w-[260px] flex flex-col gap-2.5">
              <h3 className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Lesson Categories</h3>
              {categories.map((cat, idx) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(idx)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    activeCategoryIdx === idx
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-[#151f32] text-slate-600 dark:text-slate-300 border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <span className={`${activeCategoryIdx === idx ? 'text-white' : 'text-slate-450 dark:text-slate-400'}`}>
                    {cat.icon}
                  </span>
                  <span className="text-xs font-semibold">{cat.name}</span>
                </button>
              ))}
            </div>

            {/* active Lesson dashboard */}
            <div className="flex-1 bg-white border border-slate-200/80 rounded-xl p-6 shadow-3xs flex flex-col justify-between gap-6">
              
              <div className="flex flex-col items-center gap-4">
                {/* Lesson Header */}
                <div className="text-center w-full border-b border-slate-100 pb-3">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-mono uppercase tracking-widest font-bold mb-2">
                    Lesson {activeLessonIdx + 1} of {currentCategory.lessons.length}
                  </div>
                  <h3 className="text-base font-bold text-slate-800">{currentLesson.title}</h3>
                </div>

                {/* Diagrams Chessboard (Disabled for diagrams) */}
                <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] md:w-[280px] md:h-[280px]">
                  <Chessboard 
                    game={new Chess(currentLesson.fen)}
                    disabled={true}
                    activeTheme={activeTheme}
                  />
                </div>

                {/* Lesson Description */}
                <div className="w-full max-w-[500px]">
                  <p className="text-xs text-slate-600 font-normal leading-relaxed text-center px-4 self-center justify-self-center my-1.5">
                    {currentLesson.desc}
                  </p>
                </div>
              </div>

              {/* Lesson Nav Controls */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-2">
                <button
                  onClick={handlePrevLesson}
                  disabled={activeLessonIdx === 0}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>

                <div className="text-[10px] font-mono font-bold text-slate-400">
                  {currentCategory.name} Category
                </div>

                <button
                  onClick={handleNextLesson}
                  disabled={activeLessonIdx === currentCategory.lessons.length - 1}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
