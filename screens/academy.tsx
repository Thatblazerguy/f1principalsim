import React from 'react';
import { state } from "../state.js";
import { ensureTeamState, ensureAcademyState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout } from '../components/HubLayout.tsx';
import { AcademyHQ } from '../components/academy/AcademyHQ.tsx';

/**
 * Driver academy. The rules live in game/academyEngine.js (development,
 * scouting, junior championships, loans, promotions, finances); this screen
 * mounts the interface.
 */
export function renderAcademy(root, initialFlashMessage = "") {
  ensureTeamState(state.team);
  ensureAcademyState(state);
  mountLayout(root, 'academy', <AcademyHQ appState={state} initialFlash={initialFlashMessage} onPersist={async () => { await syncGame(); }} />, () => renderAcademy(root));
}
