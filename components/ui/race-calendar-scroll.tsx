"use client";

import * as React from "react";
import { CalendarDays, Flag, Hammer, Wrench } from "lucide-react";
import XScroll from "./x-scroll";
import { Separator } from "./separator";

export interface RaceTimelineItem {
  round: number;
  name: string;
  dateLabel: string;
  laps: number;
  status: "completed" | "today" | "upcoming";
}

interface RaceCalendarScrollProps {
  races: RaceTimelineItem[];
  currentDayLabel: string;
  nextUpgradeLabel: string;
}

export function RaceCalendarScroll({
  races,
  currentDayLabel,
  nextUpgradeLabel,
}: RaceCalendarScrollProps) {
  return (
    <div className="glass dashboard-timeline-shell">
      <div className="dashboard-timeline-head">
        <div>
          <p className="dashboard-eyebrow">Season Timeline</p>
          <h3>Race Calendar + Development Clock</h3>
        </div>
        <div className="dashboard-timeline-meta">
          <span className="dashboard-timeline-chip">
            <CalendarDays size={14} />
            {currentDayLabel}
          </span>
          <span className="dashboard-timeline-chip">
            <Wrench size={14} />
            {nextUpgradeLabel}
          </span>
        </div>
      </div>

      <Separator className="my-3 bg-white/10" />

      <XScroll className="dashboard-race-scroll">
        <div className="dashboard-race-row">
          {races.map(race => (
            <article
              key={race.round}
              className={`dashboard-race-card dashboard-race-card--${race.status}`}
            >
              <div className="dashboard-race-card-head">
                <span className="dashboard-race-round">R{race.round}</span>
                <span className="dashboard-race-status">
                  <Flag size={13} />
                  {race.status === "completed"
                    ? "Completed"
                    : race.status === "today"
                      ? "Race Day"
                      : "Upcoming"}
                </span>
              </div>
              <h4>{race.name}</h4>
              <p>{race.dateLabel}</p>
              <p className="dashboard-race-laps">
                <Hammer size={12} />
                {race.laps} laps
              </p>
            </article>
          ))}
        </div>
      </XScroll>
    </div>
  );
}
