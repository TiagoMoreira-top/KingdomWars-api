/**
 * 🛡️ THE SEAL OF OWNERSHIP
 *
 * `worldGate` proves the caller is a lord of this realm. It does NOT prove
 * the village named in the URL is theirs — so without this guard any signed-in
 * player could spend another lord's resources, queue works in their yards,
 * conscript from their barracks or cancel their orders simply by putting a
 * different villageId in the path.
 *
 * Mount this on every route that CHANGES a village. Read-only routes are left
 * open on purpose: scouting a neighbour's holding is a legitimate act.
 *
 * On success the resolved document is attached as `req.village`, so handlers
 * may use it instead of fetching again.
 */
module.exports = async (req, res, next) => {
  try {
    const villageId = req.params.villageId || req.params.villageID;

    if (!villageId) {
      return res.status(400).json({ error: "🏰 UNNAMED: No village was named in this decree." });
    }
    if (!req.worldPlayer) {
      return res.status(403).json({ error: "⚔️ EXILE: Thou hast no standing in this realm." });
    }

    const VillageModel = req.getVillageModel();
    const village = await VillageModel.findById(villageId).select('ownerId');

    if (!village) {
      return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });
    }

    if (String(village.ownerId) !== String(req.worldPlayer._id)) {
      return res.status(403).json({
        error: "⚖️ TRESPASS: This holding does not answer to thy banner."
      });
    }

    req.villageId = villageId;
    next();
  } catch (error) {
    console.error("Village Ownership Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heralds could not verify thy claim." });
  }
};
