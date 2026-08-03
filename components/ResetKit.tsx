import React, { useEffect, useRef, useState } from 'react';
import { X, Wind, Anchor, Heart, Inbox, ChevronLeft } from 'lucide-react';

// A small "in-the-moment reset" toolkit + your emotion journal, in one place: evidence-based
// micro-tools for when things feel like too much (paced breathing, 5-4-3-2-1 grounding, a
// self-compassion break, worry postponement), sitting above a gentle curve of how you've been
// feeling over time. All solo-usable, no account, no waiting on anyone.

interface LogEntry { id: number; timestamp: number; valence: number; arousal: number; message: string; }

type Props = { language: 'en' | 'zh' | string; onClose: () => void; onUsed?: (tool: string) => void; version?: number };
type Tool = 'menu' | 'breathe' | 'ground' | 'kind' | 'worry';

const ResetKit: React.FC<Props> = ({ language, onClose, onUsed, version = 0 }) => {
  const zh = language === 'zh';
  const [tool, setTool] = useState<Tool>('menu');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    try { setLogs(JSON.parse(localStorage.getItem('tether_journey_log') || '[]')); } catch {}
  }, [version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { tool === 'menu' ? onClose() : setTool('menu'); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, onClose]);

  const items: { key: Tool; icon: React.ReactNode; title: string; sub: string }[] = [
    { key: 'breathe', icon: <Wind size={20} />, title: zh ? '跟着呼吸' : 'Breathe', sub: zh ? '慢下来，几口气就好' : 'Slow down in a few breaths' },
    { key: 'ground', icon: <Anchor size={20} />, title: zh ? '回到当下' : 'Ground', sub: zh ? '5-4-3-2-1，把自己拉回来' : '5-4-3-2-1, come back to now' },
    { key: 'kind', icon: <Heart size={20} />, title: zh ? '善待自己' : 'Be kind' , sub: zh ? '像对朋友一样对自己' : 'Speak to yourself like a friend' },
    { key: 'worry', icon: <Inbox size={20} />, title: zh ? '放下担忧' : 'Set it aside', sub: zh ? '把烦恼写下、先收起来' : 'Write the worry down, put it away' },
  ];

  const enter = (t: Tool) => { setTool(t); onUsed?.(t); };

  return (
    <div className="fixed inset-0 z-[68] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)' }}
           className="w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl shadow-2xl text-white flex flex-col">
        {/* header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
          {tool !== 'menu' && (
            <button onClick={() => setTool('menu')} className="p-1.5 -ml-1.5 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"><ChevronLeft size={18} /></button>
          )}
          <div>
            <h2 className="font-bold">{zh ? '先稳一稳' : 'Steady yourself'}</h2>
            <p className="text-[11px] opacity-50">{zh ? '难受的时候，挑一个陪你几分钟' : 'Pick one to sit with you for a moment'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5">
          {tool === 'menu' && (
            <div className="space-y-3">
              <MoodTrend zh={zh} logs={logs} />
              <p className="text-[11px] tracking-widest uppercase font-bold opacity-40 pt-1 px-1">{zh ? '现在，做点什么' : 'Right now, try one'}</p>
              {items.map((it) => (
                <button key={it.key} onClick={() => enter(it.key)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl glass-panel text-left hover:brightness-125 transition-all">
                  <span className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgb(var(--tint) / 0.10)', color: 'var(--rose)' }}>{it.icon}</span>
                  <span>
                    <span className="block font-bold text-sm">{it.title}</span>
                    <span className="block text-[12px] opacity-60">{it.sub}</span>
                  </span>
                </button>
              ))}
              <RecentNotes zh={zh} logs={logs} />
            </div>
          )}
          {tool === 'breathe' && <Breathe zh={zh} />}
          {tool === 'ground' && <Ground zh={zh} />}
          {tool === 'kind' && <Kind zh={zh} />}
          {tool === 'worry' && <Worry zh={zh} onDone={() => setTool('menu')} />}
        </div>
      </div>
    </div>
  );
};

// ---- Paced breathing (physiological-sigh-ish: in · in · long out) ----
const Breathe: React.FC<{ zh: boolean }> = ({ zh }) => {
  const phases = [
    { label: zh ? '吸气' : 'Breathe in', dur: 4000, scale: 1.6 },
    { label: zh ? '停一下' : 'Hold', dur: 2000, scale: 1.6 },
    { label: zh ? '慢慢呼气' : 'Long exhale', dur: 6000, scale: 0.85 },
  ];
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    ref.current = window.setTimeout(() => {
      setI((p) => { const n = (p + 1) % phases.length; if (n === 0) setCount((c) => c + 1); return n; });
    }, phases[i].dur);
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [i]);
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="relative w-52 h-52 flex items-center justify-center my-2">
        <div className="absolute rounded-full" style={{
          width: 130, height: 130, background: 'var(--rose)', opacity: 0.28,
          transform: `scale(${phases[i].scale})`, transition: `transform ${phases[i].dur}ms ease-in-out` }} />
        <div className="absolute rounded-full border" style={{ width: 150, height: 150, borderColor: 'rgb(var(--tint) / 0.25)' }} />
        <span className="relative text-base font-bold tracking-wide">{phases[i].label}</span>
      </div>
      <p className="text-[13px] opacity-60 mt-3 leading-relaxed max-w-[16rem]">
        {zh ? '跟着圆圈：涨的时候吸气，缩的时候把气慢慢送出去。' : 'Follow the circle — breathe in as it grows, let the air out slowly as it shrinks.'}
      </p>
      {count > 0 && <p className="text-[12px] opacity-40 mt-3">{zh ? `已经陪你 ${count} 轮了` : `${count} calm ${count === 1 ? 'round' : 'rounds'} so far`}</p>}
    </div>
  );
};

// ---- 5-4-3-2-1 grounding ----
const Ground: React.FC<{ zh: boolean }> = ({ zh }) => {
  const steps = zh
    ? [{ n: 5, s: '看到' }, { n: 4, s: '听到' }, { n: 3, s: '摸到' }, { n: 2, s: '闻到' }, { n: 1, s: '尝到' }]
    : [{ n: 5, s: 'can see' }, { n: 4, s: 'can hear' }, { n: 3, s: 'can touch' }, { n: 2, s: 'can smell' }, { n: 1, s: 'can taste' }];
  const [i, setI] = useState(0);
  const done = i >= steps.length;
  return (
    <div className="flex flex-col items-center text-center py-6 min-h-[15rem] justify-center">
      {!done ? (
        <>
          <div className="text-6xl font-bold mb-4" style={{ color: 'var(--rose)' }}>{steps[i].n}</div>
          <p className="text-lg font-semibold mb-1">
            {zh ? `说出 ${steps[i].n} 样你${steps[i].s}的东西` : `Name ${steps[i].n} things you ${steps[i].s}`}
          </p>
          <p className="text-[12px] opacity-50 mb-6">{zh ? '慢慢来，一样一样地找' : 'Take your time, one at a time'}</p>
          <button onClick={() => setI(i + 1)} className="px-8 py-3 rounded-full font-bold text-sm text-white" style={{ background: 'var(--rose)' }}>
            {i === steps.length - 1 ? (zh ? '完成' : 'Done') : (zh ? '下一个' : 'Next')}
          </button>
        </>
      ) : (
        <>
          <Anchor size={30} style={{ color: 'var(--rose)' }} className="mb-4" />
          <p className="text-base font-semibold">{zh ? '你回来了。' : "You're back."}</p>
          <p className="text-[13px] opacity-60 mt-2 max-w-[16rem] leading-relaxed">{zh ? '此刻是安全的。就停在这里，感受一下脚下的地面。' : 'This moment is safe. Rest here, and feel the ground under you.'}</p>
          <button onClick={() => setI(0)} className="mt-6 text-[13px] opacity-60 hover:opacity-100 underline">{zh ? '再来一次' : 'Again'}</button>
        </>
      )}
    </div>
  );
};

// ---- Self-compassion break (Neff's three steps) ----
const Kind: React.FC<{ zh: boolean }> = ({ zh }) => {
  const lines = zh
    ? ['这是一个难受的时刻。', '难受，是每个人都会经历的——你不是一个人。', '愿我能像对最好的朋友那样，对自己温柔一点。']
    : ['This is a moment of suffering.', 'Suffering is part of being human — you are not alone in this.', 'May I be as kind to myself as I would be to a dear friend.'];
  const [i, setI] = useState(0);
  const last = i >= lines.length - 1;
  return (
    <div className="flex flex-col items-center text-center py-8 min-h-[16rem] justify-center">
      <Heart size={26} style={{ color: 'var(--rose)' }} className="mb-6 opacity-80" />
      <p className="text-lg font-serif leading-relaxed max-w-[18rem] transition-opacity duration-500">{lines[i]}</p>
      <div className="flex items-center gap-2 mt-8">
        {lines.map((_, k) => <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: k === i ? 'var(--rose)' : 'rgb(var(--tint) / 0.2)' }} />)}
      </div>
      <button onClick={() => setI(last ? 0 : i + 1)} className="mt-7 px-8 py-3 rounded-full font-bold text-sm text-white" style={{ background: 'var(--rose)' }}>
        {last ? (zh ? '再读一遍' : 'Read it again') : (zh ? '继续' : 'Next')}
      </button>
    </div>
  );
};

// ---- Worry postponement ----
const Worry: React.FC<{ zh: boolean; onDone: () => void }> = ({ zh, onDone }) => {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const put = () => {
    if (!text.trim()) return;
    try {
      const list = JSON.parse(localStorage.getItem('tether_worries') || '[]');
      localStorage.setItem('tether_worries', JSON.stringify([{ text: text.trim(), t: Date.now() }, ...list].slice(0, 50)));
    } catch {}
    setSaved(true);
  };
  if (saved) return (
    <div className="flex flex-col items-center text-center py-10 min-h-[14rem] justify-center">
      <Inbox size={30} style={{ color: 'var(--rose)' }} className="mb-4" />
      <p className="text-base font-semibold">{zh ? '已经帮你收好了。' : "It's put away for now."}</p>
      <p className="text-[13px] opacity-60 mt-2 max-w-[17rem] leading-relaxed">{zh ? '它不会跑掉，你晚点想的时候还在。现在，先让自己歇一会儿。' : "It won't disappear — it'll be here when you're ready. For now, let yourself rest."}</p>
      <button onClick={onDone} className="mt-6 px-8 py-3 rounded-full font-bold text-sm text-white" style={{ background: 'var(--rose)' }}>{zh ? '好' : 'Okay'}</button>
    </div>
  );
  return (
    <div className="py-4">
      <p className="text-[13px] opacity-70 leading-relaxed mb-4">{zh ? '把此刻最缠着你的担忧写下来。写下来，就可以先把它放到一边，晚点再处理。' : "Write down the worry that's clinging to you. Naming it lets you set it aside and come back to it later."}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus
        placeholder={zh ? '我在担心……' : "I'm worried about…"}
        className="w-full p-3 rounded-2xl text-[14px] resize-none outline-none text-white placeholder-white/30"
        style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.15)' }} />
      <button onClick={put} disabled={!text.trim()} className="mt-4 w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-40" style={{ background: 'var(--rose)' }}>
        {zh ? '先放下，晚点再想' : 'Set it aside for now'}
      </button>
    </div>
  );
};

// ---- Emotion journal: a gentle curve of how you've been + one soft observation ----
const entryColor = (valence: number, arousal: number) => {
  const x = valence / 100, y = arousal / 100;
  const lerp = (a: number[], b: number[], r: number) => a.map((c, i) => c + (b[i] - c) * r);
  const top = lerp([185, 28, 28], [234, 88, 12], x);      // red → orange
  const bottom = lerp([23, 37, 84], [13, 148, 136], x);   // blue → teal
  const c = lerp(bottom, top, y);
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
};

const MoodTrend: React.FC<{ zh: boolean; logs: LogEntry[] }> = ({ zh, logs }) => {
  if (logs.length === 0) {
    return (
      <div className="p-4 rounded-2xl mb-1" style={{ background: 'rgb(var(--tint) / 0.05)', border: '1px solid rgb(var(--tint) / 0.1)' }}>
        <p className="text-[11px] tracking-widest uppercase font-bold opacity-40 mb-1">{zh ? '情绪走向' : 'Mood over time'}</p>
        <p className="text-[13px] opacity-55 leading-relaxed">{zh ? '每次在这里停留、记录心情，都会慢慢连成一条属于你的线。' : "Each time you check in, your feelings slowly draw a line that's yours."}</p>
      </div>
    );
  }
  const chrono = [...logs].reverse();
  const pts = chrono.map((l, idx) => ({
    x: chrono.length <= 1 ? 50 : (idx / (chrono.length - 1)) * 100,
    y: 100 - Math.max(0, Math.min(100, l.valence)),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L 100 100 L 0 100 Z`;
  const avg = (a: LogEntry[]) => (a.length ? a.reduce((s, l) => s + l.valence, 0) / a.length : null);
  const rAvg = avg(logs.slice(0, 5)), pAvg = avg(logs.slice(5, 10));
  let insight: string;
  if (rAvg != null && pAvg != null) {
    const d = rAvg - pAvg;
    insight = d > 6 ? (zh ? '最近你的情绪在慢慢往上走了 🌱' : 'Lately your mood has been lifting a little 🌱')
      : d < -6 ? (zh ? '这段时间你过得有点沉——记得对自己温柔一点 🤍' : "It's been a heavier stretch — be gentle with yourself 🤍")
      : (zh ? '最近你的情绪比较平稳。' : 'Your mood has felt fairly steady lately.');
  } else {
    insight = zh ? '多来记几次，就能看到你情绪的走向了。' : 'A few more check-ins and your trend will show.';
  }
  return (
    <div className="p-4 rounded-2xl mb-1" style={{ background: 'rgb(var(--tint) / 0.05)', border: '1px solid rgb(var(--tint) / 0.1)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] tracking-widest uppercase font-bold opacity-40">{zh ? '情绪走向' : 'Mood over time'}</p>
        <span className="text-[10px] opacity-30 font-mono">{zh ? `${logs.length} 次记录` : `${logs.length} check-ins`}</span>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-16">
        <defs>
          <linearGradient id="rkMoodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--rose)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--rose)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="20" x2="100" y2="20" stroke="rgb(var(--tint) / 0.15)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <path d={area} fill="url(#rkMoodFill)" transform="scale(1,0.4)" />
        <path d={line} fill="none" stroke="var(--rose)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="scale(1,0.4)" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="text-[13px] opacity-70 leading-relaxed mt-2">{insight}</p>
    </div>
  );
};

const RecentNotes: React.FC<{ zh: boolean; logs: LogEntry[] }> = ({ zh, logs }) => {
  if (logs.length === 0) return null;
  const recent = logs.slice(0, 4);
  return (
    <div className="pt-3">
      <p className="text-[11px] tracking-widest uppercase font-bold opacity-40 px-1 mb-2">{zh ? '你最近说过的话' : 'What you told yourself lately'}</p>
      <div className="space-y-2">
        {recent.map((l) => (
          <div key={l.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--tint) / 0.04)' }}>
            <span className="shrink-0 w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: entryColor(l.valence, l.arousal), boxShadow: `0 0 6px ${entryColor(l.valence, l.arousal)}` }} />
            <div className="min-w-0">
              <p className="text-[13px] leading-snug opacity-85 font-serif italic break-words">"{l.message}"</p>
              <p className="text-[10px] opacity-30 font-mono mt-1">{new Date(l.timestamp).toLocaleDateString()} · {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResetKit;
