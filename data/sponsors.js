export const sponsors = [
  // TITLE SPONSORS
  { id: "sp_t_1", slot: "Title", name: "Fly Emirates", industry: "Aviation", bonus: 35.0, fee: 4.80, perk: "Global Reach: +10% Fan Growth per win." },
  { id: "sp_t_2", slot: "Title", name: "Etihad Airways", industry: "Aviation", bonus: 32.0, fee: 4.60, perk: "Aerolink: +3% Aero development speed." },
  { id: "sp_t_3", slot: "Title", name: "Oracle", industry: "Tech/Cloud", bonus: 30.0, fee: 4.50, perk: "Data Edge: +3% Strategy Accuracy." },
  { id: "sp_t_4", slot: "Title", name: "Mastercard", industry: "FinTech", bonus: 28.0, fee: 4.20, perk: "Priceless: +5% Weekly Merch Sales." },
  { id: "sp_t_5", slot: "Title", name: "HP", industry: "Computing", bonus: 25.0, fee: 3.80, perk: "Precision: -5% Pit Stop Time." },
  { id: "sp_t_6", slot: "Title", name: "Petronas", industry: "Energy", bonus: 22.0, fee: 3.50, perk: "Thermal: +2% Engine Reliability." },
  { id: "sp_t_7", slot: "Title", name: "Aramco", industry: "Energy", bonus: 20.0, fee: 3.60, perk: "Sustainable: -5% Fuel Weight." },
  { id: "sp_t_8", slot: "Title", name: "Revolut", industry: "Banking", bonus: 18.0, fee: 3.20, perk: "Fast Finance: -10% Facility Upgrade costs." },
  { id: "sp_t_9", slot: "Title", name: "Atlassian", industry: "Software", bonus: 18.0, fee: 3.00, perk: "Teamwork: +3% Staff Morale." },

  // KIT SPONSORS
  { id: "sp_k_1", slot: "Kit", name: "Nike", industry: "Apparel", bonus: 12.0, fee: 1.60, perk: "Elite: +2 Driver Market Value." },
  { id: "sp_k_2", slot: "Kit", name: "Adidas", industry: "Apparel", bonus: 10.0, fee: 1.40, perk: "Performance: +2% Driver Pace." },
  { id: "sp_k_3", slot: "Kit", name: "Puma", industry: "Apparel", bonus: 9.0, fee: 1.30, perk: "Lightweight: -2kg Chassis Weight." },
  { id: "sp_k_4", slot: "Kit", name: "Under Armour", industry: "Fitness", bonus: 8.0, fee: 1.20, perk: "Stamina: -10% Driver Fatigue." },
  { id: "sp_k_5", slot: "Kit", name: "Castore", industry: "Apparel", bonus: 6.5, fee: 1.00, perk: "Agile: Faster Contract Signings." },

  // SIDEPOD SPONSORS
  { id: "sp_s_1", slot: "Sidepod", name: "Meta AI", industry: "Technology", bonus: 12.0, fee: 2.00, perk: "Simulated: +5% Wind Tunnel hours." },
  { id: "sp_s_2", slot: "Sidepod", name: "Snapdragon", industry: "Hardware", bonus: 10.0, fee: 1.85, perk: "Processing: +3% ERS Efficiency." },
  { id: "sp_s_3", slot: "Sidepod", name: "AWS", industry: "Cloud", bonus: 9.5, fee: 1.75, perk: "Predictive: +2% Strategy Gain." },
  { id: "sp_s_4", slot: "Sidepod", name: "Google Chrome", industry: "Browser", bonus: 9.0, fee: 1.70, perk: "Speed: +1% Top Speed." },
  { id: "sp_s_5", slot: "Sidepod", name: "Bybit", industry: "Crypto", bonus: 11.0, fee: 1.90, perk: "Volatility: Random Bonus $$$ on Wins." },

  // REAR WING SPONSORS
  { id: "sp_rw_1", slot: "Rear Wing", name: "Monster Energy", industry: "Beverage", bonus: 6.0, fee: 1.10, perk: "Punchy: +2% Overtake Success." },
  { id: "sp_rw_2", slot: "Rear Wing", name: "Pirelli", industry: "Tires", bonus: 5.5, fee: 1.00, perk: "Traction: +2% Tire Life." },
  { id: "sp_rw_3", slot: "Rear Wing", name: "Mobil 1", industry: "Lubricants", bonus: 5.0, fee: 0.95, perk: "Flow: -3% Friction Wear." },
  { id: "sp_rw_4", slot: "Rear Wing", name: "Shell", industry: "Fuel", bonus: 5.2, fee: 0.90, perk: "Ignition: +1% Acceleration." },

  // HALO SPONSORS
  { id: "sp_h_1", slot: "Halo", name: "Delta Air Lines", industry: "Travel", bonus: 3.5, fee: 0.70, perk: "Fast Track: Lower Travel Costs." },
  { id: "sp_h_2", slot: "Halo", name: "Perplexity", industry: "AI Search", bonus: 3.2, fee: 0.65, perk: "Answer: Faster Part Discovery." },
  { id: "sp_h_3", slot: "Halo", name: "Ray-Ban", industry: "Eyewear", bonus: 3.0, fee: 0.75, perk: "Vision: +3% Reaction Time." },
  { id: "sp_h_4", slot: "Halo", name: "Claude (AI)", industry: "AI", bonus: 3.4, fee: 0.80, perk: "Logic: -5% Strategy Errors." }
];

