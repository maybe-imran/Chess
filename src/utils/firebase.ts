import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import config from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});

// Since we have a specific firestore database ID (optional multi-db), let's use it if specified
export const db = config.firestoreDatabaseId 
  ? getFirestore(app, config.firestoreDatabaseId) 
  : getFirestore(app);

export const auth = getAuth(app);

// Simple generator for unique 6-character uppercase codes
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars like I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Client Unique Player ID (persisted across refreshes in the session)
export function getOrCreatePlayerId(): string {
  let pid = localStorage.getItem('chess_player_id');
  if (!pid) {
    pid = 'player_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('chess_player_id', pid);
  }
  return pid;
}

export interface UserProfile {
  uid: string;
  username: string;
  createdAt: number;
  statsPlaceholder: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    gamesDrawn: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: 'w' | 'b';
  text: string;
  timestamp: number;
}

export interface OnlineRoom {
  roomId: string;
  fen: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  whitePlayerName: string | null;
  blackPlayerName: string | null;
  whiteLastActive: number;
  blackLastActive: number;
  status: 'waiting' | 'ready' | 'gameover';
  moveCount: number;
  lastMove: {
    from: string;
    to: string;
    promotion?: 'q' | 'r' | 'b' | 'n';
    timestamp: number;
  } | null;
  creatorId: string;
  currentTurn: 'w' | 'b';
  history?: string[];
  resignedColor?: 'w' | 'b' | null;
  messages?: ChatMessage[];
}

/**
 * Creates a brand new multiplayer online room in Firestore
 */
export async function createOnlineRoom(
  roomId: string, 
  creatorId: string, 
  assignedColor: 'w' | 'b',
  creatorName: string
): Promise<OnlineRoom> {
  const roomData: OnlineRoom = {
    roomId,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // starting chess position
    whitePlayerId: assignedColor === 'w' ? creatorId : null,
    blackPlayerId: assignedColor === 'b' ? creatorId : null,
    whitePlayerName: assignedColor === 'w' ? creatorName : null,
    blackPlayerName: assignedColor === 'b' ? creatorName : null,
    whiteLastActive: assignedColor === 'w' ? Date.now() : 0,
    blackLastActive: assignedColor === 'b' ? Date.now() : 0,
    status: 'waiting',
    moveCount: 0,
    lastMove: null,
    creatorId,
    currentTurn: 'w',
    history: []
  };

  const roomRef = doc(db, 'rooms', roomId);
  await setDoc(roomRef, roomData);
  return roomData;
}

/**
 * Joins an existing room. Assigns the free color.
 */
export async function joinOnlineRoom(roomId: string, playerId: string, playerName: string): Promise<OnlineRoom | null> {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  
  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as OnlineRoom;

  // If the player is already white or black, just return
  if (data.whitePlayerId === playerId || data.blackPlayerId === playerId) {
    const updates: Partial<OnlineRoom> = {};
    if (data.whitePlayerId === playerId) {
      updates.whiteLastActive = Date.now();
      updates.whitePlayerName = playerName;
    } else {
      updates.blackLastActive = Date.now();
      updates.blackPlayerName = playerName;
    }
    await updateDoc(roomRef, updates);
    return { ...data, ...updates };
  }

  // Otherwise, place them in the empty slot
  const updates: Partial<OnlineRoom> = {};
  if (!data.whitePlayerId) {
    updates.whitePlayerId = playerId;
    updates.whitePlayerName = playerName;
    updates.whiteLastActive = Date.now();
  } else if (!data.blackPlayerId) {
    updates.blackPlayerId = playerId;
    updates.blackPlayerName = playerName;
    updates.blackLastActive = Date.now();
  } else {
    // Room is fully complete! But wait, let's allow them back as spectator or similar if they are reconnecting.
    // If both slots are full and neither matches playerId, they cannot join.
    return null;
  }

  // Update status if both players have now connected
  const finalWhiteId = data.whitePlayerId || updates.whitePlayerId;
  const finalBlackId = data.blackPlayerId || updates.blackPlayerId;
  if (finalWhiteId && finalBlackId) {
    updates.status = 'ready';
  }

  await updateDoc(roomRef, updates);
  return { ...data, ...updates };
}

/**
 * Updates the board state in the firestore room
 */
export async function updateRoomBoard(
  roomId: string, 
  fen: string, 
  moveCount: number, 
  from: string, 
  to: string, 
  promotion?: 'q' | 'r' | 'b' | 'n',
  history?: string[],
  nextTurn?: 'w' | 'b'
): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  const calculatedTurn = nextTurn || (fen.split(' ')[1] as 'w' | 'b' || 'w');
  const updates: any = {
    fen,
    moveCount,
    currentTurn: calculatedTurn,
    lastMove: {
      from,
      to,
      promotion: promotion || 'q',
      timestamp: Date.now()
    }
  };
  if (history) {
    updates.history = history;
  }
  await updateDoc(roomRef, updates);
}

/**
 * Sends a heartbeat ping for the player color with current millisecond timestamp
 */
export async function sendHeartbeat(roomId: string, color: 'w' | 'b'): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  if (color === 'w') {
    await updateDoc(roomRef, { whiteLastActive: Date.now() });
  } else {
    await updateDoc(roomRef, { blackLastActive: Date.now() });
  }
}

/**
 * Fetches user profile from Firestore or returns null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (error) {
    console.warn('Error getting user profile:', error);
  }
  return null;
}
