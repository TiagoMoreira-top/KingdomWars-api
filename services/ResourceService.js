const BUILDINGS = require('../config/buildings');

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
        
        // ⏳ Calculate time elapsed in hours
        const secondsElapsed = (now - lastUpdate) / 1000;
        const hoursElapsed = secondsElapsed / 3600;

        if (hoursElapsed <= 0) return village;

        const updatedResources = { ...village.resources.toObject() };
        const warehouseLvl = village.buildings.warehouse || 0;
        
        // Fetch storage capacity
        const capacity = this.calculateCapacity(
            BUILDINGS.warehouse.storageBase,
            BUILDINGS.warehouse.growthFactor,
            warehouseLvl
        );

        // 🪵 Update Wood, Clay, Stone
        const types = ['wood', 'clay', 'stone'];
        // Inside thy tick(village) function
        types.forEach(type => {
            const buildingKey = `${type}Farm`;
            const level = village.buildings[buildingKey] || 0;
            
            const hourlyRate = this.calculateProduction(
                BUILDINGS[buildingKey].productionBase,
                BUILDINGS[buildingKey].growthFactor,
                level
            );

            const gain = hourlyRate * hoursElapsed;
            
            // ✍️ Use Math.floor to keep integers in the ledger
            const total = updatedResources[type] + gain;
            updatedResources[type] = Math.min(capacity, Math.floor(total));
        });

        village.resources = updatedResources;
        village.lastResourceUpdate = now;
        
        return village;
    }
};

module.exports = ResourceService;