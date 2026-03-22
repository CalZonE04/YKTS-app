import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Trophy, Flag, Plus, X, ChevronLeft, ChevronRight, Minus, Target, BarChart2, Share, CheckCircle2, Home, Settings, Users, Layers, MapPin, Trash2, Search, Filter, EyeOff, Globe, LocateFixed, Activity, Download } from 'lucide-react';
import { 
    getPlayerStats, formatRel, generateGameCode, 
    getHolePoints, calculateMatchStatus 
} from '../utils';
import { doc, setDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import * as htmlToImage from 'html-to-image';
// IMAGE EXPORT HELPER
const exportImage = async (elementId, filename) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
        // scale: 2 makes the image high-definition (Retina quality)
        const canvas = await html2canvas(element, { backgroundColor: '#f8fafc', scale: 2 });
        
        canvas.toBlob(async (blob) => {
            const file = new File([blob], filename, { type: 'image/png' });
            
            // Try to open the native mobile share sheet (WhatsApp, Messages, Save to Photos)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: 'YKTS Leaderboard',
                        files: [file]
                    });
                    return; // Success!
                } catch (err) {
                    console.log("User cancelled share");
                }
            }
            
            // Fallback for laptops/desktops: Download the file directly
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        });
    } catch (error) {
        console.error("Screenshot failed:", error);
    }
};
// 1. YOUR LOCAL COURSE DATABASE
// Add your usual spots here!
const COURSE_DATABASE = [
    // Your Locals & Favorites
    "Aintree Golf Centre",
    
    // UK & Ireland (The Classics)
    "St. Andrews (Old Course)",
    "St. Andrews (Castle Course)",
    "Muirfield",
    "Royal County Down",
    "Royal Portrush (Dunluce)",
    "Royal Birkdale",
    "Royal St George's",
    "Royal Lytham & St Annes",
    "Royal Troon",
    "Carnoustie Golf Links",
    "Turnberry (Ailsa)",
    "Sunningdale (Old)",
    "Sunningdale (New)",
    "Ballybunion (Old)",
    "Lahinch",
    "Gleneagles (PGA Centenary)",
    "Gleneagles (King's)",
    "Wentworth (West)",
    "Kingsbarns",
    "Trump International Scotland",

    // USA (Majors & Bucket List)
    "Augusta National",
    "Pebble Beach Golf Links",
    "Pinehurst No. 2",
    "Pine Valley Golf Club",
    "Cypress Point Club",
    "Shinnecock Hills",
    "Oakmont Country Club",
    "Merion Golf Club",
    "Bethpage Black",
    "Whistling Straits (Straits)",
    "Kiawah Island (Ocean Course)",
    "TPC Sawgrass (Stadium)",
    "Torrey Pines (South)",
    "Torrey Pines (North)",
    "Bandon Dunes",
    "Pacific Dunes",
    "Riviera Country Club",
    "Los Angeles Country Club",
    "Winged Foot (West)",
    "Muirfield Village",
    "Shadow Creek",
    "Spyglass Hill",
    "Kapalua (Plantation)",
    "Erin Hills",
    "Chambers Bay",
    "East Lake Golf Club",
    "Bay Hill Club & Lodge",
    "Harbour Town Golf Links",

    // Rest of the World
    "Royal Melbourne (West) - AUS",
    "Kingston Heath - AUS",
    "Tara Iti - NZ",
    "Cape Kidnappers - NZ",
    "Cabot Cliffs - CAN",
    "Cabot Links - CAN",
    "St. George's - CAN",
    "Valderrama - ESP",
    "Morfontaine - FRA",
    "Leopard Creek - RSA",
    "Hirono - JPN"
];

