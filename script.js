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
const createRoomSection = document.getElementById('create-room-section');
const createRoomBtn = document.getElementById('create-room-btn');

let players = [];
let currentPlayer = '';
let gameStarted = false;

// 🔐 Salle à partir de l'URL
function getRoomKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('salle');
}

const roomKey = getRoomKey();
if (roomKey) {
  roomNameDisplay.textContent = `Salle : ${roomKey}`;
  createRoomSection.style.display = 'none';
  joinSection.style.display = 'block';
} else {
  roomNameDisplay.textContent = `Aucune salle sélectionnée`;
  joinSection.style.display = 'none';
}

// 📦 Stockage local par salle
function saveRoomData(key, value) {
  localStorage.setItem(`${roomKey}_${key}`, JSON.stringify(value));
}

function getRoomData(key) {
  const val = localStorage.getItem(`${roomKey}_${key}`);
  return val ? JSON.parse(val) : null;
}

function removeRoomData(key) {
  localStorage.removeItem(`${roomKey}_${key}`);
}

// 🎲 Générateur de nom de salle
function generateRandomRoomName() {
  const random = Math.random().toString(36).substring(2, 7);
  return `rocket-${random}`;
}

createRoomBtn.addEventListener('click', () => {
  const newRoom = generateRandomRoomName();
  window.location.href = `?salle=${newRoom}`;
});

// 🎯 Défis imposteur
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

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username && !players.includes(username)) {
    currentPlayer = username;
    players.push(username);
    saveRoomData('players', players);
    joinSection.style.display = 'none';
    lobbySection.style.display = 'block';
    updatePlayerList();
  }
});

startBtn.addEventListener('click', () => {
  if (players.length >= 4 && players.length <= 6) {
    assignRoles();
    showRole();
  } else {
    alert("Le nombre de joueurs doit être entre 4 et 6 !");
  }
});

function updatePlayerList() {
  playerList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player;
    playerList.appendChild(li);
  });

  if (players.length >= 4 && players.length <= 6 && currentPlayer === players[0]) {
    startBtn.style.display = 'inline-block';
  }
}

function assignRoles() {
  const impostorIndex = Math.floor(Math.random() * players.length);
  const impostorName = players[impostorIndex];
  const challenges = getRandomChallenges(3);

  saveRoomData('impostor', impostorName);
  saveRoomData('impostorChallenges', challenges);
  saveRoomData('gameStarted', true);
  gameStarted = true;
}

function showRole() {
  lobbySection.style.display = 'none';
  roleSection.style.display = 'block';

  const impostor = getRoomData('impostor');

  if (currentPlayer === impostor) {
    const challenges = getRoomData('impostorChallenges');
    let challengeText = "🚨 Tu es l’IMPOSTEUR du match !\n\n🎯 Tes défis :\n";
    challenges.forEach(c => {
      challengeText += `• ${c}\n`;
    });

    roleDisplay.textContent = challengeText;
    roleDisplay.classList.add('impostor');
  } else {
    roleDisplay.textContent = "🟢 Tu es un coéquipier loyal.\nGagne la partie et repère l’imposteur.";
    roleDisplay.classList.add('citizen');
  }

  showReplayOption();
}

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

function resetGame() {
  removeRoomData('impostor');
  removeRoomData('impostorChallenges');
  removeRoomData('gameStarted');

  roleSection.style.display = 'none';
  replaySection.style.display = 'none';
  joinSection.style.display = 'block';
  usernameInput.value = '';
}

replayBtn.addEventListener('click', resetGame);

// 🔁 Restauration
if (roomKey) {
  const existingPlayers = getRoomData('players');
  if (existingPlayers) {
    players = existingPlayers;
  }
}
