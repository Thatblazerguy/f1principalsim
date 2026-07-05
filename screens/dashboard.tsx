import React from 'react';
import { mountLayout } from '../components/HubLayout.tsx';
import { ChampionshipHub } from './ChampionshipHub';

export function renderDashboard(root) {
  mountLayout(root, 'dashboard', <ChampionshipHub appRoot={root} />);
}
