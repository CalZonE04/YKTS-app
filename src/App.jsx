import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { getPlayerStats, generateGameCode } from './utils';

// UI Components - Added MenuOverlay here
import { Header, Navigation, SplashScreen, MenuOverlay } from './Components/UI';

// Screen Components
import { 
    ScoringScreen, LeaderboardScreen, StatsScreen, 
    LobbyScreen, SetupScreen, ScorecardScreen,
    SummaryScreen, FeedScreen 
} from './Components/Screens';

export default function App() {
    // 1. APP & PERSISTENCE STATES (Top Level)
    const [showSplash, setShowSplash] = useState(true);
    const [isExiting, setIsExiting] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Menu control state
    
    // Initialize from LocalStorage so the app doesn't reset on refresh
    const [gameCode, setGameCode] = useState(() => localStorage.getItem('ykts_gameCode') || null);
    const [view, setView] = useState(() => localStorage.getItem('ykts_view') || 'lobby');
    
    const [activeTab, setActiveTab] = useState('scoring');
    const [gameState, setGameState] = useState(null);
    const [currentHole, setCurrentHole] = useState(0);
    const [toast, setToast] = useState({ show: false, msg: '', isError: false });

    // 2. SAVE TO LOCALSTORAGE
    useEffect(() => {
        if (gameCode) {
            localStorage.setItem('ykts_gameCode', gameCode);
            localStorage.setItem('ykts_view', view);
        } else {
            localStorage.removeItem('ykts_gameCode');
            localStorage.setItem('ykts_view', 'lobby');
        }
    }, [gameCode, view]);

    // 3. SPLASH SCREEN TIMER
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => setShowSplash(false), 500);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // 4. FIREBASE REAL-TIME SYNC
    useEffect(() => {
        if (!gameCode) return;
        const unsub = onSnapshot(doc(db, 'games', gameCode), (doc) => {
            if (doc.exists()) {
                setGameState(doc.data());
                // If we have a valid game, make sure we aren't stuck on the lobby/setup
                if (view === 'lobby' || view === 'setup') setView('game');
            } else {
                handleLeaveGame();
            }
        });
        return () => unsub();
    }, [gameCode]);

    // 5. HANDLERS
    const handleShowToast = (msg, isError = false) => {
        setToast({ show: true, msg, isError });
        setTimeout(() => setToast({ show: false, msg: '', isError: false }), 3000);
    };

    const handleCreateGame = (code, initialState) => {
        setGameCode(code);
        setGameState(initialState);
        setView('game');
    };

    const handleJoinGame = (code) => {
        if (!code) return handleShowToast("Enter a code", true);
        setGameCode(code.toUpperCase());
        setView('game');
    };

    const handleLeaveGame = () => {
        localStorage.removeItem('ykts_gameCode');
        localStorage.removeItem('ykts_view');
        setGameCode(null);
        setGameState(null);
        setView('lobby');
    };

    const handleUpdatePar = async (delta) => {
        if (!gameState) return;
        const newPars = [...gameState.pars];
        newPars[currentHole] = Math.max(3, Math.min(6, newPars[currentHole] + delta));
        await updateDoc(doc(db, 'games', gameCode), { pars: newPars });
    };

    const handleUpdateScore = async (playerIdx, delta) => {
        if (!gameState) return;
        
        const isStableford = gameState.mode === 'Stableford';
        
        // Lead Change Helper
        const getLeaderId = (players) => {
            const sorted = [...players].sort((a, b) => {
                const sA = getPlayerStats(a, gameState.pars, gameState.mode);
                const sB = getPlayerStats(b, gameState.pars, gameState.mode);
                return isStableford ? sB.points - sA.points : sA.relative - sB.relative;
            });
            return sorted[0]?.id;
        };

        const leaderBefore = getLeaderId(gameState.players);
        const newPlayers = [...gameState.players];
        const player = newPlayers[playerIdx];
        const par = gameState.pars[currentHole];
        
        const oldScore = player.scores[currentHole];
        const currentVal = oldScore || par;
        const newScore = Math.max(1, currentVal + delta);
        player.scores[currentHole] = newScore;
        
        const leaderAfter = getLeaderId(newPlayers);
        let feedMessages = [];

        // Commentary Logic (Birdies/Eagles)
        if (oldScore === 0 && newScore > 0) {
            const diff = newScore - par;
            if (newScore === 1) feedMessages.push(`🎯 HOLE IN ONE! ${player.name} on Hole ${currentHole + 1}!`);
            else if (diff <= -2) feedMessages.push(`🦅 EAGLE! ${player.name} is flying on Hole ${currentHole + 1}!`);
            else if (diff === -1) feedMessages.push(`🐦 Birdie! ${player.name} on Hole ${currentHole + 1}.`);
        }

        // Leader Change Logic
        if (leaderBefore !== leaderAfter && leaderAfter) {
            const newLeader = newPlayers.find(p => p.id === leaderAfter);
            feedMessages.push(`📈 NEW LEADER! ${newLeader.name} takes the lead!`);
        }

        try {
            const updateData = { players: newPlayers };
            if (feedMessages.length > 0) {
                updateData.feed = arrayUnion(...feedMessages.map(msg => ({
                    text: msg,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    id: Math.random().toString(36).substr(2, 9)
                })));
            }
            await updateDoc(doc(db, 'games', gameCode), updateData);
        } catch (err) {
            handleShowToast("Sync failed", true);
        }
    };

    // 6. RENDER LOGIC
    return (
        <div className="h-[100dvh] w-full flex flex-col bg-slate-50 overflow-hidden fixed inset-0">
            {showSplash && <SplashScreen isExiting={isExiting} />}

            {/* NEW: MENU OVERLAY (Safeguard) */}
            <MenuOverlay 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)} 
                onEndRound={() => { 
                    setIsMenuOpen(false); 
                    setView('summary'); 
                }}
                mode={gameState?.mode}
            />

            {/* HEADER - Updated to open menu */}
            {view === 'game' && (
                <Header 
                    gameId={gameCode} 
                    courseName={gameState?.courseName} 
                    onMenuOpen={() => setIsMenuOpen(true)} 
                />
            )}

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {view === 'lobby' && (
                    <LobbyScreen 
                        onNavigate={setView} 
                        onJoinSuccess={handleJoinGame} 
                        showToast={handleShowToast} 
                    />
                )}

                {view === 'setup' && (
                    <SetupScreen 
                        db={db}
                        onNavigate={setView}
                        onGameCreated={handleCreateGame}
                        showToast={handleShowToast}
                    />
                )}

                {view === 'game' && gameState && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                            {activeTab === 'scoring' && (
                                <ScoringScreen 
                                    state={gameState}
                                    currentHole={currentHole}
                                    onHoleChange={setCurrentHole}
                                    onUpdateScore={handleUpdateScore}
                                    onUpdatePar={handleUpdatePar}
                                />
                            )}
                            {activeTab === 'leaderboard' && <LeaderboardScreen state={gameState} />}
                            {activeTab === 'stats' && <StatsScreen state={gameState} />}
                            {activeTab === 'feed' && <FeedScreen state={gameState} />}
                            {activeTab === 'scorecard' && (
                                <ScorecardScreen 
                                    state={gameState} 
                                    currentHole={currentHole} 
                                    onHoleSelect={(hIdx) => { setCurrentHole(hIdx); setActiveTab('scoring'); }} 
                                />
                            )}
                        </div>
                    </div>
                )}

                {view === 'summary' && (
                    <SummaryScreen 
                        state={gameState} 
                        onLeave={handleLeaveGame} 
                        showToast={handleShowToast}
                    />
                )}
            </main>

            {/* NAVIGATION */}
            {view === 'game' && (
                <Navigation 
                    current={activeTab} 
                    onNavigate={setActiveTab} 
                />
            )}

            {/* GLOBAL TOAST */}
            {toast.show && (
                <div className={`fixed top-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-white font-black shadow-2xl z-[200] animate-in slide-in-from-top duration-300 ${toast.isError ? 'bg-red-500' : 'bg-emerald-600'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}