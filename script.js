/* ========= VARIABLES & SÉLECTION DES ÉLÉMENTS ========= */
const joinBtn               = document.getElementById('join-btn');
const usernameInput         = document.getElementById('username');
const playerList            = document.getElementById('player-list');
const lobbySection          = document.getElementById('lobby-section');
const joinSection           = document.getElementById('join-section');
const roleSection           = document.getElementById('role-section');
const roleDisplay           = document.getElementById('role-display');
const startBtn              = document.getElementById('start-btn');
const replayBtn             = document.getElementById('replay-btn');
const replaySection         = document.getElementById('replay-section');
const replayInfo            = document.getElementById('replay-info');
const roomNameDisplay       = document.getElementById('room-name');
const createRoomBtn         = document.getElementById('create-room-btn');
const copyBtn               = document.getElementById('copy-room-btn');
const copyFeedback          = document.getElementById('copy-feedback');
const scoreBoard            = document.getElementById('score-board');
const scoreSection          = document.getElementById('score-section');
const voteSection           = document.getElementById('vote-section');
const pseudoError           = document.getElementById('pseudo-error');
const voteStatus            = document.getElementById('vote-status');
const voteResult            = document.getElementById('vote-result');
const voteList              = document.getElementById('vote-list');
const impostorResultSection = document.getElementById('impostor-result-section');
const impostorResultText    = document.getElementById('impostor-result-text');
const impostorFeedback      = document.getElementById('impostor-feedback');
const impostorLostBtn       = document.getElementById('impostor-lost-btn');
const impostorWonBtn        = document.getElementById('impostor-won-btn');

let currentPlayer = '';
let roomKey       = getRoomKey();
let players       = [];
let currentUid    = '';

/* ========= CONSTANTES ========= */
const MIN_PLAYERS_TO_START = 3;
const IMPOSTOR_CHALLENGES = [
  "Tente de rater une balle facile sans te faire remarquer",
  "Fais une retournée inutile en pleine action",
  "Démarre en arrière pendant l'engagement",
  "Fais semblant d'aller défendre, puis abandonne",
  "Fais une passe à l’équipe adverse discrètement",
  "Bouscule un coéquipier pendant qu’il va tirer",
  "Boost inutilement jusqu’au plafond au moins une fois",
  "Tourne en rond dans ton camp pendant 10 secondes",
  "Ne touche pas la balle pendant 1 minute",
  "Fais un tir complètement à côté exprès"
];

/* ========= FONCTIONS UTILITAIRES ========= */
// Récupère la room key depuis les paramètres d'URL (plusieurs clés supportées)
function getRoomKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('salle') || params.get('room') || params.get('roomId');
}

// Récupère X défis aléatoires
const getRandomChallenges = (count = 3) =>
  [...IMPOSTOR_CHALLENGES].sort(() => 0.5 - Math.random()).slice(0, count);

// Affiche un message de feedback temporaire
const showFeedback = (element, message, duration = 2000) => {
  if (!element) return;
  element.textContent = message;
  setTimeout(() => { element.textContent = ""; }, duration);
};

// Vérifie si l'utilisateur courant est le leader
async function isLeader() {
  if (!currentUid || !roomKey) return false;
  const snap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  return snap.val() === currentUid;
}

/* ========= RÉFÉRENCES FIREBASE ========= */
const playersRef = roomKey && firebase.database().ref(`rooms/${roomKey}/players`);
const gameRef    = roomKey && firebase.database().ref(`rooms/${roomKey}/game`);
const votesRef   = roomKey && firebase.database().ref(`rooms/${roomKey}/votes`);
const scoresRef  = roomKey && firebase.database().ref(`rooms/${roomKey}/scores`);

/* ========= INITIALISATION DE L'INTERFACE ========= */
if (!roomKey) {
  joinSection.style.display               = 'none';
  document.getElementById('create-room-section').style.display = 'block';
} else {
  roomNameDisplay.textContent = `Salle : ${roomKey}`;
  if (localStorage.getItem('rl_pseudo') === localStorage.getItem('rl_room') &&
      localStorage.getItem('rl_room') === roomKey) {
    joinSection.style.display = 'none';
  } else {
    joinSection.style.display = 'block';
  }
  document.getElementById('create-room-section').style.display = 'none';
  document.getElementById('copy-room-section').style.display   = 'block';
}

