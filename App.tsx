import React, { useState, useEffect, useRef } from 'react';
import { TetherState, TetherRole, Message, Language, UserProfile } from './types';
import { saveUserSession, loadUserSession, establishUserSession, clearUserSessionToken, getDriftingUsers, sendTetherMessage, voteForMessage, unvoteForMessage, listenToWall } from './services/firebase';
import { startHealingDrone, stopHealingDrone, unlockAudio } from './services/audioService';
import { vibrate, stopVibration } from './services/haptics';
import { getTranslation, streamMessages, aiFallbackMessages } from './translations';
import OrbCanvas from './components/OrbCanvas';
import Controls from './components/Controls';
import LandingOverlay from './components/LandingOverlay';
import HistoryPanel from './components/HistoryPanel';
import { JourneyLog } from './components/JourneyLog';
import ResetKit from './components/ResetKit';
import { appendJournal } from './services/journal';
import { appendSent } from './services/sent';
import { MessageCard } from './components/MessageCard';
import WelcomeBack from './components/WelcomeBack';
import SafetyNet from './components/SafetyNet';
import WallPanel from './components/WallPanel';
import FeedbackWidget from './components/FeedbackWidget';
import EmotionSpaces from './components/EmotionSpaces';
import { Send, Heart, ShieldAlert, Loader2, BookOpen, Users, Sparkles, Volume2, VolumeX, Radio, Globe, ArrowLeft, ArrowRight, Sun, Moon, LogOut, LifeBuoy } from 'lucide-react';

const INITIAL_STATE: TetherState = {
  valence: 50,
  arousal: 50,
};

const TARGET_DESCRIPTORS = ["HEAVY", "COLD", "BRITTLE", "HOLLOW", "SILENT", "LOST", "FADING", "SHATTERED", "DARK"];

// The environment colour still shifts with mood, but within a restrained warm-Morandi
// range per theme (light lotus pastels by day, deep warm tones by night) so it never
// clashes with the calm palette. Corners map to the valence×arousal quadrants.
const MOOD_CORNERS = {
  // Warm-neutral corners that sit gently around each theme's base so the "weather" tints
  // the room without ever clashing with the calm ground. Quadrants: tl storm, tr sun,
  // bl rain, br clear.
  day:   { tl: [206, 190, 182], tr: [222, 206, 186], bl: [198, 192, 184], br: [220, 206, 190] },
  night: { tl: [76, 62, 54],    tr: [92, 74, 56],    bl: [64, 60, 56],    br: [96, 82, 62] },
};

