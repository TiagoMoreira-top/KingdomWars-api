const LEVEL_UP_GAINS = { health: 50, attack: 15, defense: 10, breathDamage: 20 };

class DragonService {
    static processHatching(village, now) {
        if (!village.dragons || village.dragons.length === 0) return village;

        village.dragons.forEach(dragon => {
            if (dragon.status === 'Hatching' && dragon.hatchUntil && now >= new Date(dragon.hatchUntil).getTime()) {
                dragon.status = 'Idle';
                dragon.hatchUntil = null;
            }
            if (dragon.status === 'Training' && dragon.trainingUntil && now >= new Date(dragon.trainingUntil).getTime()) {
                dragon.level += 1;
                dragon.maxHealth  += LEVEL_UP_GAINS.health;
                dragon.health      = dragon.maxHealth;
                dragon.attack     += LEVEL_UP_GAINS.attack;
                dragon.defense    += LEVEL_UP_GAINS.defense;
                dragon.breathDamage += LEVEL_UP_GAINS.breathDamage;
                dragon.status = 'Idle';
                dragon.trainingUntil = null;
            }
        });

        return village;
    }

    static getTrainingCost(level) {
        return {
            gold:  level * 2000,
            wood:  level * 500,
            clay:  level * 300,
            stone: level * 800,
        };
    }

    // Training duration in ms: level * 2 hours
    static getTrainingDurationMs(level) {
        return level * 2 * 60 * 60 * 1000;
    }
}

module.exports = DragonService;
