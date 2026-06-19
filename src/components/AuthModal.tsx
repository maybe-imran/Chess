import { useState, FormEvent } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, UserProfile } from '../utils/firebase';
import { X, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TermsPrivacyModal } from './TermsPrivacyModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: UserProfile) => void;
}

type AuthTab = 'login' | 'signup' | 'forgot';

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  
  // States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsPrivacyOpen, setTermsPrivacyOpen] = useState(false);
  const [termsPrivacyTab, setTermsPrivacyTab] = useState<'terms' | 'privacy'>('terms');

  if (!isOpen) return null;

  // Simple email format validator
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleResetState = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setError('');
    setSuccessMsg('');
    setAgreed(false);
  };

  const handleTabChange = (nextTab: AuthTab) => {
    handleResetState();
    setTab(nextTab);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const user = credential.user;
      
      const trimmedUser = user.displayName || user.email?.split('@')[0] || 'Player';
      
      const userProfile: UserProfile = {
        uid: user.uid,
        username: trimmedUser,
        createdAt: Date.now(),
        statsPlaceholder: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesDrawn: 0
        }
      };

      await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });

      setSuccessMsg('Signed in with Google successfully!');
      onSuccess(userProfile);
      setTimeout(() => {
        onClose();
        handleResetState();
      }, 1500);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please enable popups.');
      } else {
        setError('Failed to sign in with Google: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Validation
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setError('Please choose a username.');
      return;
    }
    if (trimmedUser.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Create user in firebase Auth
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // Update auth displayName
      await updateProfile(user, { displayName: trimmedUser });

      // Build UserProfile Document
      const userProfile: UserProfile = {
        uid: user.uid,
        username: trimmedUser,
        createdAt: Date.now(),
        statsPlaceholder: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesDrawn: 0
        }
      };

      // Store user metadata in collection users/{userId} in Firestore
      await setDoc(doc(db, 'users', user.uid), userProfile);

      setSuccessMsg('Account created successfully!');
      onSuccess(userProfile);
      setTimeout(() => {
        onClose();
        handleResetState();
      }, 1500);
    } catch (err: any) {
      console.error('Signup error:', err);
      const code = err.code || '';
      const message = err.message || '';
      if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
        setError('An account with this email already exists.');
      } else if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
        setError('Email/Password provider is not enabled. Please sign in using Google Account, or enable the Email/Password provider in the Firebase Console: Build > Authentication > Sign-in method.');
      } else {
        setError('Failed to create account. Please consult network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Retrieve display profile
      const user = credential.user;
      
      const userProfile: UserProfile = {
        uid: user.uid,
        username: user.displayName || email.split('@')[0],
        createdAt: Date.now(), // fallback
        statsPlaceholder: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesDrawn: 0
        }
      };

      setSuccessMsg('Logged in successfully!');
      onSuccess(userProfile);
      setTimeout(() => {
        onClose();
        handleResetState();
      }, 1500);
    } catch (err: any) {
      console.warn('Login failure:', err);
      const code = err.code || '';
      const message = err.message || '';
      if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
        setError('Email/Password provider is not enabled in Firebase. Please use Google Account instead, or enable the Email/Password provider in the Firebase Console: Build > Authentication > Sign-in method.');
      } else {
        // Strict requirement: "wrong credentials (don't reveal whether the email or password specifically was wrong)"
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('Password reset link sent! Check your inbox.');
    } catch (err: any) {
      console.warn('Reset error code:', err.code);
      if (err.code === 'auth/user-not-found') {
        // Follow security best practice, but can indicate or say sent
        setSuccessMsg('If an account exists with this email, a reset link was sent.');
      } else {
        setError('Error sending password reset link. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      {/* Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 md:p-8 overflow-hidden font-sans text-slate-800"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition-colors p-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Dynamic Headers */}
        <div className="mb-6 text-center">
          {tab === 'login' && (
            <>
              <h2 className="text-xl font-light tracking-tight uppercase">Login to Chess</h2>
              <p className="text-xs text-slate-400 mt-1">Access real-time sync and custom profiles</p>
            </>
          )}
          {tab === 'signup' && (
            <>
              <h2 className="text-xl font-light tracking-tight uppercase">Create Account</h2>
              <p className="text-xs text-slate-400 mt-1">Register for global matching and scores</p>
            </>
          )}
          {tab === 'forgot' && (
            <>
              <h2 className="text-xl font-light tracking-tight uppercase">Reset Password</h2>
              <p className="text-xs text-slate-400 mt-1">Send recovery email link immediately</p>
            </>
          )}
        </div>

        {/* Alert Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 flex items-center gap-2 bg-rose-50 border border-rose-100 p-3 rounded-lg text-xs font-semibold text-rose-700 font-mono"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs font-semibold text-emerald-700 font-mono"
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Selection */}
        {tab !== 'forgot' && (
          <div className="flex border-b border-slate-100 mb-6 font-mono text-xs font-bold uppercase tracking-wider">
            <button
              onClick={() => handleTabChange('login')}
              disabled={loading}
              className={`flex-1 pb-2.5 text-center transition-colors cursor-pointer border-b-2 ${
                tab === 'login' ? 'border-slate-800 text-slate-850' : 'border-transparent text-slate-400 hover:text-slate-650'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => handleTabChange('signup')}
              disabled={loading}
              className={`flex-1 pb-2.5 text-center transition-colors cursor-pointer border-b-2 ${
                tab === 'signup' ? 'border-slate-800 text-slate-850' : 'border-transparent text-slate-400 hover:text-slate-650'
              }`}
            >
              Create Player
            </button>
          </div>
        )}

        {/* FORMS */}
        <div className="space-y-4">
          {/* LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Password</label>
                  <button
                    type="button"
                    onClick={() => handleTabChange('forgot')}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer outline-none"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-slate-800 text-white font-mono text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-slate-700 active:scale-98 transition-all cursor-pointer shadow-xs mt-3 flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign In Now'}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Username / Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                  <input
                    type="text"
                    required
                    placeholder="grandmaster_bob"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                  <input
                    type="email"
                    required
                    placeholder="bob@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Confirm Match</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Terms and Privacy Checkbox */}
              <div className="flex items-start gap-2.5 my-3">
                <input
                  id="agree-checkbox"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={loading}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="agree-checkbox" className="text-[11px] text-slate-500 leading-relaxed cursor-pointer select-none">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsPrivacyTab('terms');
                      setTermsPrivacyOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 underline inline hover:no-underline font-semibold cursor-pointer"
                  >
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsPrivacyTab('privacy');
                      setTermsPrivacyOpen(true);
                    }}
                    className="text-emerald-600 hover:text-emerald-800 underline inline hover:no-underline font-semibold cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !agreed}
                className="w-full py-2.5 bg-slate-800 disabled:opacity-50 text-white font-mono text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-slate-700 active:scale-98 transition-all cursor-pointer shadow-xs mt-3 flex items-center justify-center gap-2"
              >
                {loading ? 'Creating...' : 'Register Player'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-350" />
                  <input
                    type="email"
                    required
                    placeholder="recovery@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-[#fbfcfd] focus:bg-white rounded-lg text-sm text-slate-800 placeholder-slate-350 outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 mt-3">
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  disabled={loading}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-650 hover:bg-slate-50 font-mono text-xs uppercase tracking-widest font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-650 hover:bg-indigo-755 text-white font-mono text-xs uppercase tracking-widest font-bold rounded-lg active:scale-98 transition-all cursor-pointer shadow-xs"
                >
                  {loading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          )}

          {tab !== 'forgot' && (
            <>
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider font-bold">
                  <span className="bg-white px-3 text-slate-400">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-mono text-xs uppercase tracking-widest font-bold rounded-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="text-red-500 font-extrabold text-sm font-sans">G</span>
                <span className="text-amber-500 font-extrabold text-sm font-sans">o</span>
                <span className="text-green-500 font-extrabold text-sm font-sans">o</span>
                <span className="text-blue-500 font-extrabold text-sm font-sans">g</span>
                <span className="text-green-500 font-extrabold text-sm font-sans">l</span>
                <span className="text-red-500 font-extrabold text-sm font-sans">e</span>
                <span className="text-slate-600 font-sans tracking-normal capitalize font-medium ml-1">Account</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      <TermsPrivacyModal
        isOpen={termsPrivacyOpen}
        onClose={() => setTermsPrivacyOpen(false)}
        defaultTab={termsPrivacyTab}
      />
    </div>
  );
}
