const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

const CensusService = {
    recalculateStats(village) {
        let totalUsed = 0;
        let totalHabitants = 0;
        let totalPoints = 0;

        Object.entries(village.buildings).forEach(([bKey, bLvl]) => {
            const config = BUILDINGS[bKey];
            if (!config || bLvl <= 0) return;

            totalPoints += Math.floor(
                (config.pointValue || 2) * Math.pow(config.pointFactor || 1.2, bLvl - 1)
            );

            if (bKey === 'farm') {
                totalHabitants = Math.floor(
                    config.populationBase * Math.pow(config.growthFactor, bLvl - 1)
                );
            } 
            
            if (config.basePop) {
                totalUsed += Math.floor(
                    config.basePop * Math.pow(config.popMultiplier, bLvl - 1)
                );
            }
        });

        (village.upgradeQueue || []).forEach((job) => {
            const config = BUILDINGS[job.building];
            if (!config || !config.basePop) return;
            
            const bLvlAtTimeOfUpgrade = village.buildings[job.building] || 0;
            const upgradePendingCount = village.upgradeQueue
                .filter((q, idx) => q.building === job.building && idx < village.upgradeQueue.indexOf(job))
                .length;
            
            const targetLvlForThisJob = bLvlAtTimeOfUpgrade + upgradePendingCount;

            totalUsed += Math.floor(
                config.basePop * Math.pow(config.popMultiplier, targetLvlForThisJob)
            );
        });
        
        Object.entries(village.army).forEach(([uKey, uAmount]) => {
            const uConfig = UNITS[uKey];
            if (uConfig && uAmount > 0) {
                totalUsed += (uAmount * uConfig.population);
            }
        });

        ['trainingQueue', 'stableQueue', 'workshopQueue'].forEach(qKey => {
            (village[qKey] || []).forEach(job => {
                const uConfig = UNITS[job.unitKey];
                if (uConfig) {
                    totalUsed += (job.unitsLeft * uConfig.population);
                }
            });
        });

        village.points = totalPoints;
        village.population = {
            habitants: totalHabitants,
            used: totalUsed
        };

        village.markModified('population');
        return village;
    }
};

module.exports = CensusService;