import React, { useEffect, useState } from 'react';
import { X, Heart, Loader2, MessageCircle, MessagesSquare, Send } from 'lucide-react';
import { Language, Message } from '../types';

interface Props {
  messages: Message[];
  votedIds: Set<string>;
  onVote: (id: string) => void;
  loading?: boolean;                       // first fetch still in flight
  language: Language;
  onClose: () => void;
  myUid?: string;                          // so we never offer to write to ourselves
  onConfide?: (msg: Message) => void;      // reach the person whose words landed for you
  onSend?: (text: string) => Promise<void>;
}

// The "wall" — always reachable from the header, so anyone can read the kind words
// others have written (and add a heart), whatever mood they're in.
const WallPanel: React.FC<Props> = ({ messages, votedIds, onVote, loading, language, onClose, myUid, onConfide, onSend }) => {
  const zh = language === 'zh';
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!onSend || !text || sending) return;
    setSending(true); setSendError(''); setSent(false);
    try {
      await onSend(text);
      setDraft(''); setSent(true);
    } catch (error: any) {
      setSendError(error?.code === 'blocked'
        ? (zh ? '这句话没有通过温柔度审核，可以换一种更友善的说法。' : 'This did not pass the kindness review. Try a gentler version.')
        : (zh ? '暂时没能送出，请稍后再试。' : 'This could not be sent. Please try again later.'));
    } finally { setSending(false); }
  };

  return (
    <div className="modal-overlay viewport-overlay fixed inset-0 z-[65] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="wall-title" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)' }} className="modal-panel w-full max-w-lg max-h-[88vh] overflow-hidden rounded-3xl shadow-2xl text-white flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <MessagesSquare size={18} style={{ color: 'var(--rose)' }} />
          <div>
            <h2 id="wall-title" className="font-bold">{zh ? '暖心留言墙' : 'Community wall'}</h2>
            <p className="text-[11px] opacity-60">{zh ? '看看大家的话，也可以留一句给后来的人' : 'Read what others left, or add a few words for someone else'}</p>
          </div>
          <button onClick={onClose} aria-label={zh ? '关闭暖心墙' : 'Close kind words'} className="ml-auto p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto no-scrollbar p-5 space-y-3">
          {onSend && (
            <form className="wall-compose" onSubmit={submit}>
              <label htmlFor="wall-message">{zh ? '写给来到这里的人' : 'Write to someone who comes here'}</label>
              <textarea id="wall-message" value={draft} onChange={event => { setDraft(event.target.value); setSendError(''); setSent(false); }} maxLength={300} rows={3} placeholder={zh ? '一句温柔、真诚、不要求对方回应的话…' : 'Something kind and sincere, with no expectation of a reply…'} disabled={sending} />
              <div><span>{draft.length}/300</span><button type="submit" disabled={sending || !draft.trim()}>{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{sending ? (zh ? '正在审核' : 'Reviewing') : (zh ? '匿名留下' : 'Leave anonymously')}</button></div>
              {sent && <p role="status">{zh ? '已经留在墙上了。' : 'Your words are now on the wall.'}</p>}
              {sendError && <p role="alert">{sendError}</p>}
            </form>
          )}
          {loading ? (
            /* Placeholder words used to fill this gap, but they looked exactly like real ones —
               and carried no author and no way to reach anybody, so the wall seemed inert. */
            <p className="text-center text-[13px] opacity-40 py-16 leading-relaxed">
              {zh ? '正在把大家写下的话取过来…' : 'Fetching what people wrote…'}
            </p>
          ) : messages.length === 0 ? (
            <p className="text-center text-[13px] opacity-50 py-16 leading-relaxed">{zh ? '还没有人写下暖心话，\n来做第一个吧 🌱' : 'No kind words yet —\nbe the first 🌱'}</p>
          ) : (
            messages.map((msg) => {
              const voted = votedIds.has(msg.id);
              const named = msg.senderName && !['Guide', '小伙伴', 'AI Companion'].includes(msg.senderName);
              // Reaching out only makes sense towards a real person who isn't you.
              const canReach = !!onConfide && msg.type === 'human' && !!msg.senderId && msg.senderId !== myUid;
              return (
                <div key={msg.id} className="p-4 rounded-xl glass-panel">
                  <p className="text-sm font-serif italic mb-3 leading-relaxed">"{msg.text}"</p>
                  <div className="flex justify-between items-center text-[10px] opacity-60">
                    <span className="tracking-widest">{named ? `— ${msg.senderName}` : ''}</span>
                    <div className="flex items-center gap-3">
                      {canReach && (
                        <button
                          onClick={() => onConfide!(msg)}
                          title={zh ? '想跟 TA 说说' : 'reach out to them'}
                          className="flex items-center gap-1 hover:text-teal-200 transition-colors cursor-pointer"
                        >
                          <MessageCircle size={12} />
                          <span className="tracking-widest">{zh ? '说说' : 'talk'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => onVote(msg.id)}
                        title={voted ? (zh ? '取消爱心' : 'remove heart') : (zh ? '给它一颗心' : 'send a heart')}
                        className={`flex items-center gap-1 transition-colors cursor-pointer ${voted ? 'text-teal-300' : 'hover:text-teal-200'}`}
                      >
                        <span>{msg.voteCount || 0}</span>
                        <Heart size={12} className={voted ? 'fill-current' : 'fill-white/40'} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default WallPanel;
