import React, { useState } from 'react';
import { Fingerprint, CheckSquare, Square, ArrowRight, Sliders, LifeBuoy, Users } from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../translations';

interface LandingProps {
  onEnter: (username: string, autoEnter: boolean) => Promise<void>;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LandingOverlay: React.FC<LandingProps> = ({ onEnter, language, setLanguage }) => {
  const zh = language === 'zh';
  const [username, setUsername] = useState("");
  const [autoEnter, setAutoEnter] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = getTranslation(language);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    performExit(username);
  };

  const performExit = async (name: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsExiting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await onEnter(name, autoEnter);
  };

  return (
    <div style={{ ['--tint' as any]: '237 228 218' }} className={`fixed inset-0 z-50 bg-[#3a322c] flex flex-col items-center justify-start pt-12 sm:pt-14 md:pt-10 lg:pt-12 pb-12 transition-all duration-1000 overflow-y-auto ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
          background: `radial-gradient(circle at 50% 40%, #4b4137 0%, #3c332c 55%, #322a24 100%)`
       }}></div>

       {/* Film Grain Overlay */}
       <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
       }}></div>

       {/* Ambient Aura — soft terracotta "warm light" wash behind the title */}
       <div className="absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[680px] bg-[#d4967a] opacity-[0.28] rounded-full blur-[160px] pointer-events-none"></div>
       <div className="absolute top-[64%] left-[36%] -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] bg-[#c97f5e] opacity-[0.15] rounded-full blur-[150px] pointer-events-none"></div>

       <div className="relative z-10 w-full max-w-6xl px-6 md:px-12 flex flex-col items-center">
         
         <div className="flex flex-col items-center space-y-5 md:space-y-6 animate-float-gentle max-w-2xl text-center">
            <Fingerprint className="w-10 h-10 md:w-12 md:h-12 mx-auto text-white opacity-80" />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-sans font-bold tracking-[0.4em] text-white">TETHER</h1>
            <p className="text-sm md:text-base text-slate-300/80 font-serif italic leading-relaxed max-w-xl mx-auto">
              {t.appIntro}
            </p>
         </div>

         <form onSubmit={handleSubmit} className="mt-8 md:mt-9 flex flex-col items-center gap-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
            <div className="w-full">
              <label htmlFor="display-name" className="block text-center text-[11px] font-bold tracking-[0.2em] text-white/80 uppercase mb-3">
                {zh ? '显示名称' : 'Display name'}
              </label>
              <input
                id="display-name"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={12}
                autoComplete="nickname"
                placeholder={zh ? '用任何让你舒服的名字' : 'Any name you feel comfortable with'}
                aria-describedby="display-name-help"
                className="w-full rounded-md border border-white/25 bg-white/[0.06] px-4 py-3.5 text-center font-sans text-base text-white placeholder:text-white/45 focus:outline-none focus:border-[#d99a7d] focus:ring-2 focus:ring-[#d99a7d]/25 transition-colors"
              />
              <p id="display-name-help" className="mt-2.5 text-center text-[11px] leading-relaxed text-white/60">
                {zh ? '不需要真实姓名。只有选择记住时，才会保存在这台设备上。' : 'No real name needed. It stays on this device only if you choose remember.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={!username.trim() || isSubmitting}
              className="group flex w-full justify-center items-center gap-3 px-8 py-3.5 bg-[#d1855f] text-[#2b2521] hover:bg-[#dfa07f] transition-all duration-300 rounded-full text-xs md:text-sm font-sans tracking-[0.16em] uppercase disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_8px_28px_rgba(209,133,95,0.2)]"
            >
              <span className="font-bold">{isSubmitting ? (zh ? '正在进入…' : 'Entering…') : t.enter}</span>
              <ArrowRight size={16} className="opacity-80 group-hover:translate-x-1 transition-transform" />
            </button>

            <label className={`flex items-center justify-center gap-3 cursor-pointer group/check transition-opacity ${!username.trim() ? 'opacity-35' : 'opacity-80 hover:opacity-100'}`}>
              <input
                type="checkbox"
                checked={autoEnter}
                onChange={(e) => setAutoEnter(e.target.checked)}
                disabled={!username.trim() || isSubmitting}
                className="sr-only"
              />
              {autoEnter ? (
                <CheckSquare size={15} className="text-white" />
              ) : (
                <Square size={15} className="text-slate-300" />
              )}
              <span className="text-[10px] md:text-xs font-sans uppercase tracking-[0.16em] text-slate-300 select-none">{zh ? '在这台设备上记住我' : 'Remember me on this device'}</span>
            </label>
         </form>

         {/* Product path — visible as the next section, after the primary action. */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-9 md:gap-14 w-full max-w-4xl mx-auto mt-11 md:mt-10 pt-8 md:pt-8 border-t border-white/10">
            {/* Step 1 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 group transition-all duration-500 hover:-translate-y-2">
               <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   <Sliders size={20} className="opacity-90" />
               </div>
               <h3 className="text-white font-sans font-medium tracking-widest text-sm uppercase">{zh ? '看见此刻' : 'See where you are'}</h3>
               <p className="text-slate-300/70 font-sans leading-relaxed">{zh ? '画出此刻的情绪与能量，给说不清的感受一个形状。' : 'Map your mood and energy right now — give the feeling a shape.'}</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 group transition-all duration-500 hover:-translate-y-2 delay-75">
               <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   <LifeBuoy size={20} className="opacity-90" />
               </div>
               <h3 className="text-white font-sans font-medium tracking-widest text-sm uppercase">{zh ? '稳住自己' : 'Steady yourself'}</h3>
               <p className="text-slate-300/70 font-sans leading-relaxed">{zh ? '难受时用几个小工具缓一缓，慢慢也能看到自己情绪的走向。' : 'Reach for small tools when it’s a lot — and watch how your mood trends over time.'}</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 group transition-all duration-500 hover:-translate-y-2 delay-150">
               <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   <Users size={20} className="opacity-90" />
               </div>
               <h3 className="text-white font-sans font-medium tracking-widest text-sm uppercase">{zh ? '被看见' : 'Be seen'}</h3>
               <p className="text-slate-300/70 font-sans leading-relaxed">{zh ? '低落时收到陌生人的牵系，充盈时为他人点一盏光。' : "Receive a tether from a stranger when you're low, or send a light when you're full."}</p>
            </div>
         </div>
       </div>
    </div>
  );
};

export default LandingOverlay;
