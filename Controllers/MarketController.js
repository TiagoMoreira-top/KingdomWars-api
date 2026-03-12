const World = require('../Models/World');

exports.getOffers = async (req, res) =>
{
    try
    {
        // 📜 Utilizing the dynamic model to fetch from the dedicated table
        const MarketOfferModel = req.getMarketOfferModel();
        const offers = await MarketOfferModel.find().sort({ createdAt: -1 });

        res.status(200).json({ 
            success: true,
            offers: offers || [] 
        });
    }
    catch (error)
    {
        console.error("Market Browse Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The market scrolls have been burnt. We cannot read the listings." });
    }
};

exports.acceptOffer = async (req, res) =>
{
    try
    {
        const { villageID, offerID } = req.params;
        const VillageModel = req.getVillageModel();
        const MarketOfferModel = req.getMarketOfferModel();

        const buyerVillage = await VillageModel.findById(villageID);
        const offer = await MarketOfferModel.findById(offerID);

        if (!offer)
        {
            return res.status(404).json({ error: "📜 VANISHED: This offer has already been claimed or rescinded." });
        }

        // 🛡️ OWNER CHECK: Cannot trade with thyself
        if (offer.originVillageId.toString() === villageID)
        {
            return res.status(400).json({ error: "⚖️ FOLLY: You cannot accept your own trade proclamation." });
        }

        // 🐎 LOGISTICS: Option A - Buyer needs merchants to send 'wanted' resources
        const buyerMerchantsNeeded = Math.ceil(offer.wantedAmount / 1000);

        if (buyerVillage.merchants.available < buyerMerchantsNeeded)
        {
            return res.status(400).json({ error: "🐎 SHORTAGE: Not enough merchants are available for this haul." });
        }

        // 💰 VERIFY BUYER TREASURY
        if (buyerVillage.resources[offer.wantedRes] < offer.wantedAmount)
        {
            return res.status(400).json({ error: `🪙 POVERTY: You lack the ${offer.wantedRes} required for this pact.` });
        }

        const sellerVillage = await VillageModel.findById(offer.originVillageId);
        
        if (!sellerVillage)
        {
            return res.status(404).json({ error: "🏰 MYSTERY: The village that posted this offer has fallen into ruin." });
        }

        // ⏳ CALCULATE TRAVEL: 5 minutes per coordinate unit
        const distance = Math.sqrt(Math.pow(buyerVillage.x - offer.originX, 2) + Math.pow(buyerVillage.y - offer.originY, 2));
        const travelTimeMs = Math.floor(distance * 5 * 60 * 1000); 
        const arrivalDate = new Date(Date.now() + travelTimeMs);

        // 🛠️ EXECUTE EXCHANGE: Dispatching Caravans
        // Buyer pays and sends merchants
        buyerVillage.resources[offer.wantedRes] -= offer.wantedAmount;
        buyerVillage.merchants.available -= buyerMerchantsNeeded;

        // Buyer -> Seller Movement
        buyerVillage.merchantMovements.push({
            type: 'trade',
            resources: { [offer.wantedRes]: offer.wantedAmount },
            targetX: offer.originX,
            targetY: offer.originY,
            arrivalTime: arrivalDate,
            merchantsUsed: buyerMerchantsNeeded
        });

        // Seller -> Buyer Movement
        // (Seller's resources and merchants were already deducted on createOffer)
        sellerVillage.merchantMovements.push({
            type: 'trade',
            resources: { [offer.offeredRes]: offer.offeredAmount },
            targetX: buyerVillage.x,
            targetY: buyerVillage.y,
            arrivalTime: arrivalDate,
            merchantsUsed: Math.ceil(offer.offeredAmount / 1000)
        });

        // ✨ CLEANUP: Remove from dynamic market table
        await MarketOfferModel.findByIdAndDelete(offerID);

        // Mark modified
        buyerVillage.markModified('resources');
        buyerVillage.markModified('merchants');
        sellerVillage.markModified('merchantMovements');
        
        await buyerVillage.save();
        await sellerVillage.save();

        res.status(200).json({
            success: true,
            message: "The pact is sealed. Caravans have been dispatched under imperial decree.",
            village: buyerVillage
        });
    }
    catch (error)
    {
        console.error("Market Accept Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The trade seal has broken. The exchange has failed." });
    }
};

