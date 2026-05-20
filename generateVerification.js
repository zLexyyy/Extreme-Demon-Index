const fs = require('fs')
const upcomingList = require('./data/_upcoming.json')

const verifications = {};

upcomingList.forEach((item, index) => {
    try {
        // Skip section headers (lines starting with -)
        if (item.startsWith('-')) return;

        const levelInfo = require('./data/' + item + ".json")

        // Get verifier(s) - split by | to handle multiple verifiers
        const verifierString = levelInfo.verifier || '-';
        if (verifierString && verifierString !== '-') {
            // Split by | to get individual verifiers
            const verifierList = verifierString.split('|').map(v => v.trim()).filter(v => v && v !== '-');
            
            // Add this level to each individual verifier
            verifierList.forEach(verifier => {
                if (!verifications[verifier]) {
                    verifications[verifier] = [];
                }

                verifications[verifier].push({
                    rank: index + 1,
                    level: item,
                    link: levelInfo.verification || '#'
                });
            });
        }
    } catch(e) {
        console.log("failed to find level " + item)
    }
});

fs.writeFileSync('./data/_verifications.json', JSON.stringify(verifications, null, 2));
console.log('Verifications generated successfully!');