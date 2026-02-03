const Village = require('../Models/Village');
const Movement = require('../Models/Movement');

exports.sendTroops = async (req, res) => {
    try {
        const { originId, destinationId, units } = req.body;
        
        const origin = await Village.findById(originId);
        const target = await Village.findById(destinationId);

        if (!origin || !target) return res.status(404).json({ error: "Village not found" });

        // 1. VALIDATION: Check if they actually have the troops
        if (origin.army.spearman < units.spearman || 
            origin.army.swordsman < units.swordsman || 
            origin.army.archer < units.archer) {
            return res.status(400).json({ error: "Not enough troops in the garrison!" });
        }

        // 2. DISTANCE MATH
        const dist = Math.sqrt(
            Math.pow(target.x - origin.x, 2) + 
            Math.pow(target.y - origin.y, 2)
        );

        const travelTimeSeconds = Math.floor(dist * 60); 
        const arrivalTime = new Date(Date.now() + (travelTimeSeconds * 1000));

        // 3. DEDUCTION: Move troops out of the village
        origin.army.spearman -= units.spearman;
        origin.army.swordsman -= units.swordsman;
        origin.army.archer -= units.archer;

        // Tell Mongoose the nested 'army' object changed
        origin.markModified('army');
        await origin.save();

        // 4. CREATE MOVEMENT
        const march = new Movement({
            originId,
            destinationId,
            ownerId: origin.ownerId,
            units,
            arrivalTime
        });

        await march.save();
        res.json({ message: "Troops are marching!", arrivalTime });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const processAttack = async (movement) => {
    const origin = await Village.findById(movement.originId);
    const target = await Village.findById(movement.destinationId);

    // 1. Define Stats
    const stats = {
        spearman: { off: 10, def: 15 },
        swordsman: { off: 25, def: 50 },
        archer: { off: 15, def: 5 }
    };

    // 2. Calculate Attacker Power
    let attackerPower = 0;
    for (const unit in movement.units) {
        attackerPower += (movement.units[unit] || 0) * stats[unit].off;
    }

    // 3. Calculate Defender Power
    let defenderPower = 0;
    for (const unit in target.army) {
        defenderPower += (target.army[unit] || 0) * stats[unit].def;
    }

    // 4. Determine Winner and Casualties
    const totalPower = attackerPower + defenderPower;
    if (totalPower === 0) return finalizeMovement(movement);

    // Percentage of loss is based on the ratio of the opponent's power
    const attackerLossRatio = Math.min(defenderPower / attackerPower, 1);
    const defenderLossRatio = Math.min(attackerPower / defenderPower, 1);

    // Apply casualties to Attacker (Movement units)
    for (const unit in movement.units) {
        movement.units[unit] = Math.floor(movement.units[unit] * (1 - attackerLossRatio));
    }

    // Apply casualties to Defender (Village army)
    for (const unit in target.army) {
        target.army[unit] = Math.floor(target.army[unit] * (1 - defenderLossRatio));
    }

    // 5. Looting (If attacker won)
    let loot = { wood: 0, clay: 0, iron: 0 };
    if (attackerPower > defenderPower) {
        const capacity = Object.values(movement.units).reduce((a, b) => a + b, 0) * 10; // 10 resources per surviving unit
        
        // Simple 1/3 split of resources from target
        loot.wood = Math.min(Math.floor(target.resources.wood * 0.5), capacity / 3);
        loot.clay = Math.min(Math.floor(target.resources.clay * 0.5), capacity / 3);
        loot.iron = Math.min(Math.floor(target.resources.iron * 0.5), capacity / 3);

        target.resources.wood -= loot.wood;
        target.resources.clay -= loot.clay;
        target.resources.iron -= loot.iron;
    }

    // 6. Save target village state
    target.markModified('army');
    await target.save();

    // 7. Create Return Movement
    await createReturnMovement(movement, loot);
};

const createReturnMovement = async (oldMovement, loot) => {
    const travelTime = oldMovement.arrivalTime.getTime() - new Date(oldMovement.startTime || Date.now()).getTime(); // Same time as before
    
    const returnTrip = new Movement({
        originId: oldMovement.destinationId, // Coming from target
        destinationId: oldMovement.originId, // Going back home
        ownerId: oldMovement.ownerId,
        type: 'return',
        units: oldMovement.units,
        arrivalTime: new Date(Date.now() + travelTime),
        loot: loot // You'll need to add a 'loot' field to your Movement schema!
    });

    await returnTrip.save();
    oldMovement.isCompleted = true;
    await oldMovement.save();
};