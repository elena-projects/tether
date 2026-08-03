import React, { useEffect, useState } from 'react';
import { X, Clock, Activity, Heart, Award, Send } from 'lucide-react';
import { getHistory } from '../services/firebase';
import { HistoryEntry, TetherState } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  healingScore: number;
  labels: {
    healingPower: string;
    yourImpact: string;
  };
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, userId, healingScore, labels }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      
      // 1. Fetch Remote History
      const fetchPromise = userId ? getHistory(userId) : Promise.resolve([]);
      
      fetchPromise.then((remoteData) => {
        // 2. Fetch Local "Sent" Messages
        const localSent = JSON.parse(localStorage.getItem('my_sent_messages') || '[]');
        
        // Transform local messages to match history shape somewhat
        const formattedLocal = localSent.map((msg: any) => ({
            id: msg.id,
            timestamp: msg.timestamp,
            state: { valence: 70, arousal: 50 }, // Mock anchored state
            note: `Sent to ${msg.target}: "${msg.text}"`,
            isSent: true // Custom flag for UI
        }));

        // 3. Merge and Sort (Newest first)
        const combined = [...remoteData, ...formattedLocal].sort((a, b) => b.timestamp - a.timestamp);
        
        setHistory(combined);
        setLoading(false);
      });
    }
  }, [isOpen, userId]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMoodLabel = (state: TetherState) => {
    if (state.valence > 60) return "ANCHORED";
    if (state.valence < 40) return "DRIFTING";
    return "WITNESS";
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      )}
      
      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-[#111] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-white/70" />
            <h2 className="text-sm font-bold tracking-widest text-white">YOUR PATH</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Healing Score Card */}
        <div className="p-6 pb-2">
          <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-5 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
               <Heart size={64} className="fill-white" />
            </div>
            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1 text-rose-200">{labels.healingPower}</p>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-bold text-white drop-shadow-md">{healingScore}</span>
               <span className="text-xs opacity-50">hearts received</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center text-white/30 text-xs animate-pulse">Scanning archives...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-white/30 text-xs">No records found yet.</div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className={`relative pl-4 border-l ${entry.isSent ? 'border-teal-500/50' : 'border-white/10'} pb-4 last:pb-0`}>
                <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full border ${entry.isSent ? 'bg-teal-900 border-teal-500' : 'bg-[#333] border-white/20'}`}></div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/40 font-mono tracking-wide">{formatDate(entry.timestamp)}</span>
                  
                  {entry.isSent ? (
                      // Sent Message Style
                      <div className="flex items-start gap-2 mt-1">
                         <Send size={12} className="text-teal-400 mt-1 shrink-0" />
                         <div className="flex flex-col">
                            <span className="text-xs font-bold tracking-widest text-teal-200">MESSAGE SENT</span>
                            <span className="text-[11px] italic text-white/60 font-serif leading-snug mt-1">"{entry.note?.split('"')[1] || entry.note}"</span>
                         </div>
                      </div>
                  ) : (
                      // State Record Style
                      <>
                        <span className={`text-xs font-bold tracking-widest ${entry.state.valence < 40 ? 'text-white/45' : 'text-teal-300'}`}>
                            {getMoodLabel(entry.state)}
                        </span>
                        <div className="flex gap-2 mt-1 opacity-60 text-[10px] uppercase">
                            <span className="bg-white/5 px-1 rounded">V: {entry.state.valence}</span>
                            <span className="bg-white/5 px-1 rounded">A: {entry.state.arousal}</span>
                        </div>
                      </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default HistoryPanel;