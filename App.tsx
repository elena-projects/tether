import React, { useState, useEffect, useRef } from 'react';
import { TetherState, TetherRole, Message, Language, UserProfile } from './types';
import { moderateContent, generateFallbackMessage } from './services/geminiService';
import { saveUserSession, loadUserSession, updateUserState, getDriftingUsers, sendTetherMessage, listenToInbox, voteForMessage, unvoteForMessage, listenToSpotlight, listenToUserTotalVotes, listenToWall } from './services/firebase';
import { startHealingDrone, stopHealingDrone, unlockAudio } from './services/audioService';
import { vibrate, stopVibration } from './services/haptics';
import { getTranslation, streamMessages, aiFallbackMessages } from './translations';
import OrbCanvas from './components/OrbCanvas';
import Controls from './components/Controls';
import LandingOverlay from './components/LandingOverlay';
import HistoryPanel from './components/HistoryPanel';
import { JourneyLog } from './components/JourneyLog';
import { MessageCard } from './components/MessageCard';
import WelcomeBack from './components/WelcomeBack';
import SafetyNet from './components/SafetyNet';
import WallPanel from './components/WallPanel';
import { Send, Heart, ShieldAlert, Loader2, BookOpen, Users, Sparkles, Volume2, VolumeX, Radio, Globe, ArrowLeft, ArrowRight, Sun, Moon, LogOut } from 'lucide-react';

const INITIAL_STATE: TetherState = {
  valence: 50,
  arousal: 50,
  body: 50,
};

const TARGET_DESCRIPTORS = ["HEAVY", "COLD", "BRITTLE", "HOLLOW", "SILENT", "LOST", "FADING", "SHATTERED", "DARK"];

// The environment colour still shifts with mood, but within a restrained warm-Morandi
// range per theme (light lotus pastels by day, deep warm tones by night) so it never
// clashes with the calm palette. Corners map to the valence×arousal quadrants.
const MOOD_CORNERS = {
  // Day corners softened a touch (less bright/glary) while staying warm & light.
  day:   { tl: [190, 170, 173], tr: [216, 196, 180], bl: [186, 184, 190], br: [210, 190, 186] },
  night: { tl: [78, 53, 54],    tr: [98, 69, 54],    bl: [60, 56, 60],    br: [78, 56, 55] },
};

