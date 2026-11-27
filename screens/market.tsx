import React from 'react';
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, pageTitle, pageSubtitle } from '../components/HubLayout.tsx';
import { DriverMarket } from '../components/market/DriverMarket.tsx';

/**
 * Driver market 2.0. The market rules live in game/transferMarket.js; this
 * screen only mounts the interface. Free agents, drivers under contract and
 * F2 prospects, with scouting, approaches, transfer fees and pre-contracts.
 */
export function renderMarket(root) {
  if (!root) return;
  ensureTeamState(state.team);

  if (!state.team) {
    const content = (
      <div>
        <div style={{ marginBottom: '32px' }}>
          {pageTitle('Driver market')}
          {pageSubtitle('Create a team before scouting drivers.')}
        </div>
      </div>
    );
    mountLayout(root, 'market', content);
    return;
  }

  mountLayout(root, 'market', <DriverMarket appState={state} onPersist={async () => { await syncGame(); }} />, () => renderMarket(root));
}
