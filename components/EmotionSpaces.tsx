import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Flag, Heart, Loader2, PenLine, RefreshCw, Send } from 'lucide-react';
import { Language, TetherState } from '../types';
import { EMOTION_SPACES, EmotionId, EmotionNote, SpaceError, readSpace, leaveNote, encourageNote, reportNote } from '../services/emotionSpaces';

interface Props { language: Language; state: TetherState; onAdjust: () => void; onRest: () => void; onNeedHelp: () => void; }

function errorCopy(error: unknown, zh: boolean) {
  if (error instanceof SpaceError) {
    if (error.needsSupport) return zh ? '这句话没有公开。你现在的感受值得被认真照顾，可以先看看能马上联系的人。' : 'This was not published. What you are feeling deserves care. You can reach someone who can help now.';
    if (error.code === 'blocked') return zh ? '这句话暂时不能公开。可以留下自己的感受，请避开攻击、个人信息或危险细节。' : 'This cannot be shared publicly. Your feelings are welcome; please leave out attacks, personal information, or dangerous details.';
    if (error.code === 'unverifiable') return zh ? '暂时无法完成审核，还没有发布。文字已保留在输入框中。' : 'The review is unavailable. Nothing was published; your words are still here.';
    if (error.code === 'rate_limit') return zh ? '稍微等一会儿，再试一次。' : 'Please wait a moment and try again.';
    if (error.code === 'not_found') return zh ? '这句话已经不在这里了，可以刷新看看。' : 'That note is no longer here. Try refreshing.';
  }
  return zh ? '暂时连接不上，稍后可以再试。' : 'We could not connect. Please try again.';
}

