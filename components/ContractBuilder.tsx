import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { state } from '../state.js';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { HUB, btn, btnClass, iconBtn } from './HubLayout.tsx';
import { DriverToolsModal } from './DriverToolsModal.tsx';
import { useTween } from './driverToolsMotion.ts';
import {
  CONTRACT_LIMITS,
  MONEY_RAISE,
  computeBudgetImpact,
  computeMarketOfferOdds,
  computeReserveOfferOdds,
  computeRenewalOdds,
  getRenewalAsking,
  driverOverall,
} from '../utils/contractOfferModel.js';

export type ContractTerms = { salary: number; seasons: number };
export type OfferResult = { accepted: boolean; headline: string; reply?: string };

const money = (v: number, dp = 1) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(dp)}M`;
const signedMoney = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(v).toFixed(1)}M`;
const seasonsText = (n: number) => `${n} ${n === 1 ? 'season' : 'seasons'}`;

function Slider({
  id, label, value, min, max, step, pageStep, onChange, valueText, marks = [], ticks, autoFocusHere = false,
}: {
  autoFocusHere?: boolean; id: string; label: string; value: number; min: number; max: number; step: number; pageStep: number;
  onChange: (v: number) => void; valueText: (v: number) => string; marks?: { at: number; label: string }[]; ticks: [string, string];
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const snap = (v: number) => Math.round(Math.min(max, Math.max(min, v)) / step) * step;
  return (
    <div>
      <div className="ctb-range-wrap">
        <div className="ctb-range-track" />
        <div className="ctb-range-fill" style={{ width: `${pct}%` }} />
        {marks.map((m) => (
          <div key={m.label} className="ctb-range-mark" style={{ left: `${((m.at - min) / (max - min)) * 100}%` }} title={m.label} />
        ))}
        <input
          id={id}
          className="ctb-range"
          style={{ background: "transparent", border: "none", padding: 0, borderRadius: 0, boxShadow: "none", minHeight: 0, margin: 0 }}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          {...(autoFocusHere ? { 'data-autofocus': true } : {})}
          aria-valuetext={valueText(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'PageUp') { e.preventDefault(); onChange(snap(value + pageStep)); }
            else if (e.key === 'PageDown') { e.preventDefault(); onChange(snap(value - pageStep)); }
          }}
        />
      </div>
      <div className="ctb-ticks"><span>{ticks[0]}</span><span>{ticks[1]}</span></div>
    </div>
  );
}

function OddsGauge({ odds }: { odds: number }) {
  const v = useTween(odds, 420) as number;
  const r = 90; const cx = 110; const cy = 104;
  const len = Math.PI * r;
  const color = odds >= 70 ? HUB.positive : odds >= 35 ? HUB.warning : HUB.negative;
  const end = Math.PI * (1 - v / 100);
  const nx = cx + (r) * Math.cos(end);
  const ny = cy - (r) * Math.sin(end);
  return (
    <div className="ctb-gauge" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(odds)} aria-valuetext={`${Math.round(odds)}% chance they accept`} aria-label="Acceptance odds">
      <svg viewBox="0 0 220 120" aria-hidden="true">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(237,237,237,0.1)" strokeWidth={10} strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${len}`} strokeDashoffset={len * (1 - v / 100)} style={{ transition: `stroke 200ms ${HUB.ease}` }} />
        {v > 0.5 && <circle cx={nx} cy={ny} r={7} fill={HUB.bg} stroke={color} strokeWidth={2.5} />}
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={38} fill={HUB.textPrimary} style={{ fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}%</text>
      </svg>
      <div className="ctb-gauge-label">Chance they accept</div>
    </div>
  );
}

function Tweened({ value, format }: { value: number; format: (v: number) => string }) {
  const v = useTween(value, 380) as number;
  return <>{format(v)}</>;
}

/**
 * Contract builder.
 *  mode "market"  → new reserve contract via the market signing path.
 *  mode "reserve" → offer a current race driver the reserve role (NegotiationSession).
 * `onSend` must run the real game path and report the outcome.
 */
