import React, { useState } from 'react';
import { Heart, Bot, Sparkles } from 'lucide-react';
import { Message } from '../types';

interface MessageCardProps {
  msg: Message;
  onVote: (id: string) => void;
  isVoted: boolean;
  theme: any;
}

export const MessageCard: React.FC<MessageCardProps> = ({ msg, onVote, isVoted, theme }) => {
  const [showAnim, setShowAnim] = useState(false);
  const isAI = msg.type === 'ai';

  const handleClick = () => {
    if (isVoted) return;
    onVote(msg.id);
    setShowAnim(true);
    setTimeout(() => setShowAnim(false), 1000);
  };

  return (
    <div className={`
      relative overflow-hidden rounded-r-md p-4 mb-3 transition-all duration-500 group
      border-l-2 animate-in fade-in slide-in-from-left-2 duration-1000
      ${isAI 
        ? 'border-teal-400 bg-gradient-to-r from-teal-950/40 to-black/20 shadow-[0_0_20px_rgba(45,212,191,0.05)]' 
        : 'border-white/60 bg-white/5 hover:bg-white/10'}
    `}>
      {/* AI Decorative Background Elements */}
      {isAI && (
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
          <Bot size={48} />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3 relative z-10">
         <div className="flex items-center gap-2">
            {isAI ? (
               <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30">
                  <Sparkles size={10} className="text-teal-200 animate-pulse" />
                  <span className="text-[9px] font-bold text-teal-100 tracking-widest">AI • {msg.senderName}</span>
               </div>
            ) : (
               <span className="text-[10px] tracking-widest opacity-60 uppercase font-bold">{msg.senderName || 'UNKNOWN'}</span>
            )}
         </div>
         <span className="text-[9px] opacity-30 font-mono">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
      </div>

      {/* Message Body */}
      <p className={`
        text-lg leading-relaxed font-serif relative z-10
        ${isAI ? 'text-teal-50 italic drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]' : theme.accent}
      `}>
        "{msg.text}"
      </p>
      
      {/* Footer / Actions */}
      <div className="mt-4 flex justify-end relative z-10">
         <button 
           onClick={handleClick}
           disabled={isVoted}
           className={`group/btn flex items-center gap-2 transition-all text-[10px] uppercase tracking-wider ${isVoted ? 'cursor-default opacity-80' : 'hover:text-rose-200 cursor-pointer opacity-60 hover:opacity-100'}`}
         >
            <span className={`opacity-0 transition-opacity duration-300 -mr-1 ${!isVoted && 'group-hover/btn:opacity-100'}`}>
              {isVoted ? 'Saved' : 'Appreciate'}
            </span>
            
            <div className="relative p-1">
              <Heart 
                size={16} 
                strokeWidth={isVoted ? 0 : 1.5}
                className={`transition-all duration-500 ${isVoted ? "fill-rose-500 text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.6)] scale-110" : "text-current group-hover/btn:scale-110"}`} 
              />
              {showAnim && (
                <span className="absolute -top-4 right-0 text-rose-400 text-sm font-bold animate-float-up pointer-events-none">
                  +1
                </span>
              )}
            </div>

            {(msg.voteCount > 0 || isVoted) && <span className="font-mono">{msg.voteCount}</span>}
         </button>
      </div>
    </div>
  );
};