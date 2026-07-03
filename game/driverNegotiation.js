export class NegotiationSession {
  constructor(driver, team) {
    this.driver = driver;
    this.team = team;
    this.driverMood = driver.morale || 75; 
    // Calculate initial resistance based on overall rating, age, and current role
    const rating = typeof driver.overallRating === 'function' ? driver.overallRating() : 75;
    
    // Higher rating = more resistance to being demoted.
    // Younger = slightly more willing if they have low experience.
    // High morale = slightly more willing to help the team.
    let baseResistance = rating - 60;
    if (baseResistance < 0) baseResistance = 0;
    
    if (driver.morale > 85) baseResistance -= 10;
    else if (driver.morale < 50) baseResistance += 15;

    // A hidden stat like professionalism helps
    const professionalism = driver.hiddenTraits?.professionalism || 60;
    if (professionalism > 80) baseResistance -= 15;

    this.resistance = baseResistance;
    this.history = [];
    this.status = 'ONGOING'; // 'ONGOING', 'ACCEPTED_RESERVE', 'LEFT_TEAM', 'RELEASED', 'CANCELLED'

    // Initial greeting
    this.currentDialogue = this._getInitialGreeting();
    this.options = this._getInitialOptions();
    
    this.history.push({ speaker: this.driver.name, text: this.currentDialogue });
  }

  _getInitialGreeting() {
    if (this.driverMood > 80) {
      return `Hey Boss, you wanted to see me? Things are going well, what's on your mind?`;
    } else if (this.driverMood > 50) {
      return `You asked for me? What do we need to discuss?`;
    } else {
      return `Look, if this is about my recent performances, I don't want to hear it. What do you want?`;
    }
  }

  _getInitialOptions() {
    return [
      { id: 'offer_reserve', text: "We need to make a change. We'd like you to step down to the Reserve role.", action: () => this.handleOfferReserve() },
      { id: 'terminate', text: "We are terminating your contract effective immediately.", action: () => this.handleTerminate() },
      { id: 'cancel', text: "Actually, never mind. Keep up the good work.", action: () => this.handleCancel() }
    ];
  }

  handleOfferReserve() {
    if (this.resistance < 20) {
      // Accepts easily
      this.currentDialogue = `I understand. If that's what is best for the team, I'll step back and help develop the car as a reserve driver.`;
      this.status = 'ACCEPTED_RESERVE';
      this.options = [{ id: 'finish', text: "Thank you. We appreciate your professionalism.", action: () => {} }];
    } else if (this.resistance < 40) {
      // Hesitant, can be convinced easily
      this.currentDialogue = `Reserve? I still have a lot of fight left in me... I'm not sure about this. Is this really the only option?`;
      this.options = [
        { id: 'convince_soft', text: "It's just for now. We need you to help us develop the car. You're crucial to the team.", action: () => this.handleConvince(true) },
        { id: 'convince_hard', text: "It's this or you leave the team. Your choice.", action: () => this.handleConvince(false) },
        { id: 'cancel', text: "You know what, forget I said anything. You keep your seat.", action: () => this.handleCancel() }
      ];
    } else {
      // Angry, high resistance
      this.currentDialogue = `You've got to be joking. After everything I've done? I am a race driver, not a test dummy! I won't accept a demotion.`;
      this.options = [
        { id: 'convince_hard', text: "You need to accept this, or we will have to terminate your contract.", action: () => this.handleConvince(false) },
        { id: 'convince_money', text: "We'll increase your salary by 20% if you accept the reserve role.", action: () => this.handleConvinceMoney() },
        { id: 'cancel', text: "Okay, calm down. Let's pretend this didn't happen.", action: () => this.handleCancel() }
      ];
    }
  }

  handleConvince(isSoft) {
    // Attempt to convince
    let successChance = 0;
    if (isSoft) {
      successChance = 60 - this.resistance; 
    } else {
      successChance = 40 - (this.resistance / 2);
    }

    if (Math.random() * 100 < successChance) {
      this.currentDialogue = `...Fine. I don't like it, but I'll do it. Don't expect me to be happy about it though.`;
      this.status = 'ACCEPTED_RESERVE';
      this.options = [{ id: 'finish', text: "We appreciate your cooperation.", action: () => {} }];
    } else {
      this.currentDialogue = `Absolutely not. If you don't think I'm good enough for a race seat, then I'm leaving. Consider my contract terminated!`;
      this.status = 'LEFT_TEAM';
      this.options = [{ id: 'finish', text: "If that's how you feel, goodbye.", action: () => {} }];
    }
  }

  handleConvinceMoney() {
    const successChance = 80 - (this.resistance / 3);
    if (Math.random() * 100 < successChance) {
      this.currentDialogue = `...Money talks, I suppose. I'll take the reserve role. But I'll be looking for a race seat elsewhere soon.`;
      this.status = 'ACCEPTED_RESERVE_MONEY'; // Need to handle 20% salary increase in UI
      this.options = [{ id: 'finish', text: "We have a deal.", action: () => {} }];
    } else {
      this.currentDialogue = `You think you can buy my pride? Keep your money. I'm leaving!`;
      this.status = 'LEFT_TEAM';
      this.options = [{ id: 'finish', text: "Suit yourself. Goodbye.", action: () => {} }];
    }
  }

  handleTerminate() {
    this.currentDialogue = `Wow. Just like that, huh? Fine. I'll pack my bags. You'll regret this.`;
    this.status = 'RELEASED';
    this.options = [{ id: 'finish', text: "Best of luck in your future endeavors.", action: () => {} }];
  }

  handleCancel() {
    this.currentDialogue = `...Right. Well, I've got a debrief to get to.`;
    this.status = 'CANCELLED';
    this.options = [{ id: 'finish', text: "[End Meeting]", action: () => {} }];
  }

  selectOption(optionId) {
    const option = this.options.find(o => o.id === optionId);
    if (option) {
      this.history.push({ speaker: 'You', text: option.text });
      option.action();
      this.history.push({ speaker: this.driver.name, text: this.currentDialogue });
    }
  }
}
