export class Driver {
  constructor(name, pace, quali, racecraft, tyre, wet, consistency, market, salary, age, category) {
    Object.assign(this, {
      name, pace, quali, racecraft, tyre, wet,
      consistency, market, salary, age, category
    });

    // ── Academy extended attributes (defaults for backward compat) ──
    if (this.adaptability === undefined) this.adaptability = this.racecraft || 70;
    if (this.feedback === undefined) this.feedback = Math.round((this.consistency || 70) * 0.95);
    if (this.mentality === undefined) this.mentality = Math.round(((this.pace || 70) + (this.consistency || 70)) / 2);
    if (this.mediaHandling === undefined) this.mediaHandling = 60;
    if (this.fitness === undefined) this.fitness = 75;
    if (this.developmentRate === undefined) this.developmentRate = age <= 21 ? 80 : age <= 25 ? 65 : 45;

    // ── Potential & hidden traits ──
    if (this.potentialCeiling === undefined) this.potentialCeiling = Math.min(99, Math.round((this.pace || 70) * 1.05 + 3));
    if (this.hiddenTraits === undefined) this.hiddenTraits = {
      workEthic: 60 + Math.floor(Math.random() * 30),
      professionalism: 60 + Math.floor(Math.random() * 30),
      pressureResistance: 55 + Math.floor(Math.random() * 35),
    };

    // ── Contract system ──
    if (this.contractType === undefined) this.contractType = category === 'F1' ? 'race' : 'none';
    if (this.contractYearsRemaining === undefined) this.contractYearsRemaining = 2;

    // ── Role hierarchy: 'academy' | 'reserve' | 'second' | 'lead' | null ──
    if (this.driverRole === undefined) this.driverRole = null;

    // ── Loan status ──
    if (this.loanStatus === undefined) this.loanStatus = null;

    // ── Career timeline (array of { seasonYear, event, detail }) ──
    if (this.careerTimeline === undefined) this.careerTimeline = [];

    // ── Morale ──
    if (this.morale === undefined) this.morale = 75;

    // ── Personality & driving style ──
    if (this.preferredStyle === undefined) this.preferredStyle = null;
    if (this.personality === undefined) this.personality = null;
  }

  errorChance() {
    return (100 - this.consistency) / 100;
  }

  /** Average of the 6 core racing attributes */
  overallRating() {
    return Math.round(
      (this.pace + this.quali + this.racecraft + this.consistency + this.tyre + this.wet) / 6
    );
  }

  /** Average of the visible "big 4" stats */
  currentRating() {
    return Math.round(
      (this.pace + this.quali + this.racecraft + this.consistency) / 4
    );
  }
}
