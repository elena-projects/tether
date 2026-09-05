import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, LifeBuoy, Heart } from 'lucide-react';
import { Language, Message } from '../types';
import { screenConfide } from '../services/geminiService';
import { createTalk, hasLiveTalkWith, TEXT_LIMIT } from '../services/talks';

interface Props {
  message: Message;                       // the wall message that made them want to reach out
  me: { uid: string; username: string };
  language: Language;
  onClose: () => void;
  onNeedHelp: () => void;                 // opens the real-help screen
}

type Phase = 'writing' | 'sending' | 'blocked' | 'crisis' | 'sent' | 'duplicate';

// Reaching the person whose words landed for you — one message, and only if they say yes.
const ConfideCompose: React.FC<Props> = ({ message, me, language, onClose, onNeedHelp }) => {
  const zh = language === 'zh';
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('writing');
  const [reason, setReason] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const id = window.setTimeout(() => areaRef.current?.focus(), 80);
    return () => { window.removeEventListener('keydown', k); window.clearTimeout(id); };
  }, [onClose]);

  const deliver = async (body: string) => {
    const id = await createTalk(
      { uid: me.uid, name: me.username },
      { uid: message.senderId, name: message.senderName },
      message.text,
      body,
    );
    setPhase(id ? 'sent' : 'writing');
    if (!id) setReason(zh ? '没送出去，等一下再试试。' : "That didn't send — try again in a moment.");
  };

  const send = async () => {
    const body = text.trim();
    if (body.length < 2) return;
    setPhase('sending');

    if (await hasLiveTalkWith(me.uid, message.senderId)) { setPhase('duplicate'); return; }

    const screen = await screenConfide(body, language);
    if (!screen.screened) {
      setReason(zh ? '现在没法检查这条内容，等一下再试试。' : "Can't check this right now — try again in a moment.");
      setPhase('writing');
      return;
    }
    if (!screen.allowed) {
      setReason(screen.reason || (zh ? '这条里有不适合发给陌生人的内容。' : "There's something in this that isn't safe to send to a stranger."));
      setPhase('blocked');
      return;
    }
    // Someone in real danger needs more than a classmate can give — and the classmate
    // should not be the one carrying it. Offer help first, and a lighter note instead.
    if (screen.crisis) { setPhase('crisis'); return; }

    await deliver(body);
  };

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-3 sm:p-6 font-mono">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog" aria-modal="true"
        className="relative w-full sm:w-[440px] max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl border p-6 sm:p-7 text-white shadow-2xl"
        style={{ background: 'var(--card)', borderColor: 'rgb(var(--line))' }}
      >
        <button onClick={onClose} aria-label={zh ? '关闭' : 'Close'}
          className="absolute top-4 right-4 opacity-40 hover:opacity-90 transition-opacity"><X size={16} /></button>
        {children}
      </div>
    </div>
  );

  if (phase === 'sent') return shell(
    <div className="py-10 text-center space-y-3">
      <Heart size={22} className="mx-auto" style={{ color: 'var(--rose)' }} />
      <p className="text-[15px]">{zh ? '已经送到了' : "It's on its way"}</p>
      <p className="text-[12px] opacity-60 leading-relaxed">
        {zh ? 'TA 会先被问一句“现在有力气听吗”。\n可能会回，也可能不会 —— 都没关系。' : "They'll be asked whether they have the energy right now.\nThey may reply, they may not — either is okay."}
      </p>
      <button onClick={onClose} className="mt-2 px-6 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase border border-white/20 hover:bg-white/5">{zh ? '好' : 'Okay'}</button>
    </div>
  );

  if (phase === 'duplicate') return shell(
    <div className="py-10 text-center space-y-3">
      <p className="text-[14px]">{zh ? '你已经在等这个人的回应了' : "You're already waiting to hear from them"}</p>
      <p className="text-[12px] opacity-60 leading-relaxed">{zh ? '先等等这一条吧。' : 'Give that one a little time.'}</p>
      <button onClick={onClose} className="mt-2 px-6 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase border border-white/20 hover:bg-white/5">{zh ? '好' : 'Okay'}</button>
    </div>
  );

  // Real danger: help comes first, and the heavy part doesn't land on another teenager.
  if (phase === 'crisis') return shell(
    <div className="space-y-4 py-2">
      <LifeBuoy size={22} style={{ color: 'var(--rose)' }} />
      <p className="text-[15px] leading-relaxed">{zh ? '你写的这些，我很在意。' : 'What you wrote matters.'}</p>
      <p className="text-[12.5px] opacity-70 leading-relaxed">
        {zh
          ? '但这件事需要比这里更能帮上你的人 —— 对面也只是一个和你差不多大的人，TA 接不住这么重的东西，你也值得被真正接住。'
          : "But this needs someone who can actually help. The person on the other end is a teenager too — they can't carry this, and you deserve more than they can give."}
      </p>
      <button onClick={onNeedHelp}
        className="w-full rounded-full py-3 text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2"
        style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}>
        <LifeBuoy size={13} /> {zh ? '看看能帮上忙的人' : 'See who can help'}
      </button>
      <button onClick={() => deliver(zh ? '我读到了你写的话，谢谢你。' : 'I read what you wrote. Thank you.')}
        className="w-full rounded-full py-2.5 text-[11px] tracking-[0.2em] uppercase border border-white/20 hover:bg-white/5 transition-colors">
        {zh ? '只跟 TA 说声谢谢' : 'Just say thank you to them'}
      </button>
      <button onClick={onClose} className="w-full text-[11px] opacity-45 hover:opacity-80 py-1">{zh ? '先不发了' : 'Not now'}</button>
    </div>
  );

  return shell(
    <>
      <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--rose)' }}>
        {zh ? '想跟 TA 说说' : 'Reach out'}
      </p>

      {/* what they wrote — the reason you're here */}
      <div className="rounded-2xl border border-white/15 p-3.5 mb-4">
        <p className="text-[12.5px] italic leading-relaxed opacity-80">"{message.text}"</p>
        {message.senderName && <p className="text-[10px] opacity-45 mt-2 tracking-widest">— {message.senderName}</p>}
      </div>

      {/* the honest expectation, before they write a word */}
      <p className="text-[12px] leading-relaxed opacity-65 mb-4">
        {zh
          ? '对面是一个和你差不多大的普通人，不是咨询师。TA 会先被问“现在有力气听吗”，可以答应，也可以拒绝 —— 都没关系。你可以写一条。'
          : "They're an ordinary person about your age, not a counsellor. They'll be asked whether they have the energy right now, and they can say no — that's okay. You get one message."}
      </p>

      <textarea
        ref={areaRef} value={text} onChange={(e) => setText(e.target.value)}
        maxLength={TEXT_LIMIT} rows={5}
        placeholder={zh ? '你想说什么都可以…' : 'Whatever you want to say…'}
        className="w-full rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-[13px] leading-relaxed
                   placeholder:opacity-40 focus:outline-none focus:border-white/45 transition-colors resize-none"
      />
      <p className="text-right text-[10px] opacity-35 mt-1">{text.length}/{TEXT_LIMIT}</p>

      <button
        onClick={send} disabled={phase === 'sending' || text.trim().length < 2}
        className="mt-3 w-full rounded-full py-3 text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
        style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}
      >
        {phase === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
        {phase === 'sending' ? (zh ? '看一下…' : 'Checking…') : (zh ? '送出' : 'Send')}
      </button>

      {phase === 'blocked' && <p className="mt-3 text-center text-[11.5px] leading-relaxed" style={{ color: 'var(--rose)' }}>{reason}</p>}
      {phase === 'writing' && reason && <p className="mt-3 text-center text-[11.5px]" style={{ color: 'var(--rose)' }}>{reason}</p>}
    </>
  );
};

export default ConfideCompose;