export function ContractBuilder({
  driver, mode, onSend, onClose, onDone, onTalk,
}: {
  driver: any;
  mode: 'market' | 'reserve' | 'renew' | 'salary';
  onSend: (terms: ContractTerms) => Promise<OfferResult> | OfferResult;
  onClose: () => void;
  onDone?: (result: OfferResult) => void;
  onTalk?: () => void;
}) {
  const s: any = state;
  const base = Number(driver.salary) || 1;
  const step = CONTRACT_LIMITS.salaryStep;
  const talks = mode === 'renew' || mode === 'salary';
  const minSalary = talks ? Math.max(step, Math.floor((base * 0.6) / step) * step) : Math.ceil(base / step) * step;
  const maxSalary = Math.max(Math.ceil(base / step) * step + step * 4, Math.ceil((base * (1 + CONTRACT_LIMITS.maxRaise)) / step) * step);
  const asking = mode === 'renew' ? getRenewalAsking(driver) : base;
  const [salary, setSalary] = useState(talks ? Math.min(maxSalary, Math.max(minSalary, asking)) : minSalary);
  const [seasons, setSeasons] = useState(Math.min(CONTRACT_LIMITS.maxSeasons, Math.max(CONTRACT_LIMITS.minSeasons, driver.contractYearsRemaining || 2)));
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<OfferResult | null>(null);
  const titleId = useId();
  const salaryId = useId();
  const seasonsId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (result) doneRef.current?.focus(); }, [result]);

  const terms = { salary, seasons };
  const odds = useMemo(
    () => (mode === 'market' ? computeMarketOfferOdds(s, driver, terms)
      : talks ? computeRenewalOdds(s, driver, terms, mode)
      : computeReserveOfferOdds(driver, s.team, terms)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, driver, salary, seasons],
  );
  // Market: the whole salary is new spend. Reserve: the driver is already paid, so only the change counts.
  const impact = computeBudgetImpact(s, { salary, seasons, currentSalary: mode === 'market' ? 0 : base });
  const raiseMark = mode === 'reserve' && (odds as any).moneyMatters
    ? [{ at: Math.min(maxSalary, Math.ceil((base * (1 + MONEY_RAISE)) / step) * step), label: '+20% raise unlocks the money offer' }]
    : mode === 'renew' ? [{ at: Math.min(maxSalary, Math.max(minSalary, asking)), label: `Asking $${asking}M` }]
    : mode === 'salary' ? [{ at: base, label: `Current $${base}M` }]
    : [];

  const send = async () => {
    if (sending || odds.odds <= 0) return;
    setSending(true);
    try {
      const r = await onSend(terms);
      setResult(r);
    } finally {
      setSending(false);
    }
  };

  const close = () => { if (result) onDone?.(result); onClose(); };
  const factorColor = (effect: string) => effect === 'for' ? HUB.positive : effect === 'against' ? HUB.negative : HUB.textFaint;

  return (
    <DriverToolsModal prefix="ctb" labelledBy={titleId} onClose={close}>
      <div className="ctb-head">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <img src={getDriverHeadshotUrl(driver)} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
          <div>
            <p className="ctb-kicker">{mode === 'market' ? 'Reserve contract offer' : mode === 'renew' ? 'Contract renewal' : mode === 'salary' ? 'Salary negotiation' : 'Reserve role offer'}</p>
            <h3 className="ctb-title" id={titleId}>{driver.name}</h3>
            <span style={{ fontSize: 12, color: HUB.textMuted }}>
              Age {driver.age ?? '–'} · {driverOverall(driver)} overall · {mode === 'market' ? 'asking' : 'currently on'} ${base}M a season{talks ? ` · ${driver.contractYearsRemaining ?? '–'} ${driver.contractYearsRemaining === 1 ? 'season' : 'seasons'} left · morale ${driver.morale ?? '–'}` : ''}
            </span>
          </div>
        </div>
        <button type="button" onClick={close} className={btnClass('ghost')} style={iconBtn('md')} aria-label="Close contract builder">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {result ? (
        <div className="ctb-result" aria-live="polite">
          <h4 style={{ fontFamily: HUB.fontBold, fontWeight: 400, fontSize: 18, margin: 0, color: result.accepted ? HUB.positive : HUB.negative }}>{result.headline}</h4>
          {result.reply && <div className="ctb-quote">“{result.reply}”<div style={{ fontSize: 12, color: HUB.textMuted, marginTop: 8 }}>— {driver.name}</div></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={close} ref={doneRef}>Done</button>
          </div>
        </div>
      ) : (
        <>
          <div className="ctb-body">
            <div>
              <div className="ctb-field">
                <div className="ctb-field-head">
                  <label className="ctb-field-label" htmlFor={salaryId}>Salary</label>
                  <span className="ctb-field-value">${salary.toFixed(1)}M<span style={{ fontSize: 12, color: HUB.textMuted }}> / season</span></span>
                </div>
                <Slider
                  id={salaryId}
                  label="Salary per season"
                  autoFocusHere
                  value={salary}
                  min={minSalary}
                  max={maxSalary}
                  step={step}
                  pageStep={step * 4}
                  onChange={setSalary}
                  valueText={(v) => `$${v.toFixed(1)} million per season`}
                  marks={raiseMark}
                  ticks={[`$${minSalary.toFixed(1)}M`, `$${maxSalary.toFixed(1)}M`]}
                />
                <p className="ctb-field-hint">
                  {mode === 'market'
                    ? 'Starts at the asking salary. The market path never takes less.'
                    : mode === 'renew' ? `Starts at their $${asking}M asking salary. The mark shows it.`
                    : mode === 'salary' ? 'The mark is their current salary. A raise is always accepted; a cut needs their agreement.'
                    : raiseMark.length
                      ? 'The amber mark is a 20% raise — the point where the money offer becomes available.'
                      : 'Starts at their current salary. At this resistance a raise does not change the odds.'}
                </p>
              </div>
              {mode !== 'salary' && <div className="ctb-field">
                <div className="ctb-field-head">
                  <label className="ctb-field-label" htmlFor={seasonsId}>Length</label>
                  <span className="ctb-field-value">{seasonsText(seasons)}</span>
                </div>
                <Slider
                  id={seasonsId}
                  label="Contract length"
                  value={seasons}
                  min={CONTRACT_LIMITS.minSeasons}
                  max={CONTRACT_LIMITS.maxSeasons}
                  step={1}
                  pageStep={2}
                  onChange={setSeasons}
                  valueText={(v) => seasonsText(v)}
                  ticks={[seasonsText(CONTRACT_LIMITS.minSeasons), seasonsText(CONTRACT_LIMITS.maxSeasons)]}
                />
                <p className="ctb-field-hint">{mode === 'renew' ? 'Replaces the seasons left on the deal. Drivers aged 34 or over prefer two seasons or fewer.' : "Sets the contract years shown on the driver. Length doesn't affect acceptance in the current rules."}</p>
              </div>}

              <div className="ctb-budget" aria-live="polite">
                <div className="ctb-stat">
                  <span className="ctb-stat-label">{mode === 'market' ? 'Cost' : 'Change in cost'} this season ({impact.racesLeft} races left)</span>
                  <span className="ctb-stat-value"><Tweened value={impact.thisSeason} format={signedMoney} /></span>
                </div>
                <div className="ctb-stat">
                  <span className="ctb-stat-label">Over the contract</span>
                  <span className="ctb-stat-value"><Tweened value={impact.overContract} format={signedMoney} /></span>
                </div>
                <div className="ctb-stat">
                  <span className="ctb-stat-label">Budget now</span>
                  <span className="ctb-stat-value">{money(impact.budget)}</span>
                </div>
                <div className="ctb-stat">
                  <span className="ctb-stat-label">Left after this season's salary</span>
                  <span className="ctb-stat-value" style={{ color: impact.remainingAfterSeason < 0 ? HUB.negative : HUB.textPrimary }}>
                    <Tweened value={impact.remainingAfterSeason} format={(v) => money(v)} />
                  </span>
                </div>
              </div>
              <p className="ctb-field-hint">Salary is charged at 1/24 per race weekend ({signedMoney(impact.perRace)} a race), before any other income or costs.</p>
            </div>

            <div>
              <OddsGauge odds={odds.odds} />
              <p className="ctb-rule">{odds.rule}</p>
              <ul className="ctb-factors" aria-label="What drives the odds">
                {odds.factors.map((f: any, i: number) => (
                  <li key={i} className="ctb-factor">
                    <span className="ctb-factor-dot" style={{ borderColor: factorColor(f.effect) }} aria-hidden="true" />
                    <span><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{f.effect === 'for' ? 'Helps: ' : f.effect === 'against' ? 'Hurts: ' : 'Note: '}</span>{f.text}</span>
                  </li>
                ))}
                {odds.failureOutcome && (
                  <li className="ctb-factor"><span className="ctb-factor-dot" style={{ borderColor: HUB.warning }} aria-hidden="true" /><span>{odds.failureOutcome}</span></li>
                )}
              </ul>
            </div>
          </div>
          <div className="ctb-foot">
            <div>
              {onTalk && (
                <button type="button" className={btnClass('ghost')} style={btn('ghost', 'md')} onClick={onTalk}>Talk it through instead</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={close}>Cancel</button>
              <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={send} disabled={sending || odds.odds <= 0}>
                {sending ? 'Sending…' : 'Send offer'}
              </button>
            </div>
          </div>
        </>
      )}
    </DriverToolsModal>
  );
}