// 2. THE CUSTOM AUTOCOMPLETE COMPONENT
function CourseInput({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);

    const handleTextChange = (e) => {
        const text = e.target.value;
        onChange(text); // Updates the parent state
        
        if (text.length > 0) {
            // Filter the database for matches
            const matches = COURSE_DATABASE.filter(c => 
                c.toLowerCase().includes(text.toLowerCase())
            );
            setSuggestions(matches);
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    return (
        <div className="relative w-full z-50">
            <input 
                placeholder="e.g. Aintree Golf Centre" 
                value={value} 
                onChange={handleTextChange}
                onFocus={() => value.length > 0 && setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Delay allows click to register
                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:border-emerald-500 border-2 border-transparent transition-colors" 
            />
            
            {/* DROPDOWN MENU */}
            {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    {suggestions.map((course, idx) => (
                        <div
                            key={idx}
                            onClick={() => { onChange(course); setIsOpen(false); }}
                            className="p-4 hover:bg-emerald-50 active:bg-emerald-100 font-bold text-slate-700 text-sm border-b border-slate-50 last:border-0 cursor-pointer flex items-center gap-3 transition-colors"
                        >
                            <MapPin size={16} className="text-emerald-500" />
                            {course}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * 1. LOBBY SCREEN (Cleaned up, Feed moved to SpectateScreen)
 */
export function LobbyScreen({ onNavigate, onJoinSuccess, showToast }) {
    const inputRef = useRef(null);

    return (
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 p-4 no-scrollbar flex flex-col justify-center">
            
            {/* HERO SECTION */}
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] shadow-2xl text-white mb-8 rotate-3 flex items-center justify-center w-24 mx-auto mt-4">
                <Trophy size={48} />
            </div>
            <div className="text-center mb-10">
                <h1 className="text-5xl font-black text-slate-900 leading-none tracking-tighter italic">YKTS</h1>
                <h2 className="text-lg font-black text-emerald-600 tracking-[0.2em] uppercase mt-2">You Know The Score</h2>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-4 max-w-sm mx-auto w-full">
                
                <button 
                    onClick={() => onNavigate('setup')} 
                    className="w-full bg-emerald-600 text-white p-6 rounded-[2rem] font-black text-xl shadow-lg active:scale-95 transition flex justify-center items-center gap-3"
                >
                    <Flag size={24} fill="currentColor" /> Start a Round
                </button>

                {/* NEW: SPECTATE BUTTON */}
                <button 
                    onClick={() => onNavigate('spectate')} 
                    className="w-full bg-blue-50 text-blue-600 p-6 rounded-[2rem] font-black text-xl border border-blue-100 shadow-sm active:scale-95 transition flex justify-center items-center gap-3"
                >
                    <Activity size={24} /> Watch Live Games
                </button>
                
                <div className="w-full bg-white p-3 rounded-[2rem] shadow-sm border border-slate-200 flex gap-2 mt-4">
                    <input 
                        ref={inputRef} 
                        type="text" 
                        placeholder="GAME CODE" 
                        maxLength={5} 
                        className="flex-1 min-w-0 p-4 bg-slate-50 rounded-2xl uppercase font-black text-center outline-none border-2 border-transparent focus:border-emerald-500 placeholder:text-slate-300" 
                    />
                    <button 
                        onClick={() => onJoinSuccess(inputRef.current?.value)} 
                        className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black active:scale-95 transition"
                    >
                        Join
                    </button>
                </div>
            </div>

        </div>
    );
}

/**
 * 2. THE UPDATED SETUP SCREEN (With GPS Auto-Locate)
 */
export function SetupScreen({ db, onNavigate, onGameCreated, showToast }) {
    const [mode, setMode] = useState('Stroke Play');
    const [course, setCourse] = useState('');
    const [holes, setHoles] = useState(18);
    const [maxScore, setMaxScore] = useState('None');
    const [isPrivate, setIsPrivate] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [entries, setEntries] = useState([]);
    const [nameInput, setNameInput] = useState('');
    const [memberInput, setMemberInput] = useState('');
    const [activeTeamId, setActiveTeamId] = useState(null);
    
    // NEW: Loading state for the GPS
    const [isLocating, setIsLocating] = useState(false);

    const modeDescriptions = {
        'Scramble': 'Team play. Everyone hits, you pick the best shot. Record 1 score per team.',
        'Best Ball': 'Team play. Everyone plays their own ball. The lowest score counts. Record 1 score per team.',
        'Alternate': 'Teammates take turns hitting the same ball until it is holed. Record 1 score per team.',
        'Snake': 'Track 3-putts! The last person to 3-putt is the "Snake".',
        'Stableford': 'Points vs Par. Par=2, Birdie=3. High points win!',
        'Stroke Play': 'Traditional golf. Every shot counts. Lowest score wins.',
        'Match Play': 'Hole-by-hole rivalry. Win the hole, win a point.'
    };

    const isTeamMode = mode === 'Scramble' || mode === 'Alternate' || mode === 'Best Ball';

    const addEntry = () => {
        if (!nameInput.trim()) return;
        const newId = Date.now().toString();
        setEntries([...entries, { id: newId, name: nameInput.trim(), members: [], scores: Array(18).fill(0) }]);
        setNameInput('');
        if (isTeamMode) setActiveTeamId(newId);
    };

    const addMember = (teamId) => {
        if (!memberInput.trim()) return;
        setEntries(entries.map(e => e.id === teamId ? { ...e, members: [...e.members, memberInput.trim()] } : e));
        setMemberInput('');
    };

    // NEW: The GPS Auto-Locate Magic (No API Key Required!)
    // NEW & IMPROVED: GPS Auto-Locate with True Distance Sorting
    const handleFindNearest = () => {
        if (!navigator.geolocation) {
            return showToast("GPS not supported by your browser", true);
        }

        setIsLocating(true);
        showToast("Finding nearest course... 🛰️");

        // Helper function to calculate exact distance between two GPS coordinates
        const getDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
        };

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                // Search OpenStreetMap within 15km
                const query = `[out:json];way(around:15000,${latitude},${longitude})["leisure"="golf_course"];out center;`;
                const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
                const data = await response.json();

                if (data.elements && data.elements.length > 0) {
                    // Filter out courses that don't have a name or a center coordinate
                    let namedCourses = data.elements.filter(e => e.tags && e.tags.name && e.center);
                    
                    if (namedCourses.length > 0) {
                        // SORT THE COURSES BY ACTUAL DISTANCE FROM YOUR PHONE
                        namedCourses.sort((a, b) => {
                            const distA = getDistance(latitude, longitude, a.center.lat, a.center.lon);
                            const distB = getDistance(latitude, longitude, b.center.lat, b.center.lon);
                            return distA - distB;
                        });

                        // Grab the absolute closest one!
                        const closestCourse = namedCourses[0].tags.name;
                        setCourse(closestCourse);
                        showToast(`Found: ${closestCourse}! 📍`);
                    } else {
                        showToast("Found a course, but it has no name.", true);
                    }
                } else {
                    showToast("No courses found within 15km.", true);
                }
            } catch (err) {
                showToast("Map search failed. Try typing it.", true);
            } finally {
                setIsLocating(false);
            }
        }, (err) => {
            setIsLocating(false);
            showToast("Please allow location access!", true);
        });
    };

    const handleStart = async () => {
        if (entries.length === 0) return showToast(`Add at least one ${isTeamMode ? 'team' : 'player'}!`, true);
        if (mode === 'Match Play' && entries.length !== 2) return showToast("Match Play requires exactly 2 sides!", true);

        const code = generateGameCode();
        const holeCount = Number(holes);
        const state = { 
            courseName: course || 'Local Course', 
            holes: holeCount, 
            mode, 
            maxScore,
            isPrivate, 
            pars: Array(holeCount).fill(4), 
            players: entries.map(e => ({ ...e, scores: e.scores.slice(0, holeCount) })), 
            createdAt: new Date().toISOString(),
            feed: []
        };
        try {
            await setDoc(doc(db, 'games', code), state);
            onGameCreated(code, state);
        } catch (err) { showToast("Database error!", true); }
    };

    return (
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 p-6 bg-slate-50 no-scrollbar">
            
            <button 
                onClick={() => onNavigate('lobby')}
                className="mb-6 flex items-center gap-1 text-slate-400 font-black uppercase tracking-widest text-[10px] active:scale-95 active:text-slate-600 transition-all w-fit"
            >
                <ChevronLeft size={16} strokeWidth={3} />
                Back to Lobby
            </button>

            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase leading-none">Round Setup</h2>
            
            <div className="space-y-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 mb-6 shadow-sm">
                
                <div>
                    <div className="flex justify-between items-center mb-2 px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                           <Layers size={14}/> Game Mode
                        </label>
                        <button onClick={() => setShowInfo(!showInfo)} className="text-[10px] font-black text-emerald-600 underline">
                            {showInfo ? 'Close Info' : 'Rules'}
                        </button>
                    </div>
                    {showInfo && <div className="mb-4 p-4 bg-emerald-50 rounded-2xl text-xs font-bold text-emerald-800 animate-in slide-in-from-top">{modeDescriptions[mode]}</div>}
                    <select value={mode} onChange={e => { setMode(e.target.value); setEntries([]); }} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-emerald-800 outline-none border-2 border-transparent focus:border-emerald-500">
                        {Object.keys(modeDescriptions).map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>

                {/* UPDATED COURSE INPUT WITH GPS BUTTON */}
                <div className="space-y-2 relative z-20">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                        <MapPin size={14}/> Course Name
                    </label>
                    <div className="flex gap-2">
                        <CourseInput value={course} onChange={setCourse} />
                        <button 
                            onClick={handleFindNearest}
                            disabled={isLocating}
                            className={`w-14 shrink-0 rounded-2xl flex items-center justify-center transition-all ${isLocating ? 'bg-slate-200 text-slate-400 animate-pulse' : 'bg-emerald-100 text-emerald-600 active:bg-emerald-200 active:scale-90'}`}
                        >
                            <LocateFixed size={20} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Length</label>
                        <div className="flex p-1 bg-slate-100 rounded-2xl">
                            {[9, 18].map(h => (
                                <button key={h} onClick={() => setHoles(h)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${holes === h ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}>{h}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Max Score</label>
                        <select value={maxScore} onChange={e => setMaxScore(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl font-black text-xs text-slate-600 outline-none">
                            <option>None</option><option>Double Par</option><option>Triple Bogey</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        {isPrivate ? <EyeOff size={18} className="text-slate-500" /> : <Globe size={18} className="text-emerald-600" />}
                        <div>
                            <p className="font-black text-slate-700 text-sm leading-tight">Private Game</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hide from live lobby</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsPrivate(!isPrivate)} 
                        className={`w-12 h-6 rounded-full transition-all relative shadow-inner ${isPrivate ? 'bg-slate-700' : 'bg-emerald-400'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all ${isPrivate ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>

            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative z-0">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 mb-4 block flex items-center gap-2">
                    <Users size={14}/> {isTeamMode ? 'Teams' : 'Players'}
                </label>
                
                <div className="flex gap-2 mb-6">
                    <input 
                        value={nameInput} 
                        onChange={e => setNameInput(e.target.value)} 
                        onKeyDown={(ev) => ev.key === 'Enter' && addEntry()}
                        placeholder={isTeamMode ? "Team Name..." : "Player Name..."} 
                        className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-bold" 
                    />
                    <button onClick={addEntry} className="bg-emerald-600 text-white p-4 rounded-2xl active:scale-90 transition-all"><Plus /></button>
                </div>

                <div className="space-y-3">
                    {entries.map(e => (
                        <div key={e.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 animate-in slide-in-from-right duration-300">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black uppercase text-emerald-800 tracking-tight">{e.name}</span>
                                <button onClick={() => setEntries(entries.filter(x => x.id !== e.id))}><Trash2 size={18} className="text-slate-300 hover:text-red-500 transition-colors"/></button>
                            </div>
                            
                            {isTeamMode && (
                                <div className="mt-3 pl-3 border-l-2 border-emerald-200">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {e.members.map((m, i) => (
                                            <span key={i} className="bg-white px-2 py-1 rounded-lg text-[9px] font-black text-slate-500 border border-slate-100 uppercase">{m}</span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            value={activeTeamId === e.id ? memberInput : ''} 
                                            onFocus={() => setActiveTeamId(e.id)} 
                                            onChange={e => setMemberInput(e.target.value)} 
                                            onKeyDown={(ev) => ev.key === 'Enter' && addMember(e.id)} 
                                            placeholder="Add Player to Team..." 
                                            className="flex-1 bg-transparent text-xs font-bold outline-none border-b border-slate-200 py-1" 
                                        />
                                        <button onClick={() => addMember(e.id)} className="text-emerald-600 font-black text-[10px] uppercase">Add</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <button onClick={handleStart} className="mt-8 w-full bg-emerald-600 text-white p-6 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                <Flag size={24} fill="white" /> Tee Off!
            </button>
        </div>
    );
}
/**
 * 3. UPDATED SCORING SCREEN
 * Features: Team Roster display, Match Play standing, and tactile scoring controls.
 */
export function ScoringScreen({ state, currentHole, onHoleChange, onUpdateScore, onUpdatePar, isSpectator }) {
    if (!state) return null;

    const isStableford = state.mode === 'Stableford';
    const isSnake = state.mode === 'Snake';
    const isMatchPlay = state.mode === 'Match Play';

    // Standing logic for Match Play (1v1 or 2v2)
    const matchStatus = isMatchPlay ? calculateMatchStatus(state.players) : null;

    return (
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 p-4 no-scrollbar">
            
            {/* 1. MATCH PLAY STATUS CARD */}
            {isMatchPlay && state.players.length === 2 && (
                <div className="mb-6 bg-slate-900 text-white p-5 rounded-[2.5rem] text-center shadow-xl border-b-4 border-emerald-500 animate-in slide-in-from-top duration-500">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-1">Current Standing</p>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{matchStatus}</h3>
                </div>
            )}

            {/* 2. HOLE & PAR SELECTOR */}
            <div className="flex justify-between items-center mb-6 bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
                <button 
                    onClick={() => onHoleChange(currentHole - 1)} 
                    disabled={currentHole === 0} 
                    className="p-5 bg-slate-50 rounded-2xl text-emerald-700 disabled:opacity-20 active:scale-90 transition-all"
                >
                    <ChevronLeft strokeWidth={3}/>
                </button>
                
                <div className="text-center">
                    <h2 className="text-2xl font-black text-slate-900 leading-none uppercase italic tracking-tighter">Hole {currentHole + 1}</h2>
                    <div className="flex items-center gap-2 mt-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 mx-auto w-fit">
                        {/* Hide Par adjustments if just spectating */}
                        {!isSpectator && (
                            <button onClick={() => onUpdatePar(-1)} className="text-emerald-700 font-black px-1 text-lg active:scale-125">-</button>
                        )}
                        <span className="text-[10px] font-black uppercase text-emerald-800 tracking-widest min-w-[50px]">Par {state.pars[currentHole]}</span>
                        {!isSpectator && (
                            <button onClick={() => onUpdatePar(1)} className="text-emerald-700 font-black px-1 text-lg active:scale-125">+</button>
                        )}
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

            {/* 3. PLAYER/TEAM SCORING CARDS */}
            <div className="space-y-3">
                {state.players.map((p, idx) => {
                    const stats = getPlayerStats(p, state.pars, state.mode);
                    const score = p.scores[currentHole] || 0;
                    const par = state.pars[currentHole];
                    const holePts = getHolePoints(score, par, state.mode);

                    return (
                        <div key={p.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm active:border-emerald-200 transition-colors">
                            <div className="flex-1 min-w-0 pr-2">
                                {/* Team/Player Name */}
                                <h3 className="font-black text-slate-900 truncate uppercase tracking-tight text-lg leading-tight">
                                    {p.name}
                                </h3>
                                
                                {/* ROSTER VIEW: Shows team members for Scramble/Best Ball/Alternate */}
                                {p.members && p.members.length > 0 && (
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5 truncate italic">
                                        {p.members.join(' • ')}
                                    </p>
                                )}
                                
                                <div className="mt-2 flex items-center gap-2">
                                    {/* Score vs Par Badge */}
                                    <div className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                                        stats.relative < 0 ? 'bg-red-50 text-red-500 border-red-100' : 
                                        stats.relative === 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        'bg-slate-50 text-slate-400 border-slate-100'
                                    }`}>
                                        {formatRel(stats.relative)}
                                    </div>

                                    {/* Stableford Context Badge */}
                                    {isStableford && score > 0 && (
                                        <div className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-in zoom-in">
                                            +{holePts} PTS
                                        </div>
                                    )}

                                    {/* Snake Context Badge */}
                                    {isSnake && score >= 3 && (
                                        <div className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-bounce">
                                            🐍 3-Putt
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TACTILE CONTROLS OR SPECTATOR LOCK */}
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100 shrink-0">
                                {!isSpectator ? (
                                    <>
                                        {/* Player Mode: Full +/- Controls */}
                                        <button 
                                            onClick={() => onUpdateScore(idx, -1)} 
                                            className="w-12 h-12 bg-white rounded-xl text-slate-400 font-black shadow-sm active:scale-90 active:bg-slate-100 transition-all flex items-center justify-center text-xl"
                                        >
                                            <Minus size={20} />
                                        </button>
                                        <span className="w-10 text-center font-black text-3xl text-emerald-800 tabular-nums">
                                            {score || '-'}
                                        </span>
                                        <button 
                                            onClick={() => onUpdateScore(idx, 1)} 
                                            className="w-12 h-12 bg-emerald-600 rounded-xl text-white font-black shadow-lg active:scale-90 active:bg-emerald-700 transition-all flex items-center justify-center text-xl"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </>
                                ) : (
                                    /* Spectator Mode: Read-Only Box */
                                    <div className="w-24 h-12 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                                        <span className="font-black text-3xl text-emerald-800 tabular-nums">
                                            {score || '-'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* BOTTOM PADDING FOR NAV */}
            <div className="h-20" />
        </div>
    );
}
/**
 * 4. LEADERBOARD SCREEN (Exportable)
 */
export function LeaderboardScreen({ state }) {
    if (!state) return null;

    const isStableford = state.mode === 'Stableford';
    const sortedPlayers = [...state.players].sort((a, b) => {
        const statsA = getPlayerStats(a, state.pars, state.mode);
        const statsB = getPlayerStats(b, state.pars, state.mode);
        return isStableford ? statsB.points - statsA.points : statsA.relative - statsB.relative;
    });

    return (
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 p-4 no-scrollbar">
            
            {/* HEADER WITH EXPORT BUTTON */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Leaderboard</h2>
                <button 
                    onClick={() => exportImage('leaderboard-capture', `YKTS_Leaderboard_${state.courseName}.png`)}
                    className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                >
                    <Download size={14} /> Export
                </button>
            </div>

            {/* THE CAPTURE ZONE: Everything inside this div gets turned into a picture */}
            <div id="leaderboard-capture" className="bg-slate-50 p-2 rounded-3xl">
                <div className="text-center mb-6 mt-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{state.courseName}</p>
                    <p className="text-sm font-black text-emerald-700 uppercase tracking-tight">{state.mode}</p>
                </div>

                <div className="space-y-3">
                    {sortedPlayers.map((p, i) => {
                        const stats = getPlayerStats(p, state.pars, state.mode);
                        return (
                            <div key={p.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-4 shadow-sm relative overflow-hidden">
                                {i === 0 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400" />}
                                
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-50 text-slate-400'}`}>
                                    {i + 1}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-slate-900 uppercase truncate tracking-tight">{p.name}</h3>
                                    {p.members && p.members.length > 0 && (
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate mt-0.5">
                                            {p.members.join(' • ')}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="text-right">
                                    <div className={`text-xl font-black tabular-nums tracking-tighter ${stats.relative < 0 ? 'text-red-500' : stats.relative === 0 ? 'text-emerald-500' : 'text-slate-900'}`}>
                                        {isStableford ? `${stats.points} pts` : formatRel(stats.relative)}
                                    </div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        Thru {stats.thru}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
/**
 * 5. STATS SCREEN (Exportable)
 */

export function StatsScreen({ state }) {
    if (!state) return null;

    return (
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 p-4 no-scrollbar">
            
            {/* HEADER WITH EXPORT BUTTON */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Performance</h2>
                <button 
                    onClick={() => exportImage('stats-capture', `YKTS_Stats_${state.courseName}.png`)}
                    className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                >
                    <Download size={14} /> Export
                </button>
            </div>

            {/* THE CAPTURE ZONE */}
            <div id="stats-capture" className="bg-slate-50 p-2 rounded-3xl space-y-6">
                
                <div className="text-center mt-2 mb-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{state.courseName}</p>
                    <p className="text-sm font-black text-emerald-700 uppercase tracking-tight">Round Analytics</p>
                </div>

                {state.players.map(p => {
                    const stats = getPlayerStats(p, state.pars, state.mode);
                    return (
                        <div key={p.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
                            <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg mb-4">{p.name}</h3>
                            
                            {/* ... (Keep your existing Stats grid / circles / logic here) ... */}
                            <div className="grid grid-cols-4 gap-2">
                                <StatCircle label="Eagles" value={stats.eagles} color="bg-purple-100 text-purple-700" />
                                <StatCircle label="Birdies" value={stats.birdies} color="bg-red-100 text-red-600" />
                                <StatCircle label="Pars" value={stats.parsCount} color="bg-emerald-100 text-emerald-600" />
                                <StatCircle label="Bogeys+" value={stats.bogeys} color="bg-slate-100 text-slate-600" />
                            </div>

                        </div>
                    );
                })}
            </div>

        </div>
    );
}

/**
 * 6. UPDATED SCORECARD SCREEN
 * Now displays Team Rosters (members) under Team Names.
 */
export function ScorecardScreen({ state, currentHole, onHoleSelect }) {
    if (!state) return null;
    const isStableford = state.mode === 'Stableford';

    // Helper to style Birdies (Circles) and Bogeys (Squares)
    const getScoreStyle = (score, par) => {
        if (!score || score === 0) return "text-slate-300";
        const diff = score - par;
        // Birdie or better (Circle)
        if (diff === -1) return "border-2 border-emerald-500 rounded-full w-8 h-8 flex items-center justify-center mx-auto text-emerald-600 font-bold";
        if (diff <= -2) return "border-4 border-emerald-500 rounded-full w-9 h-9 flex items-center justify-center mx-auto text-emerald-600 font-black";
        // Bogey (Square)
        if (diff === 1) return "border-2 border-slate-900 w-7 h-7 flex items-center justify-center mx-auto text-slate-900 font-bold";
        // Double Bogey+ (Thick Square)
        if (diff >= 2) return "border-4 border-slate-900 w-8 h-8 flex items-center justify-center mx-auto text-slate-900 font-black";
        
        return "text-slate-900 font-medium";
    };

    return (
        <div className="p-4 h-full animate-in fade-in duration-500 flex flex-col overflow-hidden">
            {/* CARD HEADER */}
            <div className="mb-4 px-2 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Scorecard</h2>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                        {state.courseName} • {state.mode}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Holes Played</span>
                    <p className="text-xs font-black text-slate-900">1 - {state.holes}</p>
                </div>
            </div>

            {/* THE TABLE */}
            <div className="flex-1 overflow-auto border border-slate-200 rounded-[2rem] bg-white shadow-xl no-scrollbar">
                <table className="w-full text-center border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                        <tr className="border-b border-slate-200">
                            <th className="p-4 w-14 sticky left-0 bg-slate-100 z-30 border-r border-slate-200 text-[10px] font-black uppercase text-slate-400">Hole</th>
                            <th className="p-4 w-12 border-r border-slate-200 text-[10px] font-black uppercase text-slate-400">Par</th>
                            {state.players.map(player => (
                                <th key={player.id} className="p-4 min-w-[110px] border-r border-slate-200 last:border-r-0">
                                    <div className="text-slate-900 font-black truncate uppercase text-[11px] leading-tight">
                                        {player.name}
                                    </div>
                                    
                                    {/* ROSTER DISPLAY: Shows members if they exist (Scramble/Alternate) */}
                                    {player.members && player.members.length > 0 && (
                                        <div className="text-[7px] text-slate-400 font-bold leading-none mt-1 uppercase tracking-tighter italic">
                                            {player.members.join(', ')}
                                        </div>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: state.holes }).map((_, hIdx) => (
                            <tr 
                                key={hIdx} 
                                onClick={() => onHoleSelect(hIdx)} 
                                className={`group active:bg-emerald-100 transition-colors ${hIdx === currentHole ? 'bg-emerald-50/50' : ''}`}
                            >
                                <td className="p-4 sticky left-0 bg-white group-active:bg-emerald-100 z-10 border-r border-slate-200 font-black text-slate-400 text-xs">
                                    {hIdx + 1}
                                </td>
                                <td className="p-4 border-r border-slate-200 font-bold text-slate-300 text-xs">
                                    {state.pars[hIdx]}
                                </td>
                                {state.players.map(player => (
                                    <td key={player.id} className="p-2 border-r border-slate-100 last:border-r-0">
                                        <div className="h-10 flex items-center justify-center">
                                            <span className={getScoreStyle(player.scores[hIdx], state.pars[hIdx])}>
                                                {player.scores[hIdx] || '-'}
                                            </span>
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                        
                        {/* TOTALS FOOTER */}
                        <tr className="bg-slate-900 text-white font-black uppercase text-[10px] sticky bottom-0 z-20">
                            <td className="p-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">TOT</td>
                            <td className="p-4 border-r border-slate-800">
                                {state.pars.reduce((a, b) => a + b, 0)}
                            </td>
                            {state.players.map(player => {
                                const stats = getPlayerStats(player, state.pars, state.mode);
                                return (
                                    <td key={player.id} className="p-4 text-emerald-400 text-sm border-r border-slate-800 last:border-r-0">
                                        {isStableford ? `${stats.points} PTS` : stats.strokes}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* TIP FOOTER */}
            <p className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest mt-4">
                Tap any row to jump to that hole and edit the score
            </p>
        </div>
    );
}

/**
 * 7. SUMMARY SCREEN (With Full Scorecard)
 * Includes the Champion Card AND the full hole-by-hole receipt.
 */
export function SummaryScreen({ state, onLeave, showToast }) {
    const cardRef = useRef(null); 
    const [saving, setSaving] = useState(false);
    
    if (!state) return null;

    const isStableford = state.mode === 'Stableford';

    // 1. Ranking Logic
    const ranked = [...state.players].sort((a, b) => {
        const statsA = getPlayerStats(a, state.pars, state.mode);
        const statsB = getPlayerStats(b, state.pars, state.mode);
        return isStableford ? statsB.points - statsA.points : statsA.relative - statsB.relative;
    });

    const champion = ranked[0];

    // 2. Score Styling Helper (Brought over from ScorecardScreen)
    const getScoreStyle = (score, par) => {
        if (!score || score === 0) return "text-slate-300";
        const diff = score - par;
        if (diff === -1) return "border-2 border-emerald-500 rounded-full w-7 h-7 flex items-center justify-center mx-auto text-emerald-600 font-bold";
        if (diff <= -2) return "border-4 border-emerald-500 rounded-full w-8 h-8 flex items-center justify-center mx-auto text-emerald-600 font-black";
        if (diff === 1) return "border-2 border-slate-900 w-6 h-6 flex items-center justify-center mx-auto text-slate-900 font-bold";
        if (diff >= 2) return "border-4 border-slate-900 w-7 h-7 flex items-center justify-center mx-auto text-slate-900 font-black";
        return "text-slate-900 font-medium";
    };

    const handleSaveImage = async () => {
        if (!cardRef.current) return;
        setSaving(true);
        try {
            const dataUrl = await htmlToImage.toPng(cardRef.current, { 
                backgroundColor: '#f8fafc', 
                pixelRatio: 2 // High quality capture
            });
            
            // Try mobile share first
            try {
                if (navigator.share && navigator.canShare) {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], `YKTS-Results.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'YKTS Scorecard' });
                        setSaving(false); return;
                    }
                }
            } catch (e) { console.log("Share fallback"); }

            // Fallback download
            const link = document.createElement('a');
            link.download = `YKTS-${state.courseName}-Results.png`;
            link.href = dataUrl;
            link.click();
            showToast("Scorecard saved! 📸");
        } catch (err) { 
            showToast("Failed to save image", true); 
        } finally { 
            setSaving(false); 
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 min-h-screen animate-in zoom-in duration-500 overflow-y-auto pb-12 no-scrollbar">
            
            {/* THIS ENTIRE DIV IS WHAT GETS CAPTURED */}
            <div ref={cardRef} className="bg-slate-50 p-4 pb-8">
                
                {/* TROPHY HEADER */}
                <div className="p-8 flex flex-col items-center text-center bg-white rounded-[3rem] shadow-sm border border-slate-200 mb-6 mt-4">
                    <div className="bg-yellow-400 p-5 rounded-[2.5rem] text-emerald-900 mb-4 rotate-3 shadow-lg shadow-yellow-200">
                        <Trophy size={48} strokeWidth={2.5} />
                    </div>
                    <h1 className="text-3xl font-black mb-1 tracking-tighter uppercase text-slate-900 italic">Winner!</h1>
                    <p className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[9px]">
                        {state.courseName} • {state.mode}
                    </p>
                </div>

                {/* CHAMPION CARD */}
                <div className="bg-slate-900 text-white rounded-[3rem] p-8 shadow-2xl border-b-8 border-emerald-500 text-center relative z-10 -mt-12 mx-2">
                    <span className="text-[9px] font-black uppercase text-emerald-400/60 tracking-[0.3em] mb-2 block">Grand Champion</span>
                    
                    <h2 className="text-3xl font-black mb-2 uppercase tracking-tight italic">
                        {champion.name}
                    </h2>

                    {champion.members?.length > 0 && (
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-6 px-4 leading-relaxed">
                            Featuring: {champion.members.join(' • ')}
                        </p>
                    )}

                    <div className="inline-flex items-center gap-3 bg-white/10 px-5 py-2 rounded-full border border-white/10">
                        <span className="text-2xl font-black text-emerald-400">
                            {isStableford ? getPlayerStats(champion, state.pars, state.mode).points : formatRel(getPlayerStats(champion, state.pars, state.mode).relative)}
                        </span>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            {isStableford ? 'Points' : 'To Par'}
                        </span>
                    </div>
                </div>

                {/* THE FULL SCORECARD RECEIPT */}
                <div className="mt-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mx-2">
                    <div className="bg-slate-100 p-4 border-b border-slate-200 text-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Official Scorecard</span>
                    </div>
                    <table className="w-full text-center border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-10 border-r border-slate-200 text-[9px] font-black uppercase text-slate-400">Hole</th>
                                <th className="p-3 w-10 border-r border-slate-200 text-[9px] font-black uppercase text-slate-400">Par</th>
                                {state.players.map(player => (
                                    <th key={player.id} className="p-3 min-w-[70px] border-r border-slate-200 last:border-r-0">
                                        <div className="text-slate-900 font-black truncate uppercase text-[10px] leading-tight">
                                            {player.name}
                                        </div>
                                        {player.members?.length > 0 && (
                                            <div className="text-[6px] text-slate-400 font-bold leading-none mt-1 uppercase tracking-tighter">
                                                {player.members.join(', ')}
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Array.from({ length: state.holes }).map((_, hIdx) => (
                                <tr key={hIdx}>
                                    <td className="p-3 border-r border-slate-200 font-black text-slate-400 text-[10px]">{hIdx + 1}</td>
                                    <td className="p-3 border-r border-slate-200 font-bold text-slate-300 text-[10px]">{state.pars[hIdx]}</td>
                                    {state.players.map(player => (
                                        <td key={player.id} className="p-2 border-r border-slate-100 last:border-r-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <span className={getScoreStyle(player.scores[hIdx], state.pars[hIdx])}>
                                                    {player.scores[hIdx] || '-'}
                                                </span>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {/* TOTALS ROW */}
                            <tr className="bg-slate-900 text-white font-black uppercase text-[10px]">
                                <td className="p-4 border-r border-slate-800">TOT</td>
                                <td className="p-4 border-r border-slate-800">{state.pars.reduce((a, b) => a + b, 0)}</td>
                                {state.players.map(player => {
                                    const stats = getPlayerStats(player, state.pars, state.mode);
                                    return (
                                        <td key={player.id} className="p-4 text-emerald-400 text-xs border-r border-slate-800 last:border-r-0">
                                            {isStableford ? `${stats.points}` : stats.strokes}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ACTION BUTTONS (Excluded from image capture) */}
            <div className="px-6 space-y-3 mt-4">
                <button 
                    onClick={handleSaveImage} 
                    disabled={saving}
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-3xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                    <Share size={20}/> {saving ? 'Generating...' : 'Save Image'}
                </button>
                <button 
                    onClick={onLeave} 
                    className="w-full py-4 bg-slate-900 text-white font-black rounded-3xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
                >
                    <Home size={20}/> Exit to Clubhouse
                </button>
            </div>
        </div>
    );
}
/**
 * 8. LIVE FEED SCREEN
 */
export function FeedScreen({ state }) {
    if (!state) return null;
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
            <div className="bg-slate-900 rounded-[2rem] p-6 mb-8 text-white shadow-xl">
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/10 p-3 rounded-2xl">
                        <p className="text-xl font-black text-emerald-400">{totalStats.birdies + totalStats.eagles + totalStats.hio}</p>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none mt-1">Unders</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl">
                        <p className="text-xl font-black">{totalStats.pars}</p>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none mt-1">Pars</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-xl font-black text-emerald-400">{totalStats.hio}</p>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none mt-1">HIO</p>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                {sortedFeed.map((msg) => (
                    <div key={msg.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex gap-4 items-start">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0"><Flag size={18} /></div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight mb-1">{msg.text}</p>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{msg.time}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
/**
 * NEW: SPECTATE SCREEN (Dedicated Live Feed Window)
 */
export function SpectateScreen({ db, onNavigate, onSpectate }) {
    const [allLiveGames, setAllLiveGames] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [playerFilter, setPlayerFilter] = useState('All');

    useEffect(() => {
        const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const games = [];
            snap.forEach(doc => {
                games.push({ id: doc.id, ...doc.data() });
            });
            setAllLiveGames(games);
        });
        return () => unsub();
    }, [db]);

    const filteredGames = allLiveGames.filter(game => {
        // 0. Hide Private AND Completed Games
        if (game.isPrivate || game.isCompleted) return false;

        // 1. Search by Course Name
        const matchesSearch = game.courseName?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // 2. Filter by Player/Team Count
        const playerCount = game.players?.length || 0;
        let matchesPlayers = true;
        
        if (playerFilter === '1-2') matchesPlayers = playerCount >= 1 && playerCount <= 2;
        else if (playerFilter === '3-4') matchesPlayers = playerCount >= 3 && playerCount <= 4;
        else if (playerFilter === '5+') matchesPlayers = playerCount >= 5;

        return matchesSearch && matchesPlayers;
    });

    return (
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 p-6 bg-slate-50 no-scrollbar">
            
            {/* BACK BUTTON */}
            <button 
                onClick={() => onNavigate('lobby')}
                className="mb-6 flex items-center gap-1 text-slate-400 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all w-fit"
            >
                <ChevronLeft size={16} strokeWidth={3} />
                Back to Lobby
            </button>

            <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-100 p-2 rounded-xl">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none italic">
                    Live Games
                </h2>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="flex gap-2 mb-6">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search course..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors shadow-sm"
                    />
                </div>
                
                <div className="relative shrink-0">
                    <select 
                        value={playerFilter}
                        onChange={(e) => setPlayerFilter(e.target.value)}
                        className="appearance-none bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-8 text-xs font-black text-slate-700 outline-none focus:border-emerald-500 transition-colors shadow-sm cursor-pointer"
                    >
                        <option value="All">All Sizes</option>
                        <option value="1-2">1-2 Players</option>
                        <option value="3-4">3-4 Players</option>
                        <option value="5+">5+ Players</option>
                    </select>
                    <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" />
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                </div>
            </div>

            {/* THE FEED */}
            <div className="space-y-3">
                {filteredGames.length > 0 ? filteredGames.map((game) => (
                    <div 
                        key={game.id} 
                        onClick={() => onSpectate(game.id)}
                        className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm active:scale-95 transition-all cursor-pointer flex justify-between items-center group hover:border-emerald-300"
                    >
                        <div>
                            <h4 className="font-black text-slate-900 text-lg leading-none mb-1 uppercase tracking-tight group-hover:text-emerald-700 transition-colors">
                                {game.courseName}
                            </h4>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {game.mode} • {game.players?.length || 0} {game.players?.length === 1 ? 'Player' : 'Players'}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest">
                                Watch
                            </span>
                        </div>
                    </div>
                )) : (
                    <div className="bg-slate-100 p-8 rounded-[2rem] text-center border border-slate-200 border-dashed">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No games found</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">Try adjusting your filters!</p>
                    </div>
                )}
            </div>
        </div>
    );
}