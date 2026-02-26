const DEFAULT_TIMER_SECONDS = 90;

const state = {
  teamNames: ["Team 1", "Team 2"],
  started: false,
  pickNumber: 0,
  currentTeamIndex: 0,
  timerSecondsRemaining: DEFAULT_TIMER_SECONDS,
  availablePlayers: [],
  draftedByTeam: [[], []],
  history: [],
  lastEventMessage: "Set team names and start the draft.",
  loadFailed: false,
};

const elements = {
  team1NameInput: document.getElementById("team1Name"),
  team2NameInput: document.getElementById("team2Name"),
  team1Heading: document.getElementById("team1Heading"),
  team2Heading: document.getElementById("team2Heading"),
  team1Panel: document.getElementById("team1Panel"),
  team2Panel: document.getElementById("team2Panel"),
  team1Roster: document.getElementById("team1Roster"),
  team2Roster: document.getElementById("team2Roster"),
  playerPool: document.getElementById("playerPool"),
  activeTeamLabel: document.getElementById("activeTeamLabel"),
  pickNumberLabel: document.getElementById("pickNumberLabel"),
  timerLabel: document.getElementById("timerLabel"),
  statusMessage: document.getElementById("statusMessage"),
  loadError: document.getElementById("loadError"),
  startBtn: document.getElementById("startBtn"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

let timerId = null;
let initialPlayers = [];
const originalIndexById = new Map();

function formatTimer(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isDraftComplete() {
  return state.availablePlayers.length === 0;
}

function clonePlayer(player) {
  return { ...player };
}

function computeCurrentTeamIndex(pickNumber) {
  const round = Math.floor(pickNumber / 2);
  const slot = pickNumber % 2;
  const order = round % 2 === 0 ? [0, 1] : [1, 0];
  return order[slot];
}

function renderTimer() {
  elements.timerLabel.textContent = formatTimer(state.timerSecondsRemaining);
}

function renderTeams() {
  const team1Name = state.teamNames[0];
  const team2Name = state.teamNames[1];
  elements.team1Heading.textContent = `${team1Name} Picks`;
  elements.team2Heading.textContent = `${team2Name} Picks`;

  elements.team1Panel.classList.toggle(
    "active-turn",
    state.started && state.currentTeamIndex === 0 && !isDraftComplete()
  );
  elements.team2Panel.classList.toggle(
    "active-turn",
    state.started && state.currentTeamIndex === 1 && !isDraftComplete()
  );

  elements.team1Roster.innerHTML = "";
  state.draftedByTeam[0].forEach((player) => {
    const item = document.createElement("li");
    item.textContent = `${player.name} (${player.tribe})`;
    elements.team1Roster.appendChild(item);
  });

  elements.team2Roster.innerHTML = "";
  state.draftedByTeam[1].forEach((player) => {
    const item = document.createElement("li");
    item.textContent = `${player.name} (${player.tribe})`;
    elements.team2Roster.appendChild(item);
  });
}

function renderPool() {
  elements.playerPool.innerHTML = "";
  if (state.availablePlayers.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "All players drafted.";
    elements.playerPool.appendChild(empty);
    return;
  }

  state.availablePlayers.forEach((player) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "player-card";
    card.disabled = !state.started || state.loadFailed;
    card.style.setProperty("--tribe-color", player.tribeColor);
    card.dataset.playerId = player.id;
    card.innerHTML = `
      <span>${player.name}</span>
      <span class="player-tribe">${player.tribe}</span>
    `;
    card.addEventListener("click", () => pickPlayer(player.id));
    elements.playerPool.appendChild(card);
  });
}

function renderTurnAndStatus() {
  const currentTeamName = state.teamNames[state.currentTeamIndex];
  elements.activeTeamLabel.textContent = currentTeamName;
  elements.pickNumberLabel.textContent = (state.pickNumber + 1).toString();
  elements.statusMessage.textContent = state.lastEventMessage;
}

function renderControlState() {
  elements.startBtn.disabled = state.started || state.loadFailed || isDraftComplete();
  elements.undoBtn.disabled = state.history.length === 0 || state.loadFailed;
  elements.resetBtn.disabled = state.loadFailed;
}

function renderLoadError() {
  if (state.loadFailed) {
    elements.loadError.classList.remove("hidden");
    elements.loadError.textContent =
      "Could not load data/players.json. Run a local server (for example: `python3 -m http.server`) and open http://localhost:8000.";
    return;
  }
  elements.loadError.classList.add("hidden");
  elements.loadError.textContent = "";
}

function renderAll() {
  renderTeams();
  renderPool();
  renderTurnAndStatus();
  renderTimer();
  renderControlState();
  renderLoadError();
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!state.started || state.loadFailed || isDraftComplete()) {
      return;
    }

    state.timerSecondsRemaining -= 1;
    if (state.timerSecondsRemaining <= 0) {
      advanceTurnBySkip();
      return;
    }
    renderTimer();
  }, 1000);
}

function resetTurnTimer() {
  state.timerSecondsRemaining = DEFAULT_TIMER_SECONDS;
}

function insertPlayerBackInOrder(player) {
  const playerOriginalIndex = originalIndexById.get(player.id);
  const insertIndex = state.availablePlayers.findIndex((candidate) => {
    return originalIndexById.get(candidate.id) > playerOriginalIndex;
  });

  if (insertIndex === -1) {
    state.availablePlayers.push(player);
  } else {
    state.availablePlayers.splice(insertIndex, 0, player);
  }
}

