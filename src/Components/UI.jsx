import React from 'react';
// Updated list to include Flag, MessageSquare, and everything else
import { 
    Target, 
    Trophy, 
    BarChart2, 
    FileText, 
    MessageSquare, 
    Menu, 
    Flag 
} from 'lucide-react';

/**
 * 1. HEADER COMPONENT
 */
export function Header({ gameId, courseName, onMenuOpen }) {
    return (
        <header className="bg-emerald-800 text-white p-4 pt-6 shadow-lg relative z-50">
            <div className="flex justify-between items-center max-w-md mx-auto">
                <div className="flex items-center gap-3">
                    {/* CUSTOM LOGO CONTAINER */}
                    <div className="bg-white p-1 rounded-xl shadow-inner w-10 h-10 flex items-center justify-center overflow-hidden">
                        <img 
                            src="/logo.png" 
                            alt="YKTS Logo" 
                            className="w-full h-full object-contain"
                            onError={(e) => e.target.src = 'https://placehold.co/40x40?text=⛳'} 
                        />
                    </div>
                    
                    <div>
                        <h1 className="text-xl font-black leading-none tracking-tighter italic">YKTS</h1>
                        <p className="text-[10px] font-black uppercase text-emerald-300 tracking-widest mt-1 truncate max-w-[120px]">
                            {courseName || 'Loading...'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-700/50">
                        <span className="text-[10px] font-black tracking-widest text-emerald-100 uppercase">
                            {gameId || '----'}
                        </span>
                    </div>
                    <button onClick={onMenuOpen} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <Menu size={24} />
                    </button>
                </div>
            </div>
        </header>
    );
}
/**
 * 2. NAVIGATION COMPONENT
 */
export function Navigation({ current, onNavigate }) {
    const tabs = [
        { id: 'scoring', icon: Target, label: 'Score' },
        { id: 'leaderboard', icon: Trophy, label: 'Board' },
        { id: 'stats', icon: BarChart2, label: 'Stats' },
        { id: 'feed', icon: MessageSquare, label: 'Feed' },
        { id: 'scorecard', icon: FileText, label: 'Card' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 p-4 pb-8 z-50">
            <div className="flex justify-around items-center max-w-md mx-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onNavigate(tab.id)}
                        className={`flex flex-col items-center gap-1 transition-all ${
                            current === tab.id ? 'text-emerald-600 scale-110' : 'text-slate-300'
                        }`}
                    >
                        <tab.icon size={20} strokeWidth={current === tab.id ? 3 : 2} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">{tab.label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
export function SplashScreen({ isExiting }) {
    return (
        <div className={`fixed inset-0 z-[100] bg-emerald-800 flex flex-col items-center justify-center transition-opacity duration-500 ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex flex-col items-center animate-logo">
                <div className="w-24 h-24 bg-white p-3 rounded-[2rem] shadow-2xl mb-6">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-4xl font-black text-white tracking-tighter italic">YKTS</h1>
                <div className="mt-4 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
            
            <p className="absolute bottom-12 text-emerald-300/50 text-[10px] font-black uppercase tracking-[0.3em]">
                You Know The Score
            </p>
        </div>
    );
}