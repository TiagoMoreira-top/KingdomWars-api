const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

const ResourceService = {
    calculateProduction(base, multiplier, level) {
        if (level === 0) return 5; // Base survival production
        return Math.floor(base * Math.pow(multiplier, level - 1));
    },

    calculateCapacity(base, multiplier, level) {
        if (level === 0) return 1000;
        return Math.floor(base * Math.pow(multiplier, level - 1));
    },

    tick(village) {
        const now = new Date();
        const lastUpdate = new Date(village.lastResourceUpdate);
        
        const secondsElapsed = (now - lastUpdate) / 1000;
        const hoursElapsed = secondsElapsed / 3600;

        const updatedResources = { ...village.resources.toObject() };
        const warehouseLvl = village.buildings.warehouse || 0;
        
        const capacity = this.calculateCapacity(
            BUILDINGS.warehouse.storageBase,
            BUILDINGS.warehouse.growthFactor,
            warehouseLvl
        );

        updatedResources.maxStorage = capacity;

        // 📜 Initialize the Production Ledger
        const production = {};
        const types = ['wood', 'clay', 'stone'];

        types.forEach(type => {
            const buildingKey = `${type}Farm`;
            const level = village.buildings[buildingKey] || 0;
            
            const hourlyRate = this.calculateProduction(
                BUILDINGS[buildingKey].productionBase,
                BUILDINGS[buildingKey].growthFactor,
                level
            );

            // 💰 Record the current rate for the Monarch's Topbar
            production[type] = Math.floor(hourlyRate);

            if (hoursElapsed > 0) {
                const gain = hourlyRate * hoursElapsed;
                const total = (village.resources[type] || 0) + gain;
                updatedResources[type] = Math.min(capacity, Math.floor(total));
            }
        });

        // ✍️ Update the Village Record
        village.resources = updatedResources;
        village.production = production; // Save the rates to the DB
        village.lastResourceUpdate = now;
        
        return village;
    }
};

module.exports = ResourceService;