export default function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncViewport = () => {
      // Keep overlays above the software keyboard without interfering with pinch zoom.
      if (viewport.scale !== 1) return;
      document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`);
      document.documentElement.style.setProperty('--visible-top', `${viewport.offsetTop}px`);
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
      document.documentElement.style.removeProperty('--visible-height');
      document.documentElement.style.removeProperty('--visible-top');
    };
  }, []);
  // Session State
  const [currentUser, setCurrentUser] = useState<{uid: string, username: string} | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSafety, setShowSafety] = useState(false);   // crisis-support screen
  const [showKit, setShowKit] = useState(false);         // reset kit + emotion journal
  const [showWall, setShowWall] = useState(false);       // always-on "kind words" wall
  // Post-login flow: 'welcome' (a calm "remember you" screen) → 'main' (the dashboard).
  const [phase, setPhase] = useState<'welcome' | 'main'>('welcome');
  // Within the main phase, a gentle 3-step ritual instead of one dense dashboard.
  const [step, setStep] = useState<'checkin' | 'reflect' | 'respond' | 'close'>('checkin');
  const checkinRecorded = useRef(false);

  // App State
  const [state, setState] = useState<TetherState>(INITIAL_STATE);
  const [role, setRole] = useState<TetherRole>(TetherRole.WITNESS);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('tether_lang') : null;
    if (saved === 'zh' || saved === 'en') return saved as Language;
    return (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('zh')) ? 'zh' : 'en';
  });
  // Change language and remember it, so the choice sticks (and can be toggled in-app, not just on the landing screen).
  const changeLang = (lang: Language) => { setLanguage(lang); try { localStorage.setItem('tether_lang', lang); } catch {} };
  const [bgColor, setBgColor] = useState<string>('rgb(0,0,0)');

  // --- Day / Night theme (defaults to the calm warm-dark "night"; manual toggle locks it) ---
  const getInitialMode = (): 'day' | 'night' => {
    const locked = localStorage.getItem('tether.theme') || localStorage.getItem('tether_theme');
    if (locked === 'day' || locked === 'night') return locked;
    return 'night';
  };
  const [mode, setMode] = useState<'day' | 'night'>(getInitialMode);
  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
  const toggleMode = () => {
    const m = mode === 'day' ? 'night' : 'day';
    setMode(m);
    localStorage.setItem('tether.theme', m);
    localStorage.removeItem('tether_theme');
  };
  // Sound on/off for the healing drone (persisted). Default OFF — many users open this in
  // class or in public, where a surprise drone is jarring; they can turn it on deliberately.
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem('tether_sound') === 'on');
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
  const [wallLoaded, setWallLoaded] = useState(false);   // false until the first fetch comes back
  const wallRef = useRef<Message[]>([]);
  useEffect(() => { wallRef.current = wallMessages; }, [wallMessages]); // latest wall, readable inside the drift timer
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
    let cancelled = false;

    const restore = async () => {
      if (!session.uid || !session.username) {
        setShowLanding(true);
        return;
      }
      const uid = await establishUserSession(session.uid);
      if (cancelled) return;
      if (uid !== session.uid) saveUserSession(uid, session.username);
      setCurrentUser({ uid, username: session.username });
      setShowLanding(!autoEnter);
    };
    restore();
    
    const storedVotes = localStorage.getItem('tether_voted_ids');
    if (storedVotes) {
      setVotedIds(new Set(JSON.parse(storedVotes)));
    }
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (username: string, autoEnter: boolean) => {
    if (!username.trim()) {
      setCurrentUser(null);
      setPhase('main');
      setStep('respond');
      setShowLanding(false);
      return;
    }
    // Only keep the stored identity (and its history / sent-message record) if this is
    // genuinely the same person: they typed the same name, or they'd previously chosen
    // "remember my identity". A different name on a shared browser starts fresh, so nobody
    // inherits someone else's encouragements or impact.
    const existingUid = localStorage.getItem('tether_uid');
    const existingUsername = localStorage.getItem('tether_username');
    const rememberedBefore = localStorage.getItem('tether_auto_enter') === 'true';
    const sameIdentity = !!existingUid && (
      rememberedBefore ||
      (!!existingUsername && existingUsername.trim().toLowerCase() === username.trim().toLowerCase())
    );
    const uid = await establishUserSession(sameIdentity ? existingUid : null);

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
    // Feeling low (low valence) gently drops the space into a soothing "healing" state.
    const healing = !showLanding && state.valence < 35;
    setIsHealing(healing);
    if (healing && soundOn) {
       startHealingDrone();
    } else {
       stopHealingDrone();
    }
    // A soft, calming pulse the moment you drop into healing (Android only — iOS has no web vibration).
    if (healing && soundOn && !wasHealingRef.current) vibrate([0, 40, 130, 40]);
    wasHealingRef.current = healing;
  }, [state.valence, showLanding, soundOn]);

  // Breathing haptic on the closing "breathe with me" step: one soft pulse at the
  // start of each 8s breath cycle (matches the .animate-breathe animation). Android only.
  useEffect(() => {
    if (showLanding || step !== 'close') return;
    const pulse = () => vibrate([0, 55, 220, 30]);
    pulse();
    const id = setInterval(pulse, 8000);
    return () => { clearInterval(id); stopVibration(); };
  }, [step, showLanding]);


  // --- TRACK INTERACTION FOR NUDGE ---
  useEffect(() => {
    if (!hasInteracted && (state.valence !== 50 || state.arousal !== 50)) {
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
    appendJournal({ id: Date.now(), timestamp: Date.now(), valence: state.valence, arousal: state.arousal, message: word });
  }, [phase, hasInteracted, state, zh]);

  useEffect(() => {
    if (showLanding || !showWall) return;
    return listenToWall((msgs) => { setWallMessages(msgs); setWallLoaded(true); });
  }, [showLanding, showWall]);

  // Clear notification when history opens
  useEffect(() => {
    if (showHistory) setHasNewHealing(false);
  }, [showHistory]);


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

    // Local first-line safety net for immediate feedback. The server repeats this check
    // and runs the authoritative Guardian moderation before writing anything to the wall.
    const badLocal = /(去死|自杀|自残|杀了你|滚蛋|傻[逼比屄]|贱人|微信号|加我微信|我的电话|手机号|qq号|kill yourself|\bkys\b)/i;
    if (badLocal.test(textToSend)) {
      setSendWarning(zh ? '这句话可能会让人更难受，也不会被送出。换一句温柔的话好吗？💗' : "This might hurt someone and won't be sent. Could you try something gentler? 💗");
      setIsProcessing(false);
      return;
    }

    // Deliver to a real drifting user if one is online, otherwise to the public wall.
    let sentTarget = 'wall';
    const justSentId = `local-${Date.now()}`;
    try {
      const drifters = await getDriftingUsers(currentUser.uid);
      const targetUid = drifters.length > 0 ? drifters[0].uid : 'wall';
      sentTarget = targetUid === 'wall' ? 'wall' : 'someone';
      await sendTetherMessage(
        { uid: currentUser.uid, name: currentUser.username },
        targetUid,
        textToSend,
        'human',
        language === 'en' ? 'en' : 'zh',
      );

      // Show it on the wall straight away. The wall refreshes on a 6-second poll, so
      // without this you can send something, open the wall to check, and not find it —
      // which reads as "it didn't go through". The next poll replaces the whole list with
      // the server's, which by then contains the stored copy, so this stand-in is transient.
      setWallMessages((prev) => {
        if (prev.some((m) => m.id === justSentId)) return prev;
        return [{
          id: justSentId,
          text: textToSend,
          senderName: currentUser.username,
          senderId: currentUser.uid,
          targetId: targetUid,
          timestamp: Date.now(),
          voteCount: 0,
          type: 'human',
        }, ...prev];
      });
      setWallLoaded(true);
    } catch (e: any) {
      console.warn('send failed', e);
      const blocked = e?.code === 'blocked';
      setSendWarning(
        blocked
          ? (zh ? '这句话不够温柔，没有送出。换一句暖一点、鼓励的话好吗？💗' : "This wasn't warm enough to send. Try something gentler and kinder? 💗") + (e?.reason ? ` ${e.reason}` : '')
          : (zh ? '现在没法确认这句话，先没有送出。请稍后再试。💗' : "Couldn't verify this right now, so it wasn't sent. Please try again in a moment. 💗")
      );
      setIsProcessing(false);
      return;
    }

    // Keep a private record of the kind words YOU sent, tagged with your identity so only
    // you see them back (a different person on this browser won't inherit them).
    appendSent({ id: Date.now(), timestamp: Date.now(), text: textToSend, target: sentTarget });

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
    clearUserSessionToken();
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
    return step === 'respond' ? (zh ? '情绪空间' : 'Emotion spaces') : moodNow;
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
    const { valence: v, arousal: a } = state;
    if (v < 40 && a > 55) return zh ? '此刻你心里有点乱、有点撑着。能感觉到你在硬扛——我看见了。' : "It feels tight and restless in there. I can tell you're holding a lot — I see it.";
    if (v < 40) return zh ? '此刻你有点沉、有点累。被这样看见，也没关系，慢慢来。' : "It feels heavy and tired right now. It's okay to be seen like this. Take your time.";
    if (v > 60) return zh ? '此刻你心里有一点光。真好——让自己好好感受一下。' : "There's a little light in you right now. That's lovely — let yourself feel it.";
    return zh ? '此刻平平的，没什么特别。这样也很好，不用勉强。' : "Right now feels ordinary, nothing special. That's okay too — no need to force anything.";
  })();

  return (
    <>
      {showLanding && <LandingOverlay onEnter={handleLogin} language={language} setLanguage={changeLang} />}

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
          messages={wallMessages}
          loading={!wallLoaded}
          votedIds={votedIds}
          onVote={handleVote}
          language={language}
          onClose={() => setShowWall(false)}
          myUid={currentUser?.uid}
        />
      )}

      {showKit && (
        <ResetKit
          language={language}
          version={journeyVersion}
          onClose={() => setShowKit(false)}
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
        inert={showLanding || phase === 'welcome'}
        className={`app-shell relative min-h-screen w-full transition-[background-color] duration-500 ease-linear flex flex-col items-center ${theme.text} font-mono selection:bg-white/30`}
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
            <header className="app-header w-full px-4 py-3 md:p-8 grid grid-cols-[1fr_auto] md:flex md:flex-row md:justify-between items-center z-10 opacity-90 gap-x-3 gap-y-2 md:gap-6">
              <div className="order-1 flex items-center gap-3 md:gap-4">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 md:w-10 md:h-10 opacity-90">
                  <circle cx="75" cy="25" r="12" strokeWidth="6" style={{ stroke: 'var(--rose)' }} />
                  <circle cx="25" cy="75" r="10" stroke="none" style={{ fill: 'var(--rose)' }} />
                  <path d="M25 75 C 25 45 55 25 63 25" strokeWidth="4" className="opacity-80" />
                </svg>
                <h1 className="text-xl tracking-[0.3em] font-bold drop-shadow-sm">TETHER</h1>
              </div>
              
              <div className="order-3 col-span-2 md:order-2 md:col-span-1 md:ml-auto flex items-center justify-center gap-5 md:gap-6">
                 <button onClick={() => setShowKit(true)} className="flex items-center gap-1.5 text-[11px] tracking-widest uppercase opacity-90 hover:opacity-100 transition-opacity rounded-full px-2.5 sm:px-3 py-1.5" style={{ background: 'rgb(var(--tint) / 0.14)', color: 'var(--rose)' }} title={zh ? '急救工具箱 · 情绪足迹' : 'Reset kit · your journey'} aria-label={zh ? '急救工具箱 · 情绪足迹' : 'Reset kit · your journey'}>
                    <LifeBuoy size={15} /> <span className="hidden sm:inline">{zh ? '稳一稳' : 'Reset'}</span>
                 </button>

                 <button onClick={() => setShowWall(true)} className="opacity-70 hover:opacity-100 transition-opacity" title={zh ? '大家的暖心话' : 'Wall of kind words'} aria-label={zh ? '大家的暖心话' : 'Wall of kind words'}>
                    <Sparkles size={18} />
                 </button>

                 <button onClick={toggleSound} className={`transition-opacity ${soundOn ? 'opacity-80 hover:opacity-100' : 'opacity-60 hover:opacity-90'}`} title={soundOn ? (zh ? '关闭疗愈音' : 'Sound on') : (zh ? '开启疗愈音' : 'Sound off')} aria-label={soundOn ? (zh ? '关闭疗愈音' : 'Turn sound off') : (zh ? '开启疗愈音' : 'Turn sound on')} aria-pressed={soundOn}>
                    {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                 </button>

                 <button onClick={toggleMode} className="opacity-70 hover:opacity-100 transition-opacity" title={mode === 'day' ? '夜间模式' : '日间模式'} aria-label={mode === 'day' ? (zh ? '切换到夜间模式' : 'Switch to night mode') : (zh ? '切换到日间模式' : 'Switch to day mode')}>
                    {mode === 'day' ? <Moon size={18} /> : <Sun size={18} />}
                 </button>

                 <button onClick={() => changeLang(zh ? 'en' : 'zh')} className="text-[13px] font-bold tracking-widest opacity-70 hover:opacity-100 transition-opacity" title={zh ? 'Switch to English' : '切换成中文'}>
                    {zh ? 'EN' : '中'}
                 </button>

                 <button onClick={() => setShowHistory(true)} className="opacity-70 hover:opacity-100 transition-opacity relative" aria-label={zh ? '查看情绪足迹' : 'View your journey'}>
                    <BookOpen size={18} />
                    {hasNewHealing && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                    )}
                 </button>

              </div>

              <div className="order-2 md:order-3 flex items-center justify-end gap-2 md:gap-4">
                <button onClick={handleLogout} className="flex items-center gap-1.5 text-[11px] tracking-widest uppercase opacity-80 hover:opacity-100 transition-opacity border border-white/40 rounded-full px-2.5 sm:px-3 py-1.5" title={zh ? '离开 Tether' : 'Leave Tether'} aria-label={zh ? '离开 Tether' : 'Leave Tether'}>
                  <LogOut size={14} /> <span className="hidden sm:inline">{zh ? '离开' : 'Leave'}</span>
                </button>

                <div className="text-[10px] sm:text-xs tracking-widest uppercase border border-white/50 px-2 py-1 rounded-sm backdrop-blur-sm whitespace-nowrap">
                  <span className="hidden sm:inline">{t.status}: </span>{getRoleLabel()}
                </div>
              </div>
            </header>

            {/* Intro */}
          </>
        )}

        {/* Main Content — a gentle 3-step ritual (check-in → respond → breathe) */}
        <main className={`app-main flex-1 w-full max-w-4xl px-5 md:px-8 flex flex-col items-center justify-start gap-8 mt-2 z-10 pb-20 transition-opacity duration-1000 ${showLanding ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

          {/* ===== STEP 1 — CHECK IN ===== */}
          {step === 'checkin' && (
          <div className="checkin-layout w-full max-w-sm md:max-w-3xl mx-auto flex flex-col items-center gap-5 animate-in fade-in duration-700">
            <p className="text-center text-lg md:text-2xl font-serif italic opacity-90 max-w-md leading-relaxed">
              {zh ? '此刻，你的内心是什么天气?' : "What's your inner weather right now?"}
            </p>

            <div className="checkin-instruments w-full flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 lg:gap-14">
              <div className="checkin-orb relative flex justify-center w-44 md:w-56 -my-4 md:my-0 shrink-0">
                 <OrbCanvas state={state} isHealing={isHealing} isPulsing={isPulsing} />
                 {isHealing && soundOn && (
                   <div className="absolute bottom-4 flex items-center gap-2 text-white/40 animate-pulse">
                      <Volume2 size={12} />
                      <span className="text-[9px] tracking-widest uppercase">{zh ? '双耳疗愈音已开启' : 'Binaural Drone Active'}</span>
                   </div>
                 )}
              </div>

              <div className="checkin-controls w-full max-w-[300px] md:max-w-[360px] shrink-0">
                <Controls
                  state={state}
                  onChange={setState}
                  textColor={theme.text}
                  labels={{
                    valence: t.valence, arousal: t.arousal,
                    unpleasant: t.unpleasant, pleasant: t.pleasant,
                    lowEnergy: t.lowEnergy, highEnergy: t.highEnergy,
                  }}
                />
              </div>
            </div>

            <p className={`text-[10px] md:text-[11px] tracking-widest uppercase text-center leading-relaxed max-w-[280px] transition-opacity duration-700 ${hasInteracted ? 'opacity-0' : 'opacity-75 animate-pulse'}`} style={{ color: 'var(--rose)' }}>
              {zh ? '拖动圆点，选出现在的心情和能量' : 'Drag to set your mood and energy'}
            </p>

            <button onClick={() => setStep('respond')} className="group flex items-center gap-3 px-9 py-3.5 rounded-full text-sm tracking-widest transition-all duration-500" style={{ background: 'var(--rose)', color: '#2b2420' }}>
              <span className="font-bold">{zh ? '进入情绪空间' : 'Enter an emotion space'}</span>
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

          {/* Emotion spaces belong to a moment, not to an account or a role. */}
          {step === 'respond' && (
            <EmotionSpaces language={language} state={state} onAdjust={() => setStep('checkin')} onRest={() => setStep('close')} onNeedHelp={() => setShowSafety(true)} />
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
          <button onClick={() => setShowSafety(true)} className="mt-8 text-[11px] tracking-widest opacity-80 hover:opacity-100 transition-opacity flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
            <Heart size={11} /> {zh ? '需要真人帮助' : 'Talk to a real person'}
          </button>
        </main>

      </div>

      {/* feedback is reachable from anywhere in the app, but stays out of the way on the landing screen */}
      {!showLanding && phase === 'main' && (
        <FeedbackWidget
          language={language}
          onNeedHelp={() => setShowSafety(true)}
          onOpenWall={() => setShowWall(true)}
        />
      )}
    </>
  );
}
