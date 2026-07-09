import React, { useEffect } from 'react';
import { X, Phone, MessageSquare, Globe, Heart } from 'lucide-react';
import { Language } from '../types';

interface Props {
  language: Language;
  onClose: () => void;
}

// A gentle crisis-support screen. Shown when someone may be in real danger, and
// always reachable via a quiet link — because taking a young person's safety
// seriously is itself a way of showing they are valued.
const SafetyNet: React.FC<Props> = ({ language, onClose }) => {
  const zh = language === 'zh';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const regions = [
    {
      flag: '🇨🇳', name: zh ? '中国大陆' : 'Mainland China',
      lines: [
        { icon: 'phone', label: zh ? '希望24热线（全国·24小时）' : 'Hope 24 Hotline (China, 24h)', value: '400-161-9995', href: 'tel:4001619995' },
        { icon: 'phone', label: zh ? '上海市心理援助热线（24小时）' : 'Shanghai Psychological Aid (24h)', value: '021-962525', href: 'tel:021962525' },
        { icon: 'phone', label: zh ? '北京心理危机干预热线' : 'Beijing Crisis Line', value: '010-82951332', href: 'tel:01082951332' },
      ],
    },
    {
      flag: '🇺🇸', name: zh ? '美国' : 'United States',
      lines: [
        { icon: 'phone', label: zh ? '988 自杀与危机生命线（电话/短信）' : '988 Suicide & Crisis Lifeline', value: '988', href: 'tel:988' },
        { icon: 'text', label: zh ? 'Crisis Text Line（短信）' : 'Crisis Text Line', value: zh ? '发送 HOME 至 741741' : 'Text HOME to 741741', href: 'sms:741741&body=HOME' },
      ],
    },
    {
      flag: '🌍', name: zh ? '其他地区' : 'Other regions',
      lines: [
        { icon: 'globe', label: zh ? '按你所在地查找当地热线' : 'Find a helpline near you', value: 'findahelpline.com', href: 'https://findahelpline.com' },
      ],
    },
  ];

  const Ico = ({ t }: { t: string }) => t === 'text' ? <MessageSquare size={15} /> : t === 'globe' ? <Globe size={15} /> : <Phone size={15} />;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-base)' }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl text-white p-7 relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"><X size={18} /></button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgb(var(--tint) / 0.08)' }}>
            <Heart size={22} className="text-teal-300" />
          </div>
          <h2 className="text-xl font-bold">{zh ? '你的安全，很重要 💗' : 'Your safety matters. 💗'}</h2>
          <p className="mt-3 text-[13.5px] text-white/70 leading-relaxed">
            {zh
              ? '如果此刻你觉得快撑不住了，请让一个真实的人陪你、帮你。你值得被好好接住——现在就可以联系他们。'
              : "If it feels like too much right now, please let a real person be with you. You deserve to be caught — you can reach them right now."}
          </p>
        </div>

        <div className="space-y-5">
          {regions.map((r) => (
            <div key={r.name}>
              <p className="text-[11px] tracking-widest uppercase text-white/40 mb-2 flex items-center gap-2"><span>{r.flag}</span>{r.name}</p>
              <div className="space-y-2">
                {r.lines.map((l) => (
                  <a
                    key={l.value}
                    href={l.href}
                    target={l.icon === 'globe' ? '_blank' : undefined}
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl glass-panel hover:bg-white/10 transition-colors"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-teal-300" style={{ background: 'rgb(var(--tint) / 0.06)' }}><Ico t={l.icon} /></span>
                    <span className="flex flex-col">
                      <span className="text-[11px] text-white/50 leading-tight">{l.label}</span>
                      <span className="text-[15px] font-bold tracking-wide">{l.value}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-white/35 leading-relaxed">
          {zh ? 'Tether 不能替代专业帮助，但会一直陪着你。' : "Tether isn't a substitute for professional help, but it stays with you."}
        </p>
        <button onClick={onClose} className="w-full mt-4 py-3 rounded-full text-sm tracking-widest border border-white/20 hover:bg-white/5 transition-colors">
          {zh ? '我先待一会儿' : 'I\'ll stay a moment'}
        </button>
      </div>
    </div>
  );
};

export default SafetyNet;
