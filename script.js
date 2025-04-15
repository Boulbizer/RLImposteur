/* ========= VARIABLES & SELECTION DES ÉLÉMENTS ========= */
const joinBtn         = document.getElementById('join-btn');
const usernameInput   = document.getElementById('username');
const playerList      = document.getElementById('player-list');
const lobbySection    = document.getElementById('lobby-section');
const joinSection     = document.getElementById('join-section');
const roleSection     = document.getElementById('role-section');
const roleDisplay     = document.getElementById('role-display');
const startBtn        = document.getElementById('start-btn');
const replayBtn       = document.getElementById('replay-btn');
const replaySection   = document.getElementById('replay-section');
const replayInfo      = document.getElementById('replay-info');
const roomNameDisplay = document.getElementById('room-name');
const createRoomBtn   = document.getElementById('create-room-btn');
const copyBtn         = document.getElementById('copy-room-btn');
const copyFeedback    = document.getElementById('copy-feedback');
const scoreBoard      = document.getElementById('score-board');
const scoreSection    = document.getElementById('score-section');
const voteSection     = document.getElementById('vote-section');
const pseudoError     = document.getElementById('pseudo-error');
const voteStatus      = document.getElementById('vote-status');
const voteResult      = document.getElementById('vote-result');

let currentPlayer = '';
let roomKey = getRoomKey();
let players = [];
let currentUid = '';

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
// Récupère la room key depuis les paramètres d'URL
function getRoomKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('salle');
}

// Sélectionne aléatoirement X défis pour l'imposteur
const getRandomChallenges = (count = 3) =>
  [...IMPOSTOR_CHALLENGES].sort(() => 0.5 - Math.random()).slice(0, count);

// Affiche un message de feedback temporaire
const showFeedback = (element, message, duration = 2000) => {
  element.textContent = message;
  setTimeout(() => { element.textContent = ""; }, duration);
};

// Vérifie si l'utilisateur courant est le leader en comparant son uid avec celui stocké dans Firebase
const isLeader = async () => {
  const snap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  return snap.val() === currentUid;
};

/* ========= INITIALISATION DE L'INTERFACE ========= */
if (!roomKey) {
  // Afficher la section de création de salle
  joinSection.style.display = 'none';
  document.getElementById('create-room-section').style.display = 'block';
} else {
  // Afficher les éléments liés à la salle existante
  roomNameDisplay.textContent = `Salle : ${roomKey}`;
  joinSection.style.display = 'block';
  document.getElementById('create-room-section').style.display = 'none';
  document.getElementById('copy-room-section').style.display = 'block';
}

/* ========= GESTION DU LIEN DE LA SALLE ========= */
copyBtn.addEventListener('click', () => {
  const url = `${window.location.origin}?salle=${roomKey}`;
  navigator.clipboard.writeText(url)
    .then(() => showFeedback(copyFeedback, "Lien copié ! 🎉"));
});

/* ========= GESTION DE LA CRÉATION DE SALLE ========= */
createRoomBtn.addEventListener('click', async () => {
  const randomRoom = `rocket-${Math.random().toString(36).substring(2, 7)}`;
  const user = firebase.auth().currentUser;

  if (user) {
    await firebase.database().ref(`rooms/${randomRoom}/hostUid`).set(user.uid);
  }
  window.location.href = `?salle=${randomRoom}`;
});

/* ========= GESTION DES JOUEURS ========= */
// Met à jour l'affichage de la liste des joueurs dans le lobby et affiche le bouton de démarrage pour le leader.
const updatePlayerListUI = async (players) => {
  playerList.innerHTML = "";
  players.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    playerList.appendChild(li);
  });
  
  // Afficher le bouton "Lancer la partie" uniquement si l'utilisateur est le leader et le nombre de joueurs est suffisant.
  const leader = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  startBtn.style.display = (currentUid === leader.val() && players.length >= MIN_PLAYERS_TO_START)
    ? 'inline-block'
    : 'none';
};

