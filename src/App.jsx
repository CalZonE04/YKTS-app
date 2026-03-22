import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { getPlayerStats, generateGameCode } from './utils';

// UI Components
import { Header, Navigation, SplashScreen } from './Components/UI';

// Screen Components
import { 
    ScoringScreen, 
    LeaderboardScreen, 
    StatsScreen, 
    LobbyScreen, 
    SetupScreen, 
    ScorecardScreen,
    SummaryScreen,
    FeedScreen 
} from './Components/Screens';

export default function App() {
    // 1. APP STATES
    const [showSplash, setShowSplash] = useState(true);
    const [isExiting, setIsExiting] = useState(false);
    const [view, setView] = useState('lobby'); // lobby, setup, game, summary
    const [activeTab, setActiveTab] = useState('scoring');
    const [gameCode, setGameCode] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [currentHole, setCurrentHole] = useState(0);
    const [toast, setToast] = useState({ show: false, msg: '', isError: false });

    // 2. SPLASH SCREEN TIMER
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => setShowSplash(false), 500);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // 3. FIREBASE REAL-TIME SYNC
    useEffect(() => {
        if (!gameCode) return;
        const unsub = onSnapshot(doc(db, 'games', gameCode), (doc) => {
            if (doc.exists()) {
                setGameState(doc.data());
            } else {
                handleShowToast("Game not found", true);
                setGameCode(null);
                setView('lobby');
            }
        });
        return () => unsub();
    }, [gameCode]);

    // 4. HANDLERS
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
        setGameCode(code.toUpperCase());
        setView('game');
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

        // Commentary Logic
        if (oldScore === 0 && newScore > 0) {
            const diff = newScore - par;
            if (newScore === 1) feedMessages.push(`🎯 HOLE IN ONE! ${player.name} made history on Hole ${currentHole + 1}!`);
            else if (diff <= -2) feedMessages.push(`🦅 EAGLE! ${player.name} is flying on Hole ${currentHole + 1}!`);
            else if (diff === -1) feedMessages.push(`🐦 Birdie! ${player.name} picked up a shot on Hole ${currentHole + 1}.`);
        }

        // Leader Change Logic
        if (leaderBefore !== leaderAfter && leaderAfter) {
            const newLeader = newPlayers.find(p => p.id === leaderAfter);
            feedMessages.push(`📈 NEW LEADER! ${newLeader.name} takes the #1 spot!`);
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

    // 5. RENDER LOGIC
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100">
            {showSplash && <SplashScreen isExiting={isExiting} />}

            {/* HEADER (Only show if in game) */}
            {view === 'game' && (
                <Header 
                    gameId={gameCode} 
                    courseName={gameState?.courseName} 
                    onMenuOpen={() => setView('summary')} 
                />
            )}

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
            {view === 'lobby' && (
    <LobbyScreen 
        onNavigate={setView} // Match the name in LobbyScreen
        onJoinSuccess={handleJoinGame} // Match the name in LobbyScreen
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

                {view === 'game' && (
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
                        {activeTab === 'scorecard' && <ScorecardScreen state={gameState} />}
                    </div>
                )}

{view === 'summary' && (
    <SummaryScreen 
        state={gameState} 
        onLeave={() => { setGameCode(null); setView('lobby'); }} 
        showToast={handleShowToast} // <--- ADD THIS LINE
    />
)}
            </main>

            {/* NAVIGATION (Only show if in game) */}
            {view === 'game' && (
                <Navigation 
                    current={activeTab} 
                    onNavigate={setActiveTab} 
                />
            )}

            {/* GLOBAL TOAST NOTIFICATIONS */}
            {toast.show && (
                <div className={`fixed top-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-white font-black shadow-2xl z-[200] animate-in slide-in-from-top duration-300 ${toast.isError ? 'bg-red-500' : 'bg-emerald-600'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}