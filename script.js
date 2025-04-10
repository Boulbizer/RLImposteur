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
const scoreBoard = document.getElementById('score-board');
const scoreSection = document.getElementById('score-section');

let currentPlayer = '';
let roomKey = null;
let players = [];
let currentUid = '';

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

copyBtn.addEventListener('click', () => {
  const url = `${window.location.origin}?salle=${roomKey}`;
  navigator.clipboard.writeText(url).then(() => {
    copyFeedback.textContent = "Lien copié ! 🎉";
    setTimeout(() => (copyFeedback.textContent = ""), 2000);
  });
});

createRoomBtn.addEventListener('click', () => {
  const randomRoom = `rocket-${Math.random().toString(36).substring(2, 7)}`;
  window.location.href = `?salle=${randomRoom}`;
});

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

joinBtn.addEventListener('click', async () => {
  const name = usernameInput.value.trim();
  if (!name) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  currentPlayer = name;
  currentUid = user.uid;

  const ref = firebase.database().ref(`rooms/${roomKey}/players/${currentUid}`);
  await ref.set({ name });

  localStorage.setItem('rl_pseudo', name);
  localStorage.setItem('rl_room', roomKey);

  joinSection.style.display = 'none';
  lobbySection.style.display = 'block';
  listenToPlayers();
});

startBtn.addEventListener('click', () => {
  if (players.length < 4) return;

  const impostor = players[Math.floor(Math.random() * players.length)];
  const challenges = getRandomChallenges(3);

  firebase.database().ref(`rooms/${roomKey}/game`).set({
    impostor,
    challenges,
    started: true
  });

  firebase.database().ref(`rooms/${roomKey}/votes`).remove();
});

function showRole(impostor, challenges) {
  lobbySection.style.display = 'none';
  roleSection.style.display = 'block';

  const badge = document.createElement('div');
  badge.id = 'role-badge';

  if (currentPlayer === impostor) {
    badge.classList.add('impostor');
    badge.textContent = '🚨 IMPOSTEUR';

    roleDisplay.innerHTML = '';
    roleDisplay.appendChild(badge);
    roleDisplay.innerHTML += `<div style="margin-top:10px; text-align:left;">
      <strong>🎯 Tes défis :</strong><br>${challenges.map(c => `• ${c}`).join('<br>')}
    </div>`;
  } else {
    badge.classList.add('citizen');
    badge.textContent = '🟢 COÉQUIPIER';

    roleDisplay.innerHTML = '';
    roleDisplay.appendChild(badge);
    roleDisplay.innerHTML += `<p>Gagne la partie et démasque l’imposteur.</p>`;
  }

  roleDisplay.classList.remove('show', 'animate');
  void roleDisplay.offsetWidth;
  roleDisplay.classList.add('show', 'animate');

  setTimeout(() => {
    startVoting(impostor);
  }, 3000);
}

function startVoting(impostor) {
  const voteSection = document.getElementById('vote-section');
  const voteList = document.getElementById('vote-list');
  const voteStatus = document.getElementById('vote-status');
  const voteResult = document.getElementById('vote-result');

  voteSection.style.display = 'block';
  voteList.innerHTML = '';
  voteStatus.textContent = 'Clique sur un joueur pour voter.';

  players.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('click', async () => {
      if (li.classList.contains('voted')) return;
      li.classList.add('voted');
      voteStatus.textContent = "✅ Vote enregistré. En attente des autres joueurs...";
      const user = firebase.auth().currentUser;
      if (!user) return;
      await firebase.database().ref(`rooms/${roomKey}/votes/${user.uid}`).set(name);
    });
    voteList.appendChild(li);
  });

  const ref = firebase.database().ref(`rooms/${roomKey}/votes`);
  ref.on('value', async snapshot => {
    const votes = snapshot.val() || {};
    const totalVotes = Object.keys(votes).length;
    voteStatus.textContent = `🗳️ ${totalVotes}/${players.length} votes enregistrés`;

    if (totalVotes >= players.length) {
      ref.off();

      const tally = {};
      Object.values(votes).forEach(name => {
        tally[name] = (tally[name] || 0) + 1;
      });

      let mostVoted = '';
      let maxVotes = 0;
      for (let name in tally) {
        if (tally[name] > maxVotes) {
          mostVoted = name;
          maxVotes = tally[name];
        }
      }

      const gameSnap = await firebase.database().ref(`rooms/${roomKey}/game`).get();
      const realImpostor = gameSnap.val().impostor;

      // Attribution des points
      const scoresRef = firebase.database().ref(`rooms/${roomKey}/scores`);
      const scoreSnap = await scoresRef.get();
      const currentScores = scoreSnap.val() || {};

      for (let uid in votes) {
        const voteName = votes[uid];
        const isCorrect = voteName === realImpostor;
        const prevScore = currentScores[uid]?.points || 0;
        const name = currentScores[uid]?.name || players.find(p => p !== undefined);

        await scoresRef.child(uid).set({
          name: name,
          points: prevScore + (isCorrect ? 1 : 0)
        });
      }

      // Impostor bonus
      const impostorUid = Object.entries(currentScores).find(([uid, val]) => val.name === realImpostor)?.[0];
      if (impostorUid && !Object.values(votes).includes(realImpostor)) {
        const prev = currentScores[impostorUid]?.points || 0;
        await scoresRef.child(impostorUid).update({
          points: prev + 3
        });
      }

      voteResult.innerHTML = `
        <p><strong>🕵️ L’imposteur désigné :</strong> ${mostVoted} (${maxVotes} votes)</p>
        <p><strong>🎯 Le vrai imposteur était :</strong> ${realImpostor}</p>
      `;

      updateScoreboard();
      showReplayOption();
    }
  });
}

function updateScoreboard() {
  const ref = firebase.database().ref(`rooms/${roomKey}/scores`);
  ref.once('value').then(snapshot => {
    const data = snapshot.val() || {};
    const scores = Object.values(data).sort((a, b) => b.points - a.points);
    scoreBoard.innerHTML = '';
    scores.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name}: ${s.points} pts`;
      scoreBoard.appendChild(li);
    });
    scoreSection.style.display = 'block';
  });
}

function listenToGame() {
  const ref = firebase.database().ref(`rooms/${roomKey}/game`);
  ref.on('value', snapshot => {
    const game = snapshot.val();
    if (game?.started) {
      showRole(game.impostor, game.challenges);
    }
  });
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

replayBtn.addEventListener('click', () => {
  firebase.database().ref(`rooms/${roomKey}/game`).remove();
  firebase.database().ref(`rooms/${roomKey}/votes`).remove();
  roleSection.style.display = 'none';
  voteSection.style.display = 'none';
  scoreSection.style.display = 'none';
  replaySection.style.display = 'none';
  joinSection.style.display = 'block';
  usernameInput.value = '';
  localStorage.removeItem('rl_pseudo');
  localStorage.removeItem('rl_room');
});

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
