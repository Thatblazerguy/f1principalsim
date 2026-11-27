type V3 = [number, number, number];
export type CamView = 'three' | 'side' | 'front' | 'rear' | 'top';
export const VIEWS: Record<CamView, { pos: V3; look: V3; label: string }> = {
  three: { pos: [6.2, 2.6, 6.4], look: [-0.2, 0.5, 0], label: '3/4' },
  side: { pos: [0.2, 1.3, 10.2], look: [-0.1, 0.5, 0], label: 'Side' },
  front: { pos: [8.6, 1.6, 0.01], look: [0, 0.5, 0], label: 'Front' },
  rear: { pos: [-8.2, 3.4, 0.01], look: [0, 0.6, 0], label: 'Rear' },
  top: { pos: [0.01, 10.5, 0.4], look: [0, 0, 0], label: 'Top' },
};

