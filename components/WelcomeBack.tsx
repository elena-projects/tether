import React, { useMemo } from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import { Language } from '../types';

interface Props {
  username: string;
  language: Language;
  healingScore: number;
  remembered: boolean;                      // did they choose "remember my identity"?
  lastAction: 'sad' | 'helped' | null;      // what they did last time
  onContinue: () => void;
}

interface LogEntry { id: number; timestamp: number; valence: number; arousal: number; message: string; }

// soft dot colour: low valence → muted blue-grey, high → warm rose
const dotColor = (v: number) => {
  const t = Math.max(0, Math.min(1, v / 100));
  const low = [150, 160, 182], high = [212, 150, 158];
  const c = low.map((a, i) => Math.round(a + (high[i] - a) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

const WelcomeBack: React.FC<Props> = ({ username, language, healingScore, remembered, lastAction, onContinue }) => {
  const zh = language === 'zh';

  // Greeting sub-line. If they chose "remember me", reflect what they did last time
  // (helped someone / were having a hard time). Otherwise stay gently neutral.
  const subLine = !remembered
    ? (zh ? '很高兴又见到你。慢慢来，这里只有你和你的感受。' : "Good to see you. No rush — it's just you and how you feel.")
    : lastAction === 'helped'
      ? (zh ? '上次你为别人点亮了一束光。💗 今天的你呢？' : 'Last time you lit someone else up. 💗 And you today?')
      : lastAction === 'sad'
        ? (zh ? '上次你有点难。希望你现在，稍微好了一点点。' : 'Last time was hard. I hope today feels a little softer.')
        : (zh ? '慢慢来，今天也好好陪陪自己。' : 'No rush — be gentle with yourself today.');

  const journey: LogEntry[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('tether_journey_log') || '[]'); } catch { return []; }
  }, []);

  const seen = useMemo(() => {
    const n = parseInt(localStorage.getItem('tether_seen_healing') || '0', 10);
    return isNaN(n) ? 0 : n;
  }, []);

  const isReturning = journey.length > 0;
  // newest is at the front; show up to 9 in left→right time order
  const dots = journey.slice(0, 9).reverse();

  // Weekly recap — a gentle sense of "I kept showing up" + a touch of hope.
  const weekly = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const week = journey.filter((d) => d.timestamp >= weekAgo);
    if (week.length === 0) return null;
    const sunny = week.filter((d) => d.valence > 60).length;
    if (zh) return `过去一周，你来陪了自己 ${week.length} 次` + (sunny > 0 ? `，其中有 ${sunny} 个晴天 🌤` : '。');
    return `You checked in ${week.length} time${week.length === 1 ? '' : 's'} this week` + (sunny > 0 ? `, ${sunny} of them sunny 🌤` : '.');
  }, [journey, zh]);

  const handleContinue = () => {
    try { localStorage.setItem('tether_seen_healing', String(healingScore)); } catch {}
    onContinue();
  };

  const newHearts = healingScore - seen;
  const matterLine = newHearts > 0
    ? (zh ? `你上次留下的暖心话，又有 ${newHearts} 个人收下了。` : `${newHearts} more people kept the kind words you left.`)
    : healingScore > 0
      ? (zh ? `到现在，你已经温暖过 ${healingScore} 个人。` : `So far, you've warmed ${healingScore} people.`)
      : (zh ? '在这里，你也可以成为别人的一束光。' : 'Here, you can be someone else\'s bit of light, too.');

  return (
    <div
      style={{ background: 'var(--bg-base)' }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-white overflow-y-auto animate-in fade-in duration-700"
    >
      {/* soft pink bloom */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] bg-[#e0a6b0] opacity-[0.16] rounded-full blur-[160px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center gap-8 py-16">
        <div>
          <p className="text-xs tracking-[0.35em] uppercase text-white/40 mb-4">
            {(remembered || isReturning) ? (zh ? '欢迎回来' : 'Welcome back') : (zh ? '很高兴见到你' : 'Lovely to meet you')}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-wide">{username}</h1>
          <p className="mt-5 text-[15px] md:text-base text-white/70 leading-relaxed font-serif italic">
            {subLine}
          </p>
        </div>

        {/* emotion trajectory */}
        <div className="w-full">
          <p className="text-[10px] tracking-[0.3em] uppercase text-white/35 mb-4">{zh ? '你的情绪轨迹' : 'Your inner weather'}</p>
          {dots.length > 0 ? (
            <div className="flex items-end justify-center gap-3 h-10">
              {dots.map((d, i) => (
                <div
                  key={d.id}
                  className="rounded-full transition-transform"
                  style={{
                    width: 12, height: 12,
                    background: dotColor(d.valence),
                    boxShadow: `0 0 12px ${dotColor(d.valence)}`,
                    opacity: 0.5 + (i / dots.length) * 0.5,
                  }}
                  title={new Date(d.timestamp).toLocaleDateString()}
                />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-white/40 leading-relaxed">{zh ? '这里会慢慢记下你的每一天 🌱' : 'Your days will gather here, gently 🌱'}</p>
          )}
          {remembered && weekly && <p className="mt-4 text-[13px] text-white/55 leading-relaxed">{weekly}</p>}
        </div>

        {/* mattering card */}
        <div className="w-full glass-panel rounded-2xl px-6 py-5 flex items-center gap-4 text-left">
          <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgb(var(--tint) / 0.08)' }}>
            <Heart size={18} className="text-teal-300" />
          </div>
          <p className="text-[13.5px] text-white/75 leading-relaxed">{matterLine}</p>
        </div>

        <button
          onClick={handleContinue}
          className="group mt-2 flex items-center gap-3 px-9 py-3.5 rounded-full text-sm tracking-widest transition-all duration-500"
          style={{ background: 'var(--rose)', color: '#2b2420' }}
        >
          <span className="font-bold">{zh ? '今天，来看看自己' : 'Check in with yourself'}</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeBack;
