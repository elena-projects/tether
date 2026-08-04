import React, { useEffect, useRef, useState } from 'react';
import { X, Wind, Anchor, Heart, Inbox, ChevronLeft, History, Loader2, Check, Send } from 'lucide-react';
import { readOwnJournal } from '../services/journal';
import { readOwnSent, SentMessage } from '../services/sent';
import { readOwnWorries, appendWorry, updateWorry, Worry, WorryOutcome } from '../services/worries';
import { groundingReply, worryReply } from '../services/geminiService';

// A small "in-the-moment reset" toolkit + your emotion journal, in one place: evidence-based
// micro-tools for when things feel like too much (paced breathing, 5-4-3-2-1 grounding, a
// self-compassion break, worry postponement), sitting above a gentle curve of how you've been
// feeling over time. All solo-usable, no account, no waiting on anyone.

interface LogEntry { id: number; timestamp: number; valence: number; arousal: number; message: string; }

type Props = { language: 'en' | 'zh' | string; onClose: () => void; onUsed?: (tool: string) => void; version?: number };
type Tool = 'menu' | 'breathe' | 'ground' | 'kind' | 'worry' | 'worries';

const ResetKit: React.FC<Props> = ({ language, onClose, onUsed, version = 0 }) => {
  const zh = language === 'zh';
  const [tool, setTool] = useState<Tool>('menu');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sent, setSent] = useState<SentMessage[]>([]);
  useEffect(() => {
    setLogs(readOwnJournal() as LogEntry[]);
    setSent(readOwnSent());
  }, [version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { tool === 'menu' ? onClose() : setTool('menu'); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, onClose]);

  const items: { key: Tool; icon: React.ReactNode; title: string; sub: string }[] = [
    { key: 'breathe', icon: <Wind size={20} />, title: zh ? '跟着呼吸' : 'Breathe', sub: zh ? '慢下来，几口气就好' : 'Slow down in a few breaths' },
    { key: 'ground', icon: <Anchor size={20} />, title: zh ? '回到当下' : 'Ground', sub: zh ? '写下身边看到、摸到的，把自己拉回来' : 'Note what you see and touch, come back to now' },
    { key: 'kind', icon: <Heart size={20} />, title: zh ? '善待自己' : 'Be kind' , sub: zh ? '像对朋友一样对自己' : 'Speak to yourself like a friend' },
    { key: 'worry', icon: <Inbox size={20} />, title: zh ? '放下担忧' : 'Set it aside', sub: zh ? '写下、收起来，之后再回看' : 'Set it down, look back later' },
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
              <SentNotes zh={zh} sent={sent} />
            </div>
          )}
          {tool === 'breathe' && <Breathe zh={zh} />}
          {tool === 'ground' && <Ground zh={zh} language={language} />}
          {tool === 'kind' && <Kind zh={zh} />}
          {tool === 'worry' && <WorryTool zh={zh} language={language} onDone={() => setTool('menu')} onReview={() => setTool('worries')} />}
          {tool === 'worries' && <Worries zh={zh} />}
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

