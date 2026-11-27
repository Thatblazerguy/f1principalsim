import type { CarPart } from '../../screens/landing/Car';

type V3 = [number, number, number];

/** Car parts the garage can focus, mapped onto the game's development catalogue. */
export interface GaragePart {
  id: CarPart;
  label: string;
  summary: string;
  /** DEVELOPMENT_CATALOG entries (categoryId.itemId) developed on this part */
  items: [string, string][];
  /** eng.carSpecs keys this part mostly drives */
  specs: string[];
  anchor: V3;
  /** camera focus: position + look target */
  cam: V3;
  look: V3;
}

export const GARAGE_PARTS: GaragePart[] = [
  {
    id: 'frontWing', label: 'Front wing', summary: 'Sets front downforce and how sharply the car turns in',
    items: [['aero', 'frontWing']], specs: ['cornering', 'downforce'],
    anchor: [3.05, 0.24, 0.72], cam: [5.4, 1.0, 2.6], look: [2.6, 0.2, 0.2],
  },
  {
    id: 'suspension', label: 'Suspension', summary: 'Mechanical grip, balance and how the car rides kerbs',
    items: [['chassis', 'suspension'], ['chassis', 'mechanicalGrip'], ['chassis', 'balance'], ['chassis', 'weightReduction']],
    specs: ['mechanicalGrip', 'balance', 'tyreWear'],
    anchor: [1.62, 0.5, 0.66], cam: [3.4, 1.3, 3.0], look: [1.6, 0.4, 0.5],
  },
  {
    id: 'sidepods', label: 'Sidepods and cooling', summary: 'Airflow to the rear of the car and how hot the power unit runs',
    items: [['aero', 'sidepods'], ['aero', 'cooling']], specs: ['downforce', 'fuelEfficiency', 'reliability'],
    anchor: [-0.3, 0.68, 0.72], cam: [0.6, 1.8, 3.8], look: [-0.4, 0.5, 0.3],
  },
  {
    id: 'floor', label: 'Floor and diffuser', summary: 'Ground effect: the biggest single source of downforce',
    items: [['aero', 'floor'], ['aero', 'diffuser']], specs: ['downforce', 'cornering', 'balance'],
    anchor: [-1.1, 0.14, 0.78], cam: [-1.6, 0.55, 3.4], look: [-1.2, 0.12, 0.3],
  },
  {
    id: 'powerUnit', label: 'Power unit', summary: 'Straight-line speed, deployment and how long components last',
    items: [['powerUnit', 'ice'], ['powerUnit', 'ers'], ['powerUnit', 'turbo'], ['powerUnit', 'energyRecovery'], ['reliability', 'engineReliability'], ['reliability', 'gearboxReliability']],
    specs: ['topSpeed', 'acceleration', 'reliability'],
    anchor: [-0.95, 0.92, 0.28], cam: [-0.4, 3.0, 2.6], look: [-0.9, 0.6, 0],
  },
  {
    id: 'rearWing', label: 'Rear wing and DRS', summary: 'Top speed against rear stability, and the DRS gain on straights',
    items: [['aero', 'rearWing']], specs: ['topSpeed', 'downforce'],
    anchor: [-2.78, 1.18, 0.5], cam: [-6.2, 2.0, 3.0], look: [-2.4, 0.8, 0],
  },
];

export const OVERVIEW_CAM = { cam: [5.6, 2.0, 5.8] as V3, look: [-0.2, 0.45, 0] as V3 };

export const SPEC_LABELS: Record<string, string> = {
  cornering: 'Cornering', downforce: 'Downforce', mechanicalGrip: 'Mechanical grip', balance: 'Balance',
  tyreWear: 'Tyre management', topSpeed: 'Top speed', acceleration: 'Acceleration', fuelEfficiency: 'Fuel efficiency',
  reliability: 'Reliability',
};

export const UPGRADED_STATUSES = ['success', 'overperform', 'underperform'];
