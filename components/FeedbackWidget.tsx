import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Language } from '../types';

/**
 * FEEDBACK WIDGET
 * A quietly-present launcher (bottom-right) that opens a small panel where anyone can
 * tell Elena what worked, what didn't, or what they wish the app did.
 *
 * The panel deliberately explains WHY the feedback is wanted — this app is made by one
 * student who actually changes it based on what people say.
 *
 * Posts to the shared endpoint on the portfolio origin (CORS-allowlisted for this
 * subdomain); the note lands in a private inbox, never shown publicly.
 */

const ENDPOINT = 'https://elenaprojects.cc/api/feedback';

interface FeedbackWidgetProps {
  language: Language;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ language }) => {
  const zh = language === 'zh';

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Esc closes; focus the textarea as soon as the panel opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => areaRef.current?.focus(), 80);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id); };
  }, [open]);

  const close = () => {
    setOpen(false);
    // Reset a little later so the closing transition doesn't flash the empty form.
    window.setTimeout(() => { if (sent) { setSent(false); setText(''); setName(''); } setError(''); }, 300);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (body.length < 2) { setError(zh ? '写一点点再发哦~' : 'A few more words first :)'); return; }

    setError('');
    setSending(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body, name: name.trim(), tool: 'tether' }),
      });
      if (res.ok) {
        setSent(true);
        try { (window as any).gtag?.('event', 'feedback_sent', { app: 'tether' }); } catch { /* GA optional */ }
        window.setTimeout(() => close(), 2400);
      } else {
        let data: any = {};
        try { data = await res.json(); } catch { /* non-JSON error */ }
        setError(
          data.error === 'blocked'
            ? (zh ? '看起来像广告 / 联系方式，没发出去 🙈 换个说法说说想法?' : "That looked like a link or contact info, so it wasn't sent. Try rewording?")
            : (zh ? '发送失败了，稍后再试一次。' : 'Could not send — please try again.')
        );
      }
    } catch {
      setError(zh ? '网络不太好，稍后再试~' : 'Network hiccup — try again in a bit.');
    }
    setSending(false);
  };

  return (
    <>
      {/* ---------- launcher: always reachable, never loud ---------- */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={zh ? '打开反馈窗' : 'Open feedback'}
          className="fixed bottom-5 right-5 z-[60] font-mono flex items-center gap-2 px-4 py-2.5 rounded-full
                     border border-white/20 text-white opacity-45 hover:opacity-100 hover:border-white/40
                     text-[10px] tracking-[0.25em] uppercase transition-all duration-300 backdrop-blur-md"
          style={{ background: 'rgb(var(--tint) / 0.06)' }}
        >
          <MessageCircle size={13} />
          <span className="hidden sm:inline">{zh ? '想法' : 'Feedback'}</span>
        </button>
      )}

      {/* ---------- panel ---------- */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 font-mono">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={close}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full sm:w-[390px] max-h-[88vh] overflow-y-auto rounded-3xl border p-6 sm:p-7 text-white shadow-2xl"
            style={{ background: 'var(--card)', borderColor: 'rgb(var(--line))' }}
          >
            <button
              onClick={close}
              aria-label={zh ? '关闭' : 'Close'}
              className="absolute top-4 right-4 opacity-40 hover:opacity-90 transition-opacity"
            >
              <X size={16} />
            </button>

            {sent ? (
              /* ---- thanks state ---- */
              <div className="py-10 text-center space-y-3">
                <div className="text-[26px]">💛</div>
                <p className="text-[15px]">{zh ? '谢谢你的反馈' : 'Thank you'}</p>
                <p className="text-[12px] opacity-60">{zh ? '我会认真看的。' : 'I read every one.'}</p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--rose)' }}>
                  {zh ? '说说你的想法' : 'Tell me what you think'}
                </p>

                {/* the ask — why their words matter */}
                <p className="text-[12.5px] leading-relaxed opacity-70 mb-5">
                  {zh
                    ? '这个小工具是我一个人做的，还在一直改。哪里不好用、哪里卡住了、想要什么功能——你的一句话我都会认真看，而且真的会照着改。'
                    : "I'm a student, and I built this on my own — it's still changing. If something felt confusing, broke, or you wish it did something else, tell me. I read every message, and I really do change things because of them."}
                </p>

                <textarea
                  ref={areaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={600}
                  rows={4}
                  placeholder={zh ? '好用的地方、难用的地方、卡住的地方、想要的功能…' : "What worked, what didn't, what you wish it did…"}
                  className="w-full rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-[13px] leading-relaxed
                             placeholder:opacity-40 focus:outline-none focus:border-white/45 transition-colors resize-none"
                />

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder={zh ? '名字 / 昵称（可留空）' : 'Name or nickname (optional)'}
                  className="mt-2.5 w-full rounded-2xl border border-white/20 bg-transparent px-4 py-2.5 text-[12.5px]
                             placeholder:opacity-40 focus:outline-none focus:border-white/45 transition-colors"
                />

                <button
                  type="submit"
                  disabled={sending}
                  className="mt-4 w-full rounded-full py-3 text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2
                             transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}
                >
                  <Send size={12} />
                  {sending ? (zh ? '发送中…' : 'Sending…') : (zh ? '发送' : 'Send')}
                </button>

                <p className="mt-3 text-center text-[10.5px] opacity-45">{zh ? '匿名也可以' : 'Anonymous is fine'}</p>

                {error && <p className="mt-2 text-center text-[11.5px]" style={{ color: 'var(--rose)' }}>{error}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;
