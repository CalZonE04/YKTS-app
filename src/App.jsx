import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Trophy,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  LogOut,
  Flag,
  UserPlus,
  Users,
  Settings2,
  Target,
  Share,
  CheckCircle2,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  FileText,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-golf-app';
const firebaseConfig =
  typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : null;
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// --- UTILS & MATH ---
const generateGameCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const getPlayerStats = (player, pars) => {
  let strokes = 0;
  let parTotal = 0;
  let thru = 0;
  let stableford = 0;
  player.scores.forEach((s, i) => {
    if (s > 0) {
      strokes += s;
      const par = pars[i] || 4;
      parTotal += par;
      thru++;
      stableford += Math.max(0, par - s + 2);
    }
  });
  return { strokes, parTotal, thru, relative: strokes - parTotal, stableford };
};

const formatRel = (rel) =>
  rel === 0 ? 'E' : rel > 0 ? `+${rel}` : rel.toString();

const getScoreClass = (score, par) => {
  if (score === 0) return '';
  const diff = score - par;
  if (diff <= -2) return 'text-red-600 border-2 border-red-600 rounded-full';
  if (diff === -1) return 'text-red-500 border border-red-500 rounded-full';
  if (diff === 0) return 'text-gray-900';
  if (diff === 1) return 'text-blue-600 border border-blue-600 rounded';
  return 'text-blue-800 border-2 border-blue-800 rounded';
};

