import React, { useEffect } from 'react';
import { X, Heart, Sparkles } from 'lucide-react';
import { Language, Message } from '../types';

interface Props {
  messages: Message[];
  votedIds: Set<string>;
  onVote: (id: string) => void;
  language: Language;
  onClose: () => void;
}

// The "wall" — always reachable from the header, so anyone can read the kind words
// others have written (and add a heart), whatever mood they're in.
const WallPanel: React.FC<Props> = ({ messages, votedIds, onVote, language, onClose }) => {
  const zh = language === 'zh';
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[65] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)' }} className="w-full max-w-lg max-h-[88vh] overflow-hidden rounded-3xl shadow-2xl text-white flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <Sparkles size={16} className="text-teal-300" />
          <div>
            <h2 className="font-bold">{zh ? '大家的暖心话' : 'Wall of kind words'}</h2>
            <p className="text-[11px] opacity-50">{zh ? '每个人写给彼此的一点光' : 'little lights people wrote for each other'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto no-scrollbar p-5 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-[13px] opacity-50 py-16 leading-relaxed">{zh ? '还没有人写下暖心话，\n来做第一个吧 🌱' : 'No kind words yet —\nbe the first 🌱'}</p>
          ) : (
            messages.map((msg) => {
              const voted = votedIds.has(msg.id);
              const named = msg.senderName && !['Guide', '小伙伴', 'AI Companion'].includes(msg.senderName);
              return (
                <div key={msg.id} className="p-4 rounded-xl glass-panel">
                  <p className="text-sm font-serif italic mb-3 leading-relaxed">"{msg.text}"</p>
                  <div className="flex justify-between items-center text-[10px] opacity-60">
                    <span className="tracking-widest">{named ? `— ${msg.senderName}` : ''}</span>
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default WallPanel;