// Écoute en temps réel les mises à jour des joueurs dans Firebase
const listenToPlayers = () => {
  firebase.database().ref(`rooms/${roomKey}/players`)
    .on('value', snapshot => {
      const data = snapshot.val() || {};
      players = Object.values(data).map(p => p.name);
      updatePlayerListUI(players);
    });
};

/* ========= INSCRIPTION DES JOUEURS ========= */
joinBtn.addEventListener('click', async () => {
  const name = usernameInput.value.trim();
  pseudoError.textContent = "";

  if (!name) return;

  // Vérification de l'unicité du pseudo
  const playersRef = firebase.database().ref(`rooms/${roomKey}/players`);
  const snapshot = await playersRef.once('value');
  const existingPlayers = snapshot.val() || {};
  if (Object.values(existingPlayers).some(p => p.name === name)) {
    pseudoError.textContent = "Ce pseudo est déjà utilisé dans cette salle 🚫";
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) return;

  currentPlayer = name;
  currentUid = user.uid;
  await playersRef.child(currentUid).set({ name });

  // Sauvegarde locale pour réutilisation
  localStorage.setItem('rl_pseudo', name);
  localStorage.setItem('rl_room', roomKey);

  usernameInput.value = "";
  joinSection.style.display = "none";
  lobbySection.style.display = "block";

  listenToPlayers();
});

/* ========= DÉMARRAGE DE LA PARTIE ========= */
startBtn.addEventListener('click', () => {
  if (players.length < MIN_PLAYERS_TO_START) return;

  // Sélection aléatoire d'un imposteur
  const impostor = players[Math.floor(Math.random() * players.length)];
  const challenges = getRandomChallenges();

  firebase.database().ref(`rooms/${roomKey}/game`).set({
    impostor,
    challenges,
    started: true
  });

  // Réinitialiser les votes pour le tour
  firebase.database().ref(`rooms/${roomKey}/votes`).remove();
});

/* ========= AFFICHAGE DU RÔLE ========= */
const showRole = (impostor, challenges) => {
  lobbySection.style.display = "none";
  roleSection.style.display = "block";

  const badge = document.createElement("div");
  badge.id = "role-badge";
  roleDisplay.innerHTML = "";

  if (currentPlayer === impostor) {
    badge.classList.add("impostor");
    badge.textContent = "🚨 IMPOSTEUR";
    roleDisplay.appendChild(badge);
    roleDisplay.innerHTML += `<div style="margin-top:10px; text-align:left;">
      <strong>🎯 Tes défis :</strong><br>${challenges.map(c => `• ${c}`).join('<br>')}
      </div>`;
  } else {
    badge.classList.add("citizen");
    badge.textContent = "🟢 COÉQUIPIER";
    roleDisplay.appendChild(badge);
    roleDisplay.innerHTML += `<p>Gagne la partie et démasque l’imposteur.</p>`;
  }

  // Animation d'apparition du rôle
  roleDisplay.classList.remove("show", "animate");
  void roleDisplay.offsetWidth;
  roleDisplay.classList.add("show", "animate");

  // Après 3 secondes, lancer la phase de vote
  setTimeout(() => startVoting(impostor), 3000);
};