// ---- 5-4-3-2-1 grounding, but you WRITE what you notice around you (see / hear / touch /
//      smell / taste) — and at the end a warm AI reply witnesses what brought you back. ----
const Ground: React.FC<{ zh: boolean; language: string }> = ({ zh, language }) => {
  const steps = zh
    ? [{ n: 5, s: '看到' }, { n: 4, s: '听到' }, { n: 3, s: '摸到' }, { n: 2, s: '闻到' }, { n: 1, s: '尝到' }]
    : [{ n: 5, s: 'can see' }, { n: 4, s: 'can hear' }, { n: 3, s: 'can touch' }, { n: 2, s: 'can smell' }, { n: 1, s: 'can taste' }];
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState<string[]>(() => steps.map(() => ''));
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const atEnd = i >= steps.length;

  const setNote = (v: string) => setNotes((prev) => { const n = [...prev]; n[i] = v; return n; });

  const finish = async () => {
    setLoading(true);
    const noticed = notes.map((n, k) => (n.trim() ? `${zh ? steps[k].s : steps[k].s.replace('can ', '')}: ${n.trim()}` : '')).filter(Boolean).join('; ');
    try { setReply(await groundingReply(noticed, language as any)); }
    finally { setLoading(false); setI(steps.length); }
  };

  const reset = () => { setNotes(steps.map(() => '')); setReply(null); setI(0); };

  if (loading) return (
    <div className="flex flex-col items-center justify-center text-center py-16 min-h-[15rem]">
      <Loader2 size={22} className="animate-spin mb-3" style={{ color: 'var(--rose)' }} />
      <p className="text-[13px] opacity-60">{zh ? '在认真听……' : 'Listening…'}</p>
    </div>
  );

  if (atEnd) return (
    <div className="py-4 min-h-[15rem]">
      <div className="flex flex-col items-center text-center mb-4">
        <Anchor size={26} style={{ color: 'var(--rose)' }} className="mb-3" />
        <p className="text-base font-semibold">{zh ? '你回来了。' : "You're back."}</p>
      </div>
      {reply && (
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgb(var(--tint) / 0.10)', color: 'var(--rose)' }}><Heart size={15} /></span>
          <p className="text-[15px] leading-relaxed font-serif break-words flex-1">{reply}</p>
        </div>
      )}
      <p className="text-[12px] opacity-55 mt-4 leading-relaxed text-center">{zh ? '此刻是安全的。感受一下脚下的地面。' : 'This moment is safe. Feel the ground under you.'}</p>
      <button onClick={reset} className="mt-6 mx-auto block text-[13px] opacity-60 hover:opacity-100 underline">{zh ? '再来一次' : 'Again'}</button>
    </div>
  );

  return (
    <div className="py-4 min-h-[15rem] flex flex-col">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-bold" style={{ color: 'var(--rose)' }}>{steps[i].n}</span>
        <p className="text-[15px] font-semibold">{zh ? `样你${steps[i].s}的东西` : `things you ${steps[i].s}`}</p>
      </div>
      <p className="text-[12px] opacity-50 mb-3">{zh ? '慢慢看看四周，写下来——一样一样地找。' : 'Look slowly around you and write them down — one at a time.'}</p>
      <textarea value={notes[i]} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
        placeholder={zh ? '我注意到……' : 'I notice…'}
        className="w-full p-3 rounded-2xl text-[14px] resize-none outline-none text-white placeholder-white/30"
        style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.15)' }} />
      <div className="flex items-center gap-3 mt-4">
        {i > 0 && <button onClick={() => setI(i - 1)} className="text-[13px] opacity-55 hover:opacity-90 underline">{zh ? '上一个' : 'Back'}</button>}
        <button onClick={() => (i === steps.length - 1 ? finish() : setI(i + 1))} className="ml-auto px-8 py-3 rounded-full font-bold text-sm text-white" style={{ background: 'var(--rose)' }}>
          {i === steps.length - 1 ? (zh ? '完成' : 'Done') : (zh ? '下一个' : 'Next')}
        </button>
      </div>
    </div>
  );
};

// ---- Self-compassion via the "friend" reframe: what would you tell a friend? → say it to
//      yourself. Concrete and self-explanatory, where an abstract mantra wasn't landing. ----
const Kind: React.FC<{ zh: boolean }> = ({ zh }) => {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  return (
    <div className="py-4 min-h-[15rem]">
      {!done ? (
        <>
          <p className="text-[12px] opacity-55 leading-relaxed mb-2">{zh ? '我们常常对别人很温柔，却对自己很苛刻。' : "We're often gentle with others, yet hard on ourselves."}</p>
          <p className="text-[15px] font-semibold leading-relaxed mb-4">{zh ? '如果此刻，是你最好的朋友这样难受，你会对TA说什么？' : 'If your closest friend felt exactly this way right now, what would you say to them?'}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus
            placeholder={zh ? '我会对TA说……' : "I'd tell them…"}
            className="w-full p-3 rounded-2xl text-[14px] resize-none outline-none text-white placeholder-white/30"
            style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.15)' }} />
          <button onClick={() => text.trim() && setDone(true)} disabled={!text.trim()} className="mt-4 w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-40" style={{ background: 'var(--rose)' }}>
            {zh ? '写好了' : 'Done'}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center text-center py-4">
          <Heart size={26} style={{ color: 'var(--rose)' }} className="mb-4 opacity-80" />
          <p className="text-[13px] opacity-60 mb-3">{zh ? '现在，把这句话，也送给你自己：' : 'Now, say these same words to yourself:'}</p>
          <p className="text-lg font-serif leading-relaxed max-w-[18rem]" style={{ color: 'var(--rose)' }}>"{text.trim()}"</p>
          <p className="text-[12px] opacity-55 mt-5 max-w-[17rem] leading-relaxed">{zh ? '你也一样，值得这份温柔。' : 'You, too, deserve that same kindness.'}</p>
          <button onClick={() => { setText(''); setDone(false); }} className="mt-6 text-[13px] opacity-60 hover:opacity-100 underline">{zh ? '再想一句' : 'Again'}</button>
        </div>
      )}
    </div>
  );
};

