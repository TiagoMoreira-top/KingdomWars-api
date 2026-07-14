class GladiatorService {
  static processTraining(village, now) {
    if (!village.gladiators || village.gladiators.length === 0) return village;

    village.gladiators.forEach(glad => {
      if (glad.status === 'Training' && glad.trainingUntil && now >= new Date(glad.trainingUntil).getTime()) {
        glad.level += 1;
        glad.battlePoints += Math.floor(Math.random() * 11) + 10; // 10–20 BP gain
        glad.maxHealth += 25;
        glad.health = glad.maxHealth;
        glad.status = 'Idle';
        glad.trainingUntil = null;
      }
    });

    return village;
  }

  // Returns { winner, loser, attackerRoll, defenderRoll, damageDealt, fatal }
  static resolveFight(attacker, defender) {
    // Score = battlePoints * level + random(0..20)
    const attackerScore = (attacker.battlePoints || 10) * (attacker.level || 1) + Math.floor(Math.random() * 21);
    const defenderScore = (defender.battlePoints || 10) * (defender.level || 1) + Math.floor(Math.random() * 21);

    const attackerWins = attackerScore > defenderScore;
    const winner = attackerWins ? attacker : defender;
    const loser  = attackerWins ? defender : attacker;

    // Damage: 20–40% of loser's max health
    const damageDealt = Math.floor(loser.maxHealth * (0.20 + Math.random() * 0.20));
    loser.health = Math.max(0, loser.health - damageDealt);
    const fatal = loser.health <= 0;

    if (fatal) {
      loser.status = 'Dead';
    }

    // XP / BP gains for winner
    const xpGain = Math.floor(10 + (loser.level || 1) * 5);
    winner.experience = (winner.experience || 0) + xpGain;
    winner.battlePoints = (winner.battlePoints || 10) + Math.floor(xpGain / 3);

    // Level up winner if enough XP
    const xpNeeded = winner.level * 100;
    if (winner.experience >= xpNeeded) {
      winner.level += 1;
      winner.experience -= xpNeeded;
      winner.maxHealth += 25;
      winner.health = winner.maxHealth;
    }

    winner.wins = (winner.wins || 0) + 1;
    loser.losses  = (loser.losses  || 0) + 1;

    return {
      attackerWins,
      attackerScore,
      defenderScore,
      damageDealt,
      fatal,
      xpGain,
    };
  }
}

module.exports = GladiatorService;
