const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

const MilitaryService = {
    processRecruitment(village, now) {
        const queueKeys = ['trainingQueue', 'stableQueue', 'workshopQueue'];
        let anyQueueChanged = false;

        queueKeys.forEach(qKey => {
            if (!village[qKey] || village[qKey].length === 0) return;

            let buildingQueueChanged = false;
            const activeJob = village[qKey][0];
            const jobStartTime = new Date(activeJob.startTime).getTime();
            
            if (now >= jobStartTime) {
                const lastUpdate = new Date(activeJob.lastUpdate || activeJob.startTime).getTime();
                const msElapsed = now - lastUpdate;
                const msPerUnit = activeJob.timePerUnit;

                const unitsProduced = Math.floor(msElapsed / msPerUnit);

                if (unitsProduced > 0) {
                    const actualToDeliver = Math.min(unitsProduced, activeJob.unitsLeft);
                    const unitKey = activeJob.unitKey;
                    
                    village.army[unitKey] = (village.army[unitKey] || 0) + actualToDeliver;
                    activeJob.unitsLeft -= actualToDeliver;
                    activeJob.lastUpdate = new Date(lastUpdate + (actualToDeliver * msPerUnit));
                    buildingQueueChanged = true;
                    anyQueueChanged = true;
                }

                if (activeJob.unitsLeft <= 0) {
                    const finishedJobLastUpdate = activeJob.lastUpdate;
                    village[qKey].shift();
                    
                    if (village[qKey].length > 0) {
                        village[qKey][0].lastUpdate = finishedJobLastUpdate;
                    }
                    buildingQueueChanged = true;
                    anyQueueChanged = true;
                }
            }

            if (buildingQueueChanged) village.markModified(qKey);
        });

        if (anyQueueChanged) village.markModified('army');
        return village;
    }
};

module.exports = MilitaryService;