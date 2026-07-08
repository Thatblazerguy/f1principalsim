import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRacePaceLapTime } from './raceBalance.js';

test('competitive cars stay within a tight pace band', () => {
  const leader = calculateRacePaceLapTime({
    team: { carPerformance: 90, specs: { ovr: 90 } },
    driver: { pace: 92, racecraft: 88 },
    trackBaseTime: 90,
    tyreHealth: 1,
    fuelLoad: 0.85,
    trackGrip: 1,
    isWet: false,
    randomVariation: 0,
  });

  const rival = calculateRacePaceLapTime({
    team: { carPerformance: 88, specs: { ovr: 88 } },
    driver: { pace: 90, racecraft: 87 },
    trackBaseTime: 90,
    tyreHealth: 1,
    fuelLoad: 0.85,
    trackGrip: 1,
    isWet: false,
    randomVariation: 0,
  });

  assert.ok(Math.abs(leader - rival) < 0.4, `expected a <0.4s gap but got ${Math.abs(leader - rival).toFixed(3)}s`);
});

test('midfield cars remain reasonably close to the leaders', () => {
  const leader = calculateRacePaceLapTime({
    team: { carPerformance: 90, specs: { ovr: 90 } },
    driver: { pace: 92, racecraft: 88 },
    trackBaseTime: 90,
    tyreHealth: 1,
    fuelLoad: 0.85,
    trackGrip: 1,
    isWet: false,
    randomVariation: 0,
  });

  const midfield = calculateRacePaceLapTime({
    team: { carPerformance: 82, specs: { ovr: 82 } },
    driver: { pace: 84, racecraft: 80 },
    trackBaseTime: 90,
    tyreHealth: 1,
    fuelLoad: 0.85,
    trackGrip: 1,
    isWet: false,
    randomVariation: 0,
  });

  assert.ok(Math.abs(leader - midfield) <= 0.8, `expected midfield to stay within 0.8s but got ${Math.abs(leader - midfield).toFixed(3)}s`);
});
