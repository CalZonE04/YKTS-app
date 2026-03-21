/**
 * 1. GAME CODE GENERATOR
 * Generates a unique 5-character string for lobby joining.
 */
export const generateGameCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/**
 * 2. SCORE FORMATTER
 * Converts numbers into golf notation (e.g., 0 becomes 'E', 1 becomes '+1').
 */
export const formatRel = (val) => {
  if (val === 0) return 'E';
  return val > 0 ? `+${val}` : val;
};

/**
 * 3. MODE DESCRIPTIONS
 * Used by the "What is this?" toggle on the Setup Screen.
 */
export const modeDescriptions = {
  'Scramble': 'Team play. Everyone hits every shot, you pick the best one, and everyone plays from there. Record one score per team.',
  'Best Ball': 'Teammates play their own balls. The lowest score on each hole counts as the team score.',
  'Alternate': 'Teammates take turns hitting the same ball (Player A tees off, B hits the 2nd) until it is holed.',
  'Snake': 'Track 3-putts! The last person to 3-putt on a hole is the "Snake" and usually buys the group a round.',
  'Stableford': 'Points vs Par. Par = 2pts, Birdie = 3pts. Bad holes give 0 points but won’t ruin your total.',
  'Stroke Play': 'Traditional golf. Every shot counts toward your total. Lowest score wins.',
  'Match Play': 'Hole-by-hole rivalry. Win the hole, win a point. Best for 1v1 or 2v2 duels.'
};

/**
 * 4. HOLE POINT CALCULATOR
 * Converts a stroke score into Stableford points.
 */
export const getHolePoints = (score, par, mode = 'Stableford') => {
  if (!score || score === 0 || mode !== 'Stableford') return 0;
  // Standard Stableford: Double Bogey (or worse) = 0, Bogey = 1, Par = 2, Birdie = 3, Eagle = 4
  return Math.max(0, par + 2 - score);
};

/**
 * 5. PLAYER STATS ENGINE (Smart Scoring)
 * Only calculates relative score based on holes that actually have a score > 0.
 */
export const getPlayerStats = (player, pars, mode = 'Stroke Play') => {
  let totalStrokes = 0;
  let parOfPlayedHoles = 0;
  let points = 0;

  player.scores.forEach((score, i) => {
    if (score > 0) {
      totalStrokes += score;
      parOfPlayedHoles += pars[i];
      points += getHolePoints(score, pars[i], mode);
    }
  });

  return { 
    strokes: totalStrokes, 
    relative: totalStrokes - parOfPlayedHoles, 
    points: points 
  };
};

/**
 * 6. MATCH PLAY ENGINE
 * Compares two players hole-by-hole to determine who is "Up".
 */
export const calculateMatchStatus = (players) => {
  if (!players || players.length < 2) return "Waiting for players...";
  
  const p1 = players[0];
  const p2 = players[1];
  let p1Wins = 0;
  let p2Wins = 0;

  // We only compare holes where BOTH players have entered a score
  p1.scores.forEach((s1, i) => {
    const s2 = p2.scores[i];
    if (s1 > 0 && s2 > 0) {
      if (s1 < s2) p1Wins++;
      else if (s2 < s1) p2Wins++;
    }
  });

  const diff = Math.abs(p1Wins - p2Wins);
  const leaderName = p1Wins > p2Wins ? p1.name : p2.name;

  if (diff === 0) return "All Square";
  return `${leaderName} ${diff} UP`;
};