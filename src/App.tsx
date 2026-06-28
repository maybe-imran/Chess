import { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from './components/Chessboard';
import { LearnToPlay } from './components/LearnToPlay';
import { getCapturedPieces, getMaterialAdvantage, getPieceName } from './utils/chessHelpers';
import { getComputerMove, DifficultyLevel } from './utils/chessEngine';
import { ChessPieceSvg } from './components/ChessPieceSvg';
import { 
  createOnlineRoom, 
  joinOnlineRoom, 
  updateRoomBoard, 
  sendHeartbeat, 
  generateRoomCode, 
  getOrCreatePlayerId, 
  OnlineRoom,
  db,
  auth,
  getUserProfile,
  UserProfile,
  updateUserProfileTheme
} from './utils/firebase';
import { doc, onSnapshot, updateDoc, runTransaction, collection, getDocs, setDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AuthModal } from './components/AuthModal';
import { TermsPrivacyModal } from './components/TermsPrivacyModal';
import { ChessChat } from './components/ChessChat';
import { 
  Award, 
  Laptop, 
  Users, 
  Globe, 
  Copy, 
  Check, 
  LogOut, 
  ArrowLeft,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
  List,
  Key,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  BookOpen,
  Sun,
  Moon,
  Wifi,
  WifiOff
} from 'lucide-react';
import { playChessSound, getMuteState, setMuteState } from './utils/audio';
import { CHESS_THEMES, getSavedTheme, saveThemePreference, ChessTheme } from './utils/theme';

function getReplayVerboseHistory(moves: string[]): { from: string; to: string }[] {
  const chess = new Chess();
  const verbose: { from: string; to: string }[] = [];
  for (const move of moves) {
    try {
      const res = chess.move(move);
      if (res) {
        verbose.push({ from: res.from, to: res.to });
      }
    } catch (e) {
      // ignore
    }
  }
  return verbose;
}

function getReplayBoardAt(moves: string[], index: number): Chess {
  const chess = new Chess();
  for (let i = 0; i < index; i++) {
    try {
      chess.move(moves[i]);
    } catch (e) {
      // ignore
    }
  }
  return chess;
}

export default function App() {
  // Authoritative chess.js game state (loads saved local match if exists)
  const [game, setGame] = useState(() => {
    const saved = localStorage.getItem('chess_local_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.fen) {
          return new Chess(data.fen);
        }
      } catch (e) {
        console.warn('Failed to restore FEN from localStorage', e);
      }
    }
    return new Chess();
  });

  // Move count trigger to force React re-rendering on internal JS state changes
  const [moveCount, setMoveCount] = useState(() => {
    const saved = localStorage.getItem('chess_local_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.fen) {
          const temp = new Chess(data.fen);
          return temp.history().length;
        }
      } catch (e) {}
    }
    return 0;
  });

  // Client Identification
  const [playerId] = useState(() => getOrCreatePlayerId());

  // General Mode Configuration: 'local' | 'computer' | 'online' | 'learn'
  const [mode, setMode] = useState<'local' | 'computer' | 'online' | 'learn'>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('room')) return 'online';

    const saved = localStorage.getItem('chess_local_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.mode === 'local' || data.mode === 'computer') {
          return data.mode;
        }
      } catch (e) {}
    }
    return 'local';
  });

  // Single Player (Computer vs Local Human) Settings
  const [computerColor, setComputerColor] = useState<'w' | 'b'>(() => {
    const saved = localStorage.getItem('chess_local_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.computerColor === 'w' || data.computerColor === 'b') {
          return data.computerColor;
        }
      } catch (e) {}
    }
    return 'b';
  });

  const [humanColor, setHumanColor] = useState<'w' | 'b'>(() => {
    const saved = localStorage.getItem('chess_local_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.humanColor === 'w' || data.humanColor === 'b') {
          return data.humanColor;
        }
      } catch (e) {}
    }
    return 'w';
  });

  const [difficulty, setDifficulty] = useState<DifficultyLevel>(() => {
    const saved = localStorage.getItem('chess_local_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.difficulty) {
          return data.difficulty;
        }
      } catch (e) {}
    }
    return 'medium';
  });

  const [isThinking, setIsThinking] = useState(false);
  const thinkingRef = useRef(false);

  // User Accounts State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Theme selection ('light' | 'dark')
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('themePreference');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Dynamic network connection state (PWA resilience requirement)
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Apply theme to HTML class & synchronize storage / Firestore
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('themePreference', themeMode);
    if (user) {
      updateUserProfileTheme(user.uid, themeMode);
    }
  }, [themeMode, user]);

  // Handle system preference color scheme changes
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('themePreference')) {
        setThemeMode(e.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // Monitor dynamic network connectivity transitions
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Online Multiplayer Settings
  const [roomCode, setRoomCode] = useState<string>('');
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [preferredColor, setPreferredColor] = useState<'w' | 'b' | 'random'>('w');
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [onlineJoinError, setOnlineJoinError] = useState<string>('');

  // Matchmaking & Interactive Terms/Privacy Modal States
  const [matchmakingStatus, setMatchmakingStatus] = useState<'idle' | 'searching' | 'matched' | 'timeout'>('idle');
  const [matchmakingTimeLeft, setMatchmakingTimeLeft] = useState<number>(45);
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  
  const [appTermsPrivacyOpen, setAppTermsPrivacyOpen] = useState(false);
  const [appTermsPrivacyTab, setAppTermsPrivacyTab] = useState<'terms' | 'privacy'>('terms');

  const matchmakingUnsubscribeRef = useRef<(() => void) | null>(null);
  const matchmakingTimeoutIdRef = useRef<any>(null);
  
  // Feedback indicator triggers for Copy Buttons
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sound and Custom Theme Preferences
  const [muted, setMuted] = useState(() => getMuteState());
  const [activeTheme, setActiveTheme] = useState<ChessTheme>(() => getSavedTheme());

  // Replay feature states
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayHistory, setReplayHistory] = useState<string[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Resignation states
  const [localResignedColor, setLocalResignedColor] = useState<'w' | 'b' | null>(null);

  // Auto-advance replay effect
  useEffect(() => {
    if (isPlayingReplay) {
      replayIntervalRef.current = setInterval(() => {
        setReplayIndex((prevIndex) => {
          if (prevIndex < replayHistory.length) {
            return prevIndex + 1;
          } else {
            setIsPlayingReplay(false);
            return prevIndex;
          }
        });
      }, 1500);
    } else {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
    }

    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
      }
    };
  }, [isPlayingReplay, replayHistory.length]);

  const handleChooseTheme = (theme: ChessTheme) => {
    setActiveTheme(theme);
    saveThemePreference(theme.id);
  };

  const handleMuteToggle = () => {
    const nextMute = !muted;
    setMuted(nextMute);
    setMuteState(nextMute);
  };

  // Move History / Scroll Management
  const moveHistoryList = mode === 'online' && room?.history 
    ? room.history 
    : game.history();

  const renderHistoryPairs = () => {
    const pairs: { round: number; white: string; black?: string }[] = [];
    for (let i = 0; i < moveHistoryList.length; i += 2) {
      pairs.push({
        round: Math.floor(i / 2) + 1,
        white: moveHistoryList[i],
        black: moveHistoryList[i + 1]
      });
    }
    return pairs;
  };
  const historyPairs = renderHistoryPairs();

  const logEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll list to view latest move
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [moveHistoryList.length]);

  // Handle move trigger
  const handleMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
    try {
      // Attempt the move on the active chess instance
      const moveResult = game.move({
        from: from as any,
        to: to as any,
        promotion: promotion || 'q', // default to Queen if promotion occurs
      });

      if (moveResult) {
        // Clone the game to trigger a high-fidelity state refresh
        const freshGame = new Chess(game.fen());
        setGame(freshGame);
        const freshMoveCount = moveCount + 1;
        setMoveCount(freshMoveCount);

        // Calculate and play move sounds locally for and immediate feedback
        if (freshGame.isCheckmate() || freshGame.isStalemate() || freshGame.isDraw()) {
          playChessSound('gameover');
        } else if (freshGame.inCheck()) {
          playChessSound('check');
        } else if (moveResult.captured) {
          playChessSound('capture');
        } else if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
          playChessSound('castle');
        } else {
          playChessSound('move');
        }

        // If online mode, sync it immediately to Firestore!
        if (mode === 'online' && roomCode) {
          updateRoomBoard(roomCode, freshGame.fen(), freshMoveCount, from, to, promotion, freshGame.history());
        }
        return true;
      }
    } catch (error) {
      console.warn('Illegal or faulty move attempted:', error);
    }
    return false;
  };

  const handleResetGame = () => {
    if (mode === 'online' && roomCode) {
      // Reset the online match board in firestore for both connected clients and clear chat history
      updateRoomBoard(roomCode, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 0, '', '', 'q', []).then(() => {
        const roomRef = doc(db, 'rooms', roomCode);
        updateDoc(roomRef, { resignedColor: null, status: 'ready', messages: [] }).catch(err => console.warn(err));
      });
    } else {
      const freshGame = new Chess();
      setGame(freshGame);
      setMoveCount(0);
      setIsThinking(false);
      setLocalResignedColor(null);
      localStorage.removeItem('chess_local_game');
    }
  };

  const handleResign = async () => {
    let resigningColor: 'w' | 'b' = 'w';
    if (mode === 'computer') {
      resigningColor = humanColor;
    } else if (mode === 'online') {
      resigningColor = playerColor || 'w';
    } else {
      resigningColor = turn;
    }

    if (mode === 'online' && roomCode) {
      try {
        const roomRef = doc(db, 'rooms', roomCode);
        await updateDoc(roomRef, {
          resignedColor: resigningColor,
          status: 'gameover'
        });
      } catch (e) {
        console.warn('Resignation firestore update failed:', e);
      }
    } else {
      setLocalResignedColor(resigningColor);
      playChessSound('gameover');
    }
  };

  const handleStartReplay = () => {
    setReplayHistory(moveHistoryList);
    setReplayIndex(moveHistoryList.length); // point to end of game initially
    setIsPlayingReplay(false);
    setIsReplayMode(true);
  };

  const handleCloseReplay = () => {
    setIsPlayingReplay(false);
    setIsReplayMode(false);
    if (mode === 'online') {
      handleLeaveRoom();
    } else {
      handleResetGame();
    }
  };

  // Derive all rule metrics live from the chess.js engine instance
  const isCheck = game.inCheck();
  const isCheckmate = game.isCheckmate();
  const isStalemate = game.isStalemate();
  const isDraw = game.isDraw();
  const resignedColor = mode === 'online' && room ? room.resignedColor : localResignedColor;
  const gameOver = isCheckmate || isStalemate || isDraw || !!resignedColor;
  const turn = game.turn(); // 'w' or 'b'
  
  const captured = getCapturedPieces(game);
  const { whiteAdvantage, blackAdvantage } = getMaterialAdvantage(game);

  // User Authentication Listeners
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          setUserProfile(profile);
          if (profile.themePreference === 'light' || profile.themePreference === 'dark') {
            setThemeMode(profile.themePreference);
          }
        } else {
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            createdAt: Date.now(),
            statsPlaceholder: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0 }
          };
          setUserProfile(fallbackProfile);
        }
      } else {
        setUserProfile(null);
      }
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  // Autosave current local match layout state to client localStorage on position changes
  useEffect(() => {
    if (mode !== 'online') {
      const stateToSave = {
        fen: game.fen(),
        mode,
        computerColor,
        humanColor,
        difficulty
      };
      localStorage.setItem('chess_local_game', JSON.stringify(stateToSave));
    }
  }, [game, mode, computerColor, humanColor, difficulty]);

  // 1. URL Syncing & Auto-Join on Mount / Auth state
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const roomParam = searchParams.get('room');
    if (roomParam && authInitialized) {
      const upperRoom = roomParam.trim().toUpperCase();
      setMode('online');
      setInputRoomCode(upperRoom);
      
      // Auto-join online room (requires logged-in user)
      if (upperRoom.length === 6 && !roomCode && user && userProfile) {
        const activePlayerId = user.uid;
        const activePlayerName = userProfile.username;

        const autoJoin = async () => {
          const joinedRoom = await joinOnlineRoom(upperRoom, activePlayerId, activePlayerName);
          if (joinedRoom) {
            setRoomCode(upperRoom);
            setRoom(joinedRoom);
            const color = joinedRoom.whitePlayerId === activePlayerId ? 'w' : 'b';
            setPlayerColor(color);
            setGame(new Chess(joinedRoom.fen));
            setMoveCount(joinedRoom.moveCount);
          } else {
            setOnlineJoinError('Auto-join failed: Room is full or does not exist.');
          }
        };
        autoJoin();
      }
    }
  }, [playerId, user, userProfile, roomCode, authInitialized]);

  // 2. Real-time Firebase Firestore database listener for the active online room
  useEffect(() => {
    const activePlayerId = user?.uid || playerId;
    if (mode === 'online' && roomCode) {
      const roomRef = doc(db, 'rooms', roomCode);
      const unsubscribe = onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const currentRoom = snapshot.data() as OnlineRoom;
          setRoom(currentRoom);

          // Resolve side color if the user belongs to either slot
          if (currentRoom.whitePlayerId === activePlayerId) {
            setPlayerColor('w');
          } else if (currentRoom.blackPlayerId === activePlayerId) {
            setPlayerColor('b');
          }

          // Sync FEN changes to the chess engine using reactive state check
          setGame((prevGame) => {
            if (currentRoom.fen !== prevGame.fen()) {
              // Analyze physical change using the previous game state to play opponent move sound
              if (currentRoom.lastMove) {
                const lastMoveColor = currentRoom.moveCount % 2 === 1 ? 'w' : 'b';
                // ONLY play check/capture sound for the opponent's moves to avoid double playing on execution!
                const isMyMove = lastMoveColor === (currentRoom.whitePlayerId === activePlayerId ? 'w' : 'b');
                if (!isMyMove) {
                  const { from, to, promotion } = currentRoom.lastMove;
                  try {
                    const prevGameCopy = new Chess(prevGame.fen());
                    const moveRes = prevGameCopy.move({ from, to, promotion: promotion || 'q' });
                    if (moveRes) {
                      const freshGame = new Chess(currentRoom.fen);
                      if (freshGame.isCheckmate() || freshGame.isStalemate() || freshGame.isDraw()) {
                        playChessSound('gameover');
                      } else if (freshGame.inCheck()) {
                        playChessSound('check');
                      } else if (moveRes.captured) {
                        playChessSound('capture');
                      } else if (moveRes.flags.includes('k') || moveRes.flags.includes('q')) {
                        playChessSound('castle');
                      } else {
                        playChessSound('move');
                      }
                    }
                  } catch (e) {
                    // Fallback
                    const freshGame = new Chess(currentRoom.fen);
                    if (freshGame.isCheckmate() || freshGame.isStalemate() || freshGame.isDraw()) {
                      playChessSound('gameover');
                    } else if (freshGame.inCheck()) {
                      playChessSound('check');
                    } else {
                      playChessSound('move');
                    }
                  }
                }
              }
              return new Chess(currentRoom.fen);
            }
            return prevGame;
          });
          setMoveCount(currentRoom.moveCount);
        }
      });
      return () => unsubscribe();
    }
  }, [mode, roomCode, playerId, user]);

  // 3. Send heartbeats for offline tracking in online play
  useEffect(() => {
    if (mode === 'online' && roomCode && playerColor) {
      // Immediate ping on mount/setup
      sendHeartbeat(roomCode, playerColor);
      
      const pingInterval = setInterval(() => {
        sendHeartbeat(roomCode, playerColor);
      }, 3000);
      return () => clearInterval(pingInterval);
    }
  }, [mode, roomCode, playerColor]);

  // 4. Opponent disconnection tracker
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
  useEffect(() => {
    if (mode === 'online' && room && playerColor) {
      const checkInterval = setInterval(() => {
        const playerIsWhite = playerColor === 'w';
        const opponentId = playerIsWhite ? room.blackPlayerId : room.whitePlayerId;
        const opponentLastActive = playerIsWhite ? room.blackLastActive : room.whiteLastActive;

        if (opponentId && opponentLastActive > 0) {
          const delay = Date.now() - opponentLastActive;
          if (delay > 8000) {
            // Heartbeat latency > 8 seconds represents offline/closed connection
            setIsOpponentDisconnected(true);
          } else {
            setIsOpponentDisconnected(false);
          }
        } else {
          setIsOpponentDisconnected(false);
        }
      }, 1000);
      return () => clearInterval(checkInterval);
    } else {
      setIsOpponentDisconnected(false);
    }
  }, [mode, room, playerColor]);

  // 5. Single Player VS Computer automation logic
  useEffect(() => {
    if (mode === 'computer' && turn === computerColor && !gameOver && !thinkingRef.current) {
      thinkingRef.current = true;
      setIsThinking(true);
      
      const latency = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 300 : difficulty === 'hard' ? 400 : 450;
      
      const timer = setTimeout(() => {
        const move = getComputerMove(game, difficulty);
        if (move) {
          handleMove(move.from, move.to, move.promotion);
        }
        setIsThinking(false);
        thinkingRef.current = false;
      }, latency);

      return () => {
        clearTimeout(timer);
        thinkingRef.current = false;
      };
    }
  }, [game, mode, computerColor, gameOver, difficulty, turn]);

  // Online Action Handlers
  const handleCreateRoom = async () => {
    const activePlayerId = user?.uid || playerId;
    const activePlayerName = userProfile?.username || 'Player';
    try {
      const code = generateRoomCode();
      const assigned = preferredColor === 'random' 
        ? (Math.random() < 0.5 ? 'w' : 'b') 
        : preferredColor;
      
      const newRoom = await createOnlineRoom(code, activePlayerId, assigned, activePlayerName);
      setRoomCode(code);
      setRoom(newRoom);
      setPlayerColor(assigned);
      setOnlineJoinError('');
      
      // Update browser URL query string without reloading page
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e: any) {
      setOnlineJoinError('Error creating match. Please check network.');
    }
  };

  const handleJoinRoom = async () => {
    const activePlayerId = user?.uid || playerId;
    const activePlayerName = userProfile?.username || 'Player';
    const sanitizedCode = inputRoomCode.trim().toUpperCase();
    if (sanitizedCode.length !== 6) {
      setOnlineJoinError('Room code must be exactly 6 characters.');
      return;
    }
    try {
      const joinedRoom = await joinOnlineRoom(sanitizedCode, activePlayerId, activePlayerName);
      if (!joinedRoom) {
        setOnlineJoinError('Room is full or doesn\'t exist. Double check the code.');
      } else {
        setRoomCode(sanitizedCode);
        setRoom(joinedRoom);
        const color = joinedRoom.whitePlayerId === activePlayerId ? 'w' : 'b';
        setPlayerColor(color);
        setOnlineJoinError('');
        setGame(new Chess(joinedRoom.fen));
        setMoveCount(joinedRoom.moveCount);
        
        // Update URL
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${sanitizedCode}`;
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {
      setOnlineJoinError('Connection error. Check internet link.');
    }
  };

  const handleLeaveRoom = () => {
    // Teardown online matching states
    setRoomCode('');
    setRoom(null);
    setPlayerColor(null);
    setInputRoomCode('');
    setOnlineJoinError('');
    setMatchmakingStatus('idle'); // Safe reset
    // Reset FEN locally
    const freshGame = new Chess();
    setGame(freshGame);
    setMoveCount(0);
    // Remove query param from browser address bar
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Matchmaking Timer effect
  useEffect(() => {
    let interval: any;
    if (matchmakingStatus === 'searching') {
      interval = setInterval(() => {
        setMatchmakingTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleMatchmakingTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setMatchmakingTimeLeft(45);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [matchmakingStatus]);

  // Clean up if player exits page or component closes
  useEffect(() => {
    return () => {
      if (matchmakingUnsubscribeRef.current) {
        matchmakingUnsubscribeRef.current();
        matchmakingUnsubscribeRef.current = null;
      }
    };
  }, []);

  const handleCancelMatchmaking = async () => {
    if (matchmakingUnsubscribeRef.current) {
      matchmakingUnsubscribeRef.current();
      matchmakingUnsubscribeRef.current = null;
    }
    const myId = user?.uid;
    if (myId) {
      try {
        await deleteDoc(doc(db, 'matchmaking_queue', myId));
      } catch (err) {
        console.warn('Matchmaking cancel cleanup failed:', err);
      }
    }
    setMatchmakingStatus('idle');
    setMatchmakingError(null);
  };

  const handleMatchmakingTimeout = async () => {
    if (matchmakingUnsubscribeRef.current) {
      matchmakingUnsubscribeRef.current();
      matchmakingUnsubscribeRef.current = null;
    }
    const myId = user?.uid;
    if (myId) {
      try {
        await deleteDoc(doc(db, 'matchmaking_queue', myId));
      } catch (err) {
        console.warn('Matchmaking timeout cleanup failed:', err);
      }
    }
    setMatchmakingStatus('timeout');
    setMatchmakingError('No opponents found. Please try again or create a friend room code instead.');
  };

  const handleStartMatchmaking = async () => {
    if (!user || !userProfile) {
      setOnlineJoinError('You must be logged in to search for random opponents.');
      return;
    }

    const myId = user.uid;
    const myUsername = userProfile.username;

    setMatchmakingStatus('searching');
    setMatchmakingError(null);
    setMatchmakingTimeLeft(45);

    try {
      // 1. Look for a waiting challenger
      const q = query(
        collection(db, 'matchmaking_queue'),
        where('status', '==', 'waiting'),
        orderBy('createdAt', 'asc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      
      let candidateDoc: any = null;
      for (const d of snapshot.docs) {
        if (d.id !== myId) {
          candidateDoc = d;
          break;
        }
      }

      if (candidateDoc) {
        const candidateId = candidateDoc.id;
        const rCode = generateRoomCode();
        const isWhite = Math.random() < 0.5;
        const myColor = isWhite ? 'w' : 'b';
        const candidateColor = isWhite ? 'b' : 'w';

        try {
          await runTransaction(db, async (transaction) => {
            const candidateRef = doc(db, 'matchmaking_queue', candidateId);
            const freshSnap = await transaction.get(candidateRef);

            if (!freshSnap.exists() || freshSnap.data().status !== 'waiting') {
              throw new Error('already_matched');
            }

            // Update candidate as matched
            transaction.update(candidateRef, {
              status: 'matched',
              matchedWith: myId,
              matchedWithName: myUsername,
              roomId: rCode,
              assignedColor: candidateColor
            });

            // Write our own record
            const myRef = doc(db, 'matchmaking_queue', myId);
            transaction.set(myRef, {
              userId: myId,
              username: myUsername,
              status: 'matched',
              matchedWith: candidateId,
              matchedWithName: freshSnap.data().username,
              roomId: rCode,
              assignedColor: myColor,
              createdAt: Date.now()
            });

            // Set up match room
            const roomRef = doc(db, 'rooms', rCode);
            const roomData: OnlineRoom = {
              roomId: rCode,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whitePlayerId: myColor === 'w' ? myId : candidateId,
              blackPlayerId: myColor === 'b' ? myId : candidateId,
              whitePlayerName: myColor === 'w' ? myUsername : freshSnap.data().username,
              blackPlayerName: myColor === 'b' ? myUsername : freshSnap.data().username,
              whiteLastActive: Date.now(),
              blackLastActive: Date.now(),
              status: 'ready',
              moveCount: 0,
              lastMove: null,
              creatorId: myId,
              currentTurn: 'w',
              history: []
            };
            transaction.set(roomRef, roomData);
          });

          // Match created!
          setRoomCode(rCode);
          setPlayerColor(myColor);
          setGame(new Chess());
          setMoveCount(0);
          setMatchmakingStatus('matched');
          
          // Cleanup queue entry
          await deleteDoc(doc(db, 'matchmaking_queue', myId));

          // Set URL
          const newUrl = `${window.location.origin}${window.location.pathname}?room=${rCode}`;
          window.history.replaceState({}, '', newUrl);
          return;

        } catch (txErr) {
          console.log('Match conflict or transaction abort, going to waiting list:', txErr);
        }
      }

      // 2. Put ourselves in wait list
      const myRef = doc(db, 'matchmaking_queue', myId);
      await setDoc(myRef, {
        userId: myId,
        username: myUsername,
        status: 'waiting',
        createdAt: Date.now()
      });

      // 3. Listen to our matchmaking document for pairing
      const unsub = onSnapshot(myRef, async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'matched') {
            unsub();
            matchmakingUnsubscribeRef.current = null;

            const targetRoom = data.roomId;
            const assignedCol = data.assignedColor;

            setRoomCode(targetRoom);
            setPlayerColor(assignedCol);
            setGame(new Chess());
            setMoveCount(0);
            setMatchmakingStatus('matched');

            // Cleanup our matchmaking doc
            await deleteDoc(doc(db, 'matchmaking_queue', myId));

            // Set URL
            const newUrl = `${window.location.origin}${window.location.pathname}?room=${targetRoom}`;
            window.history.replaceState({}, '', newUrl);
          }
        }
      });

      matchmakingUnsubscribeRef.current = unsub;

    } catch (err: any) {
      console.error('Matchmaking initiation failed:', err);
      setMatchmakingStatus('idle');
      setMatchmakingError('Failed to start matchmaking search. Check network.');
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Derive turn status strings based on system context
  let turnStatusText = turn === 'w' ? "White's Turn" : "Black's Turn";
  if (isThinking) {
    turnStatusText = "Computer is thinking...";
  } else if (isCheck) {
    turnStatusText += " - IN CHECK";
  }
  if (isCheckmate) {
    turnStatusText = "CHECKMATE";
  } else if (isStalemate) {
    turnStatusText = "STALEMATE";
  } else if (isDraw) {
    turnStatusText = "DRAW MATCH";
  }

  // Determine relative display labels for Sidebars
  const activePlayerId = user?.uid || playerId;
  const whiteHeaderText = mode === 'computer'
    ? (computerColor === 'w' ? `Computer (${difficulty})` : `${userProfile?.username || 'You'} (White)`)
    : mode === 'online' && room
      ? (room.whitePlayerId === activePlayerId 
          ? `${userProfile?.username || 'You'} (White)` 
          : `${room.whitePlayerName || 'Opponent'} (White)`)
      : (userProfile?.username ? `${userProfile.username} (White)` : 'White Player');

  const blackHeaderText = mode === 'computer'
    ? (computerColor === 'b' ? `Computer (${difficulty})` : `${userProfile?.username || 'You'} (Black)`)
    : mode === 'online' && room
      ? (room.blackPlayerId === activePlayerId 
          ? `${userProfile?.username || 'You'} (Black)` 
          : `${room.blackPlayerName || 'Opponent'} (Black)`)
      : 'Black Player';

  // Online conditions
  const isOnlineWaiting = mode === 'online' && room && (room.whitePlayerId === null || room.blackPlayerId === null);
  const isMyTurnOnline = mode === 'online' && room && !isOnlineWaiting && turn === playerColor;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 font-sans flex flex-col justify-between py-6 px-4 md:px-8 transition-colors duration-200">
      
      {/* Page Header and Mode Tabs */}
      <header className="max-w-5xl mx-auto w-full mb-6">
        {/* Connection status warning bar */}
        {!isOnline && (
          <div className="mb-4 flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/25 text-rose-500 dark:text-rose-400 py-2.5 px-4 rounded-xl text-xs font-mono select-none animate-pulse">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>YOU'RE OFFLINE - Real-time matchmaking, chat, and online lobbies are disabled.</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800 pb-5">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-light tracking-tighter text-slate-850 dark:text-slate-50 sm:text-3xl">
              MINIMAL CHESS
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 uppercase font-mono tracking-widest">
              Classical rule engine
            </p>
          </div>

          {/* Mode Tabs AND Profile Account Menu */}
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            <div className="flex flex-wrap justify-center items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-s-slate-800 dark:border-slate-800">
              <button
                onClick={() => {
                  if (mode === 'online' && room) handleLeaveRoom();
                  setMode('local');
                  handleResetGame();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'local'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Local 2P</span>
              </button>
              <button
                onClick={() => {
                  if (mode === 'online' && room) handleLeaveRoom();
                  setMode('computer');
                  handleResetGame();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'computer'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Vs Computer</span>
              </button>
              <button
                onClick={() => {
                  if (!isOnline) return;
                  setMode('online');
                  setOnlineJoinError('');
                }}
                disabled={!isOnline}
                title={!isOnline ? "Unavailable offline" : "Play Online"}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-md transition-all ${
                  !isOnline ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  mode === 'online'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Online Lobby</span>
              </button>
              <button
                onClick={() => {
                  if (mode === 'online' && room) handleLeaveRoom();
                  setMode('learn');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'learn'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Learn</span>
              </button>
            </div>

            {/* THEME TOGGLE BUTTON */}
            <button
              onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
              title={`Switch to ${themeMode === 'light' ? 'Dark' : 'Light'} Mode`}
              className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-800 bg-white dark:bg-[#151f32] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-all cursor-pointer shadow-3xs"
            >
              {themeMode === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* PROFILE / ACCOUNT CONTROLS */}
            <div className="relative">
              {user ? (
                <>
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white rounded-lg transition-all cursor-pointer font-sans select-none text-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-slate-800 text-white font-mono flex items-center justify-center font-bold text-[10px] uppercase col-span-1 shrink-0">
                      {userProfile?.username?.substring(0, 2) || user.email?.substring(0, 2) || 'Pl'}
                    </div>
                    <span className="font-semibold text-slate-700 hidden sm:inline">{userProfile?.username || user.displayName || 'Player'}</span>
                    <span className="text-slate-400 text-[10px]">▼</span>
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-40 animate-fade-in font-sans text-slate-800">
                      <div className="pb-3 border-b border-slate-100 mb-3 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-mono flex items-center justify-center font-bold text-sm uppercase shrink-0">
                          {userProfile?.username?.substring(0, 2) || user.email?.substring(0, 2) || 'Pl'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-slate-800 truncate">{userProfile?.username || 'Player'}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* STATS PLACEHOLDER */}
                      <div className="space-y-2 mb-4 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                        <p className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400 block mb-1">Career Record</p>
                        <div className="grid grid-cols-2 gap-2 text-center font-mono">
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-slate-400 text-[8px] uppercase block">Played</span>
                            <span className="text-xs font-bold text-slate-700">{userProfile?.statsPlaceholder?.gamesPlayed ?? 0}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-emerald-500 text-[8px] uppercase block">Won</span>
                            <span className="text-xs font-bold text-emerald-600">{userProfile?.statsPlaceholder?.gamesWon ?? 0}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-rose-400 text-[8px] uppercase block">Lost</span>
                            <span className="text-xs font-bold text-rose-500">{userProfile?.statsPlaceholder?.gamesLost ?? 0}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="text-slate-400 text-[8px] uppercase block">Drawn</span>
                            <span className="text-xs font-bold text-slate-600">{userProfile?.statsPlaceholder?.gamesDrawn ?? 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={async () => {
                            await signOut(auth);
                            setShowProfileMenu(false);
                          }}
                          className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 border border-rose-100 font-mono text-[10px] uppercase font-bold tracking-widest rounded-md transition-all cursor-pointer text-center font-bold"
                        >
                          Log Out
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg hover:bg-slate-700 active:scale-98 transition-all cursor-pointer shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div 
        id="game-container" 
        className="max-w-5xl w-full mx-auto flex flex-col items-center justify-center flex-grow"
      >
        
        {mode === 'learn' ? (
          <LearnToPlay onBack={() => setMode('local')} activeTheme={activeTheme} />
        ) : mode === 'online' && !user ? (
          <div 
            id="online-lobby-auth-required"
            className="w-full max-w-[480px] bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col items-center text-center gap-6 animate-fade-in my-4"
          >
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
              <Key className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">Active Session Required</h2>
              <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                To play real-time online matches, sync boards, and display custom usernames, please log in or create an account.
              </p>
              <p className="text-[10px] text-slate-400 mt-2 bg-slate-50 border border-slate-100 p-2.5 rounded-lg font-mono leading-normal select-none">
                💡 Guests are always free to play <strong>Local 2P</strong> or <strong>Vs Computer</strong>!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-705 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg active:scale-98 transition-all cursor-pointer shadow-xs"
              >
                Sign In / Sign Up
              </button>
              <button
                onClick={() => setMode('local')}
                className="flex-1 py-1 px-1.5 bg-white text-slate-700 border border-slate-200 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg hover:bg-slate-50 active:scale-98 transition-all cursor-pointer text-center flex items-center justify-center"
              >
                Play Offline 2P
              </button>
            </div>
          </div>
        ) : mode === 'online' && !room ? (
          <div 
            id="online-lobby-panel"
            className="w-full max-w-[540px] bg-white rounded-xl border border-slate-250 p-6 md:p-8 shadow-sm flex flex-col gap-8 animate-fade-in my-4"
          >
            {matchmakingStatus === 'searching' ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-6">
                {/* Searching radar animation */}
                <div className="relative flex items-center justify-center w-20 h-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-20"></span>
                  <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-indigo-500 opacity-30 [animation-delay:0.3s]"></span>
                  <div className="relative rounded-full p-4 bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                    <Globe className="w-8 h-8 animate-spin [animation-duration:8s]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight text-slate-805 uppercase font-mono">Searching...</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Scanning the matchmaking pool for online players. We'll pair you immediately!
                  </p>
                </div>

                <div className="font-mono text-xs font-bold text-slate-500 bg-slate-55 border border-slate-200 px-4 py-2 rounded-lg">
                  Searching for {45 - matchmakingTimeLeft}s • Timeout in {matchmakingTimeLeft}s
                </div>

                <button
                  onClick={handleCancelMatchmaking}
                  className="px-6 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg transition-colors cursor-pointer border border-rose-200"
                >
                  Cancel Search
                </button>
              </div>
            ) : matchmakingStatus === 'timeout' ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-6 animate-fade-in">
                <div className="p-4 bg-rose-50 border border-rose-105 text-rose-600 rounded-full">
                  <Users className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight text-slate-805 uppercase font-mono">No Opponent Found</h3>
                  <p className="text-xs text-rose-650 leading-relaxed max-w-xs mx-auto">
                    {matchmakingError || "Please try again or create a friend room code instead."}
                  </p>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setMatchmakingStatus('idle')}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg transition-colors cursor-pointer"
                  >
                    Back To Lobby
                  </button>
                  <button
                    onClick={handleStartMatchmaking}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center border-b border-slate-100 pb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full mb-2">
                    <Globe className="w-3 h-3 animate-pulse" /> Live Multiplayer
                  </span>
                  <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Play Chess Online</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Join matchmaking list to find someone instantly, or play private matches with friends.
                  </p>
                </div>

                {/* Matchmaking option */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400">1. Instant Pool Play</h3>
                  <div className="p-4 bg-indigo-50/40 rounded-lg border border-indigo-100 flex flex-col gap-3">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Enter the global matching queue. You'll be paired randomly as White or Black with another waiting player.
                    </p>
                    <button
                      onClick={handleStartMatchmaking}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs uppercase tracking-widest font-bold transition-all rounded shadow-sm hover:shadow-indigo-100 cursor-pointer active:scale-98 transition-transform flex items-center justify-center gap-2"
                    >
                      <Globe className="w-4 h-4" /> Find Random Opponent
                    </button>
                  </div>
                </div>

                {/* Separator */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-205"></div>
                  </div>
                  <span className="relative bg-white px-3 text-[10px] text-slate-400 uppercase tracking-widest font-bold">OR PRIVATE CHEST</span>
                </div>

                {/* Part A: CREATE MATCH */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400">2. Create a Private Match</h3>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500">Pick My Side</span>
                      <div className="flex items-center gap-2">
                        {(['w', 'random', 'b'] as const).map((color) => {
                          const label = color === 'w' ? 'White' : color === 'b' ? 'Black' : 'Random 🎲';
                          return (
                            <button
                              key={color}
                              onClick={() => setPreferredColor(color)}
                              className={`flex-1 py-1.5 text-xs rounded border transition-all font-semibold capitalize cursor-pointer ${
                                preferredColor === color
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-650 border-slate-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleCreateRoom}
                      className="w-full py-2.5 bg-[#4f46e5] text-white text-xs uppercase tracking-widest font-bold hover:bg-[#4338ca] transition-colors rounded shadow-xs cursor-pointer active:scale-98 transition-transform"
                    >
                      Create Match Code
                    </button>
                  </div>
                </div>

                {/* Part B: JOIN MATCH */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400">3. Join Private Match</h3>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500">Enter Room Code</span>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="E.G. AZ8R9M"
                        value={inputRoomCode}
                        onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                        className="w-full px-4 py-2 border border-slate-200 bg-white rounded-md text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-slate-400 text-center text-slate-800"
                      />
                    </div>

                    <button
                      onClick={handleJoinRoom}
                      className="w-full py-2.5 bg-slate-800 text-white text-xs uppercase tracking-widest font-bold hover:bg-slate-700 transition-colors rounded shadow-xs cursor-pointer active:scale-98 transition-transform"
                    >
                      Join Match Room
                    </button>
                  </div>
                </div>

                {/* Show any Errors */}
                {onlineJoinError && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-center font-mono font-medium animate-pulse">
                    ⚠️ {onlineJoinError}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          /* Main active board panel for gameplay (Local / CPU / Connected Online match) */
          <>
            {isReplayMode ? (
              <div 
                id="replay-panel-container"
                className="w-full flex flex-col items-center animate-fade-in"
              >
                {/* Replay Header */}
                <div className="w-full max-w-[768px] flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-amber-50 rounded-lg text-amber-500">
                      <Play className="w-5 h-5 fill-current" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Game Replay</h2>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {replayIndex === 0 ? "Starting Position" : `Move ${replayIndex} of ${replayHistory.length}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCloseReplay}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-705 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Close Replay</span>
                  </button>
                </div>

                {/* Dashboard layout containing Replay Board AND adjacent Move history */}
                <div className="w-full max-w-[512px] md:max-w-[768px] flex flex-col md:flex-row justify-center items-stretch gap-6">
                  
                  {/* Left Column: Board and Controls */}
                  <div className="flex-1 flex flex-col gap-4">
                    {/* Chessboard */}
                    <div className="flex justify-center">
                      <Chessboard 
                        game={getReplayBoardAt(replayHistory, replayIndex)}
                        flipped={playerColor === 'b'}
                        disabled={true}
                        activeTheme={activeTheme}
                        highlightSquares={replayIndex > 0 ? (() => {
                          const verboseList = getReplayVerboseHistory(replayHistory);
                          const lastItem = verboseList[replayIndex - 1];
                          return lastItem ? [lastItem.from, lastItem.to] : [];
                        })() : []}
                      />
                    </div>

                    {/* Controller Panel Bar */}
                    <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-3xs flex flex-col gap-3">
                      {/* Scrubbing Slider Control */}
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-mono font-bold text-slate-400">0</span>
                        <input 
                          type="range" 
                          min="0" 
                          max={replayHistory.length} 
                          value={replayIndex} 
                          onChange={(e) => { 
                            setIsPlayingReplay(false); 
                            setReplayIndex(Number(e.target.value)); 
                          }} 
                          className="flex-grow h-1.5 bg-slate-105 rounded-lg appearance-none cursor-pointer accent-slate-800"
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400">{replayHistory.length}</span>
                      </div>

                      {/* Control Buttons */}
                      <div className="flex items-center justify-between">
                        {/* Player / Side Indicator */}
                        <div className="text-[10px] font-mono font-bold text-slate-400">
                          {replayIndex === 0 ? (
                            "White to move"
                          ) : (
                            <span>Last played: <span className="text-slate-800 font-semibold">{replayHistory[replayIndex - 1]}</span></span>
                          )}
                        </div>

                        {/* Interactive Play/Pause Step Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setIsPlayingReplay(false);
                              setReplayIndex(prev => Math.max(0, prev - 1));
                            }}
                            disabled={replayIndex === 0}
                            className="p-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded cursor-pointer transition-colors"
                            title="Previous Move"
                          >
                            <SkipBack className="w-4 h-4 text-slate-600" />
                          </button>

                          <button
                            onClick={() => {
                              if (replayIndex === replayHistory.length) {
                                setReplayIndex(0);
                                setIsPlayingReplay(true);
                              } else {
                                setIsPlayingReplay(!isPlayingReplay);
                              }
                            }}
                            className="p-2 border border-slate-200 hover:bg-slate-50 rounded cursor-pointer transition-colors bg-slate-50/50"
                            title={isPlayingReplay ? "Pause" : "Play"}
                          >
                            {isPlayingReplay ? (
                              <Pause className="w-4 h-4 text-slate-800" />
                            ) : (
                              <Play className="w-4 h-4 text-slate-800 fill-slate-800" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setIsPlayingReplay(false);
                              setReplayIndex(prev => Math.min(replayHistory.length, prev + 1));
                            }}
                            disabled={replayIndex === replayHistory.length}
                            className="p-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded cursor-pointer transition-colors"
                            title="Next Move"
                          >
                            <SkipForward className="w-4 h-4 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Move log history showcasing current step indicator */}
                  <div 
                    className="w-full md:w-[220px] flex flex-col bg-white rounded-lg border border-slate-200/80 shadow-3xs p-3 select-none shrink-0 min-h-[260px] max-h-[512px] transition-all"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Replay moves</span>
                      <span className="text-[10px] font-mono text-slate-405 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        {replayIndex} / {replayHistory.length}
                      </span>
                    </div>

                    <div className="flex-grow overflow-y-auto scrollbar-thin text-xs pr-1 flex flex-col gap-1 max-h-[350px] md:max-h-[420px]">
                      {replayHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center my-auto py-12 text-slate-300">
                          <Clock className="w-6 h-6 stroke-[1.5] mb-2" />
                          <span className="text-[10px] uppercase tracking-wider font-semibold font-mono">No Moves</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">Start playing moves</span>
                        </div>
                      ) : (
                        (() => {
                          const pairs: { round: number; whiteIndex: number; white: string; blackIndex?: number; black?: string }[] = [];
                          for (let i = 0; i < replayHistory.length; i += 2) {
                            pairs.push({
                              round: Math.floor(i / 2) + 1,
                              whiteIndex: i + 1,
                              white: replayHistory[i],
                              blackIndex: replayHistory[i + 1] ? i + 2 : undefined,
                              black: replayHistory[i + 1]
                            });
                          }

                          return pairs.map((pair) => {
                            const isWhiteActive = replayIndex === pair.whiteIndex;
                            const isBlackActive = pair.blackIndex !== undefined && replayIndex === pair.blackIndex;

                            return (
                              <div 
                                key={pair.round} 
                                className="grid grid-cols-[30px_1fr_1fr] gap-1 py-1 px-1 hover:bg-slate-50 rounded transition-colors text-center font-mono"
                              >
                                <span className="text-slate-400 font-semibold text-right pr-2">{pair.round}.</span>
                                <button
                                  onClick={() => {
                                    setIsPlayingReplay(false);
                                    setReplayIndex(pair.whiteIndex);
                                  }}
                                  className={`text-left pl-1.5 py-0.5 rounded transition-all cursor-pointer text-[11px] ${
                                    isWhiteActive 
                                      ? 'bg-amber-100 text-amber-800 font-bold border-l-2 border-amber-500' 
                                      : 'text-slate-750 font-medium hover:bg-slate-100'
                                  }`}
                                >
                                  {pair.white}
                                </button>
                                {pair.black ? (
                                  <button
                                    onClick={() => {
                                      setIsPlayingReplay(false);
                                      setReplayIndex(pair.blackIndex!);
                                    }}
                                    className={`text-left pl-1.5 py-0.5 rounded transition-all cursor-pointer text-[11px] ${
                                      isBlackActive 
                                        ? 'bg-amber-100 text-amber-800 font-bold border-l-2 border-amber-500' 
                                        : 'text-slate-750 font-medium hover:bg-slate-100'
                                    }`}
                                  >
                                    {pair.black}
                                  </button>
                                ) : (
                                  <span />
                                )}
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 text-[9px] uppercase tracking-wider font-bold text-slate-400 text-center font-mono">
                      ⭐ Click any move to inspect that step
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Top Computer Settings bar */}
            {mode === 'computer' && (
              <div 
                id="cpu-settings" 
                className="mb-6 w-full max-w-[512px] md:max-w-[768px] p-4 bg-white rounded-lg border border-slate-200/85 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in"
              >
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Your Side</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setHumanColor('w');
                        setComputerColor('b');
                        handleResetGame();
                      }}
                      className={`px-3 py-1 text-xs rounded transition-all border font-medium cursor-pointer ${
                        humanColor === 'w' 
                          ? 'bg-slate-850 text-white border-slate-850' 
                          : 'bg-[#f8fafc] hover:bg-slate-105 text-slate-650 border-slate-200'
                      }`}
                    >
                      White (human)
                    </button>
                    <button 
                      onClick={() => {
                        setHumanColor('b');
                        setComputerColor('w');
                        handleResetGame();
                      }}
                      className={`px-3 py-1 text-xs rounded transition-all border font-medium cursor-pointer ${
                        humanColor === 'b' 
                          ? 'bg-slate-850 text-white border-slate-850' 
                          : 'bg-[#f8fafc] hover:bg-slate-105 text-slate-650 border-slate-200'
                      }`}
                    >
                      Black (human)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 items-start sm:items-end w-full sm:w-auto">
                  <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-400">Engine Difficulty</span>
                  <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end">
                    {(['easy', 'medium', 'hard', 'expert'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded transition-all border font-bold cursor-pointer ${
                          difficulty === level
                            ? 'bg-slate-850 text-white border-slate-850'
                            : 'bg-[#f8fafc] hover:bg-slate-105 text-slate-500 border-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top Online Room Sync Settings panel */}
            {mode === 'online' && room && (
              <div 
                id="online-game-settings"
                className="mb-6 w-full max-w-[512px] md:max-w-[768px] bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col gap-3 animate-fade-in"
              >
                {/* Lobby Details header info */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Connected Room:</span>
                    <span className="text-sm font-extrabold font-mono text-slate-800 tracking-widest">{roomCode}</span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => copyToClipboard(roomCode, 'code')}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] uppercase font-bold tracking-wider rounded flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Code'}</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?room=${roomCode}`, 'link')}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] uppercase font-bold tracking-wider rounded flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied Invite Link' : 'Invite Link'}</span>
                    </button>
                  </div>
                </div>

                {/* Multiplayer Roles and Active Connection indicators */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">My Assignment:</span>
                    {playerColor === 'w' ? (
                      <span className="text-[10px] font-bold bg-white text-slate-800 border-2 border-slate-800 px-2.5 py-0.5 rounded uppercase">
                        White Player
                      </span>
                    ) : playerColor === 'b' ? (
                      <span className="text-[10px] font-bold bg-slate-850 text-white px-2.5 py-0.5 rounded uppercase">
                        Black Player
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-555 px-2 py-0.5 rounded">
                        Spectator Mode
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleLeaveRoom}
                    className="text-slate-400 hover:text-rose-600 transition-colors text-[9px] uppercase tracking-wider font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Exit Match</span>
                  </button>
                </div>
              </div>
            )}

            {/* Play area grid */}
            <div className="flex flex-col lg:flex-row w-full justify-between items-stretch gap-8 lg:gap-14">
              
              {/* Left Sidebar: White Player Status */}
              <div className="w-full lg:w-[200px] flex flex-col justify-between p-4 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                <div>
                  <h2 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>{whiteHeaderText}</span>
                    {mode === 'online' && room && (
                      <span className={`w-2 h-2 rounded-full ${
                        room.whitePlayerId 
                          ? (isOpponentDisconnected && playerColor === 'b' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500') 
                          : 'bg-slate-300'
                      }`} />
                    )}
                  </h2>
                  
                  <p className="text-[9px] uppercase font-mono tracking-wider text-slate-400 mb-1.5">
                    Black's Captures
                  </p>
                  <div 
                    id="white-captured" 
                    className="flex flex-wrap gap-1 min-h-[60px] p-2 bg-[#f8fafc] rounded border border-slate-200"
                  >
                    {captured.w.length === 0 ? (
                      <span className="text-xs text-slate-400 italic m-auto">No captures</span>
                    ) : (
                      captured.w.map((type, idx) => (
                        <div key={idx} className="w-6 h-6 hover:scale-110 active:scale-95 transition-transform animate-scale-in" title={getPieceName(type)}>
                          <ChessPieceSvg type={type} color="w" />
                        </div>
                      ))
                    )}
                  </div>

                  {whiteAdvantage > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded animate-bounce-short">
                        +{whiteAdvantage} pts
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  {turn === 'w' && !gameOver ? (
                    <div id="white-turn-indicator" className="p-3.5 rounded-lg border-2 border-slate-800 bg-white shadow-sm flex flex-col items-center justify-center text-center animate-pulse">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-800">
                        {isThinking ? "Thinking" : (mode === 'online' && playerColor === 'w' ? "Your Turn" : "White's Turn")}
                      </span>
                      <p className="text-[9px] text-slate-400 mt-0.5">{isThinking ? "Processing..." : "Active"}</p>
                    </div>
                  ) : (
                    <div id="white-turn-indicator" className="p-3.5 rounded-lg border-2 border-transparent opacity-30 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Waiting</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Board Center Section */}
              <div className="flex-1 flex flex-col items-center justify-center">
                
                {/* Theme Selector & Sounds Settings Bar */}
                <div id="settings-controls-bar" className="w-full max-w-[512px] md:max-w-[768px] mb-5 p-2 bg-white border border-slate-200/80 rounded-lg shadow-3xs flex flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 px-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] shrink-0">Theme:</span>
                    <div className="flex gap-1">
                      {CHESS_THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleChooseTheme(t)}
                          className={`px-2 py-1 rounded text-[10px] font-bold tracking-tight transition-all border cursor-pointer flex items-center gap-1 shrink-0 ${
                            activeTheme.id === t.id
                              ? 'bg-slate-850 text-white border-slate-850 shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span className="inline-flex gap-0.5 w-2.5 h-2.5 rounded-full overflow-hidden border border-slate-300">
                            <span className="w-1.25 h-full" style={{ backgroundColor: t.lightSquare }} />
                            <span className="w-1.25 h-full" style={{ backgroundColor: t.darkSquare }} />
                          </span>
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleMuteToggle}
                    className={`px-2.5 py-1 rounded border flex items-center gap-1 font-bold cursor-pointer transition-colors shrink-0 mr-1 ${
                      muted 
                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {muted ? <VolumeX className="w-3.5 h-3.5 font-bold" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span className="text-[9px] uppercase tracking-wider hidden sm:inline">{muted ? 'Muted' : 'Sounds'}</span>
                  </button>
                </div>

                {/* Status indicators */}
                <div className="mb-4 text-center flex flex-col items-center gap-2">
                  <p 
                    id="game-status" 
                    className={`text-xs text-slate-500 font-mono uppercase tracking-widest transition-colors ${
                      isCheckmate ? 'text-red-500 font-extrabold' : isCheck ? 'text-rose-500 font-extrabold animate-pulse' : ''
                    }`}
                  >
                    {turnStatusText}
                  </p>

                  {!gameOver && moveHistoryList.length > 0 && (
                    <button
                      onClick={handleResign}
                      className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded transition-all cursor-pointer shadow-3xs"
                    >
                      🏳️ Resign Match
                    </button>
                  )}
                </div>

                {/* Custom Online Waiting banner overlay */}
                {isOnlineWaiting && (
                  <div className="mb-4 w-full max-w-[512px] p-4 rounded bg-indigo-50 border border-indigo-200 text-center animate-fade-in flex flex-col items-center gap-1">
                    <span className="text-xs tracking-wider uppercase font-bold font-mono text-indigo-700 animate-pulse flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Waiting for Opponent...
                    </span>
                    <p className="text-[11px] text-indigo-650">
                      Copy the room link or code above and share it with your friend to connect instantly.
                    </p>
                  </div>
                )}

                {/* Opponent Disconnection banner overlay */}
                {mode === 'online' && !isOnlineWaiting && isOpponentDisconnected && (
                  <div className="mb-4 w-full max-w-[512px] p-3.5 rounded bg-rose-50 border border-rose-200 text-center animate-pulse flex flex-col items-center gap-1">
                    <span className="text-xs tracking-wider uppercase font-extrabold font-mono text-rose-700 flex items-center gap-1.5">
                      ⚠️ Connection Lost
                    </span>
                    <p className="text-[11px] text-rose-650 font-medium">
                      Your opponent disconnected. Waiting for them to rejoin...
                    </p>
                  </div>
                )}

                {/* Custom Interactive Alert Banner (Checkmate / Stalemate popup strip) */}
                {gameOver && (
                  <div 
                    id="game-over-banner"
                    className="mb-4 w-full max-w-[512px] p-4 rounded bg-slate-800 text-white text-center shadow-md animate-fade-in flex flex-col items-center gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span className="text-xs tracking-wider uppercase font-bold font-mono">
                        {isCheckmate ? "Checkmate - Game Over" : 
                         isStalemate ? "Stalemate - Draw" : 
                         isDraw ? "Draw Match" : 
                         resignedColor ? "Forfeit by Resignation" : "Game Over"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {isCheckmate 
                        ? `${turn === 'w' ? 'Black' : 'White'} wins the game.` 
                        : resignedColor 
                          ? `${resignedColor === 'w' ? 'Black' : 'White'} wins by resignation.`
                          : "No legal moves remaining; the match results in a draw."}
                    </p>
                    <button
                      onClick={handleStartReplay}
                      className="mt-1 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-md active:scale-95 transition-all cursor-pointer shadow-3xs"
                    >
                      🎬 Watch Replay
                    </button>
                  </div>
                )}

                {/* Grid layout containing Board AND Move Log adjacent to it */}
                <div className={`w-full max-w-[512px] ${mode === 'online' ? 'md:max-w-[1024px]' : 'md:max-w-[768px]'} flex flex-col md:flex-row justify-center items-stretch gap-6`}>
                  
                  {/* Chessboard View Panel */}
                  <div className="flex-1 flex justify-center">
                    <Chessboard 
                      game={game} 
                      onMove={handleMove}
                      flipped={mode === 'online' && playerColor === 'b'}
                      disabled={
                        gameOver || 
                        isThinking || 
                        (mode === 'computer' && turn === computerColor) ||
                        (mode === 'online' && (isOnlineWaiting || turn !== playerColor))
                      } 
                      activeTheme={activeTheme}
                      highlightSquares={game.history().length > 0 ? (() => {
                        const h = game.history({ verbose: true }) as any[];
                        const last = h[h.length - 1];
                        return last ? [last.from, last.to] : [];
                      })() : []}
                    />
                  </div>

                  {/* Move History Log Panel */}
                  <div 
                    id="move-history-log"
                    className="w-full md:w-[200px] flex flex-col bg-white rounded-lg border border-slate-200/80 shadow-3xs p-3 select-none shrink-0 min-h-[260px] max-h-[512px] transition-all"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Move Log</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        {moveHistoryList.length} total
                      </span>
                    </div>

                    <div className="flex-grow overflow-y-auto scrollbar-thin text-xs pr-1 flex flex-col gap-1 max-h-[350px] md:max-h-[420px]">
                      {historyPairs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center my-auto py-12 text-slate-300">
                          <Clock className="w-6 h-6 stroke-[1.5] mb-2" />
                          <span className="text-[10px] uppercase tracking-wider font-semibold">Ready to Log</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">Moves show here</span>
                        </div>
                      ) : (
                        historyPairs.map((pair) => (
                          <div 
                            key={pair.round} 
                            className="grid grid-cols-[30px_1fr_1fr] gap-1 py-1 px-1.5 hover:bg-slate-50 rounded transition-colors text-center font-mono"
                          >
                            <span className="text-slate-400 font-semibold text-right pr-2">{pair.round}.</span>
                            <span className="text-slate-800 font-medium text-left pl-1">
                              {pair.white}
                            </span>
                            <span className="text-slate-800 font-medium text-left pl-1">
                              {pair.black || ''}
                            </span>
                          </div>
                        ))
                      )}
                      <div ref={logEndRef} />
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] uppercase tracking-wider font-bold text-slate-400 text-center font-mono">
                      {gameOver ? '⭐ Match Finished' : `● ${turn === 'w' ? "White's turn" : "Black's turn"}`}
                    </div>
                  </div>

                  {/* Chat Panel - Only visible in Online modes during active gameplay */}
                  {mode === 'online' && roomCode && (
                    <ChessChat 
                      roomId={roomCode}
                      activePlayerId={user?.uid || playerId}
                      playerName={userProfile?.username || (playerColor === 'w' ? 'White' : 'Black')}
                      playerColor={playerColor || 'w'}
                      room={room}
                    />
                  )}

                </div>

                {/* Centered New Match Button */}
                <button 
                  onClick={handleResetGame} 
                  id="reset-match-btn"
                  className="mt-8 px-6 py-2 bg-slate-800 text-white text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors rounded shadow-xs cursor-pointer active:scale-95 transition-all outline-none"
                >
                  New Game
                </button>

              </div>

              {/* Right Sidebar: Black Player Status */}
              <div className="w-full lg:w-[200px] flex flex-col justify-between p-4 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                <div>
                  <h2 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>{blackHeaderText}</span>
                    {mode === 'online' && room && (
                      <span className={`w-2 h-2 rounded-full ${
                        room.blackPlayerId 
                          ? (isOpponentDisconnected && playerColor === 'w' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500') 
                          : 'bg-slate-300'
                      }`} />
                    )}
                  </h2>
                  
                  <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1.5">
                    White's Captures
                  </p>
                  <div 
                    id="black-captured" 
                    className="flex flex-wrap gap-1 min-h-[60px] p-2 bg-[#f8fafc] rounded border border-slate-200"
                  >
                    {captured.b.length === 0 ? (
                      <span className="text-xs text-slate-400 italic m-auto">No captures</span>
                    ) : (
                      captured.b.map((type, idx) => (
                        <div key={idx} className="w-6 h-6 hover:scale-110 active:scale-95 transition-transform animate-scale-in" title={getPieceName(type)}>
                          <ChessPieceSvg type={type} color="b" />
                        </div>
                      ))
                    )}
                  </div>

                  {blackAdvantage > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded animate-bounce-short">
                        +{blackAdvantage} pts
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  {turn === 'b' && !gameOver ? (
                    <div id="black-turn-indicator" className="p-3.5 rounded-lg border-2 border-slate-800 bg-white shadow-sm flex flex-col items-center justify-center text-center animate-pulse">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-800">
                        {isThinking ? "Thinking" : (mode === 'online' && playerColor === 'b' ? "Your Turn" : "Black's Turn")}
                      </span>
                      <p className="text-[9px] text-slate-400 mt-0.5">{isThinking ? "Processing..." : "Active"}</p>
                    </div>
                  ) : (
                    <div id="black-turn-indicator" className="p-3.5 rounded-lg border-2 border-transparent opacity-30 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Waiting</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </>
          )}
          </>
        )}
      </div>

      {/* Elegant Minimal Footer */}
      <footer className="w-full text-center text-[10px] py-6 font-mono border-t border-slate-100 mt-8 flex flex-col items-center justify-center gap-2">
        <p className="uppercase tracking-widest text-slate-400">Classical Chess • Clean Minimalist ruleset</p>
        <div className="flex gap-4 text-slate-400">
          <button
            onClick={() => {
              setAppTermsPrivacyTab('terms');
              setAppTermsPrivacyOpen(true);
            }}
            className="hover:text-indigo-600 transition-colors uppercase tracking-wider cursor-pointer font-bold underline hover:no-underline"
          >
            Terms of Service
          </button>
          <span>•</span>
          <button
            onClick={() => {
              setAppTermsPrivacyTab('privacy');
              setAppTermsPrivacyOpen(true);
            }}
            className="hover:text-emerald-700 transition-colors uppercase tracking-wider cursor-pointer font-bold underline hover:no-underline"
          >
            Privacy Policy
          </button>
        </div>
      </footer>

      {/* Auth modal overlay */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={(profile) => {
          setUserProfile(profile);
          setIsAuthModalOpen(false);
        }}
      />

      {/* Terms and Privacy Policy overlay */}
      <TermsPrivacyModal
        isOpen={appTermsPrivacyOpen}
        onClose={() => setAppTermsPrivacyOpen(false)}
        defaultTab={appTermsPrivacyTab}
      />

    </div>
  );
}