exports.sendResources = async (req, res) =>
{
    try
    {
        const { worldId, villageID } = req.params;
        const { x, y, resources } = req.body;

        const VillageModel = req.getVillageModel();
        const originVillage = await VillageModel.findById(villageID);
        
        const targetVillage = await VillageModel.findOne({ worldId, x: Number(x), y: Number(y) });

        if (!targetVillage)
        {
            return res.status(404).json({ error: "🏰 MYSTERY: No settlement exists at these coordinates." });
        }

        if (originVillage._id.toString() === targetVillage._id.toString())
        {
            return res.status(400).json({ error: "⚖️ FOLLY: You cannot send a caravan to its own gates." });
        }

        const totalRes = Object.values(resources).reduce((a, b) => a + Number(b), 0);
        const merchantsRequired = Math.ceil(totalRes / 1000);

        if (originVillage.merchants.available < merchantsRequired)
        {
            return res.status(400).json({ error: "🐎 SHORTAGE: Not enough merchants are available for this haul." });
        }

        for (const [resKey, amount] of Object.entries(resources))
        {
            if (originVillage.resources[resKey] < amount)
            {
                return res.status(400).json({ error: `🪙 POVERTY: Your ${resKey} stores are too shallow.` });
            }
        }

        for (const [resKey, amount] of Object.entries(resources))
        {
            originVillage.resources[resKey] -= amount;
        }
        originVillage.merchants.available -= merchantsRequired;

        const distance = Math.sqrt(Math.pow(targetVillage.x - originVillage.x, 2) + Math.pow(targetVillage.y - originVillage.y, 2));
        const travelTimeMs = Math.floor(distance * 5 * 60 * 1000); 

        const movement = {
            type: 'trade',
            resources,
            originVillageId: originVillage._id,
            targetX: Number(x),
            targetY: Number(y),
            arrivalTime: new Date(Date.now() + travelTimeMs),
            merchantsUsed: merchantsRequired
        };

        originVillage.merchantMovements.push(movement);
        originVillage.markModified('resources');
        originVillage.markModified('merchants');
        await originVillage.save();

        res.status(200).json({
            success: true,
            message: `The caravan has departed. Expected arrival at (${x}|${y}) in ${Math.round(travelTimeMs / 60000)} minute(s).`,
            village: originVillage
        });
    }
    catch (error)
    {
        console.error("Market Dispatch Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The roads are washed out. The caravan cannot proceed." });
    }
};

exports.cancelOffer = async (req, res) =>
{
    try
    {
        const { villageID, offerID } = req.params;
        const VillageModel = req.getVillageModel();
        const MarketOfferModel = req.getMarketOfferModel();

        // 1. Find the proclamation on the scrolls
        const offer = await MarketOfferModel.findById(offerID);

        if (!offer)
        {
            return res.status(404).json({ error: "📜 VANISHED: This offer no longer exists in the market records." });
        }

        // 🛡️ AUTHORITY CHECK: Ensure the one canceling is the one who posted
        // Checking against player/user ID from the request
        const requesterId = req.player?._id || req.user?._id;
        if (offer.ownerId.toString() !== requesterId.toString())
        {
            return res.status(403).json({ error: "⚖️ TRESPASS: You do not have the imperial authority to strike this offer." });
        }

        // 2. Locate the origin village to return the goods
        const village = await VillageModel.findById(villageID);
        if (!village)
        {
            return res.status(404).json({ error: "🏰 MYSTERY: The village of origin has vanished from the maps." });
        }

        // 🛠️ RECOVER GOODS & MERCHANTS
        // We reverse the logic used in createOffer
        const merchantsToReturn = Math.ceil(offer.offeredAmount / 1000);
        
        village.resources[offer.offeredRes] += offer.offeredAmount;
        village.merchants.available += merchantsToReturn;

        // 3. Update the realm records
        await MarketOfferModel.findByIdAndDelete(offerID);

        village.markModified('resources');
        village.markModified('merchants');
        await village.save();

        res.status(200).json({
            success: true,
            message: "The offer has been rescinded. Resources and merchants have returned to your stores.",
            village
        });
    }
    catch (error)
    {
        console.error("Market Cancel Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The market scribes cannot strike the record. Try again later." });
    }
};

exports.createOffer = async (req, res) =>
{
    try
    {
        const { worldId, villageID } = req.params;
        const { offeredRes, offeredAmount, wantedRes, wantedAmount } = req.body;

        const VillageModel = req.getVillageModel();
        const MarketOfferModel = req.getMarketOfferModel();
        const village = await VillageModel.findById(villageID);

        // ⚖️ LOGISTICS: Option A - Calculate and lock merchants (1 per 1000 res)
        const merchantsRequired = Math.ceil(offeredAmount / 1000);

        if (village.merchants.available < merchantsRequired)
        {
            return res.status(400).json({ error: "🐎 SHORTAGE: Not enough merchants are available to transport these goods." });
        }

        // 🛡️ RESOURCE LOCK
        if (village.resources[offeredRes] < offeredAmount)
        {
            return res.status(400).json({ error: "🪙 POVERTY: You lack the goods you intend to trade." });
        }

        // 🛠️ LOCK GOODS & MERCHANTS IN ESCROW
        village.resources[offeredRes] -= offeredAmount;
        village.merchants.available -= merchantsRequired;
        
        village.markModified('resources');
        village.markModified('merchants');
        await village.save();

        // 🌎 PUBLISH TO THE GREAT MARKET TABLE
        const newOffer = await MarketOfferModel.create({
            worldId: worldId,
            ownerId: req.player?._id || req.user?._id,
            originVillageId: village._id,
            offeredRes,
            offeredAmount,
            wantedRes,
            wantedAmount,
            originX: village.x,
            originY: village.y,
            ratio: wantedAmount / offeredAmount
        });

        res.status(200).json({
            success: true,
            message: "Your offer has been posted on the Great Market's scrolls.",
            village,
            offer: newOffer
        });
    }
    catch (error)
    {
        console.error("Market Offer Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The market scribes have lost their ink. Offer failed." });
    }
};