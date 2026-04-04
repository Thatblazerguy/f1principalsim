export class Driver {
  constructor(name, pace, quali, racecraft, tyre, wet, consistency, market, salary, age, category) {
    Object.assign(this, {
      name, pace, quali, racecraft, tyre, wet,
      consistency, market, salary, age, category
    });
  }

  errorChance() {
    return (100 - this.consistency) / 100;
  }
}
