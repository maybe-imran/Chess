import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MessageSquare, 
  VolumeX, 
  Volume2, 
  Flag, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  CheckCircle,
  Clock
} from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, ChatMessage, OnlineRoom } from '../utils/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface ChessChatProps {
  roomId: string;
  activePlayerId: string;
  playerName: string;
  playerColor: 'w' | 'b';
  room: OnlineRoom | null;
}

const PROFANITY_WORDS = [
  'shit', 'fuck', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'idiot', 'noob', 'dummy', 'loser'
];

export const ChessChat: React.FC<ChessChatProps> = ({
  roomId,
  activePlayerId,
  playerName,
  playerColor,
  room
}) => {
  const [inputText, setInputText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMsgLength, setLastMsgLength] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Reporting state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Abusive Language');
  const [isReportSubmitted, setIsReportSubmitted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = room?.messages || [];

  // Profanity Filter: Censors words with asterisks
  const filterProfanity = (text: string): string => {
    let clean = text;
    PROFANITY_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      clean = clean.replace(regex, (match) => match[0] + '*'.repeat(match.length - 1));
    });
    return clean;
  };

  // Scroll to bottom when messages list changes
  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCollapsed]);

  // Track unread messages when collapsed
  useEffect(() => {
    if (messages.length > lastMsgLength) {
      if (isCollapsed) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.senderId !== activePlayerId) {
          setUnreadCount(prev => prev + (messages.length - lastMsgLength));
        }
      }
      setLastMsgLength(messages.length);
    }
  }, [messages, isCollapsed, lastMsgLength, activePlayerId]);

  // Reset unread count when expanding the chat
  useEffect(() => {
    if (!isCollapsed) {
      setUnreadCount(0);
    }
  }, [isCollapsed]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // Apply profanity censoring before sending
    const safeText = filterProfanity(trimmed);
    
    setInputText('');

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 11),
      senderId: activePlayerId,
      senderName: playerName,
      senderColor: playerColor,
      text: safeText,
      timestamp: Date.now()
    };

    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        messages: arrayUnion(newMessage)
      });
    } catch (err) {
      console.error('Failed to send live chat message:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleSubmitReport = () => {
    const reportedUserId = playerColor === 'w' ? room?.blackPlayerId : room?.whitePlayerId;
    const reportedUsername = playerColor === 'w' ? room?.blackPlayerName : room?.whitePlayerName;
    
    // Log report parameters clearly for moderation audits
    console.log('[MODERATION COGNIZANCE] Chat Abuse Report Submitted:', {
      reporterId: activePlayerId,
      reportedUserId,
      reportedUsername,
      reason: reportReason,
      roomId,
      timestamp: new Date().toISOString()
    });

    setIsReportSubmitted(true);
    setTimeout(() => {
      setIsReportSubmitted(false);
      setShowReportModal(false);
    }, 2000);
  };

  // Determine opponent name
  const opponentName = playerColor === 'w' 
    ? (room?.blackPlayerName || 'Black') 
    : (room?.whitePlayerName || 'White');

  // Filter messages (hide sender if muted, except our own)
  const visibleMessages = messages.filter(msg => {
    if (isMuted && msg.senderId !== activePlayerId) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full md:w-[280px] flex flex-col bg-white dark:bg-[#151f32] rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-3xs select-none shrink-0 min-h-[300px] max-h-[512px] transition-all relative font-sans text-slate-800 dark:text-slate-100">
      
      {/* Header bar */}
      <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-lg">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
          <span>Game Chat</span>
          {isCollapsed && unreadCount > 0 && (
            <span className="ml-1 bg-indigo-600 text-white text-[10px] font-mono leading-none py-0.5 px-1.5 rounded-full animate-bounce">
              {unreadCount}
            </span>
          )}
        </span>

        <div className="flex items-center gap-1">
          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer ${isMuted ? 'text-red-500 bg-red-50' : 'text-slate-400'}`}
            title={isMuted ? "Unmute Opponent" : "Mute Opponent"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Report Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="p-1 rounded hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-amber-600 cursor-pointer"
            title="Report Opponent"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-slate-200/60 transition-colors text-slate-400 cursor-pointer"
            title={isCollapsed ? "Expand Chat" : "Collapse Chat"}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-grow flex flex-col min-h-[250px] overflow-hidden"
          >
            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 max-h-[380px] scrollbar-thin bg-white dark:bg-[#151f32]">
              {visibleMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center my-auto py-10 text-slate-350">
                  <Clock className="w-5 h-5 stroke-[1.5] mb-1 text-slate-300" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Live Chat</span>
                  <p className="text-[9px] text-slate-400 mt-0.5 text-center px-4 leading-relaxed">
                    Exchanged messages will show here. Good luck, play fair!
                  </p>
                </div>
              ) : (
                visibleMessages.map((msg) => {
                  const isMe = msg.senderId === activePlayerId;
                  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      {/* Sender details and timestamp */}
                      <div className="flex items-center gap-1.5 mb-0.5 text-[9px] font-mono font-bold text-slate-400">
                        <span>{msg.senderName}</span>
                        <span className={`px-1 rounded-sm text-[8px] ${msg.senderColor === 'w' ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-800 text-white'}`}>
                          {msg.senderColor === 'w' ? 'W' : 'B'}
                        </span>
                        <span>•</span>
                        <span>{timeStr}</span>
                      </div>

                      {/* Bubble content */}
                      <div className={`px-2.5 py-1.5 rounded-lg text-xs leading-relaxed break-words border ${
                        isMe 
                          ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200/60 dark:border-slate-700 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              
              {isMuted && messages.some(m => m.senderId !== activePlayerId) && (
                <div className="text-[9px] font-mono bg-red-50 text-red-600 p-1.5 rounded border border-red-100 text-center uppercase tracking-wide">
                  ⚠️ Opponent Muted • Some messages hidden
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input field and send button */}
            <form 
              onSubmit={handleSendMessage} 
              className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2"
            >
              <input
                type="text"
                maxLength={180}
                placeholder="Type a safe message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-350 text-slate-805 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-1.5 bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      {showReportModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-3xs flex items-center justify-center p-3 rounded-lg">
          <div className="w-full bg-white dark:bg-[#1f2d44] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-md flex flex-col gap-3 font-sans animate-fade-in text-slate-805 dark:text-slate-100">
            {isReportSubmitted ? (
               <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 animate-bounce" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Report Logged</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium">
                  Flagged {opponentName} for investigation.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Report Player</span>
                  </span>
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  You are filing a safe-gaming audit on <span className="font-semibold text-slate-800 dark:text-slate-200">{opponentName}</span>. Choose reason:
                </div>

                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-md focus:outline-none"
                >
                  <option value="Abusive Language">Abusive Language</option>
                  <option value="Cheating / Engine Use">Cheating / Engine Use</option>
                  <option value="Spam / Flooding">Spam / Flooding</option>
                  <option value="Inappropriate Name">Inappropriate Username</option>
                  <option value="Unsporting Conduct">Unsporting Conduct</option>
                </select>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-2.5 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-550 dark:text-slate-300 border border-slate-250 dark:border-slate-705 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    className="px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white text-[9px] font-mono font-bold uppercase tracking-wider rounded"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