function startDraft() {
  if (state.loadFailed || state.started || isDraftComplete()) {
    return;
  }

  state.started = true;
  state.currentTeamIndex = computeCurrentTeamIndex(state.pickNumber);
  resetTurnTimer();
  state.lastEventMessage = `${state.teamNames[state.currentTeamIndex]} is on the clock.`;
  startTimer();
  renderAll();
}

function finishDraft() {
  state.started = false;
  stopTimer();
  state.lastEventMessage = "Draft complete.";
  renderAll();
}

function pickPlayer(playerId) {
  if (!state.started || state.loadFailed || isDraftComplete()) {
    return;
  }

  const playerIndex = state.availablePlayers.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) {
    return;
  }

  const player = state.availablePlayers.splice(playerIndex, 1)[0];
  const teamIndex = state.currentTeamIndex;
  state.draftedByTeam[teamIndex].push(player);
  state.history.push({
    type: "pick",
    teamIndex,
    player: clonePlayer(player),
    pickNumberBefore: state.pickNumber,
  });

  state.pickNumber += 1;
  if (isDraftComplete()) {
    finishDraft();
    return;
  }

  state.currentTeamIndex = computeCurrentTeamIndex(state.pickNumber);
  resetTurnTimer();
  state.lastEventMessage = `${state.teamNames[teamIndex]} drafted ${player.name}. ${state.teamNames[state.currentTeamIndex]} is on the clock.`;
  renderAll();
}

function advanceTurnBySkip() {
  if (!state.started || state.loadFailed || isDraftComplete()) {
    return;
  }

  const skippedTeam = state.teamNames[state.currentTeamIndex];
  state.pickNumber += 1;
  state.currentTeamIndex = computeCurrentTeamIndex(state.pickNumber);
  resetTurnTimer();
  state.lastEventMessage = `Timer expired. ${skippedTeam}'s turn was skipped. ${state.teamNames[state.currentTeamIndex]} is on the clock.`;
  renderAll();
}

function undoLastPick() {
  if (state.history.length === 0 || state.loadFailed) {
    return;
  }

  const lastAction = state.history.pop();
  if (!lastAction || lastAction.type !== "pick") {
    return;
  }

  const teamRoster = state.draftedByTeam[lastAction.teamIndex];
  let rosterIndex = -1;
  for (let idx = teamRoster.length - 1; idx >= 0; idx -= 1) {
    if (teamRoster[idx].id === lastAction.player.id) {
      rosterIndex = idx;
      break;
    }
  }
  if (rosterIndex !== -1) {
    teamRoster.splice(rosterIndex, 1);
  }

  insertPlayerBackInOrder(clonePlayer(lastAction.player));
  state.pickNumber = lastAction.pickNumberBefore;
  state.currentTeamIndex = computeCurrentTeamIndex(state.pickNumber);
  state.started = true;
  resetTurnTimer();
  startTimer();
  state.lastEventMessage = `Undid pick: ${lastAction.player.name}. ${state.teamNames[state.currentTeamIndex]} is on the clock.`;
  renderAll();
}

function resetDraft() {
  if (state.loadFailed) {
    return;
  }

  state.started = false;
  state.pickNumber = 0;
  state.currentTeamIndex = 0;
  state.timerSecondsRemaining = DEFAULT_TIMER_SECONDS;
  state.availablePlayers = initialPlayers.map(clonePlayer);
  state.draftedByTeam = [[], []];
  state.history = [];
  state.lastEventMessage = "Draft reset. Team 1 starts when you click Start Draft.";
  stopTimer();
  renderAll();
}

function handleTeamNameInput(index, value) {
  const cleaned = value.trim();
  state.teamNames[index] = cleaned.length > 0 ? cleaned : `Team ${index + 1}`;
  renderAll();
}

function validatePlayers(players) {
  if (!Array.isArray(players)) {
    throw new Error("Player data is not an array.");
  }

  players.forEach((player, index) => {
    if (!player.id || !player.name || !player.tribe || !player.tribeColor) {
      throw new Error(`Player at index ${index} is missing required fields.`);
    }

    if (player.id !== slugify(player.id)) {
      throw new Error(`Player id "${player.id}" must be URL-safe lowercase kebab-case.`);
    }
  });
}

function wireEvents() {
  elements.startBtn.addEventListener("click", startDraft);
  elements.undoBtn.addEventListener("click", undoLastPick);
  elements.resetBtn.addEventListener("click", resetDraft);

  elements.team1NameInput.addEventListener("input", (event) => {
    handleTeamNameInput(0, event.target.value);
  });
  elements.team2NameInput.addEventListener("input", (event) => {
    handleTeamNameInput(1, event.target.value);
  });
}

async function loadPlayers() {
  const response = await fetch("data/players.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load players: ${response.status}`);
  }

  const players = await response.json();
  validatePlayers(players);
  return players;
}

async function init() {
  wireEvents();

  try {
    initialPlayers = await loadPlayers();
    initialPlayers.forEach((player, index) => {
      originalIndexById.set(player.id, index);
    });
    state.availablePlayers = initialPlayers.map(clonePlayer);
    renderAll();
  } catch (error) {
    state.loadFailed = true;
    state.lastEventMessage = "Draft data failed to load.";
    renderAll();
    console.error(error);
  }
}

init();
