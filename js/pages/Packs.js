import { store } from "../main.js";
import { fetchPacks, fetchLevel, fetchRecords, calculatePackPoints } from "../content.js";
import { score } from "../score.js";

import Spinner from "../components/Spinner.js";

const dir = '/data';

export default {
    components: { Spinner },
    data: () => ({
        packs: [],
        list: [],
        levels: {},
        recordList: {},
        loading: true,
        selectedPack: null,
        selectedLevel: null,
        loadingPackDetails: false,
        sortBy: 'default', // 'default', 'alphabetical', 'pointsHigh', 'pointsLow', 'levelCountHigh', 'levelCountLow'
        packPointsCache: {}, // Cache for instant display
    }),
    async mounted() {
        // Always use classic list for packs
        const classicResult = await fetch(`${dir}/_list.json`);
        let classicList;
        try {
            classicList = await classicResult.json();
        } catch (e) {
            console.error('Failed to load classic list for packs.', e);
            this.list = [];
        }
        this.list = classicList || [];

        // Load records data
        this.recordList = await fetchRecords();

        this.packs = await fetchPacks();
        
        // Pre-calculate all pack points for instant display
        for (const pack of this.packs) {
            this.packPointsCache[pack.name] = await calculatePackPoints(pack.levels, this.list, this.recordList);
        }

        this.loading = false;

        // Check for pack query param
        const queryPack = this.$route.query.pack;
        if (queryPack) {
            const pack = this.packs.find(p => p.name === queryPack);
            if (pack) {
                this.selectPack(pack);
            }
        }
    },
    computed: {
        packLevels() {
            if (!this.selectedPack) return [];
            return this.selectedPack.levels.map(name => {
                const index = this.list.indexOf(name);
                const level = this.levels[name];
                const points = level && index >= 0 ? score(index + 1, 100, level.percentToQualify) : 0;
                return {
                    name,
                    index,
                    points,
                    level,
                };
            }).filter(l => l.index >= 0).sort((a, b) => a.index - b.index);
        },
        packReward() {
            const total = this.packLevels.reduce((sum, l) => sum + l.points, 0);
            return Math.floor(total * 0.5);
        },
        sortedPacks() {
            const packsToSort = [...this.packs];
            
            switch(this.sortBy) {
                case 'alphabetical':
                    return packsToSort.sort((a, b) => a.name.localeCompare(b.name));
                
                case 'pointsHigh':
                    return packsToSort.sort((a, b) => {
                        const aPoints = this.packPointsCache[b.name] || 0;
                        const bPoints = this.packPointsCache[a.name] || 0;
                        return aPoints - bPoints;
                    });
                
                case 'pointsLow':
                    return packsToSort.sort((a, b) => {
                        const aPoints = this.packPointsCache[a.name] || 0;
                        const bPoints = this.packPointsCache[b.name] || 0;
                        return aPoints - bPoints;
                    });
                
                case 'levelCountHigh':
                    return packsToSort.sort((a, b) => b.levels.length - a.levels.length);
                
                case 'levelCountLow':
                    return packsToSort.sort((a, b) => a.levels.length - b.levels.length);
                
                case 'default':
                default:
                    return packsToSort;
            }
        },
    },
    methods: {
        getPackPoints(packName) {
            return this.packPointsCache[packName] || 0;
        },
        async selectPack(pack) {
            this.selectedPack = pack;
            this.selectedLevel = null;
            
            // Lazy load levels for this pack
            this.loadingPackDetails = true;
            try {
                for (const levelName of pack.levels) {
                    if (!this.levels[levelName]) {
                        const levelData = await fetchLevel(levelName);
                        if (levelData[0]) {
                            this.levels[levelName] = levelData[0];
                        }
                    }
                }
            } finally {
                this.loadingPackDetails = false;
            }
        },
        selectLevel(level) {
            this.selectedLevel = level;
            // Navigate to list and select the level
            this.$router.push({ path: '/', query: { level: level.name } });
        },
    },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-packs">
            <div class="packs-container">
                <h2>Packs</h2>
                
                <!-- Sort Controls -->
                <div class="pack-sort-controls">
                    <label for="sortSelect">Sort by:</label>
                    <select v-model="sortBy" id="sortSelect" class="pack-sort-select">
                        <option value="default">Default</option>
                        <option value="alphabetical">Alphabetical</option>
                        <option value="pointsHigh">Points (High to Low)</option>
                        <option value="pointsLow">Points (Low to High)</option>
                        <option value="levelCountHigh">Level Count (High to Low)</option>
                        <option value="levelCountLow">Level Count (Low to High)</option>
                    </select>
                </div>

                <div class="packs-list">
                    <div v-for="pack in sortedPacks" :key="pack.name" class="pack-item" :class="{ active: selectedPack === pack }" @click="selectPack(pack)">
                        <div class="pack-name" :style="{ color: pack.textColor }">{{ pack.name }}</div>
                        <div class="pack-meta">
                            <span class="pack-levels-count">{{ pack.levels.length }} levels</span>
                            <span class="pack-points">{{ getPackPoints(pack.name) }} pts</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="pack-details-container">
                <div v-if="selectedPack" class="pack-details">
                    <h1 :style="{ color: selectedPack.textColor }">{{ selectedPack.name }}</h1>
                    <p class="pack-reward">Pack Reward: {{ packReward }} points</p>
                    <h3>Levels in Pack</h3>
                    <div v-if="loadingPackDetails" style="display: flex; justify-content: center; padding: 20px;">
                        <Spinner></Spinner>
                    </div>
                    <ul v-else class="pack-levels">
                        <li v-for="level in packLevels" :key="level.name" @click="selectLevel(level)">
                            <span class="level-name">#{{ level.index + 1 }} {{ level.name }}</span>
                            <span class="level-points">{{ level.points }} pts</span>
                        </li>
                    </ul>
                </div>
                <div v-else class="no-pack">
                    <p>Select a pack to view details</p>
                </div>
            </div>
        </main>
    `,
};