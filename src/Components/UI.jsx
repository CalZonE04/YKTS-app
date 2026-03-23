import React from 'react';
// Updated list to include Flag, MessageSquare, and everything else
import { 
    Menu, X, Trophy, Flag, 
    ChevronRight, CheckCircle2, Trash2, 
    LayoutGrid, Trophy as TrophyIcon, BarChart2, MessageSquare, CreditCard,
    Share, LogOut, Target, FileText // <--- NEW ICONS
} from 'lucide-react';

/**
 * 1. HEADER (With Obvious Game Code)
 */
export function Header({ gameId, courseName, onMenuOpen, isSpectator }) { 
    return (
        <header className="bg-emerald-800 text-white p-4 pt-6 shadow-lg relative z-50">
            <div className="flex justify-between items-center max-w-md mx-auto">
                
                {/* LOGO & COURSE NAME */}
                <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-xl shadow-inner w-10 h-10 flex items-center justify-center overflow-hidden">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black leading-none tracking-tighter italic">YKTS</h1>
                        <p className="text-[10px] font-black uppercase text-emerald-300 tracking-widest mt-1 truncate max-w-[120px]">
                            {courseName || 'Live Scoring'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    
                    {/* SECURE BADGE: Hide the game code if they are just watching */}
                    {!isSpectator ? (
                        <div className="bg-emerald-900 px-3 py-1.5 rounded-lg border border-emerald-600 shadow-sm flex items-center gap-1.5">
                            <span className="text-[8px] font-black tracking-widest text-emerald-400 uppercase">
                                Code
                            </span>
                            <span className="text-xs font-black tracking-widest text-white uppercase">
                                {gameId || '----'}
                            </span>
                        </div>
                    ) : (
                        <div className="bg-blue-900/50 px-3 py-1.5 rounded-lg border border-blue-700/50 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black tracking-widest text-blue-100 uppercase">
                                SPECTATING
                            </span>
                        </div>
                    )}
                    
                    {/* MENU BUTTON */}
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
        { id: 'feed', icon: MessageSquare, label: 'Gallery' },
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
/**
 * 3. MENU OVERLAY (Fully Secured against Spectators)
 */
export function MenuOverlay({ isOpen, onClose, onEndRound, onLeaveGame, gameId, mode, showToast, isSpectator }) {
    if (!isOpen) return null;

    const handleShare = async () => {
        const joinLink = `${window.location.origin}?join=${gameId}`;
        const shareText = `⛳️ YKTS (You Know The Score)\n\n🏌️‍♂️ Get involved in the game!\nTap the link to view the live scorecard and join the action:\n${joinLink}`;

        // 1. Try the Native Share Sheet FIRST (For Mobile: WhatsApp, iMessage, etc.)
        if (navigator.share && navigator.canShare) {
            try {
                await navigator.share({ 
                    title: 'YKTS Live Scorecard', 
                    text: shareText 
                });
                return; // Stop here if the share sheet successfully opened!
            } catch (e) {
                console.log("Share sheet dismissed or unsupported.");
                // If they manually closed the share sheet, stop here.
                if (e.name === 'AbortError') return; 
            }
        }

        // 2. FALLBACK: Copy to Clipboard (For Laptops / Desktop Browsers)
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(shareText);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = shareText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
            if (showToast) showToast("Invite link copied to clipboard! 📋");
        } catch (err) {
            console.error("Clipboard copy failed:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-t-[3rem] p-8 pb-12 animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
                
                <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase italic tracking-tighter">Round Menu</h2>
                
                <div className="space-y-3">
                    <button onClick={onClose} className="w-full p-5 bg-slate-100 rounded-2xl font-black text-slate-900 flex justify-between items-center active:scale-95 transition-all">
                        {isSpectator ? 'Close Menu' : 'Resume Round'}
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                    
                    {/* ONLY PLAYERS CAN SHARE THE CODE OR END THE ROUND */}
                    {!isSpectator && (
                        <>
                            <button onClick={handleShare} className="w-full p-5 bg-blue-50 text-blue-600 rounded-2xl font-black flex justify-between items-center active:scale-95 transition-all">
                                Share Lobby Code
                                <Share size={18} />
                            </button>
                            
                            <button onClick={onEndRound} className="w-full p-5 bg-emerald-600 rounded-2xl font-black text-white flex justify-between items-center shadow-lg active:scale-95 transition-all">
                                End & Save Round
                                <CheckCircle2 size={20} />
                            </button>
                        </>
                    )}
                    
                    <button onClick={onLeaveGame} className="w-full p-5 bg-red-50 text-red-600 rounded-2xl font-black flex justify-between items-center active:scale-95 transition-all mt-4">
                        Leave Game
                        <LogOut size={18} />
                    </button>
                </div>
                
                {/* HIDE THE CODE IN THE FOOTER FOR SPECTATORS TOO */}
                <p className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Mode: {mode || 'Stroke Play'} {!isSpectator && `• Code: ${gameId}`}
                </p>
            </div>
        </div>
    );
}