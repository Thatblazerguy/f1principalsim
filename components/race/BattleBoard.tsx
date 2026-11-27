import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, ChevronDown } from 'lucide-react';
import { TyreBadge } from './RaceParts.tsx';

/*
 * Cars within a second of each other, ranked: fights involving our drivers
 * first, then the lead, podium and points. Gap, trend, DRS range, tyres and
 * underlying pace all come from the engine (basePace is what decides passes).
 */
export function BattleBoard({ battles, onFocus, selectedId, compact }: any) {
  const [open, setOpen] = useState<string | null>(null);
  const list = battles.slice(0, compact ? 3 : 4);
  return (
    <div className={`rc-battles ${compact ? 'is-compact' : ''}`} aria-label="Battles on track">
      <div className="rc-battles-head"><Swords size={13} strokeWidth={1.5} />Battles<em>{battles.length ? `${battles.length} within 1s` : 'None within 1s'}</em></div>
      <AnimatePresence initial={false}>
        {list.map((b: any) => {
          const front = b.cars[0]; const back = b.cars[b.cars.length - 1]; const chaser = b.cars[1];
          const isOpen = open === b.key;
          return (
            <motion.div key={b.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className={`rc-battle is-${b.category} ${b.involvesPlayer ? 'is-ours' : ''} ${b.cars.some((c: any) => c.id === selectedId) ? 'is-sel' : ''}`}>
              <button type="button" className="rc-battle-row" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : b.key); onFocus(chaser.id); }}>
                <span className="rc-battle-label">{b.label}</span>
                <span className="rc-battle-cars">
                  {b.cars.map((c: any, i: number) => <span key={c.id} style={{ ['--tc' as any]: c.color }} className={c.isPlayer ? 'is-ours' : ''}><i />{c.code}{i < b.cars.length - 1 && <b>›</b>}</span>)}
                </span>
                <span className="rc-battle-gap rc-num">{b.gap.toFixed(1)}s{b.drs && <em>DRS</em>}</span>
                <ChevronDown size={13} strokeWidth={1.5} className="rc-battle-chev" />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.dl className="rc-battle-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div><dt>Gap trend</dt><dd>{b.trend == null ? 'Needs a few more laps' : Math.abs(b.trend) < 0.05 ? 'Holding steady' : `${b.trend < 0 ? 'Closing' : 'Opening'} ${Math.abs(b.trend).toFixed(2)}s a lap`}</dd></div>
                    <div><dt>DRS</dt><dd>{b.drs ? `${chaser.code} is in range` : 'Not yet enabled'}</dd></div>
                    <div><dt>Tyres</dt><dd><TyreBadge compound={front.compound} age={front.tyreAge} /> vs <TyreBadge compound={chaser.compound} age={chaser.tyreAge} />
                      <span>{Math.abs(b.tyreAgeDelta) < 1 ? 'Same age' : `${b.tyreAgeDelta > 0 ? chaser.code : front.code} ${Math.round(Math.abs(b.tyreAgeDelta))} laps fresher`}</span></dd></div>
                    <div><dt>Relative pace</dt><dd>{Math.abs(b.pace) < 0.02 ? 'Evenly matched' : `${b.pace > 0 ? chaser.code : front.code} ${Math.abs(b.pace).toFixed(2)}s a lap quicker`}</dd></div>
                    {b.cars.length > 2 && <div><dt>Train</dt><dd>{b.cars.length} cars, back to {back.code}</dd></div>}
                  </motion.dl>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
