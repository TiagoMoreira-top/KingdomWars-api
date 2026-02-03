const resolveBattle = async (movement, origin, target) => {
    // 1. Calculate Combat Power (Simplified)
    // Attackers: Swordsmen (Offense), Defenders: Spearmen (Defense)
    const attackPower = (movement.units.swordsman * 40) + (movement.units.spearman * 10);
    const defensePower = (target.units.spearman * 50) + (target.units.swordsman * 15);

    if (attackPower > defensePower) {
        // ATTACKER WINS
        const casualtyRate = defensePower / attackPower;
        
        // Target loses all troops
        target.units = { spearman: 0, swordsman: 0, archer: 0 };

        // Check for Conquest (If Noble is present - we'll add this unit later)
        // For now, let's assume any successful attack with Swordsmen reduces loyalty
        const loyaltyDrop = Math.floor(Math.random() * 20) + 20; // Drops 20-40%
        target.loyalty -= loyaltyDrop;

        if (movement.units.noble > 0 && attackPower > defensePower) {
            // Only drop loyalty if a Noble survived the battle
            const loyaltyDrop = Math.floor(Math.random() * 15) + 20; // 20-35%
            target.loyalty -= loyaltyDrop;
            
            if (target.loyalty <= 0) {
                target.ownerId = movement.ownerId;
                // The noble is "consumed" to become the new governor
                // (This happens in the movement cleanup)
            }
        }

        if (target.loyalty <= 0) {
            // THE CONQUEST
            target.ownerId = movement.ownerId; // Change Owner!
            target.loyalty = 25; // New villages start with low loyalty
            target.name = `Conquered by ${origin.ownerId}`;
        }
    } else {
        // DEFENDER WINS
        // Attacking army is wiped out
        movement.isCompleted = true; 
    }
    
    await target.save();
    return;
};