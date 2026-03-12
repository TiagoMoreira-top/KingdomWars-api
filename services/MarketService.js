const MarketService = {
    processMovements(village, now)
    {
        if (!village.merchantMovements || village.merchantMovements.length === 0)
        {
            return village;
        }

        const currentTime = new Date(now);
        const remainingMovements = [];
        
        // 📦 We pull the storage capacity set by ResourceService (or fallback)
        const capacity = village.resources.maxStorage || 1000;

        village.merchantMovements.forEach(move => 
        {
            const arrivalTime = new Date(move.arrivalTime);

            if (currentTime >= arrivalTime)
            {
                // 🏁 THE CARAVAN HAS ARRIVED
                if (!move.isReturning)
                {
                    // 🚚 PHASE 1: DELIVERY
                    // Add resources to the village treasury
                    for (const [res, amount] of Object.entries(move.resources))
                    {
                        if (res === 'gold')
                        {
                            village.resources.gold += amount;
                        }
                        else
                        {
                            const currentAmount = village.resources[res] || 0;
                            village.resources[res] = Math.min(capacity, currentAmount + amount);
                        }
                    }

                    // ↩️ PHASE 2: INITIATE RETURN JOURNEY
                    // Calculate duration based on when it was supposed to arrive vs when it started
                    // If startTime isn't stored, we assume a standard travel window
                    const startTime = move.createdAt || new Date(arrivalTime.getTime() - 300000);
                    const duration = arrivalTime.getTime() - new Date(startTime).getTime();

                    remainingMovements.push({
                        ...move.toObject(),
                        resources: {}, // Empty the wagons
                        isReturning: true,
                        arrivalTime: new Date(currentTime.getTime() + duration)
                    });

                    village.markModified('resources');
                }
                else
                {
                    // 🐎 PHASE 3: HOMECOMING
                    // Merchants are back at the stables and ready for new orders
                    village.merchants.available += move.merchantsUsed;
                    // We do not push to remainingMovements, so the movement is deleted
                }
            }
            else
            {
                // ⏳ Still traversing the realm
                remainingMovements.push(move);
            }
        });

        village.merchantMovements = remainingMovements;
        
        // ✍️ Mark modified for Mongoose to track nested array changes
        village.markModified('merchantMovements');
        village.markModified('merchants');

        return village;
    }
};

module.exports = MarketService;