/* ========= PHASE DE VOTE ========= */
const startVoting = (realImpostor) => {
  voteSection.style.display = "block";
  const voteList = document.getElementById("vote-list");
  voteList.innerHTML = "";
  voteStatus.textContent = "Clique sur un joueur pour voter.";
  
  let hasVoted = false; // Indique si le joueur a déjà voté

  // Créer la liste des joueurs (exclusion du votant lui-même)
  players.forEach(name => {
    if (name === currentPlayer) return;
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", async () => {
      if (hasVoted) return; // Empêche un second vote
      hasVoted = true;
      
      // Appliquer une classe pour indiquer le vote sélectionné
      li.classList.add("selected");
      // Désactiver visuellement les autres éléments
      Array.from(voteList.children).forEach(child => {
        if (child !== li) child.classList.add("disabled");
      });
      
      voteStatus.textContent = "✅ Vote enregistré. En attente des autres joueurs...";
      const user = firebase.auth().currentUser;
      if (!user) return;
      await firebase.database().ref(`rooms/${roomKey}/votes/${user.uid}`).set(name);
    });
    voteList.appendChild(li);
  });

  // Suivi des votes en temps réel
  const votesRef = firebase.database().ref(`rooms/${roomKey}/votes`);
  votesRef.on("value", async snapshot => {
    const votes = snapshot.val() || {};
    const totalVotes = Object.keys(votes).length;
    voteStatus.textContent = `🗳️ ${totalVotes}/${players.length} votes enregistrés`;

    if (totalVotes >= players.length) {
      votesRef.off();
      // Calcul du vote majoritaire
      const tally = {};
      Object.values(votes).forEach(name => {
        tally[name] = (tally[name] || 0) + 1;
      });
      let mostVoted = "";
      let maxVotes = 0;
      for (const [name, count] of Object.entries(tally)) {
        if (count > maxVotes) {
          mostVoted = name;
          maxVotes = count;
        }
      }
      const gameSnap = await firebase.database().ref(`rooms/${roomKey}/game`).get();
      const gameData = gameSnap.val();
      const realImpostor = gameData.impostor;
      await updateScores(votes, realImpostor);
      voteResult.innerHTML = `
        <p><strong>🕵️ L’imposteur désigné :</strong> ${mostVoted} (${maxVotes} votes)</p>
        <p><strong>🎯 Le vrai imposteur était :</strong> ${realImpostor}</p>
      `;
      updateScoreboard();
      showReplayOption();
    }
  });
};

/* ========= MISE À JOUR DES SCORES ========= */
const updateScores = async (votes, realImpostor) => {
  const scoresRef = firebase.database().ref(`rooms/${roomKey}/scores`);
  // Lecture de la liste complète des joueurs pour obtenir leurs noms réels
  const playersSnap = await firebase.database().ref(`rooms/${roomKey}/players`).once('value');
  const playersMapping = playersSnap.val() || {};

  // 1. Pour chaque vote, mettre à jour le score du joueur votant (1 point s'il a voté correctement)
  for (const uid in votes) {
    const voteName = votes[uid];
    const playerScoreRef = firebase.database().ref(`rooms/${roomKey}/scores/${uid}`);
    await playerScoreRef.transaction(currentData => {
      const playerName = playersMapping[uid] ? playersMapping[uid].name : "Inconnu";
      if (currentData === null) {
        return {
          name: playerName,
          points: (voteName === realImpostor ? 1 : 0)
        };
      } else {
        const additional = (voteName === realImpostor ? 1 : 0);
        return {
          ...currentData,
          points: currentData.points + additional
        };
      }
    });
  }

  // 2. Appliquer le bonus pour l’imposteur : +1 point par vote erroné (hors vote de l’imposteur lui-même)
  // Identifier l'UID de l’imposteur à partir de la liste des joueurs
  let impostorUid = null;
  for (const uid in playersMapping) {
    if (playersMapping[uid].name === realImpostor) {
      impostorUid = uid;
      break;
    }
  }

  if (impostorUid) {
    let bonusPoints = 0;
    for (const [voterUid, votedName] of Object.entries(votes)) {
      if (votedName !== realImpostor && voterUid !== impostorUid) bonusPoints++;
    }
    const impostorRef = firebase.database().ref(`rooms/${roomKey}/scores/${impostorUid}`);
    await impostorRef.transaction(currentData => {
      const impostorName = playersMapping[impostorUid] ? playersMapping[impostorUid].name : realImpostor;
      if (currentData === null) {
        return {
          name: impostorName,
          points: bonusPoints
        };
      } else {
        return {
          ...currentData,
          points: currentData.points + bonusPoints
        };
      }
    });
  }
};