/* ========= GESTION DU LIEN DE LA SALLE ========= */
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const url = `${window.location.origin}?salle=${roomKey}`;
    navigator.clipboard.writeText(url)
      .then(() => showFeedback(copyFeedback, "Lien copié ! 🎉"));
  });
}

/* ========= GESTION DE LA CRÉATION DE SALLE ========= */
if (createRoomBtn) {
  createRoomBtn.addEventListener('click', async () => {
    const randomRoom = `rocket-${Math.random().toString(36).substring(2, 7)}`;
    const user       = firebase.auth().currentUser;
    if (user) {
      await firebase.database().ref(`rooms/${randomRoom}/hostUid`).set(user.uid);
    }
    window.location.href = `?salle=${randomRoom}`;
  });
}

/* ========= ÉCOUTE EN TEMPS RÉEL DES JOUEURS ========= */
function listenToPlayers() {
  if (!playersRef) return;
  playersRef.off();
  playersRef.on('value', snapshot => {
    const data    = snapshot.val() || {};
    players       = Object.values(data).map(p => p.name);
    updatePlayerListUI(players);
  });
}

/* ========= MISE À JOUR DE LA LISTE DES JOUEURS ========= */
async function updatePlayerListUI(players) {
  if (!playerList) return;
  playerList.innerHTML = '';
  players.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    playerList.appendChild(li);
  });
  const hostSnap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  const hostUid  = hostSnap.val();
  startBtn.style.display = (currentUid === hostUid && players.length >= MIN_PLAYERS_TO_START)
    ? 'inline-block'
    : 'none';
}

/* ========= INSCRIPTION DES JOUEURS ========= */
if (joinBtn) {
  joinBtn.addEventListener('click', async () => {
    const name = usernameInput.value.trim();
    pseudoError.textContent = '';
    if (!name) return;
    const snapshot = await playersRef.once('value');
    const existing = snapshot.val() || {};
    if (Object.values(existing).some(p => p.name === name)) {
      pseudoError.textContent = "Ce pseudo est déjà utilisé dans cette salle 🚫";
      return;
    }
    const user = firebase.auth().currentUser;
    if (!user) return;
    currentPlayer = name;
    currentUid    = user.uid;
    await playersRef.child(currentUid).set({ name });
    playersRef.child(currentUid).onDisconnect().remove();
    votesRef.child(currentUid).onDisconnect().remove();
    localStorage.setItem('rl_pseudo', name);
    localStorage.setItem('rl_room', roomKey);
    usernameInput.value = '';
    joinSection.style.display  = 'none';
    lobbySection.style.display = 'block';
    listenToPlayers();
  });
}

/* ========= DÉMARRAGE DE LA PARTIE ========= */
if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (players.length < MIN_PLAYERS_TO_START) return;
    const impostor  = players[Math.floor(Math.random() * players.length)];
    const challenges = getRandomChallenges();
    gameRef.set({ impostor, challenges, started: true, scoresProcessed: false });
    votesRef.remove();
  });
}

/* ========= AFFICHAGE DU RÔLE ========= */
function showRole(impostor, challenges) {
  joinSection.style.display = 'none';
  lobbySection.style.display = 'none';
  const pseudoLabel = document.getElementById('pseudo-label');
  if (pseudoLabel) pseudoLabel.style.display = 'none';
  roleSection.style.display = 'block';
  roleDisplay.innerHTML  = '';

  const badge = document.createElement('div');
  badge.id = 'role-badge';

  if (currentPlayer === impostor) {
    badge.classList.add('impostor');
    badge.textContent = '🚨 IMPOSTEUR';
    roleDisplay.appendChild(badge);
    roleDisplay.innerHTML += `<div style="margin-top:10px; text-align:left;">
      <strong>🎯 Tes défis :</strong><br>${challenges.map(c => `• ${c}`).join('<br>')}
    </div>`;
  } else {
    badge.classList.add('citizen');
    badge.textContent = '🟢 COÉQUIPIER';
    roleDisplay.appendChild(badge);
    roleDisplay.innerHTML += '<p>Gagne la partie et démasque l’imposteur.</p>';
  }
  // Animation
  roleDisplay.classList.remove('show', 'animate');
  void roleDisplay.offsetWidth;
  roleDisplay.classList.add('show', 'animate');

  setTimeout(() => startVoting(impostor), 3000);
}

