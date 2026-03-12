const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

const CensusService = {
    recalculateStats(village)
    {
        let totalUsed = 0;
        let totalHabitants = 0;
        let totalPoints = 0;
        let marketLvl = 0;

        // --- BUILDINGS & BASIC POPULATION ---
        Object.entries(village.buildings).forEach(([bKey, bLvl]) =>
        {
            const config = BUILDINGS[bKey];
            if (!config || bLvl <= 0) return;

            totalPoints += Math.floor(
                (config.pointValue || 2) * Math.pow(config.pointFactor || 1.2, bLvl - 1)
            );

            if (bKey === 'farm')
            {
                totalHabitants = Math.floor(
                    config.populationBase * Math.pow(config.growthFactor, bLvl - 1)
                );
            }

            if (bKey === 'market')
            {
                marketLvl = bLvl;
            }

            if (config.basePop)
            {
                totalUsed += Math.floor(
                    config.basePop * Math.pow(config.popMultiplier, bLvl - 1)
                );
            }
        });

        // --- UPGRADE QUEUE RESERVATION ---
        (village.upgradeQueue || []).forEach((job) =>
        {
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

        // --- ARMY POPULATION ---
        Object.entries(village.army).forEach(([uKey, uAmount]) =>
        {
            const uConfig = UNITS[uKey];
            if (uConfig && uAmount > 0)
            {
                totalUsed += (uAmount * uConfig.population);
            }
        });

        // --- RECRUITMENT QUEUES ---
        ['trainingQueue', 'stableQueue', 'workshopQueue'].forEach(qKey =>
        {
            (village[qKey] || []).forEach(job =>
            {
                const uConfig = UNITS[job.unitKey];
                if (uConfig)
                {
                    totalUsed += (job.unitsLeft * uConfig.population);
                }
            });
        });

        // --- MERCHANT CALCULATIONS ---
        const mConfig = BUILDINGS.market;
        let totalMerchants = 0;

        if (marketLvl > 0 && mConfig)
        {
            totalMerchants = Math.floor(
                (mConfig.merchantsBase || 1) * Math.pow(mConfig.growthFactor || 1.1, marketLvl - 1)
            );
        }

        // Calculate used merchants from offers (1 per 1000 res)
        const merchantsInOffers = (village.marketOffers || []).reduce((sum, offer) =>
        {
            return sum + Math.ceil(offer.offeredAmount / 1000);
        }, 0);

        // Calculate merchants currently in transit
        const merchantsInMovement = (village.merchantMovements || []).reduce((sum, move) =>
        {
            return sum + (move.merchantsUsed || 0);
        }, 0);

        village.merchants = {
            total: totalMerchants,
            available: Math.max(0, totalMerchants - merchantsInOffers - merchantsInMovement)
        };

        // --- UPDATE TOTALS ---
        village.points = totalPoints;
        village.population = {
            habitants: totalHabitants,
            used: totalUsed
        };

        village.markModified('population');
        village.markModified('merchants');

        return village;
    }
};

module.exports = CensusService;