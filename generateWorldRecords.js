const fs = require('fs')
const upcomingList = require('./data/_upcoming.json')

const worldRecords = {};

upcomingList.forEach(item => {
    try {
        // Skip section headers (lines starting with -)
        if (item.startsWith('-')) return;

        const levelInfo = require('./data/' + item + ".json")

        // Parse world records from the author field
        // Format: "Player1 MM:SS | Player2 MM:SS"
        if (levelInfo.author && levelInfo.author !== '-') {
            const wrParts = levelInfo.author.split(' | ');
            
            wrParts.forEach(part => {
                const match = part.match(/^(.+?)\s+(\d+.*)$/);
                if (match) {
                    const user = match[1].trim();
                    const wr = match[2].trim();
                    
                    if (!worldRecords[user]) {
                        worldRecords[user] = [];
                    }
                    
                    worldRecords[user].push({
                        level: item,
                        wr: wr,
                        link: levelInfo.verification
                    });
                }
            });
        }
    } catch(e) {
        console.log("failed to find level " + item)
    }
});

fs.writeFileSync('./data/_worldrecord.json', JSON.stringify(worldRecords, null, 2));
console.log('World records generated successfully!');