export const SPONSOR_SLOTS = [
  { key: "title", label: "Title Sponsor", placement: "Title" },
  { key: "kit", label: "Kit Sponsor", placement: "Kit" },
  { key: "sidepod", label: "Sidepod Sponsor", placement: "Sidepod" },
  { key: "rearWing", label: "Rear Wing Sponsor", placement: "Rear Wing" },
  { key: "halo", label: "Halo Sponsor", placement: "Halo" }
];

const PARTNER_PROFILES = {
  "Tech/Cloud": { partnerType: "Technology Partner", contractLength: 14, performanceBonus: 2.4, strategicBenefit: "Improves R&D efficiency" },
  "Technology": { partnerType: "Technology Partner", contractLength: 12, performanceBonus: 2.1, strategicBenefit: "Improves R&D efficiency" },
  "Cloud": { partnerType: "Technology Partner", contractLength: 12, performanceBonus: 2.0, strategicBenefit: "Improves R&D efficiency" },
  "Hardware": { partnerType: "Engineering Supplier", contractLength: 11, performanceBonus: 1.8, strategicBenefit: "Improves upgrade development" },
  "Energy": { partnerType: "Fuel Partner", contractLength: 16, performanceBonus: 1.9, strategicBenefit: "Improves reliability" },
  "Fuel": { partnerType: "Fuel Partner", contractLength: 13, performanceBonus: 1.5, strategicBenefit: "Improves reliability" },
  "Lubricants": { partnerType: "Fuel Partner", contractLength: 12, performanceBonus: 1.4, strategicBenefit: "Improves reliability" },
  "FinTech": { partnerType: "Financial Partner", contractLength: 10, performanceBonus: 2.2, strategicBenefit: "Highest monthly income" },
  "Banking": { partnerType: "Financial Partner", contractLength: 10, performanceBonus: 1.8, strategicBenefit: "Highest monthly income" },
  "Eyewear": { partnerType: "Luxury Brand", contractLength: 9, performanceBonus: 1.2, strategicBenefit: "Improves reputation" },
  "Aviation": { partnerType: "Luxury Brand", contractLength: 15, performanceBonus: 2.5, strategicBenefit: "Improves reputation" },
};

sponsors.forEach((sponsor) => {
  const profile = PARTNER_PROFILES[sponsor.industry] || { partnerType: "Commercial Partner", contractLength: 8, performanceBonus: sponsor.fee * 0.7, strategicBenefit: sponsor.perk };
  sponsor.signingBonus = sponsor.signingBonus ?? sponsor.bonus;
  sponsor.monthlyIncome = sponsor.monthlyIncome ?? sponsor.fee;
  sponsor.performanceBonus = sponsor.performanceBonus ?? Number(profile.performanceBonus.toFixed(1));
  sponsor.contractLength = sponsor.contractLength ?? profile.contractLength;
  sponsor.partnerType = sponsor.partnerType ?? profile.partnerType;
  sponsor.strategicBenefit = sponsor.strategicBenefit ?? profile.strategicBenefit;
  sponsor.brandPrestige = sponsor.brandPrestige ?? Math.min(99, Math.round(48 + sponsor.bonus * 1.35 + sponsor.fee * 5));
  sponsor.relationshipLevel = sponsor.relationshipLevel ?? 65;
});