export default function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState<{uid: string, username: string} | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSafety, setShowSafety] = useState(false);   // crisis-support screen
  const [showWall, setShowWall] = useState(false);       // always-on "kind words" wall
  // Post-login flow: 'welcome' (a calm "remember you" screen) → 'main' (the dashboard).
  const [phase, setPhase] = useState<'welcome' | 'main'>('welcome');
  // Within the main phase, a gentle 3-step ritual instead of one dense dashboard.
  const [step, setStep] = useState<'checkin' | 'reflect' | 'respond' | 'close'>('checkin');
  const checkinRecorded = useRef(false);

  // App State
  const [state, setState] = useState<TetherState>(INITIAL_STATE);
  const [role, setRole] = useState<TetherRole>(TetherRole.WITNESS);
  const [language, setLanguage] = useState<Language>(() => (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('zh')) ? 'zh' : 'en');
  const [bgColor, setBgColor] = useState<string>('rgb(0,0,0)');

  // --- Day / Night theme (6:00–19:00 day, else night; manual toggle locks the choice) ---
  const getInitialMode = (): 'day' | 'night' => {
    const locked = localStorage.getItem('tether_theme');
    if (locked === 'day' || locked === 'night') return locked;
    const h = new Date().getHours();
    return h >= 6 && h < 19 ? 'day' : 'night';
  };
  const [mode, setMode] = useState<'day' | 'night'>(getInitialMode);
  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
  const toggleMode = () => {
    const m = mode === 'day' ? 'night' : 'day';
    setMode(m);
    localStorage.setItem('tether_theme', m);
  };
  // Sound on/off for the healing drone (persisted). Default on.
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem('tether_sound') !== 'off');
  const toggleSound = () => {
    setSoundOn(prev => {
      const next = !prev;
      localStorage.setItem('tether_sound', next ? 'on' : 'off');
      if (next) unlockAudio(); // this click is a user gesture — unlock audio for mobile
      return next;
    });
  };
  const [isHealing, setIsHealing] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Happy User Simulation State
  const [sentSuccess, setSentSuccess] = useState(false);
  const [targetDescriptor, setTargetDescriptor] = useState("");
  const [journeyVersion, setJourneyVersion] = useState(0); // Triggers update for JourneyLog
  
  // Keep state in a ref so we can use it in timeouts without resetting the timer
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  
  // Messaging / Social
  const [anchorInput, setAnchorInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [sendWarning, setSendWarning] = useState("");     // Guardian blocked the message
  const [wallMessages, setWallMessages] = useState<Message[]>([]); // real "kind words" wall
  const [feedback, setFeedback] = useState<{type: 'success' | 'error' | null, msg: string}>({ type: null, msg: '' });
  
  // Data Flow
  const [inbox, setInbox] = useState<Message[]>([]);
  const [localAiMessage, setLocalAiMessage] = useState<Message | null>(null); // CLIENT-SIDE FALLBACK

  const [driftingUsers, setDriftingUsers] = useState<UserProfile[]>([]);
  const [hasScanned, setHasScanned] = useState(false); 
  const [showBroadcastOption, setShowBroadcastOption] = useState(false);
  const [selectedDrifterId, setSelectedDrifterId] = useState<string | null>(null);
  const [spotlightMessage, setSpotlightMessage] = useState<Message | null>(null);
  const [userHealingScore, setUserHealingScore] = useState(0);
  const [hasNewHealing, setHasNewHealing] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  // Timer Ref for Strict 15s logic
  const driftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback for demo stream
  const [demoStream, setDemoStream] = useState<Message[]>(streamMessages['en']);
  const t = getTranslation(language);
  const zh = language === 'zh';

  // --- INITIALIZATION ---
  useEffect(() => {
    const session = loadUserSession();
    const autoEnter = localStorage.getItem('tether_auto_enter') === 'true';

    // If session exists AND auto-enter is enabled, skip landing
    if (session.uid && session.username && autoEnter) {
      setCurrentUser({ uid: session.uid, username: session.username });
      setShowLanding(false);
    } else {
      // Otherwise, force landing, but pre-fill if session exists (handled by LandingOverlay manually if we wanted, but not needed here)
      if (session.uid && session.username) {
         setCurrentUser({ uid: session.uid, username: session.username });
      }
      setShowLanding(true);
    }
    
    const storedVotes = localStorage.getItem('tether_voted_ids');
    if (storedVotes) {
      setVotedIds(new Set(JSON.parse(storedVotes)));
    }
  }, []);

  const handleLogin = (username: string, autoEnter: boolean) => {
    // Check if we have an existing UID to preserve history, otherwise generate new
    const existingUid = localStorage.getItem('tether_uid');
    const uid = existingUid || 'user_' + Math.random().toString(36).substr(2, 9);
    
    saveUserSession(uid, username);
    setCurrentUser({ uid, username });
    setPhase('welcome');
    checkinRecorded.current = false;

    if (autoEnter) {
      localStorage.setItem('tether_auto_enter', 'true');
    } else {
      localStorage.removeItem('tether_auto_enter');
    }

    setShowLanding(false);
  };

  // Unlock audio on the very first user tap so the healing drone can play on mobile
  // (phones keep the AudioContext suspended until a gesture calls resume()).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // --- HEALING MODE LOGIC ---
  const wasHealingRef = useRef(false);
  useEffect(() => {
    const healing = !showLanding && state.body < 50;
    setIsHealing(healing);
    if (healing && soundOn) {
       startHealingDrone();
    } else {
       stopHealingDrone();
    }
    // A soft, calming pulse the moment you drop into healing (Android only — iOS has no web vibration).
    if (healing && !wasHealingRef.current) vibrate([0, 40, 130, 40]);
    wasHealingRef.current = healing;
  }, [state.body, showLanding, soundOn]);

  // Breathing haptic on the closing "breathe with me" step: one soft pulse at the
  // start of each 8s breath cycle (matches the .animate-breathe animation). Android only.
  useEffect(() => {
    if (showLanding || step !== 'close') return;
    const pulse = () => vibrate([0, 55, 220, 30]);
    pulse();
    const id = setInterval(pulse, 8000);
    return () => { clearInterval(id); stopVibration(); };
  }, [step, showLanding]);

  // --- FIREBASE SYNC (DEBOUNCED) ---
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      updateUserState(currentUser.uid, currentUser.username, state);
    }, 1000); 
    return () => clearTimeout(timer);
  }, [state, currentUser]);

  // --- TRACK INTERACTION FOR NUDGE ---
  useEffect(() => {
    if (!hasInteracted && (state.valence !== 50 || state.arousal !== 50 || state.body !== 50)) {
       setHasInteracted(true);
    }
  }, [state, hasInteracted]);

  // --- RECORD ONE CHECK-IN PER SESSION (fills the emotion trajectory shown on the welcome screen) ---
  useEffect(() => {
    if (phase !== 'main' || !hasInteracted || checkinRecorded.current) return;
    checkinRecorded.current = true;
    (window as any).gtag?.('event', 'tether_checkin');
    const word = state.valence < 35 ? (zh ? '有点低落' : 'heavy')
      : state.valence > 65 ? (zh ? '还不错' : 'okay')
      : (zh ? '平平的一天' : 'so-so');
    const entry = { id: Date.now(), timestamp: Date.now(), valence: state.valence, arousal: state.arousal, message: word };
    try {
      const hist = JSON.parse(localStorage.getItem('tether_journey_log') || '[]');
      localStorage.setItem('tether_journey_log', JSON.stringify([entry, ...hist].slice(0, 60)));
    } catch {}
  }, [phase, hasInteracted, state, zh]);

  // --- LISTENERS ---
  useEffect(() => {
    if (!currentUser) return;
    
    // Listen for messages targeted specifically to this user (targetId == currentUser.uid)
    const unsubInbox = listenToInbox(currentUser.uid, (msgs) => {
      setInbox(msgs);
      // If a real message arrives, clear local fallback to avoid duplicates or confusion
      if (msgs.length > 0) {
         setLocalAiMessage(null);
      }
    });

    const unsubSpotlight = listenToSpotlight((msg) => {
      setSpotlightMessage(msg);
    });

    const unsubHealing = listenToUserTotalVotes(currentUser.uid, (total) => {
       setUserHealingScore(prev => {
          if (total > prev && !showHistory) {
             setHasNewHealing(true);
          }
          return total;
       });
    });

    const unsubWall = listenToWall((msgs) => setWallMessages(msgs));

    return () => {
      unsubInbox();
      unsubSpotlight();
      unsubHealing();
      unsubWall();
    };
  }, [currentUser, showHistory]);

  // Clear notification when history opens
  useEffect(() => {
    if (showHistory) setHasNewHealing(false);
  }, [showHistory]);

  // --- STRICT 15-SECOND DRIFTING TIMER & AI FALLBACK ---
  
  useEffect(() => {
    // 1. CLEAR EXISTING TIMER
    if (driftTimerRef.current) {
      clearTimeout(driftTimerRef.current);
      driftTimerRef.current = null;
    }

    // 2. Logic: Only start timer if Drifting AND Inbox is Empty
    if (role === TetherRole.DRIFTING && inbox.length === 0 && currentUser) {
      console.log("Drifting state detected. Starting 15s timer...");
      
      driftTimerRef.current = setTimeout(async () => {
        const uid = currentUser.uid;
        // 1. Personalised comfort that reads their exact state (Gemini). Falls back to a
        //    warm static line if the AI can't be reached. Kept local (not written to the
        //    shared wall) since it's meant just for this person.
        let text: string;
        try {
          text = (await generateFallbackMessage(stateRef.current, language) || '').trim();
          if (!text) throw new Error('empty');
        } catch {
          const messages = aiFallbackMessages[language] || aiFallbackMessages['en'];
          text = messages[Math.floor(Math.random() * messages.length)];
        }

        const fallbackMsg: Message = {
          id: 'ai_fallback_' + Date.now(), text, senderName: 'AI Companion', senderId: '0',
          targetId: uid, timestamp: Date.now(), voteCount: 0, type: 'ai',
        };
        setLocalAiMessage(fallbackMsg);

        // record to the local journey log (feeds the emotion trajectory / weekly recap)
        const logEntry = { id: Date.now(), timestamp: Date.now(), valence: stateRef.current.valence, arousal: stateRef.current.arousal, message: text };
        const history = JSON.parse(localStorage.getItem('tether_journey_log') || '[]');
        localStorage.setItem('tether_journey_log', JSON.stringify([logEntry, ...history]));
        setJourneyVersion(v => v + 1);
      }, 15000); // Strict 15 Seconds
    }

    // Cleanup on unmount
    return () => {
      if (driftTimerRef.current) clearTimeout(driftTimerRef.current);
    };
  }, [role, inbox.length, currentUser, language]); // Dependency logic handles interruption

  // --- ANCHOR TIMEOUT LOGIC ---
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (role === TetherRole.ANCHORED) {
      if (!selectedDrifterId) {
        timer = setTimeout(() => {
          setShowBroadcastOption(true);
        }, 15000);
      }
    } else {
      setShowBroadcastOption(false);
    }
    return () => clearTimeout(timer);
  }, [role, selectedDrifterId]);

  // --- ROLE & COLOR LOGIC ---
  useEffect(() => {
    const x = state.valence / 100;
    const y = state.arousal / 100;
    const interpolate = (start: number[], end: number[], ratio: number) => {
        return start.map((c, i) => c + (end[i] - c) * ratio);
    };
    const { tl, bl, tr, br } = MOOD_CORNERS[mode];
    const top = interpolate(tl, tr, x);
    const bottom = interpolate(bl, br, x);
    const result = interpolate(bottom, top, y); 
    setBgColor(`rgb(${result[0]}, ${result[1]}, ${result[2]})`);

    if (state.valence < 40) {
        setRole(TetherRole.DRIFTING);
        setSentSuccess(false); // Reset happy state if they become sad
        if (hasInteracted) { try { localStorage.setItem('tether_last_action', 'sad'); } catch {} }
    }
    else if (state.valence > 60) {
        setRole(TetherRole.ANCHORED);
        if (!targetDescriptor) {
            setTargetDescriptor(TARGET_DESCRIPTORS[Math.floor(Math.random() * TARGET_DESCRIPTORS.length)]);
        }
    }
    else {
        setRole(TetherRole.WITNESS);
        setSentSuccess(false);
    }
  }, [state.valence, state.arousal, mode]);

  useEffect(() => {
    setDemoStream(streamMessages[language]);
  }, [language]);

  // --- HANDLERS ---
  const handleFetchDrifters = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    setHasScanned(false);
    try {
      const users = await getDriftingUsers(currentUser.uid);
      setDriftingUsers(users);
      setHasScanned(true);
      if (users.length === 0) {
        setFeedback({ type: 'error', msg: "No signals detected nearby." });
      }
    } catch (e) {
       console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulatedSend = async () => {
    if (!anchorInput.trim() || !currentUser) return;
    const textToSend = anchorInput.trim();
    setSendWarning("");
    setIsProcessing(true);

    // 1) Local first-line safety net (works even if the AI guardian is unreachable).
    const badLocal = /(去死|自杀|自残|杀了你|滚蛋|傻[逼比屄]|贱人|微信号|加我微信|我的电话|手机号|qq号|kill yourself|\bkys\b)/i;
    if (badLocal.test(textToSend)) {
      setSendWarning(zh ? '这句话可能会让人更难受，也不会被送出。换一句温柔的话好吗？💗' : "This might hurt someone and won't be sent. Could you try something gentler? 💗");
      setIsProcessing(false);
      return;
    }

    // 2) AI Guardian — STRICT & fail-closed: only send if it explicitly says isSafe.
    //    Any negativity, ambiguity, or an unverifiable/errored check → do NOT send.
    let guard;
    try {
      guard = await moderateContent(textToSend, language);
    } catch {
      guard = { isSafe: false, reason: 'Guardian connection error.' } as any;
    }
    if (guard.isSafe !== true) {
      const connErr = guard.reason === 'Guardian connection error.';
      setSendWarning(
        connErr
          ? (zh ? '现在没法确认这句话，先没有送出。请稍后再试，或换一句更温柔的话 💗' : "Couldn't verify this right now, so it wasn't sent. Please try again in a moment. 💗")
          : (zh ? '这句话不够温柔，没有送出。换一句暖一点、鼓励的话好吗？💗' : "This wasn't warm enough to send. Try something gentler and kinder? 💗") + (guard.reason ? ` ${guard.reason}` : '')
      );
      setIsProcessing(false);
      return;
    }

    // 3) Deliver to a real drifting user if one is online, otherwise to the public wall.
    try {
      const drifters = await getDriftingUsers(currentUser.uid);
      const targetUid = drifters.length > 0 ? drifters[0].uid : 'wall';
      await sendTetherMessage({ uid: currentUser.uid, name: currentUser.username }, targetUid, textToSend, 'human');
    } catch (e) { console.warn('send failed', e); }

    try { localStorage.setItem('tether_last_action', 'helped'); } catch {}
    (window as any).gtag?.('event', 'tether_send_message');
    setSentSuccess(true);
    setAnchorInput("");
    setIsProcessing(false);
  };

  const handleResetAnchor = () => {
    setSentSuccess(false);
    setTargetDescriptor(TARGET_DESCRIPTORS[Math.floor(Math.random() * TARGET_DESCRIPTORS.length)]);
    setAnchorInput("");
    // We stay in Anchored state, just resetting the form
  };
  
  // Back to home (Neutral state)
  const handleBackToHome = () => {
      // Gentle pulse before returning
      setIsPulsing(true);
      setTimeout(() => {
          setIsPulsing(false);
          setSentSuccess(false);
          setAnchorInput("");
          setState(INITIAL_STATE);
          setRole(TetherRole.WITNESS);
      }, 1500); // Wait 1.5s then reset
  };

  // Toggle a heart on/off.
  const handleVote = (msgId: string) => {
    const newSet = new Set(votedIds);
    if (newSet.has(msgId)) {
      unvoteForMessage(msgId);
      newSet.delete(msgId);
    } else {
      voteForMessage(msgId);
      newSet.add(msgId);
    }
    setVotedIds(newSet);
    localStorage.setItem('tether_voted_ids', JSON.stringify(Array.from(newSet)));
  };

  const handleLogout = () => {
    localStorage.removeItem('tether_uid');
    localStorage.removeItem('tether_username');
    localStorage.removeItem('tether_auto_enter');
    localStorage.removeItem('tether_voted_ids');
    setCurrentUser(null);
    setVotedIds(new Set());
    setState(INITIAL_STATE);
    setPhase('welcome');
    setStep('checkin');
    setShowWall(false); setShowHistory(false); setShowSafety(false);
    setShowLanding(true);
  };

  const theme = {
    text: 'text-white',
    uiBorder: 'border-white/30',
    accent: 'text-white drop-shadow-md'
  };

  const getRoleLabel = () => {
    if (role === TetherRole.DRIFTING) return t.roleDrifting;
    if (role === TetherRole.ANCHORED) return t.roleAnchored;
    return t.roleWitness;
  };

  // Determine dynamic title for Drifting State
  const getDriftingTitle = () => {
    if (inbox.length > 0 || localAiMessage) {
      const lastMsg = localAiMessage || inbox[inbox.length - 1];
      if (lastMsg?.type === 'ai') return zh ? "有人在陪着你啦。" : "AI COMPANION IS HERE WITH YOU.";
      return zh ? "有人回应你啦。" : "CONNECTION ESTABLISHED.";
    }
    return t.driftingTitle;
  };

  // Combine real inbox with local fallback for display
  const displayInbox = [...inbox];
  if (localAiMessage && inbox.length === 0) {
    displayInbox.push(localAiMessage);
  }

  const moodNow = state.valence < 40 ? (zh ? '有点低落' : 'a bit low')
    : state.valence > 60 ? (zh ? '还不错' : 'okay')
    : (zh ? '平平的' : 'so-so');

  // A gentle "I see you" reflection — affect labeling / validation of the current state.
  const reflection = (() => {
    const { valence: v, arousal: a, body: b } = state;
    if (b < 30) return zh ? '身体好像很不舒服。先轻轻地，陪着它就好，不用做什么。' : "Your body seems to be hurting. Just stay gently with it — nothing to fix.";
    if (v < 40 && a > 55) return zh ? '此刻你心里有点乱、有点撑着。能感觉到你在硬扛——我看见了。' : "It feels tight and restless in there. I can tell you're holding a lot — I see it.";
    if (v < 40) return zh ? '此刻你有点沉、有点累。被这样看见，也没关系，慢慢来。' : "It feels heavy and tired right now. It's okay to be seen like this. Take your time.";
    if (v > 60) return zh ? '此刻你心里有一点光。真好——让自己好好感受一下。' : "There's a little light in you right now. That's lovely — let yourself feel it.";
    return zh ? '此刻平平的，没什么特别。这样也很好，不用勉强。' : "Right now feels ordinary, nothing special. That's okay too — no need to force anything.";
  })();

  return (
    <>
      {showLanding && <LandingOverlay onEnter={handleLogin} language={language} setLanguage={setLanguage} />}

      {currentUser && !showLanding && phase === 'welcome' && (
        <WelcomeBack
          username={currentUser.username}
          language={language}
          healingScore={userHealingScore}
          remembered={typeof localStorage !== 'undefined' && localStorage.getItem('tether_auto_enter') === 'true'}
          lastAction={(typeof localStorage !== 'undefined' ? localStorage.getItem('tether_last_action') : null) as 'sad' | 'helped' | null}
          onContinue={() => { setStep('checkin'); setPhase('main'); }}
        />
      )}

      {showSafety && <SafetyNet language={language} onClose={() => setShowSafety(false)} />}

      {showWall && (
        <WallPanel
          messages={wallMessages.length > 0 ? wallMessages : demoStream}
          votedIds={votedIds}
          onVote={handleVote}
          language={language}
          onClose={() => setShowWall(false)}
        />
      )}

      <HistoryPanel 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        userId={currentUser?.uid || null} 
        healingScore={userHealingScore} 
        labels={{ healingPower: t.healingPower, yourImpact: t.yourImpact }}
      />

      <div 
        className={`relative min-h-screen w-full transition-[background-color] duration-500 ease-linear flex flex-col items-center ${theme.text} font-mono selection:bg-white/30`}
        style={{ backgroundColor: bgColor }}
      >
        {/* Film Grain */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.15] z-0 mix-blend-overlay"
             style={{ 
               backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
             }}
        ></div>

        {!showLanding && (
          <>
            {/* Header */}
            <header className="w-full p-4 md:p-8 flex flex-col md:flex-row justify-between items-center z-10 opacity-90 gap-4">
              <div className="flex items-center gap-4">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
                  <circle cx="75" cy="25" r="12" strokeWidth="6" style={{ stroke: 'var(--rose)' }} />
                  <circle cx="25" cy="75" r="10" stroke="none" style={{ fill: 'var(--rose)' }} />
                  <path d="M25 75 C 25 45 55 25 63 25" strokeWidth="4" className="opacity-80" />
                </svg>
                <h1 className="text-xl tracking-[0.3em] font-bold drop-shadow-sm">TETHER</h1>
              </div>
              
              <div className="flex items-center gap-6">
                 <button onClick={() => setShowWall(true)} className="opacity-70 hover:opacity-100 transition-opacity" title={zh ? '大家的暖心话' : 'Wall of kind words'}>
                    <Sparkles size={18} />
                 </button>

                 <button onClick={toggleSound} className={`transition-opacity ${soundOn ? 'opacity-70 hover:opacity-100' : 'opacity-40 hover:opacity-70'}`} title={soundOn ? (zh ? '关闭疗愈音' : 'Sound on') : (zh ? '开启疗愈音' : 'Sound off')} aria-pressed={soundOn}>
                    {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                 </button>

                 <button onClick={toggleMode} className="opacity-70 hover:opacity-100 transition-opacity" title={mode === 'day' ? '夜间模式' : '日间模式'}>
                    {mode === 'day' ? <Moon size={18} /> : <Sun size={18} />}
                 </button>

                 <button onClick={() => setShowHistory(true)} className="opacity-70 hover:opacity-100 transition-opacity relative">
                    <BookOpen size={18} />
                    {hasNewHealing && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                    )}
                 </button>

                 <button onClick={handleLogout} className="flex items-center gap-1.5 text-[11px] tracking-widest uppercase opacity-80 hover:opacity-100 transition-opacity border border-white/40 rounded-full px-3 py-1.5" title={zh ? '离开 Tether' : 'Leave Tether'}>
                    <LogOut size={14} /> <span>{zh ? '离开' : 'Leave'}</span>
                 </button>

                <div className="text-xs tracking-widest uppercase border border-white/50 px-2 py-1 rounded-sm backdrop-blur-sm">
                  {t.status}: {getRoleLabel()}
                </div>
              </div>
            </header>

            {/* Intro */}
          </>
        )}

        {/* Main Content — a gentle 3-step ritual (check-in → respond → breathe) */}
        <main className={`flex-1 w-full max-w-2xl px-5 md:px-8 flex flex-col items-center justify-start gap-8 mt-2 z-10 pb-20 transition-opacity duration-1000 ${showLanding ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

          {/* ===== STEP 1 — CHECK IN ===== */}
          {step === 'checkin' && (
          <div className="w-full flex flex-col items-center gap-7 animate-in fade-in duration-700">
            <p className="text-center text-lg md:text-xl font-serif italic opacity-90 max-w-sm leading-relaxed">
              {zh ? '此刻，你的内心是什么天气?' : "What's your inner weather right now?"}
            </p>

            <div className="relative filter drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] flex justify-center">
               <OrbCanvas state={state} isHealing={isHealing} isPulsing={isPulsing} />
               {isHealing && (
                 <div className="absolute bottom-4 flex items-center gap-2 text-white/40 animate-pulse">
                    <Volume2 size={12} />
                    <span className="text-[9px] tracking-widest uppercase">{zh ? '双耳疗愈音已开启' : 'Binaural Drone Active'}</span>
                 </div>
               )}
            </div>

            <div className="relative w-full max-w-md">
              <Controls
                state={state}
                onChange={setState}
                textColor={theme.text}
                labels={{
                  valence: t.valence, arousal: t.arousal, body: t.body,
                  unpleasant: t.unpleasant, pleasant: t.pleasant,
                  lowEnergy: t.lowEnergy, highEnergy: t.highEnergy,
                  shattered: t.shattered, whole: t.whole,
                }}
              />
              {!hasInteracted && (
                <div className="pointer-events-none absolute inset-0 -top-8 flex flex-col items-center justify-start z-10 animate-in fade-in duration-1000">
                   <div className="bg-teal-900/80 border border-teal-400/30 text-teal-100 text-xs tracking-widest uppercase py-2 px-4 rounded-full shadow-lg backdrop-blur-md animate-bounce">
                     {zh ? '滑动，让环境与你的内在同步。' : 'Slide to sync the environment with your inner world.'}
                   </div>
                   <div className="w-px h-8 bg-gradient-to-b from-teal-400/50 to-transparent"></div>
                </div>
              )}
            </div>

            <button onClick={() => setStep('reflect')} className="group mt-2 flex items-center gap-3 px-9 py-3.5 rounded-full text-sm tracking-widest transition-all duration-500" style={{ background: 'var(--rose)', color: '#2b2420' }}>
              <span className="font-bold">{zh ? '就先这样，继续' : 'Continue'}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          )}

          {/* ===== STEP 1.5 — REFLECT (a gentle "I see you" moment) ===== */}
          {step === 'reflect' && (
          <div className="w-full max-w-md flex flex-col items-center text-center gap-9 py-6 animate-in fade-in duration-700">
            <div className="relative scale-90 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.12)]">
              <OrbCanvas state={state} isHealing={isHealing} isPulsing={isPulsing} />
            </div>
            <p className="text-lg md:text-xl font-serif italic opacity-90 leading-relaxed">{reflection}</p>
            <button onClick={() => setStep('respond')} className="group flex items-center gap-3 px-8 py-3 rounded-full text-sm tracking-widest border border-white/25 hover:bg-white/5 transition-all">
              <span>{zh ? '嗯，继续' : 'Okay, continue'}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          )}

          {/* ===== STEP 2 — RESPOND (branches by mood) ===== */}
          {step === 'respond' && (
          <div className="w-full max-w-xl flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <button onClick={() => setStep('checkin')} className="self-start flex items-center gap-2 text-xs opacity-55 hover:opacity-100 transition-opacity">
              <ArrowLeft size={13} /> {zh ? `此刻：${moodNow}` : `Now: ${moodNow}`} · {zh ? '调整' : 'adjust'}
            </button>

            {/* --- DRIFTING (RECEIVER) --- */}
            {role === TetherRole.DRIFTING && (
              <div id="drifting-container" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 w-full">
                <h2 className={`text-2xl font-bold ${theme.accent} transition-all duration-500`}>
                    {getDriftingTitle()}
                </h2>
                <p className="opacity-90 text-sm leading-relaxed drop-shadow-sm">{t.driftingDesc}</p>

                <button onClick={() => setShowSafety(true)} className="w-full text-left flex items-center gap-3 p-4 rounded-xl glass-panel hover:bg-white/10 transition-colors">
                  <Heart size={16} className="shrink-0 text-teal-300" />
                  <span className="text-[13px] leading-relaxed opacity-90">
                    {zh ? '如果此刻真的撑不住，有人可以真的帮你。点这里 →' : "If it's really too much right now, real people can help. Tap here →"}
                  </span>
                </button>

                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2 mt-4">
                  {/* Strict Logic: Show Loader if Empty AND no Local Fallback. Show Message if either exists. */}
                  {displayInbox.length === 0 ? (
                    // --- LOADING CIRCLE ---
                    <div id="loading-circle" className="flex flex-col items-center justify-center h-64 transition-all duration-1000 animate-in fade-in">
                       <div className="relative flex items-center justify-center mb-8">
                          {/* Outer Ripple */}
                          <div className="absolute inset-0 bg-teal-500/10 rounded-full animate-ping opacity-20 duration-[3000ms] w-16 h-16"></div>
                          {/* Inner Pulse Ring */}
                          <div className="w-16 h-16 border border-teal-500/30 rounded-full animate-[spin_4s_linear_infinite] opacity-50 border-t-transparent"></div>
                          {/* Core Dot */}
                          <div className="absolute w-1.5 h-1.5 bg-teal-100 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.8)] animate-pulse"></div>
                       </div>
                       <span className="text-[10px] tracking-[0.3em] font-bold text-teal-100/70 animate-pulse">{zh ? '正在为你找人陪陪你…' : 'SEARCHING FOR A TETHER...'}</span>
                    </div>
                  ) : (
                    // --- AI MESSAGE BOX (Force Reveal) ---
                    <div id="ai-message-box" className="visible">
                      {displayInbox.map((msg) => (
                        <MessageCard 
                          key={msg.id} 
                          msg={msg} 
                          onVote={handleVote} 
                          isVoted={votedIds.has(msg.id)}
                          theme={theme}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- WITNESS (COMMUNITY) --- */}
            {role === TetherRole.WITNESS && (
              <div className="space-y-6 w-full animate-in fade-in slide-in-from-right-4 duration-700">
                <div>
                  <h2 className={`text-xl font-bold ${theme.accent} mb-2`}>{t.witnessTitle}</h2>
                  <p className="text-xs uppercase tracking-widest opacity-70">{t.communityStream}</p>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                  <div className="p-5 border border-white/10 bg-white/5 rounded-sm shadow-inner relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-2 opacity-30">
                        <Sparkles size={16} />
                     </div>
                     <p className="text-sm opacity-90 text-center italic font-serif leading-relaxed">
                        "{spotlightMessage ? spotlightMessage.text : t.defaultWisdom}"
                     </p>
                     <div className="flex justify-center mt-3 opacity-50 text-[10px] uppercase tracking-widest gap-2">
                        <span>{zh ? '最高共鸣' : 'Highest Resonance'}</span>
                        {spotlightMessage && <span>• {spotlightMessage.voteCount} {zh ? '颗心' : 'Hearts'}</span>}
                     </div>
                  </div>

                  {(wallMessages.length > 0 ? wallMessages : demoStream).map((msg) => {
                    const real = wallMessages.length > 0;
                    const voted = votedIds.has(msg.id);
                    const named = msg.senderName && !['Guide', '小伙伴', 'AI Companion'].includes(msg.senderName);
                    return (
                    <div key={msg.id} className={`p-4 border ${theme.uiBorder} bg-white/5 backdrop-blur-md rounded-sm transition-all`}>
                      <p className="text-sm font-serif italic mb-3 drop-shadow-sm">"{msg.text}"</p>
                      <div className="flex justify-between items-center mt-2 text-[10px] opacity-60">
                        <span className="tracking-widest">{named ? `— ${msg.senderName}` : ''}</span>
                        <button
                          disabled={!real}
                          onClick={() => real && handleVote(msg.id)}
                          title={voted ? (zh ? '取消爱心' : 'remove heart') : (zh ? '给它一颗心' : 'send a heart')}
                          className={`flex items-center gap-1 transition-colors ${voted ? 'text-teal-300' : real ? 'hover:text-teal-200 cursor-pointer' : 'cursor-default'}`}
                        >
                          <span>{msg.voteCount || 0}</span>
                          <Heart size={11} className={voted ? 'fill-current' : 'fill-white/40'} />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- ANCHORED (HELPER) - UPDATED SIMULATION --- */}
            {role === TetherRole.ANCHORED && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 h-full flex flex-col justify-center">
                
                {sentSuccess ? (
                    // SUCCESS / THANK YOU SCREEN
                    <div className="flex flex-col items-center justify-center text-center space-y-8 py-8 animate-in fade-in zoom-in-95 duration-1000">
                        <div className="relative">
                            <Sparkles className="text-teal-200 animate-pulse filter drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]" size={56} />
                            <div className="absolute inset-0 bg-teal-400/20 blur-xl rounded-full animate-ping"></div>
                        </div>
                        
                        <div className="space-y-4 max-w-sm mx-auto">
                            <h2 className="text-2xl font-bold text-teal-100 tracking-[0.3em] uppercase">{zh ? '已送达 💗' : 'Tethered'}</h2>
                            <p className="text-lg font-serif italic text-white/80 leading-relaxed">
                                {zh ? '"你的暖心话已经送出去啦，会有人因为你而好受一点。谢谢你 💗"' : '"Your message has been tethered. Your light is now reaching a drifter in the fog. Thank you for your empathy."'}
                            </p>
                        </div>

                        <button 
                            onClick={handleBackToHome}
                            className="group flex items-center gap-3 px-8 py-3 mt-4 border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all rounded-sm uppercase tracking-widest text-xs"
                        >
                            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                            <span>{zh ? '回到中心' : 'Return to Center'}</span>
                        </button>
                    </div>
                ) : (
                    // SEND MESSAGE SCREEN (SIMULATED TARGET)
                    <div className="animate-in fade-in duration-700">
                        <h2 className={`text-3xl font-bold ${theme.accent} mb-4`}>{t.anchoredTitle}</h2>
                        
                        <p className="text-sm opacity-70 mb-6 flex items-center gap-2 animate-pulse">
                            <span className="w-2 h-2 bg-teal-400 rounded-full shadow-[0_0_8px_rgba(45,212,191,0.8)]"></span>
                            {zh ? '你正在陪伴一位此刻有点难过的人…' : <>You are connecting with a stranger who feels <span className="text-teal-300 font-bold uppercase tracking-widest text-base">{targetDescriptor}</span>...</>}
                        </p>

                        <div className="relative">
                            <textarea
                                value={anchorInput}
                                onChange={(e) => { setAnchorInput(e.target.value); if (sendWarning) setSendWarning(""); }}
                                placeholder={t.placeholder}
                                className={`w-full h-40 bg-black/20 border-2 ${sendWarning ? 'border-rose-400/60' : theme.uiBorder} p-6 focus:outline-none focus:ring-1 focus:ring-teal-400/50 focus:border-teal-400/50 text-lg resize-none placeholder:text-white/20 rounded-sm backdrop-blur-sm transition-all`}
                            />
                            <button
                                id="send-button"
                                onClick={handleSimulatedSend}
                                disabled={isProcessing || !anchorInput.trim()}
                                className={`absolute bottom-4 right-4 p-3 bg-white/10 hover:bg-teal-900/40 border border-white/10 hover:border-teal-400/50 hover:scale-110 transition-all rounded-full disabled:opacity-30 text-white shadow-lg`}
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                            </button>
                        </div>
                        {sendWarning && (
                          <div className="mt-4 flex items-start gap-2 text-[13px] text-rose-200/90 bg-rose-900/20 border border-rose-400/25 rounded-lg px-4 py-3 animate-in fade-in duration-300">
                            <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{sendWarning}</span>
                          </div>
                        )}
                    </div>
                )}
              </div>
            )}

            <button onClick={() => setStep('close')} className="self-center mt-3 flex items-center gap-3 px-8 py-3 rounded-full text-sm tracking-widest border border-white/20 hover:bg-white/5 transition-colors">
              <span>{zh ? '好了，歇一会儿' : 'Take a breath'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
          )}

          {/* ===== STEP 3 — CLOSE (breathe + thanks) ===== */}
          {step === 'close' && (
          <div className="w-full max-w-md flex flex-col items-center text-center gap-8 py-6 animate-in fade-in duration-700">
            <p className="text-lg md:text-xl font-serif italic opacity-90 leading-relaxed">
              {zh ? '离开前，陪自己慢慢呼吸一会儿。' : 'Before you go, breathe slowly with yourself.'}
            </p>
            <div className="relative flex items-center justify-center w-56 h-56">
               <div className="w-28 h-28 rounded-full animate-breathe" style={{ background: 'var(--rose)', filter: 'blur(3px)' }} />
               <span className="absolute text-[10px] tracking-[0.35em] uppercase opacity-55">{zh ? '慢慢呼吸' : 'breathe'}</span>
            </div>
            <p className="text-[15px] opacity-80 leading-relaxed whitespace-pre-line">
              {zh ? '今天也谢谢你来。\n你已经好好陪了自己一会儿。' : 'Thank you for coming today.\nYou stayed with yourself for a while.'}
            </p>
            <button onClick={() => setStep('checkin')} className="mt-1 px-7 py-2.5 rounded-full text-xs tracking-widest border border-white/20 hover:bg-white/5 transition-colors">
              {zh ? '再看看自己' : 'Check in again'}
            </button>
          </div>
          )}

          {/* always-reachable crisis support */}
          <button onClick={() => setShowSafety(true)} className="mt-10 text-[11px] tracking-widest opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <Heart size={11} /> {zh ? '需要真人帮助' : 'Talk to a real person'}
          </button>
        </main>

      </div>
    </>
  );
}