/* ========= PHASE DE VOTE & ÉCRAN IMPOSTEUR ========= */
function startVoting(realImpostor) {
  if (currentPlayer === realImpostor && impostorResultSection) {
    voteSection.style.display = 'none';
    impostorFeedback.textContent   = '';
    impostorResultText.textContent = 'Sois honnête... 😈';
    impostorLostBtn.disabled = false;
    impostorWonBtn.disabled  = false;
    impostorResultSection.style.display = 'block';
    listenForVoteEnd(realImpostor);
    return;
  }

  voteSection.style.display = 'block';
  voteList.innerHTML = '';
  voteStatus.textContent = 'Clique sur un joueur pour voter.';
  let hasVoted = false;
  voteSection.style.pointerEvents = 'auto';

  players.forEach(name => {
    if (name === currentPlayer) return;
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('click', () => {
      if (hasVoted) return;
      hasVoted = true;
      li.classList.add('selected');
      voteSection.style.pointerEvents = 'none';
      voteStatus.textContent = '✅ Vote enregistré. En attente...';
      votesRef.child(currentUid).set(name);
    });
    voteList.appendChild(li);
  });
  listenForVoteEnd(realImpostor);
}

async function listenForVoteEnd(realImpostor) {
  votesRef.off();
  votesRef.on('value', async snap => {
    const votes = snap.val() || {};
    const playersSnap = await playersRef.once('value');
    const playerCount = playersSnap.numChildren();
    if (Object.keys(votes).length < playerCount) return;
    votesRef.off();

    // ➡️ Calcul majoritaire (exclut 'abstain')
    const validVotes = Object.values(votes).filter(n => n !== 'abstain');
    const tally = {};
    validVotes.forEach(n => tally[n] = (tally[n]||0) + 1);
    let most = '', max = 0;
    Object.entries(tally).forEach(([n,c]) => {
      if (c > max) { most = n; max = c; }
    });

    const gameSnap = await gameRef.once('value');
    const real       = gameSnap.val().impostor;
    const hostSnap   = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
    const host       = hostSnap.val();
    if (host === currentUid) await updateScores(votes, real);

    voteResult.innerHTML = `
      <p><strong>🕵️ Désigné :</strong> ${most} (${max} votes)</p>
      <p><strong>🎯 Réel :</strong> ${real}</p>
    `;

    if (impostorResultSection) impostorResultSection.style.display = 'none';
    updateScoreboard();
    showReplayOption();
    voteSection.style.display = 'block';
  });
}

/* ========= GESTION RÉSULTAT ROCKET LEAGUE ========= */
if (impostorLostBtn) {
  impostorLostBtn.addEventListener('click', async () => {
    await gameRef.update({ rlImpostorWon: false });
    await votesRef.child(currentUid).set('abstain');
    impostorResultSection.style.display = 'none';
    impostorLostBtn.disabled = true;
    impostorWonBtn.disabled  = true;
    impostorLostBtn.classList.add('confirmed');
  });
}
if (impostorWonBtn) {
  impostorWonBtn.addEventListener('click', async () => {
    await gameRef.update({ rlImpostorWon: true });
    await votesRef.child(currentUid).set('abstain');

    const scoreRef = scoresRef.child(currentUid);
    await scoreRef.transaction(cur => {
      if (cur) cur.points = Math.max(0, cur.points - 1);
      else return { name: currentPlayer, points: 0 };
      return cur;
    });

    impostorFeedback.textContent = "😈 Malus appliqué : -1 point";
    impostorWonBtn.disabled      = true;
    impostorLostBtn.disabled     = true;
    impostorWonBtn.classList.add('confirmed');

    updateScoreboard();
  });
}

