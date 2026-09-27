import { fetchLeaderboard, fetchWorldRecords, discoverWorldRecordPlayers } from '../content.js';
import { localize } from '../util.js';

import Spinner from '../components/Spinner.js';

export default {
    components: {
        Spinner,
    },
    data: () => ({
        leaderboard: [],
        loading: true,
        selected: 0,
        err: [],
        searchQuery: '',
        playerWorldRecords: {},
        rowStart: 0,
        rowEnd: 0,
        padTop: 0,
        padBottom: 0,
    }),
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-leaderboard-container">
            <div class="page-leaderboard">
                <div class="error-container">
                    <p class="error" v-if="err.length > 0">
                        Leaderboard may be incorrect, as the following levels could not be loaded: {{ err.join(', ') }}
                    </p>
                </div>
                <div class="board-container" ref="listContainer" @scroll.passive="syncRows">
                    <!-- SEARCH BOX: inserted here (above the leaderboard) -->
                    <div id="player-search-wrapper" style="padding:16px; margin-bottom:8px;">
                      <input
                        id="playerSearch"
                        v-model="searchQuery"
                        type="search"
                        placeholder="Search players..."
                        aria-label="Search players"
                        autocomplete="off"
                        style="width:100%; padding:10px 12px; border-radius:8px; border:none; background:#2a2a2a; color:#fff; box-sizing:border-box; font-family: 'Lexend Deca', sans-serif; font-weight: 500;"
                      />
                    </div>

                    <div ref="listTop" :style="{ height: padTop + 'px' }"></div>
                    <table class="board" ref="listTable">
                        <tr v-for="(ientry, i) in visibleRows" :key="ientry.player.user">
                            <td class="rank">
                                <p class="type-label-lg">#{{ ientry.index + 1 }}</p>
                            </td>
                            <td class="total">
                                <p class="type-label-lg">{{ localize(ientry.player.total) }}</p>
                            </td>
                            <td class="user" :class="{ 'active': selected === ientry.index }">
                                <button @click="selected = ientry.index">
                                    <span class="type-label-lg">{{ ientry.player.user }}</span>
                                </button>
                            </td>
                        </tr>
                    </table>
                    <div :style="{ height: padBottom + 'px' }"></div>
                </div>
                <div class="player-container">
                    <div class="player" v-memo="[entry]">
                        <h1>#{{ selected + 1 }} {{ entry.user }}</h1>
                        <h3>{{ entry.total }}</h3>
                        <div v-if="entry.completedPacks && entry.completedPacks.length > 0" class="completed-packs">
                            <h4>Completed Packs</h4>
                            <ul>
                                <li v-for="pack in entry.completedPacks" :key="pack.name" :style="{ backgroundColor: pack.color, color: '#fff' }">
                                    {{ pack.name }}
                                </li>
                            </ul>
                        </div>
                        <h2 v-if="entry.worldRecords && entry.worldRecords.length > 0">World Records ({{ entry.worldRecords.length }})</h2>
                        <table class="table" v-if="entry.worldRecords && entry.worldRecords.length > 0">
                            <tr v-for="wr in entry.worldRecords" :key="wr.level">
                                <td class="rank"><p></p></td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="wr.link">{{ wr.level }} {{ wr.wr }}</a>
                                </td>
                                <td class="score"><p></p></td>
                            </tr>
                        </table>
                        <h2 v-if="entry.upcomingVerifying && entry.upcomingVerifying.length > 0">Upcoming Verifications ({{ entry.upcomingVerifying.length }})</h2>
                        <table class="table" v-if="entry.upcomingVerifying && entry.upcomingVerifying.length > 0">
                            <tr v-for="verification in entry.upcomingVerifying" :key="verification.level">
                                <td class="rank"><p></p></td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="verification.link">{{ verification.level }}</a>
                                </td>
                                <td class="score"><p></p></td>
                            </tr>
                        </table>
                        <h2 v-if="entry.verified.length > 0">Verified ({{ entry.verified.length}})</h2>
                        <table class="table">
                            <tr v-for="score in entry.verified" :key="score.level">
                                <td class="rank">
                                    <p>#{{ score.rank }}</p>
                                </td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="score.link">{{ score.level }}</a>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(score.score) }}</p>
                                </td>
                            </tr>
                        </table>
                        <h2 v-if="entry.completed.length > 0">Completed ({{ entry.completed.length }})</h2>
                        <table class="table">
                            <tr v-for="score in entry.completed" :key="score.level">
                                <td class="rank">
                                    <p>#{{ score.rank }}</p>
                                </td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="score.link">{{ score.level }}</a>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(score.score) }}</p>
                                </td>
                            </tr>
                        </table>
                        <h2 v-if="entry.progressed.length > 0">Progressed ({{entry.progressed.length}})</h2>
                        <table class="table">
                            <tr v-for="score in entry.progressed" :key="score.level">
                                <td class="rank">
                                    <p>#{{ score.rank }}</p>
                                </td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="score.link">{{ score.percent }}% {{ score.level }}</a>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(score.score) }}</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    `,
    computed: {
        entry() {
            const player = this.leaderboard[this.selected];
            if (!player) return {};
            return {
                ...player,
                worldRecords: this.playerWorldRecords[player.user] || []
            };
        },
        baseLeaderboard() {
            return Object.freeze(this.leaderboard.map((player, index) => Object.freeze({
                player,
                index,
                searchName: player.user ? player.user.toLowerCase() : ''
            })));
        },
        filteredLeaderboard() {
            const q = (this.searchQuery || '').toLowerCase().trim();
            if (!q) return this.baseLeaderboard;
            return this.baseLeaderboard.filter(entry => entry.searchName.includes(q));
        },
        visibleRows() {
            return this.filteredLeaderboard.slice(this.rowStart, this.rowEnd);
        },
    },
    created() {
        this.rowHeights = new Map();
        this.rowOffsets = [0];
    },
    async mounted() {
        console.log('Leaderboard mounted');
        const [leaderboard, err] = await fetchLeaderboard();
        console.log('Leaderboard data loaded, count:', leaderboard.length);
        this.leaderboard = leaderboard;
        this.err = err;
        this.loading = false;
        window.addEventListener('resize', this.onResize);
        
        console.log('Loading all world records in background');
        this.preloadAllWorldRecords();
        
        console.log('Starting background WR player discovery');
        this.loadWorldRecordPlayersInBackground();
    },
    updated() {
        this.syncRows();
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.onResize);
    },
    methods: {
        localize,
        // copy pasted from list.js
        measureRows() {
            const table = this.$refs.listTable;
            if (!table) return;
            const rows = this.visibleRows;
            Array.from(table.rows).forEach((tr, i) => {
                if (rows[i]) this.rowHeights.set(rows[i].index, tr.getBoundingClientRect().height);
            });
        },
        buildOffsets() {
            let total = 0;
            this.rowHeights.forEach(height => total += height);
            const guess = this.rowHeights.size ? total / this.rowHeights.size : 44;
            const offsets = [0];
            this.filteredLeaderboard.forEach((entry, i) => {
                offsets.push(offsets[i] + (this.rowHeights.get(entry.index) || guess));
            });
            this.rowOffsets = offsets;
            this.offsetRows = this.filteredLeaderboard;
        },
        rowAt(y) {
            const offsets = this.rowOffsets;
            let low = 0;
            let high = offsets.length - 2;
            while (low < high) {
                const mid = Math.ceil((low + high) / 2);
                if (offsets[mid] <= y) low = mid;
                else high = mid - 1;
            }
            return low;
        },
        updateWindow() {
            const box = this.$refs.listContainer;
            const top = this.$refs.listTop;
            if (!box || !top) return;
            const offsets = this.rowOffsets;
            const y = box.getBoundingClientRect().top - top.getBoundingClientRect().top;
            const first = this.rowAt(y);
            const last = this.rowAt(y + box.clientHeight);
            this.rowStart = Math.max(0, first - first % 10 - 10);
            this.rowEnd = Math.min(offsets.length - 1, last - last % 10 + 20);
            this.padTop = offsets[this.rowStart];
            this.padBottom = offsets[offsets.length - 1] - offsets[this.rowEnd];
        },
        syncRows() {
            const box = this.$refs.listContainer;
            const top = this.$refs.listTop;
            if (!box || !top) return;
            const offsets = this.rowOffsets;
            const sameRows = this.offsetRows === this.filteredLeaderboard;
            const first = this.rowAt(box.getBoundingClientRect().top - top.getBoundingClientRect().top);
            this.measureRows();
            this.buildOffsets();
            const shift = sameRows ? this.rowOffsets[first] - offsets[first] : 0;
            if (shift) box.scrollTop += shift;
            this.updateWindow();
        },
        onResize() {
            this.rowHeights.clear();
            this.syncRows();
        },
        async preloadAllWorldRecords() {
            try {
                const worldRecordsMap = await fetchWorldRecords();
                this.playerWorldRecords = worldRecordsMap;
                console.log('Preloaded world records for all players');
            } catch (e) {
                console.error('Error preloading world records:', e);
            }
        },
        async loadWorldRecordPlayersInBackground() {
            try {
                const newPlayers = await discoverWorldRecordPlayers(this.leaderboard);
                console.log('Found new WR players:', newPlayers.length);
                if (newPlayers.length > 0) {
                    this.leaderboard = [...this.leaderboard, ...newPlayers].sort((a, b) => b.total - a.total);
                    console.log('Updated leaderboard with WR players, new count:', this.leaderboard.length);
                }
            } catch (e) {
                console.error('Error discovering WR players:', e);
            }
        },
    },
};