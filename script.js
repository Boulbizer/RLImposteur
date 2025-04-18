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
const impostorResultSection = document.getElementById('impostor-result-section');
if (!impostorResultSection) {
  console.warn("Impostor result section non trouvé, désactivation de la logique RL.");
}

const impostorLostBtn       = document.getElementById('impostor-lost-btn');
const impostorWonBtn        = document.getElementById('impostor-won-btn');

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

// Vérifie si l'utilisateur courant est le leader (comparaison de l'UID avec hostUid dans Firebase)
const isLeader = async () => {
  const snap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  return snap.val() === currentUid;
};

/* ========= INITIALISATION DE L'INTERFACE ========= */
if (!roomKey) {
  // Pas de salle, on affiche uniquement la création de salle
  joinSection.style.display = 'none';
  document.getElementById('create-room-section').style.display = 'block';
} else {
  // Lorsqu'une salle existe, on affiche les éléments liés à la salle
  roomNameDisplay.textContent = `Salle : ${roomKey}`;
  // Pour un utilisateur déjà inscrit, on masque joinSection
  if (localStorage.getItem('rl_pseudo') && localStorage.getItem('rl_room') === roomKey) {
    joinSection.style.display = 'none';
  } else {
    joinSection.style.display = 'block';
  }
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
// Met à jour l'affichage de la liste des joueurs dans le lobby et affiche le bouton "Lancer la partie" pour le leader.
const updatePlayerListUI = async (players) => {
  playerList.innerHTML = "";
  players.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    playerList.appendChild(li);
  });
  // Afficher le bouton de démarrage uniquement si l'utilisateur est leader et le nombre de joueurs est suffisant.
  const leaderSnap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
  startBtn.style.display = (currentUid === leaderSnap.val() && players.length >= MIN_PLAYERS_TO_START)
    ? 'inline-block'
    : 'none';
};

// Écoute en temps réel des mises à jour de la liste des joueurs.
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
  // Vérifier l'unicité du pseudo
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
  // Gérer les déconnexions
  firebase.database().ref(`rooms/${roomKey}/players/${currentUid}`).onDisconnect().remove();
  firebase.database().ref(`rooms/${roomKey}/votes/${currentUid}`).onDisconnect().remove();
  // Sauvegarder localement
  localStorage.setItem('rl_pseudo', name);
  localStorage.setItem('rl_room', roomKey);
  usernameInput.value = "";
  // Une fois inscrit, la section d'inscription ne doit plus apparaître
  joinSection.style.display = "none";
  lobbySection.style.display = "block";
  listenToPlayers();
});

/* ========= DÉMARRAGE DE LA PARTIE ========= */
startBtn.addEventListener('click', () => {
  if (players.length < MIN_PLAYERS_TO_START) return;
  // Sélection aléatoire d'un imposteur et génération des défis
  const impostor = players[Math.floor(Math.random() * players.length)];
  const challenges = getRandomChallenges();
  firebase.database().ref(`rooms/${roomKey}/game`).set({
    impostor,
    challenges,
    started: true,
    scoresProcessed: false  // Réinitialisation pour la nouvelle manche
  });
  // Réinitialiser les votes
  firebase.database().ref(`rooms/${roomKey}/votes`).remove();
});

/* ========= AFFICHAGE DU RÔLE ========= */
const showRole = (impostor, challenges) => {
  // Masquer définitivement la section d'inscription pour tous les joueurs
  joinSection.style.display = "none";
  lobbySection.style.display = "none";
  
  // Optionnel : masquer le label du pseudo
  const pseudoLabel = document.getElementById("pseudo-label");
  if (pseudoLabel) pseudoLabel.style.display = "none";
  
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
  // Animation d'apparition
  roleDisplay.classList.remove("show", "animate");
  void roleDisplay.offsetWidth;
  roleDisplay.classList.add("show", "animate");
  // Lancer la phase de vote après 3 secondes
  setTimeout(() => startVoting(impostor), 3000);
};

/* ========= PHASE DE VOTE ========= */
const startVoting = (realImpostor) => {
  voteSection.style.display = "block";
  const voteList = document.getElementById("vote-list");
  voteList.innerHTML = "";
  voteStatus.textContent = "Clique sur un joueur pour voter.";
  
  let hasVoted = false; // Empêche plusieurs votes pour le même joueur

  // Créer la liste des joueurs à voter (excluant le votant)
  players.forEach(name => {
    if (name === currentPlayer) return;
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", () => {
      if (hasVoted) return;
      hasVoted = true;
      
      // Appliquer immédiatement les modifications visuelles
      li.classList.add("selected");
      Array.from(voteList.children).forEach(child => {
        if (child !== li) child.classList.add("disabled");
      });
      voteStatus.textContent = "✅ Vote enregistré. En attente des autres joueurs...";
      
      // Récupérer l'utilisateur courant
      const user = firebase.auth().currentUser;
      if (!user) return;
      // Lancer la mise à jour Firebase sans attendre la fin de l'opération
      firebase.database().ref(`rooms/${roomKey}/votes/${user.uid}`).set(name)
        .catch(error => console.error("Erreur lors du vote:", error));
    });
    voteList.appendChild(li);
  });

  // Écoute en temps réel des votes
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
      const realImpostorFinal = gameData.impostor;
      // Seul le leader déclenche la mise à jour globale des scores
      const leaderSnap = await firebase.database().ref(`rooms/${roomKey}/hostUid`).once('value');
      if (leaderSnap.val() === currentUid) {
        await updateScores(votes, realImpostorFinal);
      }
      voteResult.innerHTML = `
        <p><strong>🕵️ L’imposteur désigné :</strong> ${mostVoted} (${maxVotes} votes)</p>
        <p><strong>🎯 Le vrai imposteur était :</strong> ${realImpostorFinal}</p>
      `;

       // === NOUVEAU : Affiche le conteneur RL uniquement pour l’imposteur ===
      if (currentPlayer === realImpostorFinal) {
        if (impostorResultSection) {
  impostorResultSection.style.display = 'block';
}

      
      showReplayOption();
    }
  });
};

