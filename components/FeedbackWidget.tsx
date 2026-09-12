import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, LifeBuoy } from 'lucide-react';
import { Language } from '../types';
import { screenConfide } from '../services/geminiService';

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
 *
 * People do not always use this box for feedback. On an app about how you feel, an
 * invitation to write to a real person is sometimes the only thing on screen that looks
 * like it will listen — someone has already written "I really want somebody to love me"
 * here. That note reaches a private inbox that may not be read for days, so anything
 * suggesting real distress must not be answered with "thanks for the feedback" and
 * nothing else. It still gets sent; the difference is that help is offered straight away.
 */

const ENDPOINT = 'https://elenaprojects.cc/api/feedback';

interface FeedbackWidgetProps {
  language: Language;
  onNeedHelp: () => void;      // opens the real-help screen
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ language, onNeedHelp }) => {
  const zh = language === 'zh';

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reachedOut, setReachedOut] = useState(false);   // the note read as real distress
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
    window.setTimeout(() => { if (sent) { setSent(false); setReachedOut(false); setText(''); setName(''); } setError(''); }, 300);
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
        // Screening happens after sending, never before: the note reaches the inbox either
        // way, and nobody's words get held up while we decide how to answer them.
        const screen = await screenConfide(body, language);
        if (screen.screened && screen.crisis) {
          setReachedOut(true);          // stay open, offer help, don't auto-close
        } else {
          window.setTimeout(() => close(), 2400);
        }
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

            {sent && reachedOut ? (
              /* ---- they didn't write feedback; they said something heavy ---- */
              <div className="py-6 space-y-4">
                <LifeBuoy size={22} style={{ color: 'var(--rose)' }} />
                <p className="text-[15px] leading-relaxed">{zh ? '你写的这些，我看到了。' : 'I read what you wrote.'}</p>
                <p className="text-[12.5px] opacity-70 leading-relaxed">
                  {zh
                    ? '这条会送到我这里，但我可能过几天才看到 —— 而你现在就在难受。所以别只等我:下面是此刻就能找到的人。'
                    : "This reaches me, but I might not see it for days — and you're hurting now. So don't wait on me: below are people you can reach today."}
                </p>
                <button onClick={onNeedHelp}
                  className="w-full rounded-full py-3 text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2"
                  style={{ background: 'var(--rose)', color: 'var(--bg-base)' }}>
                  <LifeBuoy size={13} /> {zh ? '看看能帮上忙的人' : 'See who can help'}
                </button>
                <button onClick={close} className="w-full text-[11px] opacity-45 hover:opacity-80 py-1">
                  {zh ? '我知道了' : 'Okay'}
                </button>
              </div>
            ) : sent ? (
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

                {/* This box reaches one person, eventually. Say so before someone trusts it
                    with something that can't wait. */}
                <button type="button" onClick={onNeedHelp}
                  className="mt-3 w-full text-[10.5px] opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                  <LifeBuoy size={11} />
                  {zh ? '如果现在很难受，这里有能马上帮上忙的人' : "If you're struggling right now, there are people who can help today"}
                </button>

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
