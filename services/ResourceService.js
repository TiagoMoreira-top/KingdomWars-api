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

    tick(village, kingLevel = 1)
    {
        const now = new Date();
        const lastUpdate = new Date(village.lastResourceUpdate);

        const secondsElapsed = (now - lastUpdate) / 1000;
        const hoursElapsed = secondsElapsed / 3600;

        const updatedResources = { ...village.resources.toObject() };
        const warehouseLvl = village.buildings.warehouse || 0;
        const perks = getPerkMultipliers(kingLevel);

        const baseCapacity = this.calculateCapacity(
            BUILDINGS.warehouse.storageBase,
            BUILDINGS.warehouse.growthFactor,
            warehouseLvl
        );
        const capacity = Math.floor(baseCapacity * (1 + perks.storageBonus));

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
            const hourlyRate = baseRate * (1 + perks.productionBonus);

            production[type] = Math.floor(hourlyRate);

            if (hoursElapsed > 0)
            {
                const gain = hourlyRate * hoursElapsed;
                const total = (village.resources[type] || 0) + gain;
                updatedResources[type] = Math.min(capacity, Math.floor(total));
            }
        });

        // 2. Process Gold (Infinite Capacity)
        const goldLevel = village.buildings.goldMine || 0;
        const baseGoldRate = this.calculateProduction(
            BUILDINGS.goldMine.productionBase,
            BUILDINGS.goldMine.growthFactor,
            goldLevel,
            'goldMine'
        );
        const goldRate = baseGoldRate * (1 + perks.productionBonus);

        production.gold = Math.floor(goldRate);

        if (hoursElapsed > 0)
        {
            const goldGain = goldRate * hoursElapsed;
            const totalGold = (village.resources.gold || 0) + goldGain;
            updatedResources.gold = Math.floor(totalGold);
        }

        // ✍️ Update the Village Record
        village.resources = updatedResources;
        village.production = production; // Save the rates to the DB
        village.lastResourceUpdate = now;

        return village;
    }
};

module.exports = ResourceService;