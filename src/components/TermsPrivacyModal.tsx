import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface TermsPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy';
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'terms'
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col max-h-[85vh] text-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-slate-50 text-slate-700 rounded-lg">
              {activeTab === 'terms' ? <FileText className="w-5 h-5 text-indigo-600" /> : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
            </span>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
                {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">Last updated: June 2026</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-650 p-1.5 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="flex border-b border-slate-100 font-mono text-xs font-bold uppercase tracking-wider px-5 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-4 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'terms'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-4 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'privacy'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Privacy Policy
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-600 leading-relaxed font-sans">
          {activeTab === 'terms' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">1. Agreement to Terms</h3>
              <p>
                Welcome to our Chess Game. By registering an account, playing on our platform, or accessing any online features, you agree to bound by these Terms of Service. If you do not agree, please do not use the application.
              </p>

              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">2. Player Responsibility & Fair Play</h3>
              <p>
                You are responsible for maintaining the security of your account and credentials. To ensure a fun and healthy atmosphere, players agree to play fairly:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>No automated engines, AI bots, or solvers are permitted during computer or multiplayer games.</li>
                <li>Respectful communication inside game rooms and lobbies.</li>
                <li>No cheating, exploiting sandbox resources, or abusing Firestore syncing channels.</li>
              </ul>

              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">3. Account Eligibility</h3>
              <p>
                You agree that the metadata and credentials provided are accurate. We reserve the right to suspend accounts or rooms violating fair play standards.
              </p>

              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">4. Limitation of Liability</h3>
              <p>
                This software is provided "as is" without warranty of any kind. We are not liable for any service interruptions, loss of matchmaking queues, or general data storage limits.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">1. Information We Collect</h3>
              <p>
                We value your privacy. We collect minimal information to run matchmaking and persistent profiles:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Account details like display usernames and email address when you sign up.</li>
                <li>Live game states (FEN, move counts, and move histories).</li>
                <li>Matchmaking search queue states when accessing "Find Random Opponent".</li>
              </ul>

              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">2. Use of Data</h3>
              <p>
                Your display username and status are stored in Firestore strictly to facilitate multiplayer syncing and matching. We do not sell, trade, or share your account information or private emails with third parties.
              </p>

              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">3. Cookie & LocalStorage Use</h3>
              <p>
                We use client-side local storage (`localStorage`) solely to store game preferences (like mute states, active chessboard themes) and a unique guest player ID to enable seamless reconnection on refresh. We do not use tracking or advertising cookies.
              </p>

              <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">4. Data Deletion</h3>
              <p>
                You can request the deletion of your historical online game data or profiles anytime by contacting support or clearing your browser storage.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg cursor-pointer"
          >
            Agree & Dismiss
          </button>
        </div>
      </motion.div>
    </div>
  );
};
