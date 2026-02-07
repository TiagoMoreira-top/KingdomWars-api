const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

const BuildingService = {
    processUpgrades(village, now) {
        const completedJobs = village.upgradeQueue.filter(job => job.finishTime <= now);
        if (completedJobs.length === 0) return village;

        let greatHallUpgraded = false;
        completedJobs.sort((a, b) => a.finishTime - b.finishTime);

        completedJobs.forEach(job => {
            const currentLevel = village.buildings[job.building] || 0;
            village.buildings[job.building] = currentLevel + 1;

            if (job.building === 'greatHall') greatHallUpgraded = true;

            const bConfig = BUILDINGS[job.building];
            if (bConfig) {
                village.points += (bConfig.pointValue || 2);
            }
            village.upgradeQueue.pull(job._id);
        });

        if (greatHallUpgraded && village.upgradeQueue.length > 0) {
            this.recalculateUpgradeQueueTimes(village, now);
        }

        village.markModified('buildings');
        village.markModified('upgradeQueue');
        return village;
    },

    recalculateUpgradeQueueTimes(village, now) {
        village.upgradeQueue.forEach((job, index) => {
            const bCfg = BUILDINGS[job.building];
            const ghLvl = village.buildings.greatHall || 0;
            
            const speedFactor = Math.max(0.1, 1 - (ghLvl * 0.03));
            const costMultiplierLevel = job.targetLevel - 1;
            
            const newDurationSeconds = Math.max(1, Math.floor(
                bCfg.baseBuildTime * Math.pow(bCfg.timeMultiplier || 1.2, costMultiplierLevel) * speedFactor
            ));

            const newStart = index === 0 ? now : village.upgradeQueue[index - 1].finishTime;
            job.startTime = newStart;
            job.finishTime = newStart + (newDurationSeconds * 1000);
        });
    }
};

module.exports = BuildingService;