/* ========= MISE À JOUR DU TABLEAU DES SCORES ========= */
const updateScoreboard = async () => {
  // Récupérer la liste complète des joueurs pour s'assurer que tous apparaissent avec un score (même 0)
  const playersSnap = await firebase.database().ref(`rooms/${roomKey}/players`).once('value');
  const playersData = playersSnap.val() || {};

  // Récupérer les scores enregistrés
  const scoresSnap = await firebase.database().ref(`rooms/${roomKey}/scores`).once('value');
  const scoresData = scoresSnap.val() || {};

  // Constituer un tableau avec tous les joueurs et leur score (0 par défaut)
  const scoreArray = Object.entries(playersData).map(([uid, data]) => {
    return {
      name: data.name,
      points: (scoresData[uid] && scoresData[uid].points) ? scoresData[uid].points : 0
    };
  });

  // Tri par points décroissants
  scoreArray.sort((a, b) => b.points - a.points);

  scoreBoard.innerHTML = "";
  scoreArray.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name}: ${s.points} pts`;
    scoreBoard.appendChild(li);
  });
  
  scoreSection.style.display = "block";
};

/* ========= ÉCOUTE DES MODIFICATIONS DE L'ÉTAT DU JEU ========= */
const listenToGame = () => {
  firebase.database().ref(`rooms/${roomKey}/game`)
    .on("value", snapshot => {
      const game = snapshot.val();
      if (game?.started) {
        showRole(game.impostor, game.challenges);
      } else {
        // Réinitialiser l'interface si le jeu est réinitialisé
        roleSection.style.display = "none";
        voteSection.style.display = "none";
        replaySection.style.display = "none";
        roleDisplay.innerHTML = "";
        roleDisplay.classList.remove("impostor", "citizen", "show", "animate");
        document.getElementById("vote-result").innerHTML = "";
        lobbySection.style.display = "block";
      }
    });
};

/* ========= OPTION REJOUER ========= */
const showReplayOption = async () => {
  // Seul le leader (celui dont l'UID correspond à hostUid) voit les options de rejouer
  const leaderSnap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  const isUserLeader = leaderSnap.val() === currentUid;
  
  replaySection.style.display = "block";
  replayBtn.style.display = isUserLeader ? "inline-block" : "none";
  replayInfo.textContent = isUserLeader
    ? "Tu es l'organisateur. Tu peux relancer une partie."
    : "En attente que l'organisateur relance la partie.";
};

replayBtn.addEventListener("click", () => {
  firebase.database().ref(`rooms/${roomKey}/game`).remove();
  firebase.database().ref(`rooms/${roomKey}/votes`).remove();
  roleSection.style.display = "none";
  voteSection.style.display = "none";
  document.getElementById("vote-result").innerHTML = "";
  scoreSection.style.display = "none";
  replaySection.style.display = "none";
  joinSection.style.display = "block";
  usernameInput.value = "";
});

/* ========= INITIALISATION DE LA SESSION ========= */
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUid = user.uid;
    if (roomKey) {
      const savedName = localStorage.getItem('rl_pseudo');
      const savedRoom = localStorage.getItem('rl_room');

      if (savedName && savedRoom === roomKey) {
        currentPlayer = savedName;
        firebase.database().ref(`rooms/${roomKey}/players/${user.uid}`).set({ name: currentPlayer });
        joinSection.style.display = "none";
        lobbySection.style.display = "block";
      } else {
        firebase.database().ref(`rooms/${roomKey}/players/${user.uid}`).once("value").then(snap => {
          if (snap.exists()) {
            currentPlayer = snap.val().name;
            document.getElementById("pseudo-label").textContent = `👤 ${currentPlayer}`;
            joinSection.style.display = "none";
            lobbySection.style.display = "block";
          }
        });
      }
      listenToPlayers();
      listenToGame();
    }
  }
});