/* ========= GESTION RÉSULTAT ROCKET LEAGUE === */
impostorLostBtn.addEventListener('click', () => {
  // Simple fermeture, pas de malus
if (impostorResultSection) {
  impostorResultSection.style.display = 'block';
}

impostorWonBtn.addEventListener('click', async () => {
  // Transaction Firebase : -1 point pour l’imposteur
  const scoreRef = firebase.database().ref(`rooms/${roomKey}/scores/${currentUid}`);
  await scoreRef.transaction(cur => {
    if (cur) {
      cur.points = Math.max(0, cur.points - 1);
      return cur;
    }
    return { name: currentPlayer, points: 0 };
  });
  alert("😈 Malus appliqué : tu perds 1 point !");
if (impostorResultSection) {
  impostorResultSection.style.display = 'block';
}
});

/* ========= MISE À JOUR DES SCORES ========= */
const updateScores = async (votes, realImpostor) => {
  const scoresRef = firebase.database().ref(`rooms/${roomKey}/scores`);
  // Récupérer la liste complète des joueurs
  const playersSnap = await firebase.database().ref(`rooms/${roomKey}/players`).once('value');
  const playersMapping = playersSnap.val() || {};
  // Transaction unique sur le nœud "scores"
  await scoresRef.transaction((currentScores) => {
    if (currentScores === null) {
      currentScores = {};
    }
    // Pour chaque vote, ajouter 1 point si le vote est correct
    for (const uid in votes) {
      const voteName = votes[uid];
      if (!currentScores[uid]) {
        currentScores[uid] = {
          name: playersMapping[uid] ? playersMapping[uid].name : "Inconnu",
          points: 0
        };
      }
      if (voteName === realImpostor) {
        currentScores[uid].points += 1;
      }
    }
    // Appliquer le bonus pour l’imposteur : +1 point pour chaque vote erroné (hors vote de l'imposteur)
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
        if (votedName !== realImpostor && voterUid !== impostorUid) {
          bonusPoints++;
        }
      }
      if (!currentScores[impostorUid]) {
        currentScores[impostorUid] = {
          name: playersMapping[impostorUid] ? playersMapping[impostorUid].name : realImpostor,
          points: 0
        };
      }
      currentScores[impostorUid].points += bonusPoints;
    }
    return currentScores;
  });
  // Marquer la manche comme traitée pour éviter un recalcul lors d'un rafraîchissement
  await firebase.database().ref(`rooms/${roomKey}/game`).update({ scoresProcessed: true });
};

/* ========= MISE À JOUR DU TABLEAU DES SCORES ========= */
const updateScoreboard = async () => {
  // Récupérer les scores
  const scoresSnap = await firebase.database().ref(`rooms/${roomKey}/scores`).once('value');
  const scoresData = scoresSnap.val() || {};
  // N'afficher le tableau que s'il y a des scores (manche terminée)
  if (Object.keys(scoresData).length === 0) {
    scoreSection.style.display = "none";
    return;
  }
  // Récupérer la liste complète des joueurs
  const playersSnap = await firebase.database().ref(`rooms/${roomKey}/players`).once('value');
  const playersData = playersSnap.val() || {};
  // Construire le tableau de scores
  const scoreArray = Object.entries(playersData).map(([uid, data]) => ({
    name: data.name,
    points: (scoresData[uid] && scoresData[uid].points) ? scoresData[uid].points : 0
  }));
  scoreArray.sort((a, b) => b.points - a.points);
  scoreBoard.innerHTML = "";
  scoreArray.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name}: ${s.points} pts`;
    scoreBoard.appendChild(li);
  });
  scoreSection.style.display = "block";
};

/* ========= ÉCOUTE EN TEMPS RÉEL DES SCORES ========= */
// Met à jour le tableau dès qu'une modification intervient sur "scores"
firebase.database().ref(`rooms/${roomKey}/scores`)
  .on('value', snapshot => {
    updateScoreboard();
});

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
  // Seul le leader voit l'option pour rejouer
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
  // Le tableau des scores reste tel quel si les scores existent, sinon il restera masqué.
  joinSection.style.display = "none"; // S'assurer que l'inscription reste masquée pour tous.
  lobbySection.style.display = "block";
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
