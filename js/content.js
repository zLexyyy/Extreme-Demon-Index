import { round, score } from './score.js';

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = '/data';

/**
 * Active list handling:
 * - 'classic' -> _list.json (default)
 * - 'upcoming' -> _upcoming.json
 */
const LIST_KEYS = {
    classic: '_list.json',
    upcoming: '_upcoming.json',
};

function getActiveListKey() {
    // default to 'classic' if nothing set
    return localStorage.getItem('edi_active_list') || 'classic';
}
function setActiveListKey(key) {
    if (!LIST_KEYS[key]) return;
    localStorage.setItem('edi_active_list', key);
}

/**
 * Fetch list (respects active list selection saved in localStorage)
 */
export async function fetchList() {
    const activeKey = getActiveListKey();
    const file = LIST_KEYS[activeKey] ?? LIST_KEYS.classic;
    const listResult = await fetch(`${dir}/${file}`);
    try {
        let list = await listResult.json();
        if (activeKey === 'upcoming') {
            // Sort levels alphabetically within each section
            const sortedList = [];
            let currentSection = null;
            let levels = [];
            for (let item of list) {
                if (item.startsWith('-')) {
                    if (currentSection) {
                        sortedList.push(currentSection);
                        sortedList.push(...levels.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
                    }
                    currentSection = item;
                    levels = [];
                } else {
                    levels.push(item);
                }
            }
            // Add the last section
            if (currentSection) {
                sortedList.push(currentSection);
                sortedList.push(...levels.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
            }
            list = sortedList;
        }
        return list;
    } catch {
        console.error(`Failed to load list (${file}).`);
        return null;
    }
}
export async function fetchLevel(name)
{
    if(name.includes("/")) return;

    const levelResult = await fetch(`${dir}/${name}.json`);
    try {
        const level = await levelResult.json();
        return [
            {
                ...level,
                name,
                records: level.records.sort(
                    (a, b) => b.percent - a.percent,
                ),
            },
            null,
        ];
    } catch {
        console.error(`Failed to load level ${name}.`);
        return [null, name];
    }

}
export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}
export async function fetchRecords() {
    // const levelList = await fetchList();

    const recordRes = await fetch(`${dir}/_records.json`);
    try {
        const list =  await recordRes.json();

        // levelList.forEach((level) => {
        //     if(!list[level]) list[level] = []
        // })
        return list;
    } catch {
        console.error(`Failed to load records.`);
    }
}
export async function fetchPacks() {
    try {
        const packsResult = await fetch(`${dir}/_packs.json`);
        const packs = await packsResult.json();
        return packs;
    } catch {
        console.error(`Failed to load packs.`);
        return [];
    }
}
export async function fetchLeaderboard() {
    // Always use the CLASSIC list for the leaderboard (single shared leaderboard).
    // This ensures there is only one leaderboard, even when the user is viewing "upcoming".
    const recordList = await fetchRecords();
    const packs = await fetchPacks();

    // load classic list explicitly
    const classicResult = await fetch(`${dir}/${LIST_KEYS.classic}`);
    let list;
    try {
        list = await classicResult.json();
    } catch (e) {
        console.error('Failed to load classic list for leaderboard.', e);
        return [[], [`Failed to load classic list for leaderboard.`]];
    }

    const scoreMap = {};
    const errs = [];
    list.forEach((level, rank) => {
        if(!recordList[level]) recordList[level] = {
            verifier: {
                verifier: "!!MISSING LEVEL INFO!!"
            },
            records: []

        }
            // Verification
            const verifier = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === recordList[level].verifier.verifier.toLowerCase(),
            ) || recordList[level].verifier.verifier;
            scoreMap[verifier] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };

            const { verified } = scoreMap[verifier];
            verified.push({
                rank: rank + 1,
                level: level,
                score: score(rank + 1, 100, recordList[level].percentToQualify),
                link: recordList[level].verifier.verification,
            });
            // Records
            recordList[level].records.forEach((record) => {
                if(record) {
                    const user = Object.keys(scoreMap).find(
                        (u) => u.toLowerCase() === record.user.toLowerCase(),
                    ) || record.user;
                    scoreMap[user] ??= {
                        verified: [],
                        completed: [],
                        progressed: [],
                    };
                    const { completed, progressed } = scoreMap[user];
                    if (record.percent === 100) {
                        completed.push({
                            rank: rank + 1,
                            level: level,
                            score: score(rank + 1, 100, recordList[level].percentToQualify),
                            link: record.link,
                        });
                        return;
                    }

                    progressed.push({
                        rank: rank + 1,
                        level: level.name,
                        percent: record.percent,
                        score: score(rank + 1, record.percent, recordList[level].percentToQualify),
                        link: record.link,
                    });
                }
            });

    });

    // Calculate completed packs for each user
    Object.entries(scoreMap).forEach(([user, scores]) => {
        const completedLevels = new Set([
            ...scores.verified.map(v => v.level),
            ...scores.completed.map(c => c.level)
        ]);
        scores.completedPacks = [];
        packs.forEach(pack => {
            const hasAllLevels = pack.levels.every(level => completedLevels.has(level));
            if (hasAllLevels) {
                scores.completedPacks.push(pack);
            }
        });
    });

    // Wrap in extra Object containing the user and total score
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed, completedPacks } = scores;
        let total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        // Add pack rewards
        const packReward = completedPacks.reduce((sum, pack) => {
            const packTotal = pack.levels.reduce((levelSum, levelName) => {
                const levelIndex = list.indexOf(levelName);
                if (levelIndex >= 0) {
                    const levelData = recordList[levelName];
                    if (levelData) {
                        return levelSum + score(levelIndex + 1, 100, levelData.percentToQualify);
                    }
                }
                return levelSum;
            }, 0);
            return sum + Math.floor(packTotal * 0.5);
        }, 0);

        total += packReward;

        return {
            user,
            total: round(total),
            packReward,
            completedPacks,
            ...scores,
        };
    });

    // Sort by total score
    return [res.sort((a, b) => b.total - a.total), errs];
}
// --- sidebar level search/filter ---
// Append at the bottom of js/content.js. If your List page is a Vue component,
// ensure this runs after the List page mounts. You can wrap this in a Vue
// mounted() hook if needed.
(function () {
  const searchInput = document.getElementById('levelSearch');
  if (!searchInput) return;

  // Replace these selectors with the real container and item selectors used in your List.js
  // e.g. const listContainer = document.querySelector('.list__left .levels');
  const listContainer = document.querySelector('#sidebar-level-list') || document.querySelector('.left-list') || document.querySelector('.list__left');
  if (!listContainer) return;

  // Debounce helper
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function normalize(str) {
    return (str || '').toString().toLowerCase();
  }

  function filterList(q) {
    const query = normalize(q).trim();
    // Adjust '.level-item' to match actual items (li, a, div)
    const items = listContainer.querySelectorAll('.level-item, li, a, .level');

    items.forEach(item => {
      // Prefer data-title / data-id if you set them when rendering the list
      const title = normalize(item.getAttribute('data-title') || item.textContent);
      const id = normalize(item.getAttribute('data-id') || '');
      const isIdQuery = /^\d+$/.test(query);
      let matches = false;

      if (query === '') matches = true;
      else if (title.includes(query)) matches = true;
      else if (id && id.includes(query)) matches = true;

      item.style.display = matches ? '' : 'none';
    });
  }

  const onInput = debounce((e) => filterList(e.target.value), 150);
  searchInput.addEventListener('input', onInput);
})();