const BASE_SEASON_YEAR = 2026;
const BASE_SEASON_START_MONTH = 2; // March (0-indexed)
const BASE_SEASON_START_DAY = 1;
const RACE_INTERVAL_DAYS = 14;
const R_AND_D_DAYS = 7;
const BUILD_MIN_DAYS = 7;
const BUILD_MAX_DAYS = 14;
const MAX_NOTIFICATIONS = 10;

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRoundRaceDay(round) {
  return 1 + (Math.max(1, Number(round) || 1) - 1) * RACE_INTERVAL_DAYS;
}

export function getDaysUntilRound(round, currentDay) {
  return Math.max(0, getRoundRaceDay(round) - (Number(currentDay) || 1));
}

export function getSeasonDate(seasonYear = 1, day = 1) {
  const date = new Date(Date.UTC(BASE_SEASON_YEAR + (seasonYear - 1), BASE_SEASON_START_MONTH, BASE_SEASON_START_DAY));
  date.setUTCDate(date.getUTCDate() + Math.max(0, day - 1));
  return date;
}

export function formatSeasonDate(seasonYear = 1, day = 1) {
  return getSeasonDate(seasonYear, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ensureSeasonTimeline(state) {
  if (!state.season) state.season = { round: 1, year: 1, totalRounds: 24 };
  if (!Number.isFinite(state.season.currentDay)) state.season.currentDay = getRoundRaceDay(state.season.round || 1);

  if (!Array.isArray(state.notifications)) state.notifications = [];
  if (!state.team) return;

  if (!Array.isArray(state.team.pendingUpgrades)) state.team.pendingUpgrades = [];
  state.team.pendingUpgrades = state.team.pendingUpgrades
    .filter(entry => entry && typeof entry.part === "string" && Number.isFinite(entry.readyDay))
    .map(entry => ({
      ...entry,
      cost: Number(entry.cost) || 0,
      requestedDay: Number(entry.requestedDay) || state.season.currentDay,
      readyDay: Number(entry.readyDay),
    }));
}

export function addTimelineNotification(state, message) {
  ensureSeasonTimeline(state);
  const day = state.season.currentDay;
  state.notifications.unshift({ day, message });
  if (state.notifications.length > MAX_NOTIFICATIONS) {
    state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
  }
}

export function getPendingUpgradeForPart(team, part) {
  if (!team || !Array.isArray(team.pendingUpgrades)) return null;
  return team.pendingUpgrades.find(entry => entry.part === part) || null;
}

export function getNextUpgradeAvailability(team, currentDay) {
  if (!team || !Array.isArray(team.pendingUpgrades) || !team.pendingUpgrades.length) return null;
  const next = [...team.pendingUpgrades].sort((a, b) => a.readyDay - b.readyDay)[0];
  return {
    ...next,
    daysRemaining: Math.max(0, next.readyDay - currentDay),
  };
}

export function requestTimedUpgrade(team, part, currentDay, currentRound = 1) {
  if (!team) return { ok: false, reason: "No team loaded." };
  if (!team.car || !Number.isFinite(team.car[part])) return { ok: false, reason: "Unknown car component." };
  if (!Array.isArray(team.pendingUpgrades)) team.pendingUpgrades = [];

  if (getPendingUpgradeForPart(team, part)) {
    return { ok: false, reason: `${part.toUpperCase()} already has an active project.` };
  }

  const cost = 50 * team.car[part];
  if (team.budget < cost) {
    return { ok: false, reason: "Not enough budget for that upgrade." };
  }

  const leadTime = R_AND_D_DAYS + randomInt(BUILD_MIN_DAYS, BUILD_MAX_DAYS);
  const minRoundGateDay = getRoundRaceDay((Number(currentRound) || 1) + 2);
  const readyDay = Math.max(currentDay + leadTime, minRoundGateDay);
  const entry = {
    id: `${part}-${currentDay}-${Math.random().toString(36).slice(2, 8)}`,
    part,
    cost,
    requestedDay: currentDay,
    readyDay,
  };

  team.budget = roundToTenth(team.budget - cost);
  team.pendingUpgrades.push(entry);

  return {
    ok: true,
    entry,
    leadTime,
  };
}

export function processCompletedUpgrades(state) {
  ensureSeasonTimeline(state);
  if (!state.team?.pendingUpgrades?.length) return [];

  const currentDay = state.season.currentDay;
  const completed = state.team.pendingUpgrades.filter(entry => entry.readyDay <= currentDay);
  if (!completed.length) return [];

  state.team.pendingUpgrades = state.team.pendingUpgrades.filter(entry => entry.readyDay > currentDay);

  completed.forEach(entry => {
    state.team.car[entry.part] += 1;
    state.team.carPerformance = roundToTenth((state.team.carPerformance || 0) + 1.5);
    addTimelineNotification(
      state,
      `${entry.part.toUpperCase()} upgrade complete (Lv ${state.team.car[entry.part]}).`
    );
  });

  return completed;
}

export function canSimulateNextDay(state) {
  ensureSeasonTimeline(state);
  const totalRounds = state.season.totalRounds || 24;
  if (state.season.round > totalRounds) return false;

  const currentRoundDay = getRoundRaceDay(state.season.round);
  const raceWeekendOpen = state.season.currentDay >= currentRoundDay;
  const raceComplete = state.weekendProgress?.round === state.season.round && state.weekendProgress?.raceComplete;
  return !raceWeekendOpen || raceComplete;
}

export function simulateNextDay(state) {
  ensureSeasonTimeline(state);
  const totalRounds = state.season.totalRounds || 24;
  if (state.season.round > totalRounds) return { advanced: false, reason: "season_complete", completedUpgrades: [] };

  if (!canSimulateNextDay(state)) {
    return { advanced: false, reason: "race_weekend_open", completedUpgrades: [] };
  }

  state.season.currentDay += 1;
  const completedUpgrades = processCompletedUpgrades(state);
  const daysUntilRace = getDaysUntilRound(state.season.round, state.season.currentDay);

  // Process scouting if academy system is loaded
  if (state.academy && state.academy.scouts) {
    import('../game/scouting.js').then(({ processScoutingDay }) => {
       processScoutingDay(state);
    }).catch(err => console.error("Failed to process scouting day", err));
  }

  if (daysUntilRace === 0 && state.season.round <= totalRounds) {
    addTimelineNotification(state, `Race weekend is now live: Round ${state.season.round}.`);
  }

  return {
    advanced: true,
    reason: "ok",
    completedUpgrades,
    daysUntilRace,
  };
}
