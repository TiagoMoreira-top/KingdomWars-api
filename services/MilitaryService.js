const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

const MilitaryService = {
    processRecruitment(village, now)
    {
        // Added palaceQueue and hospitalQueue to the processing cycle
        const queueKeys = ['trainingQueue', 'stableQueue', 'workshopQueue', 'palaceQueue', 'hospitalQueue'];
        let anyQueueChanged = false;

        queueKeys.forEach(qKey =>
        {
            if (!village[qKey] || village[qKey].length === 0) return;

            let buildingQueueChanged = false;
            const activeJob = village[qKey][0];
            const jobStartTime = new Date(activeJob.startTime).getTime();
            
            if (now >= jobStartTime)
            {
                const lastUpdate = new Date(activeJob.lastUpdate || activeJob.startTime).getTime();
                const msElapsed = now - lastUpdate;
                const msPerUnit = activeJob.timePerUnit;

                // Calculate how many units were finished since the last tick
                const unitsProduced = Math.floor(msElapsed / msPerUnit);

                if (unitsProduced > 0)
                {
                    const actualToDeliver = Math.min(unitsProduced, activeJob.unitsLeft);
                    const unitKey = activeJob.unitKey;
                    
                    // Add units to the main army
                    village.army[unitKey] = (village.army[unitKey] || 0) + actualToDeliver;
                    
                    // Update the job progress
                    activeJob.unitsLeft -= actualToDeliver;
                    activeJob.lastUpdate = new Date(lastUpdate + (actualToDeliver * msPerUnit));
                    
                    buildingQueueChanged = true;
                    anyQueueChanged = true;
                }

                // If the current batch is finished, remove it and shift the next job's start
                if (activeJob.unitsLeft <= 0)
                {
                    const finishedJobLastUpdate = activeJob.lastUpdate;
                    village[qKey].shift();
                    
                    if (village[qKey].length > 0)
                    {
                        // The next job in line starts precisely when the previous one finished
                        village[qKey][0].lastUpdate = finishedJobLastUpdate;
                        village[qKey][0].startTime = finishedJobLastUpdate;
                    }
                    buildingQueueChanged = true;
                    anyQueueChanged = true;
                }
            }

            if (buildingQueueChanged)
            {
                village.markModified(qKey);
            }
        });

        if (anyQueueChanged)
        {
            village.markModified('army');
        }
        
        return village;
    }
};

module.exports = MilitaryService;