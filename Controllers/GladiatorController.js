exports.trainGladiator = async (req, res) =>
{
    try
    {
        const { villageID } = req.params;
        const { gladiatorId } = req.body;

        const VillageModel = req.getVillageModel();
        const GladiatorModel = req.getGladiatorModel();

        const village = await VillageModel.findById(villageID);
        const gladiator = await GladiatorModel.findById(gladiatorId);

        if (!village || !gladiator)
        {
            return res.status(404).json({ error: "🏰 MYSTERY: The chronicles show no such warrior or village." });
        }

        // 🛡️ STATUS CHECK: Cannot train if already training or dead
        if (gladiator.status !== 'Idle')
        {
            return res.status(400).json({ error: "⚔️ BUSY: This warrior is already occupied with another task." });
        }

        // ⚖️ CALCULATE THE TRIBUTE
        const currentLevel = Number(gladiator.level) || 1;
        const cost = {
            gold: currentLevel * 500,
            wood: currentLevel * 100,
            clay: currentLevel * 100,
            stone: currentLevel * 100
        };

        // 💰 VERIFY THE TREASURY
        if (
            village.resources.gold < cost.gold ||
            village.resources.wood < cost.wood ||
            village.resources.clay < cost.clay ||
            village.resources.stone < cost.stone
        )
        {
            return res.status(400).json({ error: "🪙 POVERTY: Thy treasury is too shallow for this master's fee." });
        }

        // 🛠️ EXPEND RESOURCES
        village.resources.gold -= cost.gold;
        village.resources.wood -= cost.wood;
        village.resources.clay -= cost.clay;
        village.resources.stone -= cost.stone;
        
        village.markModified('resources');
        await village.save();

        // ⏳ COMMENCE TRAINING
        // Duration: 1 minute (60,000ms) multiplied by current level
        const trainingDuration = currentLevel * 60 * 1000; 
        
        gladiator.status = 'Training';
        // We'll use the 'updatedAt' or a custom field, but let's assume you'll add 
        // 'trainingUntil' to your schema. If not, we can repurpose a field.
        gladiator.trainingUntil = new Date(Date.now() + trainingDuration);

        await gladiator.save();

        res.status(200).json({
            success: true,
            message: `${gladiator.name} has entered the training pits. Expect their return in ${currentLevel} minute(s).`,
            village: village,
            gladiator: gladiator
        });
    }
    catch (error)
    {
        console.error("Training Initiation Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The training pits have collapsed. The scribes cannot proceed." });
    }
};