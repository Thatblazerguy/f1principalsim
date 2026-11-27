import React from 'react';
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { ensureSponsorSlots, rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { ensureFinanceState } from "../utils/financeSystem.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, pageTitle, pageSubtitle } from '../components/HubLayout.tsx';
import { CommercialHQ } from '../components/commercial/CommercialHQ.tsx';

export function renderSponsors(root, flashMessage = "") {
  ensureTeamState(state.team);
  if (!state.team) {
    const content = (<div><div style={{ marginBottom: '32px' }}>{pageTitle('Sponsors')}{pageSubtitle('Create a team first.')}</div></div>);
    mountLayout(root, 'sponsors', content);
    return;
  }

  if (!Array.isArray(state.sponsorOffers) || state.sponsorOffers.length === 0) rotateSponsorOffers(state);
  if (!state.signedSponsors) state.signedSponsors = {};
  ensureFinanceState(state);
  ensureSponsorSlots(state.team);

  mountLayout(
    root,
    'sponsors',
    <CommercialHQ appState={state} initialMessage={flashMessage} onPersist={async () => { await syncGame(); }} />,
    () => renderSponsors(root),
  );
}