/* ========= MISE À JOUR DES SCORES ========= */
async function updateScores(votes, realImpostor) {
  const gameSnap   = await gameRef.once('value');
  const gameData   = gameSnap.val() || {};
  if (gameData.scoresProcessed) return;

  const rlWon = gameData.rlImpostorWon === true;
  const playersSnap = await playersRef.once('value');
  const playersMap  = playersSnap.val() || {};

  await scoresRef.transaction(currentScores => {
    currentScores = currentScores || {};

    // 1) votes corrects
    Object.entries(votes).forEach(([uid, voteName]) => {
      if (!currentScores[uid]) currentScores[uid] = { name: playersMap[uid]?.name || 'Inconnu', points: 0 };
      if (voteName === realImpostor) currentScores[uid].points++;
    });

    // 2) imposteur bonus/malus (exclut 'abstain')
    const impostorUid = Object.keys(playersMap)
      .find(u => playersMap[u].name === realImpostor);
    if (impostorUid) {
      if (!currentScores[impostorUid]) currentScores[impostorUid] = { name: realImpostor, points: 0 };
      if (rlWon) {
        currentScores[impostorUid].points = Math.max(0, currentScores[impostorUid].points - 1);
      } else {
        let bonus = 0;
        Object.entries(votes).forEach(([voterUid, votedName]) => {
          if (votedName !== realImpostor && votedName !== 'abstain' && voterUid !== impostorUid) bonus++;
        });
        currentScores[impostorUid].points += bonus;
      }
    }

    return currentScores;
  });

  await gameRef.update({ scoresProcessed: true });
}

/* ========= MISE À JOUR DU TABLEAU DES SCORES ========= */
async function updateScoreboard() {
  const scoresSnap  = await scoresRef.once('value');
  const scoresData  = scoresSnap.val() || {};
  if (Object.keys(scoresData).length === 0) {
    scoreSection.style.display = 'none';
    return;
  }
  const playersSnap = await playersRef.once('value');
  const playersMap  = playersSnap.val() || {};

  const scoreArray = Object.entries(playersMap).map(([uid, data]) => ({
    name:   data.name,
    points: (scoresData[uid]?.points) || 0
  })).sort((a, b) => b.points - a.points);

  scoreBoard.innerHTML = '';
  scoreArray.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.name}: ${s.points} pts`;
    scoreBoard.appendChild(li);
  });
  scoreSection.style.display = 'block';
}

/* ========= ÉCOUTE EN TEMPS RÉEL DES SCORES ========= */
scoresRef.off();
scoresRef.on('value', () => updateScoreboard());

/* ========= ÉCOUTE DES MODIFICATIONS DE L'ÉTAT DU JEU ========= */
function listenToGame() {
  if (!gameRef) return;
  gameRef.off();
  gameRef.on('value', snapshot => {
    const game = snapshot.val();
    if (game?.started) {
      showRole(game.impostor, game.challenges);
    } else {
      roleSection.style.display   = 'none';
      voteSection.style.display   = 'none';
      replaySection.style.display = 'none';
      roleDisplay.innerHTML       = '';
      roleDisplay.className       = roleDisplay.className.replace(/impostor|citizen|show|animate/g, '');
      voteResult.innerHTML        = '';
      lobbySection.style.display  = 'block';
    }
  });
}

/* ========= OPTION REJOUER ========= */
if (replayBtn) {
  replayBtn.addEventListener('click', async () => {
    // Detach all listeners
    playersRef.off(); gameRef.off(); votesRef.off(); scoresRef.off();
    // Reset in-memory
    players       = [];
    scoreBoard.innerHTML = '';
    // Remove DB nodes
    await gameRef.remove();
    await votesRef.remove();
    // UI reset
    roleSection.style.display = 'none';
    voteSection.style.display = 'none';
    voteResult.innerHTML      = '';
    joinSection.style.display = 'none';
    lobbySection.style.display= 'block';
    // Refresh scoreboard if scores persist
    const snap = await scoresRef.once('value');
    if (snap.exists()) updateScoreboard();
    // Re-attach listeners
    listenToPlayers();
    listenToGame();
  });
}

/* ========= INITIALISATION DE LA SESSION ========= */
firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  currentUid = user.uid;
  if (!roomKey) return;

  const savedName = localStorage.getItem('rl_pseudo');
  const savedRoom = localStorage.getItem('rl_room');
  if (savedName && savedRoom === roomKey) {
    currentPlayer = savedName;
    firebase.database().ref(`rooms/${roomKey}/players/${user.uid}`).set({ name: currentPlayer });
    joinSection.style.display  = 'none';
    lobbySection.style.display = 'block';
  } else {
    playersRef.child(user.uid).once('value').then(snap => {
      if (snap.exists()) {
        currentPlayer = snap.val().name;
        const pseudoLabel = document.getElementById('pseudo-label');
        if (pseudoLabel) pseudoLabel.textContent = `👤 ${currentPlayer}`;
        joinSection.style.display  = 'none';
        lobbySection.style.display = 'block';
      }
    });
  }
  listenToPlayers();
  listenToGame();
});
