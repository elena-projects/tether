import React, { useEffect, useState } from 'react';
import { X, Loader2, Send, ShieldAlert, LifeBuoy, MessageCircle } from 'lucide-react';
import { Language } from '../types';
import { screenConfide } from '../services/geminiService';
import {
  Talk, TEXT_LIMIT, acceptTalk, declineTalk, addTurn, askToContinue,
  agreeToContinue, endTalk, blockUser, sideOf, waitingOn,
} from '../services/talks';

interface Props {
  talks: Talk[];
  me: { uid: string; username: string };
  language: Language;
  onClose: () => void;
  onChanged: () => void;      // re-poll after we mutate something
  onNeedHelp: () => void;
}

// A pre-written "no" so that declining never has to be composed, and never has to
// sound like abandonment. Saying no must be as easy as saying yes.
const declineNote = (zh: boolean) => zh
  ? '谢谢你愿意跟我说这些。我现在自己也有点撑不住，怕接不好 —— 这不是因为你。'
  : "Thank you for trusting me with that. I'm not in a good place to hold it well right now — that isn't about you.";

const TalksPanel: React.FC<Props> = ({ talks, me, language, onClose, onChanged, onNeedHelp }) => {
  const zh = language === 'zh';
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const run = async (id: string, fn: () => Promise<any>) => {
    setBusy(id); await fn(); setBusy(null); onChanged();
  };

  const reply = async (talk: Talk) => {
    const body = (draft[talk.id] || '').trim();
    if (body.length < 2) return;
    setBusy(talk.id);
    const screen = await screenConfide(body, language);
    if (!screen.screened) {
      setErr({ ...err, [talk.id]: zh ? '现在没法检查这条内容，等一下再试试。' : "Can't check this right now — try again in a moment." });
      setBusy(null);
      return;
    }
    if (!screen.allowed) {
      setErr({ ...err, [talk.id]: screen.reason || (zh ? '这条不适合发出去。' : "That isn't safe to send.") });
      setBusy(null);
      return;
    }
    await addTurn(talk, sideOf(talk, me.uid), body);
    setDraft({ ...draft, [talk.id]: '' });
    setErr({ ...err, [talk.id]: '' });
    setBusy(null);
    onChanged();
    // If the person replying is themselves in trouble, point them somewhere real.
    if (screen.crisis) onNeedHelp();
  };

  const block = (talk: Talk) => {
    blockUser(talk.fromId);
    run(talk.id, () => endTalk(talk.id));
  };

  const label = (t: string) => <p className="text-[10px] tracking-[0.28em] uppercase opacity-45">{t}</p>;

  const turnBubble = (talk: Talk, turn: { by: string; text: string; ts: number }, i: number) => {
    const mine = turn.by === sideOf(talk, me.uid);
    return (
      <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${mine ? 'ml-6' : 'mr-6'}`}
        style={mine
          ? { background: 'rgb(var(--tint) / 0.08)' }
          : { background: 'var(--rose)', color: 'var(--bg-base)' }}>
        {turn.text}
      </div>
    );
  };

  const replyBox = (talk: Talk) => (
    <div className="mt-3">
      <textarea
        value={draft[talk.id] || ''} onChange={(e) => setDraft({ ...draft, [talk.id]: e.target.value })}
        maxLength={TEXT_LIMIT} rows={3}
        placeholder={zh ? '你想说的…' : 'What you want to say…'}
        className="w-full rounded-2xl border border-white/20 bg-transparent px-3.5 py-2.5 text-[12.5px] leading-relaxed
                   placeholder:opacity-40 focus:outline-none focus:border-white/45 transition-colors resize-none"
      />
      <button onClick={() => reply(talk)} disabled={busy === talk.id || (draft[talk.id] || '').trim().length < 2}
        className="mt-2 w-full rounded-full py-2.5 text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}>
        {busy === talk.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={11} />}
        {zh ? '回一条' : 'Reply once'}
      </button>
      {err[talk.id] && <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--rose)' }}>{err[talk.id]}</p>}
    </div>
  );

  const renderTalk = (talk: Talk) => {
    const side = sideOf(talk, me.uid);
    const incoming = side === 'to';
    const turn = waitingOn(talk);
    const done = talk.turns.length >= talk.maxTurns;

    return (
      <div key={talk.id} className="p-4 rounded-2xl glass-panel space-y-3">

        {/* ---- a request: asked first, content stays hidden until they agree ---- */}
        {talk.status === 'pending' && incoming && (
          <>
            {label(zh ? '有人想跟你说说' : 'Someone wants to talk')}
            <p className="text-[13.5px] leading-relaxed">
              {zh ? '有人读了你写的话，想跟你说说 TA 的事。' : 'Someone read what you wrote and wants to tell you about their own.'}
            </p>
            {talk.wallMsgText && (
              <p className="text-[11.5px] italic opacity-55 leading-relaxed border-l-2 pl-3" style={{ borderColor: 'var(--rose)' }}>
                "{talk.wallMsgText}"
              </p>
            )}
            <p className="text-[12px] font-bold">{zh ? '你现在有力气听吗？' : 'Do you have the energy right now?'}</p>
            <p className="text-[11px] opacity-50 leading-relaxed">
              {zh ? '答应之后才会看到内容。不想听也完全可以 —— 这不是你的责任。' : "You'll only see it if you say yes. Saying no is completely okay — this isn't your job."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => run(talk.id, () => acceptTalk(talk.id))} disabled={busy === talk.id}
                className="px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase"
                style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}>{zh ? '我听' : "I'll listen"}</button>
              <button onClick={() => run(talk.id, () => declineTalk(talk.id, declineNote(zh)))} disabled={busy === talk.id}
                className="px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase border border-white/20 hover:bg-white/5">
                {zh ? '现在不行' : 'Not right now'}</button>
              <button onClick={() => block(talk)} disabled={busy === talk.id}
                className="px-3 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase opacity-45 hover:opacity-90 flex items-center gap-1">
                <ShieldAlert size={11} /> {zh ? '不太合适' : 'Not okay'}</button>
            </div>
          </>
        )}

        {/* ---- waiting on the other person to decide ---- */}
        {talk.status === 'pending' && !incoming && (
          <>
            {label(zh ? '已送出' : 'Sent')}
            <p className="text-[12.5px] opacity-70 leading-relaxed">
              {zh ? `在等 ${talk.toName || '对方'} 决定要不要听。TA 可能会回，也可能不会。` : `Waiting to see if ${talk.toName || 'they'} has the energy. They may reply, they may not.`}
            </p>
          </>
        )}

        {/* ---- they said not right now ---- */}
        {talk.status === 'declined' && (
          <>
            {label(zh ? '这次没有接上' : 'Not this time')}
            {!incoming && talk.declineNote && (
              <p className="text-[12.5px] italic leading-relaxed opacity-80">"{talk.declineNote}"</p>
            )}
            <p className="text-[11px] opacity-50 leading-relaxed">
              {zh ? '这不代表你说的话不重要。墙上还有别人。' : "That doesn't mean what you said didn't matter. There are others on the wall."}
            </p>
          </>
        )}

        {/* ---- an open or finished exchange ---- */}
        {(talk.status === 'open' || talk.status === 'closed') && talk.turns.length > 0 && (
          <>
            {label(incoming ? (zh ? `来自 ${talk.fromName}` : `From ${talk.fromName}`) : (zh ? `和 ${talk.toName || '对方'}` : `With ${talk.toName || 'them'}`))}
            <div className="space-y-2">{talk.turns.map((t, i) => turnBubble(talk, t, i))}</div>

            {turn === side && replyBox(talk)}
            {turn && turn !== side && (
              <p className="text-[11px] opacity-50">{zh ? '等 TA 回应…' : 'Waiting for them…'}</p>
            )}

            {/* ---- it ends by default; continuing takes both ---- */}
            {done && talk.status === 'closed' && (
              <div className="pt-1 space-y-2">
                {talk.extendBy && talk.extendBy !== side ? (
                  <>
                    <p className="text-[11.5px] opacity-70 leading-relaxed">
                      {zh ? 'TA 想再说一轮。你愿意吗？' : 'They asked to keep going. Would you like to?'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => run(talk.id, () => agreeToContinue(talk))}
                        className="px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase"
                        style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}>{zh ? '好' : 'Yes'}</button>
                      <button onClick={() => run(talk.id, () => endTalk(talk.id))}
                        className="px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase border border-white/20 hover:bg-white/5">
                        {zh ? '就到这里' : 'Leave it here'}</button>
                    </div>
                  </>
                ) : talk.extendBy === side ? (
                  <p className="text-[11px] opacity-50">{zh ? '已经问了 TA 要不要再说一轮。' : 'Asked if they want to continue.'}</p>
                ) : (
                  <>
                    <p className="text-[11px] opacity-50 leading-relaxed">
                      {zh ? '这次的对话到这里了。' : 'This exchange has come to its end.'}
                    </p>
                    <button onClick={() => run(talk.id, () => askToContinue(talk.id, side))}
                      className="px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase border border-white/20 hover:bg-white/5">
                      {zh ? '想再说一轮' : 'Ask to continue'}</button>
                  </>
                )}
              </div>
            )}

            {incoming && talk.status !== 'closed' && (
              <button onClick={() => block(talk)}
                className="text-[10px] opacity-35 hover:opacity-80 flex items-center gap-1 pt-1">
                <ShieldAlert size={10} /> {zh ? '这条让我不舒服' : 'This makes me uncomfortable'}</button>
            )}
          </>
        )}
      </div>
    );
  };

  const pendingCount = talks.filter((t) => t.status === 'pending' && t.toId === me.uid).length;

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 font-mono" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)' }}
        className="w-full max-w-lg max-h-[88vh] overflow-hidden rounded-3xl shadow-2xl text-white flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <MessageCircle size={16} style={{ color: 'var(--rose)' }} />
          <div>
            <h2 className="font-bold">{zh ? '说说话' : 'Talking'}</h2>
            <p className="text-[11px] opacity-50">
              {pendingCount > 0
                ? (zh ? `有 ${pendingCount} 个人在等你决定` : `${pendingCount} waiting on you`)
                : (zh ? '一来一回，没有压力' : 'one message each, no pressure')}
            </p>
          </div>
          <button onClick={onClose} aria-label={zh ? '关闭' : 'Close'}
            className="ml-auto p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto no-scrollbar p-5 space-y-3">
          {talks.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <p className="text-[13px] opacity-55 leading-relaxed">
                {zh ? '这里还很安静。\n在留言墙上遇到打动你的人，可以跟 TA 说说。' : "It's quiet here.\nIf someone on the wall speaks to you, you can reach them."}
              </p>
            </div>
          ) : talks.map(renderTalk)}

          {talks.length > 0 && (
            <button onClick={onNeedHelp}
              className="w-full mt-2 py-3 text-[10px] tracking-[0.2em] uppercase opacity-40 hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity">
              <LifeBuoy size={11} /> {zh ? '需要真人帮助' : 'Talk to a real person'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalksPanel;