const Room: React.FC<{ emotion: EmotionId; language: Language; onBack: () => void; onNeedHelp: () => void }> = ({ emotion, language, onBack, onNeedHelp }) => {
  const zh = language === 'zh', space = EMOTION_SPACES[emotion];
  const [mode, setMode] = useState<'read' | 'write' | null>(null);
  const [notes, setNotes] = useState<EmotionNote[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [support, setSupport] = useState(false);
  const [sent, setSent] = useState(false);
  const [replyNote, setReplyNote] = useState<string | null>(null);
  const [replyChoice, setReplyChoice] = useState<number | null>(null);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replied, setReplied] = useState<Set<string>>(new Set());
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportError, setReportError] = useState<{ id: string; message: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const writeLock = useRef(false);
  const replyLock = useRef(false);
  const load = async (older = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true); setLoadError('');
    try {
      const data = await readSpace(emotion, older ? cursor : null, controller.signal);
      if (controller.signal.aborted) return;
      setNotes(previous => older ? [...previous, ...data.notes.filter(n => !previous.some(p => p.id === n.id))] : data.notes);
      setCursor(data.cursor);
    } catch (e) { if (!controller.signal.aborted) setLoadError(errorCopy(e, zh)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => { if (mode === 'read') void load(); }, [mode]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (writeLock.current || !text.trim()) return;
    writeLock.current = true; setSending(true); setError(''); setSupport(false);
    try {
      const result = await leaveNote(emotion, text.trim(), language);
      if (!alive.current) return;
      setNotes(previous => [result.note, ...previous]); setText(''); setSent(true);
    } catch (e) { if (alive.current) { setError(errorCopy(e, zh)); setSupport(e instanceof SpaceError && e.needsSupport); } }
    finally { writeLock.current = false; if (alive.current) setSending(false); }
  };
  const reply = async (id: string) => {
    if (replyChoice === null || replyLock.current || replied.has(id)) return;
    replyLock.current = true; setReplySending(true); setReplyError('');
    try {
      const data = await encourageNote(emotion, id, replyChoice);
      if (!alive.current) return;
      setNotes(previous => previous.map(note => note.id === id ? { ...note, encouragements: { ...note.encouragements, [`c${data.choice}`]: data.count } } : note));
      setReplied(previous => new Set([...previous, id])); setReplyNote(null); setReplyChoice(null);
    } catch (e) { if (alive.current) setReplyError(errorCopy(e, zh)); }
    finally { replyLock.current = false; if (alive.current) setReplySending(false); }
  };
  const report = async (id: string) => {
    if (reporting || reported.has(id)) return;
    setReporting(id); setReportError(null);
    try {
      await reportNote(emotion, id);
      if (alive.current) setReported(previous => new Set([...previous, id]));
    } catch (e) {
      if (alive.current) setReportError({ id, message: errorCopy(e, zh) });
    } finally {
      if (alive.current) setReporting(null);
    }
  };
  return <section className="emotion-room" style={{ '--space-color': space.color } as React.CSSProperties}>
    <button className="space-back" onClick={onBack} disabled={sending || replySending}><ArrowLeft size={16} />{zh ? '换一个空间' : 'Other spaces'}</button>
    <header className="space-heading"><span className="space-swatch" /><h2>{space.label[language]}</h2><p>{space.hint[language]}</p></header>
    <div className="space-choices" role="group" aria-label={zh ? '此刻想做什么' : 'What feels right now'}>
      <button aria-pressed={mode === 'read'} disabled={sending || replySending} onClick={() => { setMode('read'); setSent(false); }}><BookOpen size={20} /><span>{zh ? '看看别人留下的话' : 'Read others’ words'}</span></button>
      <button aria-pressed={mode === 'write'} disabled={sending || replySending} onClick={() => { setMode('write'); setSent(false); }}><PenLine size={20} /><span>{zh ? '留下一句话' : 'Leave a few words'}</span></button>
    </div>
    {mode === null && <p className="space-quiet">{zh ? '只是看看，也很好。' : 'Just being here is enough.'}</p>}
    {mode === 'write' && (sent ? <div className="space-confirmation" role="status"><Check size={28} /><h3>{zh ? '你的这句话，留在这里了。' : 'Your words have a place here.'}</h3><p>{zh ? '另一个有相似感受的人，也许会在这里遇见它。' : 'Someone feeling something similar may find them here.'}</p><button className="space-primary" onClick={() => { setSent(false); setMode('read'); }}><BookOpen size={16} />{zh ? '看看其他人的话' : 'Read other notes'}</button></div> : <form className="space-compose" onSubmit={submit}>
      <label htmlFor="space-note">{zh ? '此刻，你想留下什么？' : 'What is on your mind right now?'}</label>
      <textarea id="space-note" value={text} onChange={e => { setText(e.target.value); setError(''); setSupport(false); }} maxLength={300} rows={5} placeholder={space.placeholder[language]} disabled={sending} aria-describedby="space-privacy" />
      <div className="space-compose-meta"><p id="space-privacy">{zh ? '公开匿名 · 不关联昵称或个人账号。请勿填写个人信息。' : 'Public and anonymous. No name or account is attached. Leave out personal details.'}</p><span>{text.length}/300</span></div>
      {error && <p role="alert" className="space-error">{error}</p>}
      {support && <button className="space-back" type="button" onClick={onNeedHelp}><Heart size={16} />{zh ? '找一个能马上帮忙的人' : 'Find someone who can help now'}</button>}
      <button className="space-primary" type="submit" disabled={sending || !text.trim()}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{sending ? (zh ? '正在审核…' : 'Reviewing…') : (zh ? '匿名留下' : 'Leave anonymously')}</button>
    </form>)}
    {mode === 'read' && <div className="space-feed">
      <div className="space-feed-heading"><h3>{zh ? '此刻，有人也这样感觉' : 'Someone has felt this too'}</h3><button className="space-icon" aria-label={zh ? '刷新留言' : 'Refresh notes'} title={zh ? '刷新留言' : 'Refresh notes'} disabled={loading || replySending} onClick={() => void load()}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button></div>
      {loadError && <p role="alert" className="space-error">{loadError}<button onClick={() => void load()}>{zh ? '重试' : 'Retry'}</button></p>}
      {loading && !notes.length && <p role="status" className="space-quiet">{zh ? '正在读大家留下的话…' : 'Loading the words left here…'}</p>}
      {!loading && !loadError && !notes.length && <p className="space-quiet">{zh ? '这里还没有人留下话。你可以静静待一会儿，也可以写下第一句。' : 'No words have been left here yet. You can stay quietly, or leave the first note.'}</p>}
      {notes.map(note => <article className="space-note" key={note.id}>
        <p className="space-note-text">{note.text}</p>
        <div className="space-note-meta"><time dateTime={new Date(note.timestamp).toISOString()}>{new Date(note.timestamp).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}</time><span><button disabled={reported.has(note.id) || reporting === note.id} onClick={() => void report(note.id)}><Flag size={14} />{reported.has(note.id) ? (zh ? '已举报' : 'Reported') : reporting === note.id ? (zh ? '正在提交' : 'Reporting') : (zh ? '举报' : 'Report')}</button><button disabled={replied.has(note.id) || replySending} onClick={() => { setReplyNote(replyNote === note.id ? null : note.id); setReplyChoice(null); setReplyError(''); }}><Heart size={15} />{replied.has(note.id) ? (zh ? '心意已留下' : 'Kindness sent') : (zh ? '留一点鼓励' : 'Leave encouragement')}</button></span></div>
        {reportError?.id === note.id && <p role="alert" className="space-error">{reportError.message}</p>}
        {space.encouragements.map((message, i) => note.encouragements[`c${i}`] > 0 && <p className="space-encouragement" key={i}><Heart size={13} /><span>{message[language]}</span><span>{note.encouragements[`c${i}`]}</span></p>)}
        {replyNote === note.id && <fieldset className="space-reply" disabled={replySending}><legend>{zh ? '选一句你想对 TA 说的话' : 'Choose what you would like to say'}</legend>{space.encouragements.map((message, i) => <label key={i}><input type="radio" name={`reply-${note.id}`} value={i} checked={replyChoice === i} onChange={() => setReplyChoice(i)} /><span>{message[language]}</span></label>)}{replyError && <p role="alert" className="space-error">{replyError}</p>}<button className="space-primary" disabled={replyChoice === null || replySending} onClick={() => void reply(note.id)}>{replySending ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}{zh ? '送出这句话' : 'Send these words'}</button></fieldset>}
      </article>)}
      {cursor && <button className="space-back" disabled={loading} onClick={() => void load(true)}>{loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{zh ? '看看更早的话' : 'Earlier notes'}</button>}
    </div>}
  </section>;
}

export default function EmotionSpaces({ language, state, onAdjust, onRest, onNeedHelp }: Props) {
  const zh = language === 'zh';
  const [emotion, setEmotion] = useState<EmotionId | null>(null);
  const suggested: EmotionId | null = state.valence === 50 && state.arousal === 50 ? null
    : state.valence < 40 ? (state.arousal > 60 ? 'anxious' : state.arousal < 40 ? 'tired' : 'sad')
    : state.valence > 65 ? 'calm' : 'numb';
  return <div className="emotion-spaces">
    {emotion ? <Room key={emotion} emotion={emotion} language={language} onBack={() => setEmotion(null)} onNeedHelp={onNeedHelp} /> : <>
      <button className="space-back" onClick={onAdjust}><ArrowLeft size={16} />{zh ? '回到心情坐标' : 'Back to your mood'}</button>
      <header className="space-heading"><h2>{zh ? '此刻，哪一种感觉更靠近你？' : 'What feels closest right now?'}</h2><p>{zh ? '不必很确定，也不用只有一种。' : 'You do not need to be certain, or feel only one thing.'}</p></header>
      <div className="space-grid">{(Object.keys(EMOTION_SPACES) as EmotionId[]).map(id => { const room = EMOTION_SPACES[id]; return <button key={id} className="space-option" onClick={() => setEmotion(id)} style={{ '--space-color': room.color } as React.CSSProperties}><span className="space-swatch" /><span><strong>{room.label[language]}</strong><span>{room.hint[language]}</span>{suggested === id && <small>{zh ? '与你刚才的坐标接近' : 'Near your current mood'}</small>}</span><ArrowRight size={17} /></button>; })}</div>
    </>}
    <button className="space-rest" onClick={onRest}>{zh ? '先在这里歇一会儿' : 'Take a quiet breath'}<ArrowRight size={16} /></button>
  </div>;
}
