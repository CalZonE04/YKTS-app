import React, { useRef, useState, useEffect } from 'react';
import { 
    Trophy, Flag, Plus, X, ChevronLeft, ChevronRight, 
    Minus, Target, BarChart2, Share, CheckCircle2, Home,
    Settings, Users, Layers, MapPin, Trash2
} from 'lucide-react';
import { getPlayerStats, formatRel, generateGameCode, getHolePoints } from '../utils';
import { doc, setDoc } from 'firebase/firestore';
import * as htmlToImage from 'html-to-image';
/**
 * 1. LOBBY SCREEN
 */
export function LobbyScreen({ onNavigate, onJoinSuccess, showToast }) {
    const inputRef = useRef(null);
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen animate-in fade-in duration-500">
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] shadow-2xl text-white mb-8 rotate-3">
                <Trophy size={64} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-2 leading-none">You Know</h1>
            <h2 className="text-4xl font-black text-emerald-600 mb-10 leading-none">The Score</h2>
            <button 
                onClick={() => onNavigate('setup')} 
                className="w-full max-w-xs bg-emerald-600 text-white p-5 rounded-[2rem] font-black text-xl shadow-lg active:scale-95 transition flex justify-center items-center gap-3 mb-12"
            >
                <Flag size={24} fill="currentColor" /> Create Game
            </button>
            <div className="w-full max-w-xs bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 mb-4 text-center uppercase tracking-[0.2em]">Join Friend</label>
                <div className="flex gap-2">
                    <input ref={inputRef} type="text" placeholder="CODE" maxLength={5} className="flex-1 min-w-0 p-4 bg-slate-50 rounded-2xl uppercase font-black text-center outline-none border-2 border-transparent focus:border-emerald-500" />
                    <button onClick={() => onJoinSuccess(inputRef.current?.value)} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black active:scale-95 transition">Join</button>
                </div>
            </div>
        </div>
    );
}

/**
 * 2. SETUP SCREEN (Final Version)
 * Modes: Scramble, Best Ball, Alternate, Snake, Stableford, Stroke Play, Match Play
 */
