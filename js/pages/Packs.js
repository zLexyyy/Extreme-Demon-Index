import { store } from "../main.js";
import { fetchPacks, fetchLevel } from "../content.js";
import { score } from "../score.js";

import Spinner from "../components/Spinner.js";

const dir = '/data';

export default {
    components: { Spinner },
    data: () => ({
        packs: [],
        list: [],
        levels: {},
        loading: true,
        selectedPack: null,
        selectedLevel: null,
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

        this.packs = await fetchPacks();
        // Load all levels for packs
        for (const pack of this.packs) {
            for (const levelName of pack.levels) {
                if (!this.levels[levelName]) {
                    const levelData = await fetchLevel(levelName);
                    if (levelData[0]) {
                        this.levels[levelName] = levelData[0];
                    }
                }
            }
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
},
    methods: {
        selectPack(pack) {
            this.selectedPack = pack;
            this.selectedLevel = null;
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
            <div class="packs-list">
                <div v-for="pack in packs" :key="pack.name" class="pack-item" :class="{ active: selectedPack === pack }" @click="selectPack(pack)">
                    <div class="pack-name" :style="{ color: pack.textColor }">{{ pack.name }}</div>
                </div>
            </div>
        </div>
        <div class="pack-details-container">
            <div v-if="selectedPack" class="pack-details">
                <h1 :style="{ color: selectedPack.textColor }">{{ selectedPack.name }}</h1>
                <p class="pack-reward">Pack Reward: {{ packReward }} points</p>
                <h3>Levels in Pack</h3>
    <ul class="pack-levels">
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