// ---- Worry postponement ----
const WorryTool: React.FC<{ zh: boolean; language: string; onDone: () => void; onReview: () => void }> = ({ zh, language, onDone, onReview }) => {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const crisisRe = /(自杀|自残|不想活|想死|活不下去|结束自己|撑不下去|kill myself|end my life|suicid|self[-\s]?harm|hurt myself)/i;

  const send = async () => {
    if (!text.trim() || loading) return;
    setCrisis(crisisRe.test(text));
    appendWorry(text.trim());
    setLoading(true);
    try { setReply(await worryReply(text.trim(), language as any)); }
    finally { setLoading(false); setSent(true); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center text-center py-16 min-h-[15rem]">
      <Loader2 size={22} className="animate-spin mb-3" style={{ color: 'var(--rose)' }} />
      <p className="text-[13px] opacity-60">{zh ? '在认真听……' : 'Listening…'}</p>
    </div>
  );

  if (sent) return (
    <div className="py-4 min-h-[15rem]">
      <div className="flex flex-col items-center text-center mb-4">
        <Inbox size={26} style={{ color: 'var(--rose)' }} className="mb-3" />
        <p className="text-base font-semibold">{zh ? '已经帮你收好了。' : "It's put away for now."}</p>
      </div>
      {reply && (
        <div className="flex items-start gap-3 mb-2">
          <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgb(var(--tint) / 0.10)', color: 'var(--rose)' }}><Heart size={15} /></span>
          <p className="text-[15px] leading-relaxed font-serif break-words flex-1">{reply}</p>
        </div>
      )}
      {crisis && (
        <p className="mt-3 text-[12px] leading-relaxed p-3 rounded-xl" style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.12)' }}>
          {zh ? '如果这份难受太重了，别一个人扛。和你信任的人说说，或拨打心理援助热线。你值得被好好接住。💗' : "If this feels like too much, please don't carry it alone — reach out to someone you trust, or a helpline. You deserve to be held. 💗"}
        </p>
      )}
      <p className="text-[12px] opacity-50 text-center leading-relaxed mt-4">{zh ? '过些天回来看看，它到底有没有发生。' : 'Come back in a while and see whether it actually happened.'}</p>
      <div className="flex flex-col items-center">
        <button onClick={onDone} className="mt-5 px-8 py-3 rounded-full font-bold text-sm text-white" style={{ background: 'var(--rose)' }}>{zh ? '好' : 'Okay'}</button>
        <button onClick={onReview} className="mt-3 text-[13px] opacity-60 hover:opacity-100 underline">{zh ? '回看以前的担忧' : 'Look back at past worries'}</button>
      </div>
    </div>
  );

  return (
    <div className="py-4">
      <p className="text-[13px] opacity-70 leading-relaxed mb-4">{zh ? '把此刻最缠着你的担忧写下来，发出去——写下来、说出来，就可以先放到一边。' : "Write down the worry that's clinging to you and send it off — naming it lets you set it aside for now."}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus
        placeholder={zh ? '我在担心……' : "I'm worried about…"}
        className="w-full p-3 rounded-2xl text-[14px] resize-none outline-none text-white placeholder-white/30"
        style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.15)' }} />
      <button onClick={send} disabled={!text.trim()} className="mt-4 w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: 'var(--rose)' }}>
        <Send size={15} /> {zh ? '发送，先放下它' : 'Send it off'}
      </button>
      <button onClick={onReview} className="mt-4 w-full text-[13px] opacity-55 hover:opacity-90 underline flex items-center justify-center gap-1.5">
        <History size={13} /> {zh ? '回看以前写下的担忧' : 'Look back at past worries'}
      </button>
    </div>
  );
};

