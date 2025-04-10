const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const playerList = document.getElementById('player-list');
const lobbySection = document.getElementById('lobby-section');
const joinSection = document.getElementById('join-section');
const roleSection = document.getElementById('role-section');
const roleDisplay = document.getElementById('role-display');
const startBtn = document.getElementById('start-btn');
const replayBtn = document.getElementById('replay-btn');
const replaySection = document.getElementById('replay-section');
const replayInfo = document.getElementById('replay-info');
const roomNameDisplay = document.getElementById('room-name');
const createRoomBtn = document.getElementById('create-room-btn');
const copyBtn = document.getElementById('copy-room-btn');
const copyFeedback = document.getElementById('copy-feedback');

let currentPlayer = '';
let roomKey = null;
let players = [];
let currentUid = '';

// 🔐 Obtenir la salle depuis l’URL
function getRoomKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('salle');
}

roomKey = getRoomKey();

if (!roomKey) {
  joinSection.style.display = 'none';
  document.getElementById('create-room-section').style.display = 'block';
} else {
  roomNameDisplay.textContent = `Salle : ${roomKey}`;
  joinSection.style.display = 'block';
  document.getElementById('create-room-section').style.display = 'none';
  document.getElementById('copy-room-section').style.display = 'block';
}

// 📋 Copier le lien
copyBtn.addEventListener('click', () => {
  const url = `${window.location.origin}?salle=${roomKey}`;
  navigator.clipboard.writeText(url).then(() => {
    copyFeedback.textContent = "Lien copié ! 🎉";
    setTimeout(() => (copyFeedback.textContent = ""), 2000);
  });
});

// 🎲 Générer une salle
createRoomBtn.addEventListener('click', () => {
  const randomRoom = `rocket-${Math.random().toString(36).substring(2, 7)}`;
  window.location.href = `?salle=${randomRoom}`;
});

// 🔁 Lecture en temps réel des joueurs
function updatePlayerListUI(players) {
  playerList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    playerList.appendChild(li);
  });

  const isLeader = players[0] === currentPlayer;
  startBtn.style.display = isLeader && players.length >= 4 ? 'inline-block' : 'none';
}

function listenToPlayers() {
  const ref = firebase.database().ref(`rooms/${roomKey}/players`);
  ref.on('value', snapshot => {
    const data = snapshot.val() || {};
    players = Object.values(data).map(p => p.name);
    updatePlayerListUI(players);
  });
}

// 🎯 Défis de l’imposteur
const impostorChallenges = [
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

function getRandomChallenges(count = 3) {
  const shuffled = impostorChallenges.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 🔘 Rejoindre la salle
joinBtn.addEventListener('click', async () => {
  const name = usernameInput.value.trim();
  if (!name) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  currentPlayer = name;
  currentUid = user.uid;

  const ref = firebase.database().ref(`rooms/${roomKey}/players/${currentUid}`);
  await ref.set({ name });

  // ✅ Sauvegarde locale pour reconnexion automatique
  localStorage.setItem('rl_pseudo', name);
  localStorage.setItem('rl_room', roomKey);

  joinSection.style.display = 'none';
  lobbySection.style.display = 'block';
  listenToPlayers();
});

// 🎬 Lancer la partie
startBtn.addEventListener('click', () => {
  if (players.length < 4) return;

  const impostor = players[Math.floor(Math.random() * players.length)];
  const challenges = getRandomChallenges(3);

  firebase.database().ref(`rooms/${roomKey}/game`).set({
    impostor,
    challenges,
    started: true
  });
});

// 🎯 Afficher le rôle du joueur
function showRole(impostor, challenges) {
  lobbySection.style.display = 'none';
  roleSection.style.display = 'block';

  if (currentPlayer === impostor) {
    roleDisplay.classList.add('impostor');
    roleDisplay.textContent = `🚨 Tu es l’IMPOSTEUR du match !\n\n🎯 Tes défis :\n${challenges.map(c => `• ${c}`).join('\n')}`;
  } else {
    roleDisplay.classList.add('citizen');
    roleDisplay.textContent = "🟢 Tu es un coéquipier loyal.\nGagne la partie et repère l’imposteur.";
  }

  showReplayOption();
}

// 🔁 Écoute des infos de partie
function listenToGame() {
  const ref = firebase.database().ref(`rooms/${roomKey}/game`);
  ref.on('value', snapshot => {
    const game = snapshot.val();
    if (game?.started) {
      showRole(game.impostor, game.challenges);
    }
  });
}

// 🔁 Bouton rejouer
function showReplayOption() {
  const isLeader = players[0] === currentPlayer;
  replaySection.style.display = 'block';

  if (isLeader) {
    replayBtn.style.display = 'inline-block';
    replayInfo.textContent = "Tu es l'organisateur. Tu peux relancer une partie.";
  } else {
    replayBtn.style.display = 'none';
    replayInfo.textContent = "En attente que l'organisateur relance la partie.";
  }
}

replayBtn.addEventListener('click', () => {
  firebase.database().ref(`rooms/${roomKey}/game`).remove();
  roleSection.style.display = 'none';
  replaySection.style.display = 'none';
  joinSection.style.display = 'block';
  usernameInput.value = '';
  localStorage.removeItem('rl_pseudo');
  localStorage.removeItem('rl_room');
});

// 🟢 Démarrage + reconnexion automatique
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUid = user.uid;
    if (roomKey) {
      const savedName = localStorage.getItem('rl_pseudo');
      const savedRoom = localStorage.getItem('rl_room');

      if (savedName && savedRoom === roomKey) {
        currentPlayer = savedName;
        const ref = firebase.database().ref(`rooms/${roomKey}/players/${user.uid}`);
        ref.set({ name: currentPlayer });
        joinSection.style.display = 'none';
        lobbySection.style.display = 'block';
      }

      listenToPlayers();
      listenToGame();
    }
  }
});
