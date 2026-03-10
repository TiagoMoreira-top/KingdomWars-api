class GladiatorService
{
    static processTraining(village, now)
    {
        if (!village.gladiators || village.gladiators.length === 0)
        {
            return village;
        }

        village.gladiators.forEach(glad =>
        {
            // If the warrior is training and the hourglass has run out...
            if (glad.status === 'Training' && glad.trainingUntil && now >= new Date(glad.trainingUntil).getTime())
            {
                // ⚔️ Apply Level Up Rewards
                glad.level += 1;
                glad.battlePoints += Math.floor(Math.random() * 11) + 10; // 10-20 BP gain
                glad.maxHealth += 25;
                glad.health = glad.maxHealth; // Full heal on level up
                
                // 📜 Reset Status
                glad.status = 'Idle';
                glad.trainingUntil = null;
                
                // Mark as modified if using Mongoose and gladiators is an array of subdocs
                // glad.markModified('status'); 
            }
        });

        return village;
    }
}

module.exports = GladiatorService;