// --- MAIN APP COMPONENT ---
export default function App() {
  // Auth & App State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({
    show: false,
    message: '',
    isError: false,
  });

  // Navigation State
  const [currentScreen, setCurrentScreen] = useState('lobby');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scorecardModal, setScorecardModal] = useState({
    show: false,
    imageUrl: '',
  });
  const [expandedStats, setExpandedStats] = useState({}); // Tracks which player stats are expanded

  // Game State
  const [gameId, setGameId] = useState(null);
  const [currentHole, setCurrentHole] = useState(0);
  const [sharedState, setSharedState] = useState({
    courseName: '',
    holes: 18,
    mode: 'Stroke Play',
    pars: Array(18).fill(4),
    players: [],
  });

  // Setup Form State
  const [setupCourse, setSetupCourse] = useState('');
  const [setupHoles, setSetupHoles] = useState(18);
  const [setupMode, setSetupMode] = useState('Stroke Play');
  const [setupPlayerInput, setSetupPlayerInput] = useState('');
  const [setupMemberInput, setSetupMemberInput] = useState({});
  const [setupPlayers, setSetupPlayers] = useState([]);

  const joinCodeInputRef = useRef(null);
  const scorecardRef = useRef(null);

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(
      () => setToast({ show: false, message: '', isError: false }),
      3500
    );
  };

  // --- FIREBASE AUTH & SYNC ---
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      showToast('Running Offline Mode', true);
      return;
    }
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        showToast('Auth failed.', true);
        setLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (usr) setTimeout(() => setLoading(false), 500);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db || !gameId) return;
    const gameRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'games',
      gameId
    );
    const unsub = onSnapshot(
      gameRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.pars) data.pars = Array(data.holes).fill(4);
          // Data structure migration check for older games without advanced stats
          if (data.players) {
            data.players = data.players.map((p) => ({
              ...p,
              putts: p.putts || Array(data.holes).fill(0),
              fir: p.fir || Array(data.holes).fill(null),
            }));
          }
          setSharedState(data);
        }
      },
      (error) => console.error('Sync error:', error)
    );
    return () => unsub();
  }, [user, gameId]);

  const pushToCloud = async (newState) => {
    setSharedState(newState);
    if (!user || !db || !gameId) return;
    try {
      const gameRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'games',
        gameId
      );
      await setDoc(gameRef, newState, { merge: true });
    } catch (err) {
      console.error(err);
      showToast('Sync failed.', true);
    }
  };

  // --- LOBBY ACTIONS ---
  const createGame = async () => {
    const initialState = {
      courseName: setupCourse || 'Local Course',
      holes: setupHoles,
      mode: setupMode,
      pars: Array(setupHoles).fill(4),
      players: setupPlayers,
    };

    if (!user || !db) {
      setSharedState(initialState);
      setCurrentHole(0);
      setCurrentScreen('scoring');
      return;
    }

    try {
      const code = generateGameCode();
      const gameRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'games',
        code
      );
      await setDoc(gameRef, initialState);

      setGameId(code);
      setSharedState(initialState);
      setCurrentHole(0);
      setCurrentScreen('scoring');
    } catch (err) {
      showToast('Failed to create game.', true);
    }
  };

  const joinGame = async () => {
    if (!user || !db) return;
    const code = joinCodeInputRef.current?.value.toUpperCase().trim();
    if (!code || code.length !== 5) {
      showToast('Code must be 5 letters.', true);
      return;
    }

    try {
      const gameRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'games',
        code
      );
      const docSnap = await getDoc(gameRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.pars) data.pars = Array(data.holes).fill(4);
        if (data.players) {
          data.players = data.players.map((p) => ({
            ...p,
            putts: p.putts || Array(data.holes).fill(0),
            fir: p.fir || Array(data.holes).fill(null),
          }));
        }
        setGameId(code);
        setSharedState(data);
        setCurrentHole(0);
        showToast('Joined!', false);
        setCurrentScreen('scoring');
      } else {
        showToast('Game not found.', true);
      }
    } catch (err) {
      showToast('Error finding game.', true);
    }
  };

  const leaveGame = () => {
    setGameId(null);
    setMenuOpen(false);
    setCurrentScreen('lobby');
  };

  // --- SETUP ACTIONS ---
  const addSetupPlayer = () => {
    const name = setupPlayerInput.trim();
    if (name) {
      setSetupPlayers([
        ...setupPlayers,
        {
          id: Date.now().toString(),
          name,
          members: [],
          scores: Array(setupHoles).fill(0),
          putts: Array(setupHoles).fill(0),
          fir: Array(setupHoles).fill(null),
        },
      ]);
      setSetupPlayerInput('');
    }
  };

  const removeSetupPlayer = (id) =>
    setSetupPlayers(setupPlayers.filter((p) => p.id !== id));

  const addSetupMember = (teamId) => {
    const name = setupMemberInput[teamId]?.trim();
    if (name) {
      setSetupPlayers(
        setupPlayers.map((p) => {
          if (p.id === teamId)
            return { ...p, members: [...(p.members || []), name] };
          return p;
        })
      );
      setSetupMemberInput({ ...setupMemberInput, [teamId]: '' });
    }
  };

  const removeSetupMember = (teamId, mIdx) => {
    setSetupPlayers(
      setupPlayers.map((p) => {
        if (p.id === teamId) {
          const newM = [...p.members];
          newM.splice(mIdx, 1);
          return { ...p, members: newM };
        }
        return p;
      })
    );
  };

  const handleHolesChange = (e) => {
    const h = parseInt(e.target.value);
    setSetupHoles(h);
    setSetupPlayers(
      setupPlayers.map((p) => ({
        ...p,
        scores: Array(h).fill(0),
        putts: Array(h).fill(0),
        fir: Array(h).fill(null),
      }))
    );
  };

  const validateSetup = () => {
    if (setupMode === 'Match Play' && setupPlayers.length !== 2) return false;
    if (setupPlayers.length === 0) return false;
    return true;
  };

  // --- GAME ACTIONS ---
  const updateScore = (pIdx, change) => {
    const newState = { ...sharedState };
    const player = newState.players[pIdx];
    let current = player.scores[currentHole] || 0;
    const par = newState.pars[currentHole] || 4;

    if (current === 0 && change > 0) current = par;
    else if (current > 0) current += change;
    if (current < 1) current = 0;

    player.scores[currentHole] = current;
    pushToCloud(newState);
  };

  const updatePutts = (pIdx, change) => {
    const newState = { ...sharedState };
    const player = newState.players[pIdx];
    let current = player.putts[currentHole] || 0;
    current += change;
    if (current < 0) current = 0;

    player.putts[currentHole] = current;
    pushToCloud(newState);
  };

  const setFir = (pIdx, value) => {
    const newState = { ...sharedState };
    newState.players[pIdx].fir[currentHole] = value;
    pushToCloud(newState);
  };

  const updatePar = (change) => {
    const newState = { ...sharedState };
    let p = newState.pars[currentHole] || 4;
    p += change;
    if (p < 3) p = 3;
    if (p > 6) p = 6;
    newState.pars[currentHole] = p;
    pushToCloud(newState);
  };

  const generateScorecardImage = async () => {
    if (!scorecardRef.current) return;
    try {
      let h2c = window.html2canvas;
      if (!h2c) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src =
            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        h2c = window.html2canvas;
      }

      const el = scorecardRef.current;
      const originalMaxHeight = el.style.maxHeight;
      const originalOverflow = el.style.overflow;

      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      el.querySelector('#scorecardHeaderLabel').classList.remove('hidden');

      const canvas = await h2c(el, { scale: 2, backgroundColor: '#f8fafc' });

      el.style.maxHeight = originalMaxHeight;
      el.style.overflow = originalOverflow;
      el.querySelector('#scorecardHeaderLabel').classList.add('hidden');

      setScorecardModal({
        show: true,
        imageUrl: canvas.toDataURL('image/png'),
      });
    } catch (err) {
      showToast('Failed to generate image.', true);
    }
  };

  const copyCode = () => {
    if (!gameId) return;
    try {
      navigator.clipboard.writeText(gameId).then(() => {
        showToast('Code copied!', false);
        setMenuOpen(false);
      });
    } catch (e) {
      const el = document.createElement('textarea');
      el.value = gameId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('Code copied!', false);
      setMenuOpen(false);
    }
  };

  const toggleStatsExpansion = (id) => {
    setExpandedStats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- RENDER HELPERS ---
  const renderRankedPlayers = () => {
    const isStableford = sharedState.mode === 'Stableford';
    return sharedState.players
      .map((p) => ({ ...p, ...getPlayerStats(p, sharedState.pars) }))
      .sort((a, b) => {
        if (isStableford) {
          if (a.stableford !== b.stableford) return b.stableford - a.stableford;
        } else {
          if (a.relative !== b.relative) return a.relative - b.relative;
        }
        return b.thru - a.thru;
      });
  };

  // --- SCREENS ---
  const LobbyScreen = () => (
    <div className="p-6 h-full flex flex-col items-center justify-center animate-[slideInRight_0.25s_ease-out]">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="bg-emerald-100 p-6 rounded-full mb-6 shadow-inner text-emerald-600">
          <Trophy size={64} strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-black text-emerald-800 mb-8 text-center leading-tight">
          Welcome to
          <br />
          The Score
        </h1>

        <button
          onClick={() => {
            setSetupPlayers([]);
            setCurrentScreen('setup');
          }}
          className="w-full bg-emerald-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 mb-8 transition active:scale-95 flex justify-center items-center gap-2"
        >
          <Flag size={20} /> Create New Game
        </button>

        <div className="w-full relative flex items-center py-4 mb-4">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 font-bold text-sm tracking-widest uppercase">
            Or
          </span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <div className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3 text-center">
            Join Friend's Game
          </label>
          <div className="flex gap-2">
            <input
              ref={joinCodeInputRef}
              type="text"
              placeholder="5-Letter Code"
              maxLength="5"
              className="flex-1 min-w-0 p-3 border-2 border-gray-300 rounded-xl uppercase font-black text-center tracking-[0.25em] text-lg focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={joinGame}
              className="shrink-0 bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-900 transition active:scale-95"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const SetupScreen = () => {
    const isScramble = setupMode === 'Scramble';
    return (
      <div className="bg-gray-50 min-h-full pb-8 animate-[slideInRight_0.25s_ease-out]">
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-gray-100 px-4 py-4 flex justify-between items-center mb-2 shadow-sm">
          <h2 className="text-xl font-black text-emerald-800">Game Setup</h2>
          <button
            onClick={() => setCurrentScreen('lobby')}
            className="text-sm font-bold text-gray-600 bg-gray-100 px-4 py-2 rounded-full active:scale-95 transition"
          >
            Cancel
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Settings2 size={16} /> 1. Format & Course
            </h3>
            <div className="space-y-4">
              <select
                value={setupMode}
                onChange={(e) => setSetupMode(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-500 outline-none font-bold text-gray-800"
              >
                <option value="Stroke Play">Stroke Play</option>
                <option value="Match Play">Match Play (1v1)</option>
                <option value="Stableford">Stableford</option>
                <option value="Scramble">Scramble</option>
              </select>
              <input
                type="text"
                value={setupCourse}
                onChange={(e) => setSetupCourse(e.target.value)}
                placeholder="Course Name (e.g. Pebble Beach)"
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-500 outline-none font-medium"
              />
              <select
                value={setupHoles}
                onChange={handleHolesChange}
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-500 outline-none font-medium"
              >
                <option value={18}>18 Holes</option>
                <option value={9}>9 Holes</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={16} /> 2. Roster
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={setupPlayerInput}
                onChange={(e) => setSetupPlayerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSetupPlayer()}
                placeholder={isScramble ? 'Add Team Name' : 'Add Player Name'}
                className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-500 outline-none"
              />
              <button
                onClick={addSetupPlayer}
                className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition"
              >
                <UserPlus size={20} />
              </button>
            </div>

            {setupPlayers.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                No players added yet.
                <br />
                Add yourself above!
              </div>
            ) : (
              <ul className="space-y-3">
                {setupPlayers.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col bg-gray-50 p-4 rounded-xl border border-gray-200 gap-2"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-bold text-gray-800">{p.name}</span>
                      <button
                        onClick={() => removeSetupPlayer(p.id)}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    {isScramble && (
                      <>
                        <div className="flex flex-wrap gap-1.5 mt-1 mb-1">
                          {(p.members || []).map((m, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-md"
                            >
                              {m}{' '}
                              <button
                                onClick={() => removeSetupMember(p.id, idx)}
                                className="text-emerald-600 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 w-full mt-1">
                          <input
                            type="text"
                            value={setupMemberInput[p.id] || ''}
                            onChange={(e) =>
                              setSetupMemberInput({
                                ...setupMemberInput,
                                [p.id]: e.target.value,
                              })
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && addSetupMember(p.id)
                            }
                            placeholder="Player Name..."
                            className="flex-1 p-2 text-sm bg-white border border-gray-300 rounded-lg outline-none"
                          />
                          <button
                            onClick={() => addSetupMember(p.id)}
                            className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg font-bold hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-4 mt-2">
          <button
            onClick={createGame}
            disabled={!validateSetup()}
            className={`w-full p-4 rounded-xl font-black text-lg transition shadow-sm flex justify-center items-center gap-2 ${
              validateSetup()
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Tee Off! <ChevronRight size={24} />
          </button>
        </div>
      </div>
    );
  };

  const ScoringScreen = () => {
    const isStableford = sharedState.mode === 'Stableford';
    const isScramble = sharedState.mode === 'Scramble';
    const holePar = sharedState.pars[currentHole] || 4;

    return (
      <div className="p-4 h-full animate-[slideInRight_0.25s_ease-out]">
        <div className="flex justify-between items-center mb-6 bg-white p-2 rounded-2xl shadow-sm border border-gray-200">
          <button
            onClick={() => currentHole > 0 && setCurrentHole((h) => h - 1)}
            disabled={currentHole === 0}
            className="p-4 bg-gray-50 rounded-xl text-emerald-700 hover:bg-emerald-100 disabled:opacity-30 active:scale-95 transition"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>

          <div className="text-center flex flex-col items-center">
            <h2 className="text-3xl font-black text-emerald-800 tracking-tight leading-none">
              Hole {currentHole + 1}
            </h2>
            <div className="flex items-center justify-center gap-3 mt-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <button
                onClick={() => updatePar(-1)}
                className="w-6 h-6 flex items-center justify-center bg-white rounded-full text-emerald-700 font-black shadow-sm active:scale-90"
              >
                -
              </button>
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest w-12 text-center">
                Par {holePar}
              </span>
              <button
                onClick={() => updatePar(1)}
                className="w-6 h-6 flex items-center justify-center bg-white rounded-full text-emerald-700 font-black shadow-sm active:scale-90"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={() =>
              currentHole < sharedState.holes - 1 &&
              setCurrentHole((h) => h + 1)
            }
            disabled={currentHole === sharedState.holes - 1}
            className="p-4 bg-gray-50 rounded-xl text-emerald-700 hover:bg-emerald-100 disabled:opacity-30 active:scale-95 transition"
          >
            <ChevronRight size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="space-y-4 pb-6">
          {sharedState.players.map((p, i) => {
            const score = p.scores[currentHole] || 0;
            const putts = p.putts ? p.putts[currentHole] || 0 : 0;
            const fir = p.fir ? p.fir[currentHole] : null;
            const stats = getPlayerStats(p, sharedState.pars);

            const relFmt = isStableford
              ? `${stats.stableford} Pts`
              : formatRel(stats.relative);
            const relCls = isStableford
              ? 'text-emerald-700'
              : stats.relative < 0
              ? 'text-red-600'
              : stats.relative > 0
              ? 'text-blue-600'
              : 'text-emerald-700';

            return (
              <div
                key={p.id}
                className="bg-white p-4 rounded-3xl shadow-sm border border-gray-200 flex flex-col transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 overflow-hidden pr-2">
                    <h3 className="font-bold text-xl text-gray-900 leading-tight truncate">
                      {p.name}
                    </h3>
                    {isScramble && p.members?.length > 0 && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[200px]">
                        {p.members.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 font-bold mt-2 uppercase tracking-widest flex items-center">
                      Tot: {stats.strokes}
                      <span
                        className={`ml-2 px-2 py-0.5 rounded bg-gray-50 border border-gray-100 ${relCls}`}
                      >
                        {relFmt}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 shrink-0">
                    <button
                      onClick={() => updateScore(i, -1)}
                      className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-600 border border-gray-100 active:bg-gray-100 active:scale-95 text-3xl font-medium select-none transition"
                    >
                      <Minus size={20} />
                    </button>
                    <div className="w-10 text-center font-black text-3xl text-emerald-800 select-none">
                      {score === 0 ? '-' : score}
                    </div>
                    <button
                      onClick={() => updateScore(i, 1)}
                      className="w-12 h-12 flex items-center justify-center bg-emerald-600 rounded-xl shadow-sm text-white active:bg-emerald-700 active:scale-95 text-3xl font-medium select-none transition"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                {/* Advanced Stats Expansion */}
                {expandedStats[p.id] && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">
                        Putts
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updatePutts(i, -1)}
                          className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-600 border border-gray-200 active:bg-gray-100 active:scale-95 transition"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="w-8 text-center font-black text-2xl text-gray-800">
                          {putts}
                        </span>
                        <button
                          onClick={() => updatePutts(i, 1)}
                          className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 border border-emerald-100 active:bg-emerald-100 active:scale-95 transition"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {holePar > 3 ? (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">
                          Fairway Hit
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFir(i, 'hit')}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors active:scale-95 ${
                              fir === 'hit'
                                ? 'bg-emerald-600 text-white shadow-sm border border-emerald-700'
                                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setFir(i, 'miss')}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors active:scale-95 ${
                              fir === 'miss'
                                ? 'bg-red-500 text-white shadow-sm border border-red-600'
                                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">
                          Fairway Hit
                        </span>
                        <span className="text-xs text-gray-400 font-bold tracking-widest uppercase">
                          N/A (Par 3)
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-sm font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1">
                        GIR{' '}
                        <span className="text-[10px] text-gray-400 normal-case">
                          (Auto)
                        </span>
                      </span>
                      <span
                        className={`text-sm font-black uppercase tracking-widest ${
                          score > 0
                            ? score - putts <= holePar - 2
                              ? 'text-emerald-600'
                              : 'text-red-500'
                            : 'text-gray-300'
                        }`}
                      >
                        {score > 0
                          ? score - putts <= holePar - 2
                            ? 'Hit'
                            : 'Missed'
                          : '-'}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => toggleStatsExpansion(p.id)}
                  className="w-full mt-3 pt-3 text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest flex justify-center items-center gap-1 border-t border-dashed border-gray-100 hover:text-emerald-600 transition-colors"
                >
                  {expandedStats[p.id] ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}{' '}
                  {expandedStats[p.id] ? 'Hide Stats' : 'Advanced Stats'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const LeaderboardScreen = () => {
    const isMatchPlay = sharedState.mode === 'Match Play';
    const isStableford = sharedState.mode === 'Stableford';
    const isScramble = sharedState.mode === 'Scramble';

    if (isMatchPlay && sharedState.players.length === 2) {
      const [p1, p2] = sharedState.players;
      let p1Wins = 0;
      let p2Wins = 0;
      let holesPlayed = 0;
      for (let h = 0; h < sharedState.holes; h++) {
        const s1 = p1.scores[h] || 0;
        const s2 = p2.scores[h] || 0;
        if (s1 > 0 && s2 > 0) {
          holesPlayed++;
          if (s1 < s2) p1Wins++;
          else if (s2 < s1) p2Wins++;
        }
      }
      const diff = Math.abs(p1Wins - p2Wins);
      const holesLeft = sharedState.holes - holesPlayed;
      let status = 'ALL SQUARE';
      let color = 'text-gray-400';
      let leader = 'Tied Match';
      if (p1Wins > p2Wins) {
        leader = p1.name;
        color = 'text-emerald-600';
        status =
          diff > holesLeft ? `${diff} & ${holesLeft} (WINNER)` : `${diff} UP`;
      } else if (p2Wins > p1Wins) {
        leader = p2.name;
        color = 'text-blue-600';
        status =
          diff > holesLeft ? `${diff} & ${holesLeft} (WINNER)` : `${diff} UP`;
      }

      return (
        <div className="p-4 h-full animate-[slideInRight_0.25s_ease-out]">
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-2xl font-black text-emerald-800">
              Leaderboard
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-bold uppercase">
              {sharedState.mode}
            </span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-8 flex flex-col items-center justify-center">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
              Match Status
            </div>
            <div
              className={`text-4xl sm:text-5xl font-black ${color} text-center mb-2 leading-none`}
            >
              {status}
            </div>
            <div className="text-xl font-bold text-gray-800">{leader}</div>
            <div className="w-full flex justify-between items-center mt-10 px-2">
              <div className="text-center w-1/3 overflow-hidden">
                <div className="text-4xl font-black text-emerald-800">
                  {p1Wins}
                </div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-2 truncate">
                  {p1.name}
                </div>
              </div>
              <div className="text-xl font-black text-gray-200 w-1/3 text-center">
                VS
              </div>
              <div className="text-center w-1/3 overflow-hidden">
                <div className="text-4xl font-black text-blue-800">
                  {p2Wins}
                </div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-2 truncate">
                  {p2.name}
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4 font-medium uppercase tracking-widest">
            Holes Won / Lost
          </p>
        </div>
      );
    }

    const ranked = renderRankedPlayers();
    let currentPos = 1;

    return (
      <div className="p-4 h-full animate-[slideInRight_0.25s_ease-out]">
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-2xl font-black text-emerald-800">Leaderboard</h2>
          <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-bold uppercase">
            {sharedState.mode}
          </span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 font-bold text-center w-12">Pos</th>
                <th className="px-4 py-4 font-bold">Player</th>
                <th className="px-4 py-4 font-bold text-center">Thru</th>
                <th className="px-4 py-4 font-black text-right text-emerald-800">
                  {isStableford ? 'Pts' : 'Score'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranked.map((p, i) => {
                let isTie = false;
                let sA = isStableford ? p.stableford : p.relative;
                let prevS =
                  i > 0
                    ? isStableford
                      ? ranked[i - 1].stableford
                      : ranked[i - 1].relative
                    : null;
                let nextS =
                  i < ranked.length - 1
                    ? isStableford
                      ? ranked[i + 1].stableford
                      : ranked[i + 1].relative
                    : null;
                if (i > 0 && sA === prevS) isTie = true;
                if (i < ranked.length - 1 && sA === nextS) isTie = true;
                if (i > 0 && sA !== prevS) currentPos = i + 1;

                let sStr = isStableford
                  ? p.stableford.toString()
                  : formatRel(p.relative);
                let sCls = isStableford
                  ? 'text-emerald-700'
                  : p.relative < 0
                  ? 'text-red-600'
                  : p.relative > 0
                  ? 'text-blue-600'
                  : 'text-emerald-700';
                if (p.thru === 0) sStr = '-';

                return (
                  <tr
                    key={p.id}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-4 py-4 font-bold text-gray-400 text-center align-middle">
                      {isTie ? 'T' + currentPos : currentPos}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="font-bold text-gray-900 leading-tight">
                        {p.name}
                      </div>
                      {isScramble && p.members?.length > 0 && (
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate max-w-[120px] mt-0.5">
                          {p.members.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-gray-500 font-medium align-middle">
                      {p.thru === sharedState.holes ? 'F' : p.thru}
                    </td>
                    <td
                      className={`px-4 py-4 font-black text-right text-lg ${sCls} align-middle`}
                    >
                      {sStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4 font-medium uppercase tracking-widest">
          {isStableford ? 'Points per hole' : 'Scores relative to Par'}
        </p>
      </div>
    );
  };

  const StatsScreen = () => {
    return (
      <div className="p-4 h-full animate-[slideInRight_0.25s_ease-out]">
        <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-2xl font-black text-emerald-800">Round Stats</h2>
        </div>

        {sharedState.players.length === 0 ? (
          <div className="text-center text-gray-400 text-sm mt-10">
            No players to show stats for yet.
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            {sharedState.players.map((p) => {
              let totalPutts = 0;
              let firHits = 0;
              let firTotal = 0;
              let girHits = 0;
              let holesPlayed = 0;

              p.scores.forEach((score, h) => {
                if (score > 0) {
                  holesPlayed++;
                  const putts = p.putts ? p.putts[h] || 0 : 0;
                  totalPutts += putts;

                  const par = sharedState.pars[h] || 4;
                  if (par > 3) {
                    const fir = p.fir ? p.fir[h] : null;
                    if (fir === 'hit') firHits++;
                    if (fir === 'hit' || fir === 'miss') firTotal++;
                  }

                  if (score - putts <= par - 2) girHits++;
                }
              });

              const avgPutts =
                holesPlayed > 0 ? (totalPutts / holesPlayed).toFixed(1) : '0.0';
              const firPct =
                firTotal > 0 ? Math.round((firHits / firTotal) * 100) : 0;
              const girPct =
                holesPlayed > 0 ? Math.round((girHits / holesPlayed) * 100) : 0;

              return (
                <div
                  key={p.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 transition-all"
                >
                  <h3 className="font-black text-lg text-gray-900 mb-4 pb-2 border-b border-gray-100">
                    {p.name}
                  </h3>

                  <div className="space-y-5">
                    {/* Putts */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Target size={16} /> Total Putts
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-gray-800">
                          {totalPutts}
                        </span>
                        <span className="text-xs font-bold text-emerald-600 ml-2 bg-emerald-50 px-2 py-1 rounded">
                          ({avgPutts} avg)
                        </span>
                      </div>
                    </div>

                    {/* FIR */}
                    <div>
                      <div className="flex justify-between mb-1.5 items-end">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                          Fairways (FIR)
                        </span>
                        <span className="text-lg font-black text-emerald-700">
                          {firPct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${firPct}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1.5 text-right">
                        {firHits} / {firTotal} Fairways
                      </div>
                    </div>

                    {/* GIR */}
                    <div>
                      <div className="flex justify-between mb-1.5 items-end">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                          Greens (GIR)
                        </span>
                        <span className="text-lg font-black text-blue-700">
                          {girPct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${girPct}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1.5 text-right">
                        {girHits} / {holesPlayed} Greens
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const ScorecardScreen = () => {
    const isStableford = sharedState.mode === 'Stableford';
    const isMatchPlay = sharedState.mode === 'Match Play';

    return (
      <div className="p-4 h-full flex flex-col animate-[slideInRight_0.25s_ease-out]">
        <div className="flex justify-between items-center mb-4 px-2 shrink-0">
          <h2 className="text-2xl font-black text-emerald-800">Scorecard</h2>
          <button
            onClick={generateScorecardImage}
            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 p-2 rounded-lg font-bold transition active:scale-95"
            title="Generate Image"
          >
            <Download size={20} />
          </button>
        </div>

        <div
          ref={scorecardRef}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col max-h-[65vh] overflow-hidden relative"
        >
          <div
            id="scorecardHeaderLabel"
            className="hidden bg-emerald-800 text-white p-4 text-center"
          >
            <h2 className="text-2xl font-black tracking-widest uppercase mb-1">
              {sharedState.courseName}
            </h2>
            <p className="text-emerald-200 text-sm font-bold">
              {sharedState.mode}
            </p>
          </div>

          <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1">
            <table className="w-full text-sm text-center border-collapse">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-4 py-4 sticky left-0 bg-gray-50 z-30 border-r border-b border-gray-200 font-bold text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Hole
                  </th>
                  {sharedState.players.map((p) => (
                    <th
                      key={p.id}
                      className="px-3 py-4 min-w-[65px] border-b border-gray-200 font-bold text-gray-800"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-100">
                  <td className="px-4 py-2 sticky left-0 bg-gray-100 z-30 border-r border-b border-gray-200 font-black text-gray-500 text-xs uppercase tracking-widest text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Par
                  </td>
                  {sharedState.players.map((p) => (
                    <td
                      key={'par' + p.id}
                      className="border-b border-gray-200 px-3 py-2"
                    ></td>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array.from({ length: sharedState.holes }).map((_, h) => {
                  const isCurrent = h === currentHole;
                  const holePar = sharedState.pars[h] || 4;

                  let holeWinIdx = -1;
                  if (isMatchPlay && sharedState.players.length === 2) {
                    const s1 = sharedState.players[0].scores[h] || 0;
                    const s2 = sharedState.players[1].scores[h] || 0;
                    if (s1 > 0 && s2 > 0) {
                      if (s1 < s2) holeWinIdx = 0;
                      else if (s2 < s1) holeWinIdx = 1;
                    }
                  }

                  return (
                    <tr
                      key={h}
                      onClick={() => {
                        setCurrentHole(h);
                        setCurrentScreen('scoring');
                      }}
                      className={`cursor-pointer transition-colors ${
                        isCurrent ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td
                        className={`px-4 py-3 sticky left-0 z-10 border-r border-gray-100 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${
                          isCurrent ? 'bg-emerald-50' : 'bg-white'
                        }`}
                      >
                        <span className="font-bold text-gray-800 text-base">
                          #{h + 1}
                        </span>
                        <span className="text-xs text-gray-400 font-medium ml-1">
                          ({holePar})
                        </span>
                      </td>
                      {sharedState.players.map((p, pIdx) => {
                        const s = p.scores[h] || 0;
                        const sCls = getScoreClass(s, holePar);
                        const cellBg =
                          holeWinIdx === pIdx ? 'bg-emerald-100' : '';
                        return (
                          <td
                            key={p.id}
                            className={`px-2 py-2 text-center ${cellBg}`}
                          >
                            <div
                              className={`mx-auto flex items-center justify-center w-8 h-8 font-bold ${sCls} ${
                                s === 0 ? 'text-gray-300' : ''
                              }`}
                            >
                              {s === 0 ? '-' : s}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-emerald-50 font-bold sticky bottom-0 z-20 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)]">
                <tr>
                  <td className="px-4 py-4 sticky left-0 bg-emerald-50 z-30 border-r border-t-2 border-emerald-200 text-emerald-900 uppercase tracking-wide text-xs text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Total
                  </td>
                  {sharedState.players.map((p) => {
                    const stats = getPlayerStats(p, sharedState.pars);
                    return (
                      <td
                        key={'tot' + p.id}
                        className="px-3 py-4 text-center font-black text-emerald-800 text-lg border-t-2 border-emerald-200"
                      >
                        {isStableford ? (
                          <>
                            {stats.stableford}{' '}
                            <span className="text-[10px] font-normal">pts</span>
                          </>
                        ) : (
                          stats.strokes
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const SummaryScreen = () => {
    let wName = '';
    let wScore = '';
    if (sharedState.players.length > 0) {
      if (
        sharedState.mode === 'Match Play' &&
        sharedState.players.length === 2
      ) {
        const [p1, p2] = sharedState.players;
        let p1Wins = 0;
        let p2Wins = 0;
        for (let h = 0; h < sharedState.holes; h++) {
          const s1 = p1.scores[h] || 0;
          const s2 = p2.scores[h] || 0;
          if (s1 > 0 && s2 > 0) {
            if (s1 < s2) p1Wins++;
            else if (s2 < s1) p2Wins++;
          }
        }
        const diff = Math.abs(p1Wins - p2Wins);
        if (p1Wins > p2Wins) {
          wName = p1.name;
          wScore = `${diff} UP`;
        } else if (p2Wins > p1Wins) {
          wName = p2.name;
          wScore = `${diff} UP`;
        } else {
          wName = 'Tie';
          wScore = 'All Square';
        }
      } else {
        let ranked = renderRankedPlayers();
        if (sharedState.mode === 'Stableford') {
          wName = ranked[0].name;
          wScore = `${ranked[0].stableford} Points`;
        } else {
          wName = ranked[0].name;
          let rel = ranked[0].relative;
          wScore = rel === 0 ? 'E' : rel > 0 ? `+${rel}` : rel;
          wScore += ` (${ranked[0].strokes} Strokes)`;
        }
        if (ranked.length > 1) {
          const first =
            sharedState.mode === 'Stableford'
              ? ranked[0].stableford
              : ranked[0].relative;
          const sec =
            sharedState.mode === 'Stableford'
              ? ranked[1].stableford
              : ranked[1].relative;
          if (first === sec) {
            wName = 'Tie';
          }
        }
      }
    }

    return (
      <div className="p-6 h-full flex flex-col items-center justify-center bg-emerald-800 text-white animate-[popIn_0.5s_ease-out]">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="text-6xl mb-4 drop-shadow-lg text-yellow-400">
            <Trophy size={80} fill="currentColor" strokeWidth={1} />
          </div>
          <h2 className="text-4xl font-black mb-1 tracking-tight">
            Round Complete
          </h2>
          <p className="text-emerald-300 mb-8 font-bold tracking-widest uppercase text-sm text-center">
            {sharedState.courseName} • {sharedState.mode}
          </p>

          <div className="bg-white w-full rounded-3xl p-8 text-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] mb-8 transform hover:scale-[1.02] transition-transform relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 text-center">
              {wName === 'Tie' ? 'Match Result' : 'Champion'}
            </h3>
            <div className="text-center">
              <div className="text-4xl font-black text-emerald-800 mb-2 leading-tight">
                {wName}
              </div>
              <div className="text-lg font-bold text-emerald-600 bg-emerald-50 inline-block px-4 py-1 rounded-full border border-emerald-100">
                {wScore}
              </div>
            </div>
          </div>

          <div className="w-full space-y-4">
            <button
              onClick={() => {
                setCurrentScreen('scorecard');
                setTimeout(generateScorecardImage, 100);
              }}
              className="w-full bg-emerald-500 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-400 active:scale-95 transition flex justify-center items-center gap-2"
            >
              <Share size={20} /> Share Scorecard
            </button>
            <button
              onClick={leaveGame}
              className="w-full bg-emerald-900 text-emerald-200 p-4 rounded-xl font-bold text-lg hover:bg-emerald-950 active:scale-95 transition border border-emerald-700"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER MAIN WRAPPER ---
  if (loading) {
    return (
      <div className="fixed inset-0 bg-emerald-900 flex flex-col items-center justify-center text-white">
        <Trophy size={48} className="animate-pulse text-emerald-400 mb-6" />
        <h2 className="text-2xl font-black tracking-tight mb-2">
          Connecting...
        </h2>
      </div>
    );
  }

  const showNav = !['lobby', 'setup', 'summary'].includes(currentScreen);
  const headerBg =
    currentScreen === 'summary' ? 'bg-emerald-900' : 'bg-emerald-700';

  return (
    <div className="w-full max-w-md bg-gray-50 h-full flex flex-col shadow-2xl relative overflow-hidden mx-auto font-sans">
      {/* TOAST */}
      <div
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[70] transition-all duration-300 font-bold text-white text-center w-11/12 max-w-sm ${
          toast.show
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95 pointer-events-none'
        } ${toast.isError ? 'bg-red-500' : 'bg-emerald-600'}`}
      >
        {toast.message}
      </div>

      {/* HEADER */}
      <header
        className={`${headerBg} text-white p-4 shadow-md z-20 flex justify-between items-center shrink-0 transition-colors`}
      >
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Flag size={20} /> The Score
          </h1>
          {gameId && (
            <span className="text-xs font-medium text-emerald-200 truncate max-w-[200px] block mt-0.5">
              {sharedState.courseName}
            </span>
          )}
        </div>
        {showNav && (
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 transition active:scale-95"
          >
            <Menu size={20} />
          </button>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main
        className={`flex-1 overflow-y-auto relative ${showNav ? 'pb-20' : ''}`}
      >
        {currentScreen === 'lobby' && <LobbyScreen />}
        {currentScreen === 'setup' && <SetupScreen />}
        {currentScreen === 'scoring' && <ScoringScreen />}
        {currentScreen === 'leaderboard' && <LeaderboardScreen />}
        {currentScreen === 'stats' && <StatsScreen />}
        {currentScreen === 'scorecard' && <ScorecardScreen />}
      </main>

      {/* BOTTOM NAV */}
      {showNav && (
        <nav className="bg-white border-t border-gray-200 flex justify-between px-1 py-2 absolute bottom-0 w-full z-20 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] pb-safe">
          {[
            {
              id: 'scoring',
              label: 'Scoring',
              icon: <Target size={20} className="mb-1" />,
            },
            {
              id: 'leaderboard',
              label: 'Board',
              icon: <Trophy size={20} className="mb-1" />,
            },
            {
              id: 'stats',
              label: 'Stats',
              icon: <BarChart2 size={20} className="mb-1" />,
            },
            {
              id: 'scorecard',
              label: 'Cards',
              icon: <FileText size={20} className="mb-1" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentScreen(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 w-1/4 rounded-xl transition active:scale-95 ${
                currentScreen === tab.id
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-gray-400 hover:text-emerald-600'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] sm:text-xs font-bold tracking-wide">
                {tab.label}
              </span>
            </button>
          ))}
        </nav>
      )}

      {/* GAME MENU DRAWER */}
      {menuOpen && (
        <div className="fixed inset-0 z-[50] flex flex-col justify-end">
          <div
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-[fadeIn_0.3s]"
          ></div>
          <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-[slideUp_0.3s_ease-out] relative z-10 pb-safe">
            <div className="p-6">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6"></div>
              <h3 className="text-2xl font-black text-gray-900 mb-6">
                Game Options
              </h3>

              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex justify-between items-center mb-6">
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-1">
                    Invite Code
                  </p>
                  <p className="text-3xl font-black text-emerald-800 tracking-[0.15em]">
                    {gameId}
                  </p>
                </div>
                <button
                  onClick={copyCode}
                  className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition flex items-center gap-2"
                >
                  <Copy size={18} /> Copy
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setCurrentScreen('summary');
                  }}
                  className="w-full py-4 text-white font-bold bg-gray-900 hover:bg-black rounded-xl transition flex justify-center items-center gap-2 active:scale-95 shadow-md"
                >
                  <CheckCircle2 size={20} /> Finish Round (19th Hole)
                </button>
                <button
                  onClick={leaveGame}
                  className="w-full py-4 text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition flex justify-center items-center gap-2"
                >
                  <LogOut size={20} /> Leave Game
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full py-4 text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCORECARD IMAGE MODAL */}
      {scorecardModal.show && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-center items-center p-4">
          <div
            onClick={() => setScorecardModal({ show: false, imageUrl: '' })}
            className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"
          ></div>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-[popIn_0.3s_ease-out]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-black text-emerald-800 text-lg">
                Your Scorecard
              </h3>
              <button
                onClick={() => setScorecardModal({ show: false, imageUrl: '' })}
                className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition active:scale-95"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex justify-center bg-gray-50 items-start">
              <img
                src={scorecardModal.imageUrl}
                alt="Scorecard"
                className="max-w-full h-auto shadow-md border border-gray-200 rounded"
              />
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-800 text-center text-sm font-bold rounded-b-2xl shrink-0 border-t border-emerald-100">
              Long-press (or right-click) the image to save! 📸
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ensure keyframes are injected for custom tailwind-like animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { 0% { transform: scale(0.9); opacity: 0; } 50% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;
  document.head.appendChild(style);
}
