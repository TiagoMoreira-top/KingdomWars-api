const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');
const { getPerkMultipliers } = require('../config/kingPerks');

const ResourceService = {
    calculateProduction(base, multiplier, level, buildingKey = '')
    {
        // 🪙 Gold Mines at level 0 produce nothing.
        if (level === 0 && buildingKey === 'goldMine') 
        {
            return 0;
        }

        // 🪵 Standard resources provide base survival production at level 0
        if (level === 0) 
        {
            return 5;
        }

        return Math.floor(base * Math.pow(multiplier, level - 1));
    },

    calculateCapacity(base, multiplier, level) {
        if (level === 0) return 1000;
        return Math.floor(base * Math.pow(multiplier, level - 1));
    },

    tick(village, kingLevel = 1, mods = null)
    {
        const now = new Date();
        const lastUpdate = new Date(village.lastResourceUpdate);

        const secondsElapsed = (now - lastUpdate) / 1000;
        const hoursElapsed = secondsElapsed / 3600;

        const updatedResources = { ...village.resources.toObject() };
        const warehouseLvl = village.buildings.warehouse || 0;
        // 👑 `kingLevel` may now be the whole WorldPlayer; the shim handles both.
        const perks = getPerkMultipliers(kingLevel);

        // 🩸📜 Race traits and completed studies stack additively on top of
        // the king's perks. A Sylvan lord with Crop Rotation gets both.
        const m = mods || {};
        const bonusFor = {
            wood:  m.woodProduction  || 0,
            clay:  m.clayProduction  || 0,
            stone: m.stoneProduction || 0,
        };

        const baseCapacity = this.calculateCapacity(
            BUILDINGS.warehouse.storageBase,
            BUILDINGS.warehouse.growthFactor,
            warehouseLvl
        );
        const capacity = Math.floor(baseCapacity * (1 + perks.storageBonus + (m.storage || 0)));

        updatedResources.maxStorage = capacity;

        // 📜 Initialize the Production Ledger
        const production = {};
        const standardTypes = ['wood', 'clay', 'stone'];

        // 1. Process Standard Resources (Capped by Warehouse)
        standardTypes.forEach(type => 
        {
            const buildingKey = `${type}Farm`;
            const level = village.buildings[buildingKey] || 0;

            const baseRate = this.calculateProduction(
                BUILDINGS[buildingKey].productionBase,
                BUILDINGS[buildingKey].growthFactor,
                level,
                buildingKey
            );
            const hourlyRate = baseRate * (1 + perks.productionBonus + bonusFor[type]);

            production[type] = Math.floor(hourlyRate);

            if (hoursElapsed > 0)
            {
                const gain = hourlyRate * hoursElapsed;
                const total = (village.resources[type] || 0) + gain;
                updatedResources[type] = Math.min(capacity, Math.floor(total));
            }
        });

        // 2. 🪙 THE TREASURY — bounded by the Gold Mine, not infinite.
        // A mine that has nowhere to put its output stops being worth digging,
        // which is what makes the Royal Mint and a vaulted treasury matter.
        const goldLevel = village.buildings.goldMine || 0;

        const mintLevel = village.buildings.mint || 0;
        const mintEffect = (BUILDINGS.mint && BUILDINGS.mint.effect) || {};
        const mintCapBonus = mintLevel * (mintEffect.goldCapacityPerLevel || 0);
        const mintRateBonus = mintLevel * (mintEffect.goldProductionPerLevel || 0);

        const goldCapacity = goldLevel === 0
            ? 0
            : Math.floor(
                BUILDINGS.goldMine.storageBase * Math.pow(BUILDINGS.goldMine.storageFactor, goldLevel - 1)
                * (1 + perks.storageBonus + (m.goldStorage || 0) + mintCapBonus)
              );

        updatedResources.maxGold = goldCapacity;

        const baseGoldRate = this.calculateProduction(
            BUILDINGS.goldMine.productionBase,
            BUILDINGS.goldMine.growthFactor,
            goldLevel,
            'goldMine'
        );
        const goldRate = baseGoldRate * (1 + perks.productionBonus + (m.goldProduction || 0) + mintRateBonus);

        production.gold = Math.floor(goldRate);

        if (hoursElapsed > 0)
        {
            const totalGold = (village.resources.gold || 0) + goldRate * hoursElapsed;
            updatedResources.gold = Math.min(goldCapacity, Math.floor(totalGold));
        }
        else
        {
            // A shrunken cap (or none at all) still binds what is already held.
            updatedResources.gold = Math.min(goldCapacity, village.resources.gold || 0);
        }

        // ✍️ Update the Village Record
        village.resources = updatedResources;
        village.production = production; // Save the rates to the DB
        village.lastResourceUpdate = now;

        return village;
    }
};

module.exports = ResourceService;