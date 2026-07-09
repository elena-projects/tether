import React, { useState, useRef } from 'react';
import { Fingerprint, CheckSquare, Square, ArrowRight, Sliders, Activity, Users, Globe } from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../translations';

interface LandingProps {
  onEnter: (username: string, autoEnter: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LandingOverlay: React.FC<LandingProps> = ({ onEnter, language, setLanguage }) => {
  const zh = language === 'zh';
  const [username, setUsername] = useState("");
  const [autoEnter, setAutoEnter] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = getTranslation(language);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    performExit(username);
  };

  const performExit = (name: string) => {
    setIsExiting(true);
    setTimeout(() => {
      onEnter(name, autoEnter);
    }, 800); // Wait for animation
  };

  const handleStartTyping = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div style={{ ['--tint' as any]: '242 227 218' }} className={`fixed inset-0 z-50 bg-[#2b2420] flex flex-col items-center justify-start pt-[15vh] pb-12 transition-all duration-1000 overflow-y-auto ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
       <style>
         {`
           @keyframes floatGentle {
             0%, 100% { transform: translateY(0); }
             50% { transform: translateY(-8px); }
           }
           .animate-float-gentle {
             animation: floatGentle 6s ease-in-out infinite;
           }
         `}
       </style>
       {/* Language switcher (top-right) — simple 中文 / English toggle */}
       <div className="absolute top-6 right-6 z-20 flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-0.5 text-[11px] tracking-widest">
          <button
            onClick={() => setLanguage('zh')}
            className={`px-3 py-1 rounded-full transition-colors ${language === 'zh' ? 'bg-white/15 text-white font-bold' : 'text-white/50 hover:text-white/80'}`}
          >中文</button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded-full transition-colors ${language === 'en' ? 'bg-white/15 text-white font-bold' : 'text-white/50 hover:text-white/80'}`}
          >EN</button>
       </div>

       {/* Ambient Background Radial Gradient */}
       <div className="absolute inset-0 transition-opacity duration-1000" style={{
          background: `radial-gradient(circle at 50% 40%, #3a332d 0%, #2c2521 55%, #241d19 100%)`
       }}></div>

       {/* Film Grain Overlay */}
       <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
       }}></div>

       {/* Ambient Aura — soft pink wash behind the title */}
       <div className="absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[680px] bg-[#e0a6b0] opacity-[0.30] rounded-full blur-[160px] pointer-events-none"></div>
       <div className="absolute top-[64%] left-[36%] -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] bg-[#d9959f] opacity-[0.16] rounded-full blur-[150px] pointer-events-none"></div>

       <div className="relative z-10 w-full max-w-6xl px-6 md:px-12 flex flex-col items-center">
         
         <div className="flex flex-col items-center space-y-12 animate-float-gentle max-w-2xl text-center">
            <Fingerprint className="w-10 h-10 md:w-12 md:h-12 mx-auto text-white opacity-80" />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-sans font-bold tracking-[0.4em] text-white">TETHER</h1>
            <p className="text-sm md:text-base text-slate-400 font-serif italic leading-relaxed max-w-xl mx-auto">
              {t.appIntro}
            </p>
         </div>

         {/* Modern Bento/Grid Instructions */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 w-full max-w-4xl mx-auto my-16">
            {/* Step 1 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 group transition-all duration-500 hover:-translate-y-2">
               <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   <Sliders size={20} className="opacity-90" />
               </div>
               <h3 className="text-white font-sans font-medium tracking-widest text-sm uppercase">{zh ? '调频' : 'Tune In'}</h3>
               <p className="text-slate-500 font-sans leading-relaxed">{zh ? '用滑块描绘你此刻的情绪与能量。' : 'Use the sliders to define your current mood and energy.'}</p>
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 group transition-all duration-500 hover:-translate-y-2 delay-75">
               <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   <Activity size={20} className="opacity-90" />
               </div>
               <h3 className="text-white font-sans font-medium tracking-widest text-sm uppercase">{zh ? '沉浸' : 'Immerse'}</h3>
               <p className="text-slate-500 font-sans leading-relaxed">{zh ? '感受色彩与声音随你的频率流动。' : 'Experience how the colors and sounds shift to match your frequency.'}</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 group transition-all duration-500 hover:-translate-y-2 delay-150">
               <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   <Users size={20} className="opacity-90" />
               </div>
               <h3 className="text-white font-sans font-medium tracking-widest text-sm uppercase">{zh ? '连接' : 'Connect'}</h3>
               <p className="text-slate-500 font-sans leading-relaxed">{zh ? '低落时收到陌生人的牵系，充盈时为他人点一盏光。' : "Receive a tether from a stranger when you're low, or send a light when you're full."}</p>
            </div>
         </div>

         <div className="flex flex-col items-center gap-8 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
             <form onSubmit={handleSubmit} className="flex flex-col items-center gap-10 w-full">
                
                {/* Minimalist Input */}
                <div className="w-full flex flex-col items-center justify-center h-16">
                  {!isEditing && !username ? (
                    <div 
                        onClick={handleStartTyping}
                        className="cursor-text text-sm md:text-base font-sans font-medium tracking-[0.2em] text-slate-500 hover:text-slate-300 transition-colors duration-500 uppercase"
                    >
                        {zh ? '谁在进入？' : 'Who is entering?'}
                    </div>
                  ) : (
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onBlur={() => { if(!username) setIsEditing(false); }}
                      maxLength={12}
                      className="w-full bg-transparent border-b border-white/20 py-2 text-center font-sans text-xl md:text-2xl tracking-[0.2em] text-white focus:outline-none focus:border-white focus:shadow-[0_10px_10px_-10px_rgba(255,255,255,0.2)] transition-all duration-500"
                      autoFocus
                    />
                  )}
                </div>

                {/* ENTER BUTTON - Ghost Pill */}
                <button 
                  type="submit"
                  disabled={!username.trim()}
                  className="group flex justify-center items-center gap-4 px-12 py-4 bg-transparent border border-white/20 hover:bg-[#d5abb2] hover:text-[#2b2521] hover:border-transparent transition-all duration-500 rounded-full text-xs md:text-sm font-sans tracking-[0.2em] uppercase disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white disabled:cursor-not-allowed text-white shadow-none hover:shadow-[0_0_30px_rgba(194,150,156,0.35)]"
                >
                  <span className="font-semibold">{t.enter}</span>
                  <ArrowRight size={16} className="opacity-80 group-hover:translate-x-1 transition-transform duration-500" />
                </button>

                {/* CHECKPOINT / AUTO-ENTER TOGGLE */}
                <div 
                   onClick={() => setAutoEnter(!autoEnter)}
                   className={`flex items-center justify-center gap-3 mt-4 cursor-pointer group/check transition-all duration-500 ${!username.trim() ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-80 hover:opacity-100 translate-y-0'}`}
                >
                    {autoEnter ? (
                      <CheckSquare size={14} className="text-white" />
                    ) : (
                      <Square size={14} className="text-slate-500 group-hover/check:text-slate-300 transition-colors duration-500" />
                    )}
                    <span className="text-[10px] md:text-xs font-sans uppercase tracking-[0.2em] text-slate-500 group-hover/check:text-slate-300 transition-colors duration-500 select-none">{zh ? '记住我的身份' : 'Remember my identity'}</span>
                </div>

             </form>
         </div>
       </div>
    </div>
  );
};

export default LandingOverlay;