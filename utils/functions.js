const syncVillageState = (village) => {
  const now = new Date();

  const completedActions = village.queue.filter(item => new Date(item.finishesAt) <= now);
  
  if (completedActions.length > 0) {
    completedActions.forEach(item => {
      village.buildings[item.buildingType] = item.level;
    });
    village.queue = village.queue.filter(item => new Date(item.finishesAt) > now);
  }

  const secondsElapsed = (now - new Date(village.resources.lastUpdate)) / 1000;
  const hoursElapsed = secondsElapsed / 3600;

  village.resources.wood += Math.floor((village.buildings.timberCamp * 30) * hoursElapsed);
  village.resources.clay += Math.floor((village.buildings.clayPit * 30) * hoursElapsed);
  village.resources.iron += Math.floor((village.buildings.ironMine * 25) * hoursElapsed);
  village.resources.lastUpdate = now;

  return village;
};

const calculateResources = (village) => {
  const now = new Date();
  const lastUpdate = new Date(village.resources.lastUpdate);
  const secondsElapsed = (now - lastUpdate) / 1000;
  const hoursElapsed = secondsElapsed / 3600;

  const rates = {
    wood: village.buildings.timberCamp * 30,
    clay: village.buildings.clayPit * 30,
    iron: village.buildings.ironMine * 25
  };

  return {
    wood: Math.floor(village.resources.wood + (rates.wood * hoursElapsed)),
    clay: Math.floor(village.resources.clay + (rates.clay * hoursElapsed)),
    iron: Math.floor(village.resources.iron + (rates.iron * hoursElapsed)),
    lastUpdate: now
  };
};

const calculateProduction = (base, multiplier, level) => {
    if (level === 0) return 5; // Base survival production
    return Math.floor(base * Math.pow(multiplier, level - 1));
};

module.exports = { syncVillageState, calculateResources, calculateProduction};