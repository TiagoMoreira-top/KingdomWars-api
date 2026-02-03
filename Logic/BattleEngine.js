exports.runBattle = async (movement, attackerVillage, defenderVillage) => {
    const stats = {
        spearman: { off: 10, def: 15 },
        swordsman: { off: 25, def: 50 },
        archer: { off: 15, def: 5 }
    };

    let atkPower = 0;
    let defPower = 0;

    // Calculate Power
    Object.keys(movement.units).forEach(u => atkPower += movement.units[u] * stats[u].off);
    Object.keys(defenderVillage.army).forEach(u => defPower += defenderVillage.army[u] * stats[u].def);

    const winner = atkPower > defPower ? 'attacker' : 'defender';
    
    // Loss calculation (standard 4X formula)
    const atkLossPerc = Math.min(defPower / atkPower, 1) || 1;
    const defLossPerc = Math.min(atkPower / defPower, 1) || 1;

    const reportData = {
        attackerUnits: {},
        defenderUnits: {},
        loot: { wood: 0, clay: 0, iron: 0 }
    };

    // Apply Attacker Losses
    Object.keys(movement.units).forEach(u => {
        const lost = Math.floor(movement.units[u] * atkLossPerc);
        reportData.attackerUnits[u] = { initial: movement.units[u], lost };
        movement.units[u] -= lost;
    });

    // Apply Defender Losses
    Object.keys(defenderVillage.army).forEach(u => {
        const lost = Math.floor(defenderVillage.army[u] * defLossPerc);
        reportData.defenderUnits[u] = { initial: defenderVillage.army[u], lost };
        defenderVillage.army[u] -= lost;
    });

    // Loot Logic (Attacker Capacity)
    if (winner === 'attacker') {
        const carryCapacity = Object.keys(movement.units).reduce((acc, u) => acc + (movement.units[u] * 20), 0);
        reportData.loot.wood = Math.min(Math.floor(defenderVillage.resources.wood * 0.5), carryCapacity / 3);
        // ... repeat for clay/iron
        defenderVillage.resources.wood -= reportData.loot.wood;
    }

    return { winner, reportData };
};