// ---- Worry look-back: mark whether each past worry actually happened, add what you learned,
//      and see — in your own record — how many never came true. ----
const Worries: React.FC<{ zh: boolean }> = ({ zh }) => {
  const [list, setList] = useState<Worry[]>(() => readOwnWorries());
  const refresh = () => setList(readOwnWorries());
  const setOutcome = (id: number, outcome: WorryOutcome) => { updateWorry(id, { outcome }); refresh(); };
  const saveNote = (id: number, note: string) => { updateWorry(id, { note }); refresh(); };

  // A warm one-liner the moment you mark how a worry turned out — so it feels resolved.
  const affirm = (o: WorryOutcome) => o === 'none'
    ? (zh ? '🌱 你看，它没有发生。当时的担心，这次落空了。' : "🌱 See — it didn't happen. Your worry didn't come true this time.")
    : o === 'partial'
    ? (zh ? '发生了一点点，但也没到你担心的那么糟吧？' : "A little did happen — but not as bad as you'd feared, was it?")
    : (zh ? '它确实发生了，而你也一路走到了现在。' : "It did happen — and you made it through to now.");

  const opts: { key: WorryOutcome; label: string }[] = zh
    ? [{ key: 'none', label: '没发生' }, { key: 'partial', label: '发生一点' }, { key: 'came_true', label: '真的发生了' }]
    : [{ key: 'none', label: "Didn't happen" }, { key: 'partial', label: 'A little' }, { key: 'came_true', label: 'It happened' }];

  const resolved = list.filter((w) => w.outcome);
  const notHappened = resolved.filter((w) => w.outcome === 'none').length;

  if (list.length === 0) return (
    <div className="flex flex-col items-center text-center py-14 min-h-[13rem] justify-center">
      <History size={26} style={{ color: 'var(--rose)' }} className="mb-4 opacity-70" />
      <p className="text-[13px] opacity-55 max-w-[17rem] leading-relaxed">{zh ? '你还没有写下过担忧。写下来的担忧会收在这里，过些天你就能回看它们有没有成真。' : "You haven't set any worries down yet. The ones you do will gather here, so you can look back and see whether they came true."}</p>
    </div>
  );

  return (
    <div className="py-3">
      {resolved.length >= 2 && (
        <div className="p-3 rounded-2xl mb-4 text-[13px] leading-relaxed" style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.12)' }}>
          {zh
            ? <>在你回看的 <b>{resolved.length}</b> 个担忧里，<b style={{ color: 'var(--rose)' }}>{notHappened}</b> 个最后并没有发生。 🌱</>
            : <>Of the <b>{resolved.length}</b> worries you've looked back on, <b style={{ color: 'var(--rose)' }}>{notHappened}</b> never happened. 🌱</>}
        </div>
      )}
      <div className="space-y-3">
        {list.map((w) => (
          <div key={w.id} className="p-4 rounded-2xl" style={{ background: 'rgb(var(--tint) / 0.05)', border: '1px solid rgb(var(--tint) / 0.1)' }}>
            <p className="text-[14px] font-serif italic leading-relaxed break-words opacity-90">"{w.text}"</p>
            <p className="text-[10px] opacity-30 font-mono mt-1 mb-3">{new Date(w.t).toLocaleDateString()}</p>
            <p className="text-[11px] uppercase tracking-widest opacity-40 mb-2">{zh ? '后来呢？' : 'What happened?'}</p>
            <div className="flex gap-2">
              {opts.map((o) => {
                const active = w.outcome === o.key;
                return (
                  <button key={o.key} onClick={() => setOutcome(w.id, o.key)}
                    className="flex-1 py-2 rounded-full text-[12px] font-bold transition-all"
                    style={active
                      ? { background: 'var(--rose)', color: '#2b2420' }
                      : { background: 'rgb(var(--tint) / 0.07)', color: 'rgb(var(--tint) / 0.7)' }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {w.outcome && (
              <>
                <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--rose)' }}>{affirm(w.outcome)}</p>
                <textarea defaultValue={w.note || ''} onBlur={(e) => saveNote(w.id, e.target.value)} rows={2}
                  placeholder={zh ? '想的话，写一句：后来实际发生了什么？学到了什么？' : 'If you like, jot a line: what actually happened? What did you learn?'}
                  className="mt-2 w-full p-3 rounded-xl text-[13px] resize-none outline-none text-white placeholder-white/25"
                  style={{ background: 'rgb(var(--tint) / 0.06)', border: '1px solid rgb(var(--tint) / 0.12)' }} />
                {w.note && w.note.trim() && (
                  <p className="mt-1.5 text-[11px] opacity-50 flex items-center gap-1" style={{ color: 'var(--rose)' }}><Check size={12} /> {zh ? '已记下' : 'Saved'}</p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
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

// The kind words you've sent out — a gentle reminder, in a soothing moment, of the light
// you've given others. (Distinct from the mood curve above, which is your own check-ins.)
const SentNotes: React.FC<{ zh: boolean; sent: SentMessage[] }> = ({ zh, sent }) => {
  return (
    <div className="pt-3">
      <p className="text-[11px] tracking-widest uppercase font-bold opacity-40 px-1 mb-2">{zh ? '你送出的暖心话' : 'Kind words you’ve sent'}</p>
      {sent.length === 0 ? (
        <p className="text-[12px] opacity-45 leading-relaxed px-1">{zh ? '你送给别人的每一句暖心话，都会留在这里。' : 'Every kind word you send someone will gather here.'}</p>
      ) : (
        <div className="space-y-2">
          {sent.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--tint) / 0.04)' }}>
              <Heart size={13} className="shrink-0 mt-1" style={{ color: 'var(--rose)' }} />
              <div className="min-w-0">
                <p className="text-[13px] leading-snug opacity-85 font-serif italic break-words">"{m.text}"</p>
                <p className="text-[10px] opacity-30 font-mono mt-1">{new Date(m.timestamp).toLocaleDateString()} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResetKit;