export function SetupScreen({ db, onNavigate, onGameCreated, showToast }) {
    const [mode, setMode] = useState('Stroke Play');
    const [course, setCourse] = useState('');
    const [holes, setHoles] = useState(18);
    const [maxScore, setMaxScore] = useState('None');
    const [showInfo, setShowInfo] = useState(false);
    const [entries, setEntries] = useState([]);
    const [nameInput, setNameInput] = useState('');

    const modeDescriptions = {
        'Scramble': 'Team play. Everyone hits every shot, you pick the best one, and everyone plays from there. One score per team.',
        'Best Ball': 'Everyone plays their own ball. The lowest score in your group counts for each hole.',
        'Alternate': 'Teammates take turns hitting the same ball (Player A tees off, B hits the 2nd) until it is holed.',
        'Snake': 'Track 3-putts! The last person to 3-putt on a hole is the "Snake" and usually buys the group a round.',
        'Stableford': 'Points vs Par. Par = 2pts, Birdie = 3pts. Bad holes give 0 points but won’t ruin your total.',
        'Stroke Play': 'Traditional golf. Every shot counts toward your total. Lowest score wins.',
        'Match Play': 'Hole-by-hole rivalry. Win the hole, win a point. Best for 1v1 or 2v2 duels.'
    };

    const isTeamMode = mode === 'Scramble' || mode === 'Alternate';

    const addEntry = () => {
        if (!nameInput.trim()) return;
        setEntries([...entries, { 
            id: Date.now().toString(), 
            name: nameInput.trim(), 
            members: [], 
            scores: Array(18).fill(0) 
        }]);
        setNameInput('');
    };

    const handleStart = async () => {
        if (entries.length === 0) return showToast(`Add at least one ${isTeamMode ? 'team' : 'player'}!`, true);
        if (mode === 'Match Play' && entries.length !== 2) {
            return showToast("Match Play requires exactly 2 sides!", true);
        }
        
        const code = generateGameCode();
        const holeCount = Number(holes);

        // Defensive Slicing: Only save the number of holes selected
        const finalizedPlayers = entries.map(e => ({
            ...e,
            scores: e.scores.slice(0, holeCount)
        }));

        const state = { 
            courseName: course || 'Local Course', 
            holes: holeCount, 
            mode, 
            maxScore,
            pars: Array(holeCount).fill(4), 
            players: finalizedPlayers, 
            createdAt: new Date().toISOString(),
            feed: []
        };

        try {
            await setDoc(doc(db, 'games', code), state);
            onGameCreated(code, state);
        } catch (err) {
            showToast("Database error!", true);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 p-6 overflow-y-auto pb-32 min-h-screen">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase leading-none">Round Setup</h2>
            
            {/* 1. GAME SETTINGS */}
            <div className="space-y-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 mb-6 shadow-sm">
                <div>
                    <div className="flex justify-between items-center mb-2 px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Layers size={14}/> Game Mode
                        </label>
                        <button 
                            onClick={() => setShowInfo(!showInfo)}
                            className="text-[10px] font-black uppercase text-emerald-600 underline decoration-2 underline-offset-4"
                        >
                            {showInfo ? 'Close Info' : 'What is this?'}
                        </button>
                    </div>

                    {showInfo && (
                        <div className="mb-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in slide-in-from-top duration-300">
                            <p className="text-xs font-bold text-emerald-800 leading-tight">
                                {modeDescriptions[mode]}
                            </p>
                        </div>
                    )}

                    <select 
                        value={mode} 
                        onChange={e => { setMode(e.target.value); setEntries([]); }} 
                        className="w-full p-4 bg-slate-50 rounded-2xl font-black text-emerald-800 outline-none appearance-none border-2 border-transparent focus:border-emerald-500 transition-all"
                    >
                        {Object.keys(modeDescriptions).map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                        <MapPin size={14}/> Course Name
                    </label>
                    <input 
                        placeholder="e.g. Royal Birkdale" 
                        value={course} 
                        onChange={e => setCourse(e.target.value)} 
                        className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" 
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Length</label>
                        <div className="flex p-1 bg-slate-100 rounded-2xl">
                            {[9, 18].map(h => (
                                <button key={h} onClick={() => setHoles(h)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${holes === h ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}>
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Max Score</label>
                        <select 
                            value={maxScore} 
                            onChange={e => setMaxScore(e.target.value)}
                            className="w-full p-3 bg-slate-50 rounded-xl font-black text-xs text-slate-600 outline-none"
                        >
                            <option>None</option>
                            <option>Double Par</option>
                            <option>Triple Bogey</option>
                            <option>Limit to 10</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. PARTICIPANTS */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 mb-4 block flex items-center gap-2">
                    <Users size={14}/> {isTeamMode ? 'Teams' : 'Players'}
                </label>
                
                <div className="flex gap-2 mb-4">
                    <input 
                        value={nameInput} 
                        onChange={e => setNameInput(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                        placeholder={isTeamMode ? "Team Name..." : "Player Name..."} 
                        className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-bold" 
                    />
                    <button onClick={addEntry} className="bg-emerald-600 text-white p-4 rounded-2xl active:scale-90 transition-all">
                        <Plus />
                    </button>
                </div>

                <div className="space-y-2">
                    {entries.map(e => (
                        <div key={e.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center animate-in slide-in-from-right duration-300">
                            <span className="font-black uppercase text-slate-700">{e.name}</span>
                            <button onClick={() => setEntries(entries.filter(x => x.id !== e.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 size={20}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <button 
                onClick={handleStart} 
                className="mt-8 w-full bg-emerald-600 text-white p-6 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
                <Flag size={24} fill="white" /> Tee Off!
            </button>
        </div>
    );
}
/**
 * 3. SCORING SCREEN
 * Handles: Match Play standings, Stableford points, and Snake 3-putt alerts.
 */
export function ScoringScreen({ state, currentHole, onHoleChange, onUpdateScore, onUpdatePar }) {
    if (!state) return null;

    const isStableford = state.mode === 'Stableford';
    const isSnake = state.mode === 'Snake';
    const isMatchPlay = state.mode === 'Match Play';

    // Import calculateMatchStatus logic from utils or define here if strictly for UI
    const matchStatus = isMatchPlay ? calculateMatchStatus(state.players) : null;

    return (
        <div className="p-4 flex flex-col animate-in fade-in duration-300">
            
            {/* 1. MATCH PLAY STATUS (Only visible in 2-player Match Play) */}
            {isMatchPlay && state.players.length === 2 && (
                <div className="mb-6 bg-slate-900 text-white p-5 rounded-[2.5rem] text-center shadow-xl border-b-4 border-emerald-500 animate-in slide-in-from-top">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-1">Match Standing</p>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{matchStatus}</h3>
                </div>
            )}

            {/* 2. HOLE & PAR NAVIGATOR */}
            <div className="flex justify-between items-center mb-6 bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
                <button 
                    onClick={() => onHoleChange(currentHole - 1)} 
                    disabled={currentHole === 0} 
                    className="p-5 bg-slate-50 rounded-2xl text-emerald-700 disabled:opacity-20 active:scale-90 transition-all"
                >
                    <ChevronLeft strokeWidth={3}/>
                </button>
                
                <div className="text-center">
                    <h2 className="text-2xl font-black text-slate-900 leading-none">Hole {currentHole + 1}</h2>
                    <div className="flex items-center gap-2 mt-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <button onClick={() => onUpdatePar(-1)} className="text-emerald-700 font-black px-1 text-lg">-</button>
                        <span className="text-[10px] font-black uppercase text-emerald-800 tracking-widest">Par {state.pars[currentHole]}</span>
                        <button onClick={() => onUpdatePar(1)} className="text-emerald-700 font-black px-1 text-lg">+</button>
                    </div>
                </div>
                
                <button 
                    onClick={() => onHoleChange(currentHole + 1)} 
                    disabled={currentHole === state.holes - 1} 
                    className="p-5 bg-slate-50 rounded-2xl text-emerald-700 disabled:opacity-20 active:scale-90 transition-all"
                >
                    <ChevronRight strokeWidth={3}/>
                </button>
            </div>

            {/* 3. PLAYER SCORING CARDS */}
            <div className="space-y-3 pb-32">
                {state.players.map((p, idx) => {
                    const stats = getPlayerStats(p, state.pars, state.mode);
                    const score = p.scores[currentHole] || 0;
                    const par = state.pars[currentHole];
                    const holePts = getHolePoints(score, par, state.mode);

                    return (
                        <div key={p.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
                            <div className="flex-1">
                                <h3 className="font-black text-slate-900 truncate uppercase tracking-tight">{p.name}</h3>
                                
                                <div className="mt-2 flex items-center gap-2">
                                    {/* Overall Standing (e.g., +2 or E) */}
                                    <div className="bg-slate-50 text-slate-400 text-[10px] font-black px-2 py-0.5 rounded uppercase border border-slate-100">
                                        {formatRel(stats.relative)}
                                    </div>

                                    {/* Stableford Points Badge */}
                                    {isStableford && score > 0 && (
                                        <div className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-in zoom-in">
                                            +{holePts} PTS
                                        </div>
                                    )}

                                    {/* Snake Mode Alert */}
                                    {isSnake && score >= 3 && (
                                        <div className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-bounce">
                                            🐍 3-Putt
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Score Input Controls */}
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100">
                                <button 
                                    onClick={() => onUpdateScore(idx, -1)} 
                                    className="w-12 h-12 bg-white rounded-xl text-slate-400 font-black shadow-sm active:scale-90 transition-all"
                                >
                                    -
                                </button>
                                <span className="w-10 text-center font-black text-3xl text-emerald-800">
                                    {score || '-'}
                                </span>
                                <button 
                                    onClick={() => onUpdateScore(idx, 1)} 
                                    className="w-12 h-12 bg-emerald-600 rounded-xl text-white font-black shadow-lg active:scale-90 transition-all"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
/**
 * 4. LEADERBOARD SCREEN
 * Sorts automatically by Points (Stableford) or Relative Score (Stroke/Match/Snake).
 */
export function LeaderboardScreen({ state }) {
    if (!state) return null;

    const isStableford = state.mode === 'Stableford';
    const isMatchPlay = state.mode === 'Match Play';

    // 1. SORTING LOGIC
    const rankedPlayers = [...state.players].sort((a, b) => {
        const statsA = getPlayerStats(a, state.pars, state.mode);
        const statsB = getPlayerStats(b, state.pars, state.mode);
        
        if (isStableford) {
            return statsB.points - statsA.points; // High points win
        }
        return statsA.relative - statsB.relative; // Low relative wins
    });

    const matchStatus = isMatchPlay ? calculateMatchStatus(state.players) : null;

    return (
        <div className="p-6 flex flex-col h-full animate-in slide-in-from-bottom duration-500 overflow-y-auto no-scrollbar pb-32">
            
            {/* HEADER */}
            <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">The Board</h2>
                <div className="flex items-center gap-2 mt-2">
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                        {state.mode}
                    </span>
                    <span className="text-slate-300 text-[9px] font-black uppercase tracking-widest">
                        {state.holes} Holes • {state.courseName}
                    </span>
                </div>
            </div>

            {/* MATCH PLAY HIGHLIGHT CARD */}
            {isMatchPlay && state.players.length === 2 && (
                <div className="mb-6 bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl border-b-8 border-emerald-500 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-1">Current Standing</p>
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter">{matchStatus}</h3>
                    </div>
                    <Trophy className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 rotate-12" />
                </div>
            )}

            {/* PLAYER LIST */}
            <div className="space-y-3">
                {rankedPlayers.map((p, idx) => {
                    const stats = getPlayerStats(p, state.pars, state.mode);
                    const isLeader = idx === 0;

                    return (
                        <div 
                            key={p.id} 
                            className={`p-5 rounded-[2.5rem] border flex items-center justify-between transition-all ${
                                isLeader 
                                ? 'bg-white border-emerald-500 shadow-lg scale-[1.02]' 
                                : 'bg-white border-slate-100 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`text-xl font-black italic ${isLeader ? 'text-emerald-600' : 'text-slate-200'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <h4 className="font-black text-slate-800 uppercase tracking-tight leading-none">
                                        {p.name}
                                    </h4>
                                    <p className="text-[9px] font-black text-slate-300 uppercase mt-1">
                                        {stats.strokes} Total Strokes
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                {/* PRIMARY STAT: Points for Stableford, Relative for others */}
                                <div className={`text-2xl font-black leading-none ${
                                    stats.relative < 0 ? 'text-red-500' : 
                                    stats.relative === 0 ? 'text-emerald-600' : 'text-slate-900'
                                }`}>
                                    {isStableford ? `${stats.points}` : formatRel(stats.relative)}
                                </div>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">
                                    {isStableford ? 'Points' : 'To Par'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SNAKE MODE FOOTER */}
            {state.mode === 'Snake' && (
                <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <span className="text-xl">🐍</span>
                    <p className="text-[10px] font-black text-amber-800 uppercase leading-tight">
                        Check the scoring screen to see who is currently the Snake!
                    </p>
                </div>
            )}
        </div>
    );
}
/**
 * 5. STATS SCREEN (Stableford Aware)
 */
export function StatsScreen({ state }) {
    if (!state) return null;
    const isStableford = state.mode === 'Stableford';

    return (
        <div className="p-6 h-full animate-in slide-in-from-right duration-300 pb-32 overflow-y-auto no-scrollbar">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase">Stats</h2>
            <div className="space-y-6">
                {state.players.map((p) => {
                    const stats = getPlayerStats(p, state.pars);
                    
                    // Filter holes that actually have a score
                    const playedHoles = p.scores
                        .map((s, i) => ({ s, p: state.pars[i] }))
                        .filter(h => h.s > 0);

                    // Map the sparkline points: 
                    // In Stableford, we graph POINTS per hole. In Stroke, we graph RELATIVE score.
                    const sparkPoints = playedHoles.map((h, i) => {
                        const val = isStableford 
                            ? getHolePoints(h.s, h.p) * 10 // Higher points = Higher line
                            : (h.s - h.p) * -10;           // Lower strokes = Higher line
                        return `${i * 40},${25 - val}`;
                    }).join(' ');

                    return (
                        <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{p.name}</h3>
                                <span className="text-2xl font-black text-slate-900">
                                    {isStableford ? `${stats.points} PTS` : formatRel(stats.relative)}
                                </span>
                            </div>
                            <div className="h-16 w-full bg-slate-50 rounded-2xl flex items-center justify-center relative overflow-hidden px-4">
                                {playedHoles.length > 1 ? (
                                    <svg viewBox={`0 0 ${(playedHoles.length - 1) * 40} 50`} className="w-full h-12 overflow-visible">
                                        <polyline 
                                            fill="none" 
                                            stroke="#10b981" 
                                            strokeWidth="4" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            points={sparkPoints} 
                                        />
                                    </svg>
                                ) : (
                                    <span className="text-[10px] font-black text-slate-300 uppercase">Need 2+ holes for trend</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * 6. SCORECARD SCREEN
 */
export function ScorecardScreen({ state, currentHole, onHoleSelect }) {
    if (!state) return null;
    const isStableford = state.mode === 'Stableford';

    const getScoreStyle = (score, par) => {
        if (!score || score === 0) return "text-slate-300";
        const diff = score - par;
        if (diff === -1) return "border-2 border-emerald-500 rounded-full w-8 h-8 flex items-center justify-center mx-auto text-emerald-600 font-bold";
        if (diff <= -2) return "border-4 border-emerald-500 rounded-full w-9 h-9 flex items-center justify-center mx-auto text-emerald-600 font-black";
        if (diff === 1) return "border-2 border-slate-900 w-7 h-7 flex items-center justify-center mx-auto text-slate-900 font-bold";
        if (diff >= 2) return "border-4 border-slate-900 w-8 h-8 flex items-center justify-center mx-auto text-slate-900 font-black";
        return "text-slate-900 font-medium";
    };

    return (
        <div className="p-4 h-full animate-in fade-in duration-500 flex flex-col overflow-hidden">
            <div className="mb-4 px-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Scorecard</h2>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">{state.courseName}</p>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-[2rem] bg-white shadow-xl no-scrollbar">
                <table className="w-full text-center border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm font-black text-[10px] uppercase text-slate-400">
                        <tr className="border-b border-slate-200">
                            <th className="p-4 w-16 sticky left-0 bg-slate-100 z-30 border-r border-slate-200">Hole</th>
                            <th className="p-4 w-12 border-r border-slate-200">Par</th>
                            {state.players.map(player => (
                                <th key={player.id} className="p-4 min-w-[80px] text-slate-900 font-black truncate uppercase tracking-tighter">{player.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: state.holes }).map((_, hIdx) => (
                            <tr key={hIdx} onClick={() => onHoleSelect(hIdx)} className={`group hover:bg-emerald-50 ${hIdx === currentHole ? 'bg-emerald-50/50' : ''}`}>
                                <td className="p-4 sticky left-0 bg-white group-hover:bg-emerald-50 z-10 border-r border-slate-200 font-black text-slate-400 text-xs">{hIdx + 1}</td>
                                <td className="p-4 border-r border-slate-200 font-bold text-slate-300 text-xs">{state.pars[hIdx]}</td>
                                {state.players.map(player => (
                                    <td key={player.id} className="p-2">
                                        <div className="h-10 flex items-center justify-center">
                                            <span className={getScoreStyle(player.scores[hIdx], state.pars[hIdx])}>{player.scores[hIdx] || '-'}</span>
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                        <tr className="bg-slate-900 text-white font-black uppercase text-[10px] sticky bottom-0">
                            <td className="p-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">TOT</td>
                            <td className="p-4 border-r border-slate-800">{state.pars.reduce((a, b) => a + b, 0)}</td>
                            {state.players.map(player => (
                                <td key={player.id} className="p-4 text-emerald-400 text-sm">
                                    {isStableford ? `${getPlayerStats(player, state.pars).points} PTS` : getPlayerStats(player, state.pars).strokes}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * 7. SUMMARY SCREEN (With Save to Camera Roll)
 */
export function SummaryScreen({ state, onLeave }) {
    const cardRef = useRef(null); // The lens
    const [saving, setSaving] = useState(false);

    if (!state) return null;
    const ranked = [...state.players].sort((a, b) => {
        const statsA = getPlayerStats(a, state.pars);
        const statsB = getPlayerStats(b, state.pars);
        return state.mode === 'Stableford' ? statsB.points - statsA.points : statsA.relative - statsB.relative;
    });

    const handleSaveImage = async () => {
        if (!cardRef.current) return;
        setSaving(true);
        
        try {
            // 1. Generate the Image
            const dataUrl = await htmlToImage.toPng(cardRef.current, { 
                backgroundColor: '#f8fafc',
                pixelRatio: 2 
            });
    
            // 2. Try the Native Mobile Share Sheet
            // We put this in a nested try/catch so if it's "Denied", we move to download
            try {
                if (navigator.share && navigator.canShare) {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], `Scorecard.png`, { type: 'image/png' });
                    
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'YKTS Scorecard',
                        });
                        setSaving(false);
                        return; // Success! Exit the function.
                    }
                }
            } catch (shareErr) {
                console.log("Share denied or failed, falling back to download...");
            }
    
            // 3. FALLBACK: Standard Download (Works everywhere)
            const link = document.createElement('a');
            link.download = `YKTS-Scorecard-${state.courseName || 'Round'}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast("Image Downloaded! 📸");
    
        } catch (err) {
            console.error("Critical Save Error:", err);
            showToast("Could not save image", true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 min-h-screen animate-in zoom-in duration-500 overflow-y-auto pb-12">
            
            {/* THIS DIV IS WHAT GETS CAPTURED */}
            <div ref={cardRef} className="bg-slate-50 p-4">
                <div className="p-10 flex flex-col items-center text-center bg-white rounded-[3rem] shadow-sm border border-slate-200 mb-6">
                    <div className="bg-yellow-400 p-6 rounded-[2.5rem] text-emerald-900 mb-6 rotate-3">
                        <Trophy size={60} strokeWidth={2} />
                    </div>
                    <h1 className="text-4xl font-black mb-1 tracking-tighter uppercase text-slate-900">Winner!</h1>
                    <p className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px]">{state.courseName}</p>
                </div>

                <div className="bg-white text-slate-900 rounded-[3rem] p-8 shadow-2xl border-b-8 border-yellow-400 text-center relative z-10 -mt-16 mx-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-2 block">Champion</span>
                    <h2 className="text-4xl font-black text-emerald-800 mb-2 uppercase tracking-tight">{ranked[0].name}</h2>
                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-1.5 rounded-full font-black text-xl">
                        {state.mode === 'Stableford' ? `${getPlayerStats(ranked[0], state.pars).points} PTS` : formatRel(getPlayerStats(ranked[0], state.pars).relative)}
                    </div>
                </div>

                <div className="mt-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mx-4">
                    <table className="w-full text-center text-[10px] border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 font-black text-slate-400 border-r">Hole</th>
                                {state.players.map(p => <th key={p.id} className="p-3 font-black text-slate-900 uppercase">{p.name}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {state.pars.map((_, h) => (
                                <tr key={h}>
                                    <td className="p-2 font-black text-slate-400 border-r bg-slate-50/30">{h + 1}</td>
                                    {state.players.map(p => <td key={p.id} className="p-2 font-bold">{p.scores[h] || '-'}</td>)}
                                </tr>
                            ))}
                            <tr className="bg-slate-900 text-white font-black uppercase">
                                <td className="p-3 border-r">TOT</td>
                                {state.players.map(p => (
                                    <td key={p.id} className="p-3 text-emerald-400">
                                        {state.mode === 'Stableford' ? getPlayerStats(p, state.pars).points : getPlayerStats(p, state.pars).strokes}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Buttons (Excluded from the capture) */}
            <div className="px-10 space-y-4 mt-6">
                <button 
                    onClick={handleSaveImage} 
                    disabled={saving}
                    className="w-full py-5 bg-emerald-600 text-white font-black rounded-3xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                    <Share size={20}/> {saving ? 'Generating Image...' : 'Save to Camera Roll'}
                </button>
                <button 
                    onClick={onLeave} 
                    className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
                >
                    <Home size={20}/> Clubhouse Lobby
                </button>
            </div>
        </div>
    );
}
/**
 * 8. LIVE FEED SCREEN (With Group Stats)
 */
export function FeedScreen({ state }) {
    if (!state) return null;

    // Calculate Group Stats
    const totalStats = state.players.reduce((acc, p) => {
        p.scores.forEach((s, i) => {
            if (s > 0) {
                const diff = s - state.pars[i];
                if (s === 1) acc.hio++;
                else if (diff <= -2) acc.eagles++;
                else if (diff === -1) acc.birdies++;
                else if (diff === 0) acc.pars++;
            }
        });
        return acc;
    }, { hio: 0, eagles: 0, birdies: 0, pars: 0 });

    const sortedFeed = [...(state.feed || [])].reverse().slice(0, 20);

    return (
        <div className="p-6 h-full animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar pb-32">
            <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tighter uppercase">Clubhouse</h2>
            
            {/* Group Stats Card */}
            <div className="bg-slate-900 rounded-[2rem] p-6 mb-8 text-white shadow-xl">
                <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-4 text-center">Group Performance</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/10 p-3 rounded-2xl">
                        <p className="text-xl font-black text-emerald-400">{totalStats.birdies + totalStats.eagles + totalStats.hio}</p>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none mt-1">Under Par</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl">
                        <p className="text-xl font-black">{totalStats.pars}</p>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none mt-1">Total Pars</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-xl font-black text-emerald-400">{totalStats.hio}</p>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none mt-1">Holes In 1</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {sortedFeed.length > 0 ? sortedFeed.map((msg) => (
                    <div key={msg.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex gap-4 items-start">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                            <Flag size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight mb-1">{msg.text}</p>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{msg.time}</span>
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-slate-300 font-black uppercase text-[10px] py-10">No highlights yet...</p>
                )}
            </div>
        </div>
    );
}