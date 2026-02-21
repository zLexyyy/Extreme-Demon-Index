import { fetchLeaderboard, fetchWorldRecordsForUser, discoverWorldRecordPlayers } from '../content.js';
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
        loadingWorldRecords: false,
        worldRecordsLoaded: {},
        playerWorldRecords: {},
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
                <div class="board-container">
                    <table class="board">
                        <tr v-for="(ientry, i) in leaderboard">
                            <td class="rank">
                                <p class="type-label-lg">#{{ i + 1 }}</p>
                            </td>
                            <td class="total">
                                <p class="type-label-lg">{{ localize(ientry.total) }}</p>
                            </td>
                            <td class="user" :class="{ 'active': selected == i }">
                                <button @click="selected = i">
                                    <span class="type-label-lg">{{ ientry.user }}</span>
                                </button>
                            </td>
                        </tr>
                    </table>
                </div>
                <div class="player-container">
                    <div class="player">
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
                        <div v-if="loadingWorldRecords" style="display: flex; justify-content: center; padding: 20px;">
                            <Spinner></Spinner>
                        </div>
                        <table class="table" v-else-if="entry.worldRecords && entry.worldRecords.length > 0">
                            <tr v-for="wr in entry.worldRecords">
                                <td class="rank"><p></p></td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="wr.link">{{ wr.level }} {{ wr.wr }}</a>
                                </td>
                                <td class="score"><p></p></td>
                            </tr>
                        </table>
                        <h2 v-if="entry.verified.length > 0">Verified ({{ entry.verified.length}})</h2>
                        <table class="table">
                            <tr v-for="score in entry.verified">
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
                            <tr v-for="score in entry.completed">
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
                            <tr v-for="score in entry.progressed">
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
            // Return entry with world records from separate storage
            return {
                ...player,
                worldRecords: this.playerWorldRecords[player.user] || []
            };
        },
    },
    watch: {
        selected(newVal) {
            // Load world records for the newly selected player if not already loaded
            const player = this.leaderboard[newVal];
            if (player && !this.worldRecordsLoaded[player.user]) {
                this.loadWorldRecordsForPlayer();
            }
        },
    },
    async mounted() {
        console.log('Leaderboard mounted');
        const [leaderboard, err] = await fetchLeaderboard();
        console.log('Leaderboard data loaded, count:', leaderboard.length);
        this.leaderboard = leaderboard;
        this.err = err;
        // Hide loading spinner
        this.loading = false;
        
        // Load world records for initially selected player
        console.log('About to load WR for index 0, player:', this.leaderboard[0]?.user);
        if (this.leaderboard[this.selected]) {
            await this.loadWorldRecordsForPlayer();
        }
        
        // Load WR-only players in the background (don't await, let it load while user views leaderboard)
        console.log('Starting background WR player discovery');
        this.loadWorldRecordPlayersInBackground();
    },
    methods: {
        localize,
        async loadWorldRecordPlayersInBackground() {
            try {
                const newPlayers = await discoverWorldRecordPlayers(this.leaderboard);
                console.log('Found new WR players:', newPlayers.length);
                if (newPlayers.length > 0) {
                    // Add new players to leaderboard and re-sort
                    this.leaderboard = [...this.leaderboard, ...newPlayers].sort((a, b) => b.total - a.total);
                    console.log('Updated leaderboard with WR players, new count:', this.leaderboard.length);
                }
            } catch (e) {
                console.error('Error discovering WR players:', e);
            }
        },
        async loadWorldRecordsForPlayer() {
            const player = this.leaderboard[this.selected];
            if (!player) {
                console.log('No player found at index', this.selected);
                return;
            }
            
            console.log('loadWorldRecordsForPlayer called for:', player.user);
            
            // Check if already loading or already loaded
            if (this.loadingWorldRecords || this.worldRecordsLoaded[player.user]) {
                console.log('Already loading or loaded for:', player.user);
                return;
            }
            
            this.loadingWorldRecords = true;
            try {
                console.log('Starting world records fetch for:', player.user);
                const worldRecords = await fetchWorldRecordsForUser(player.user);
                console.log('Got world records:', worldRecords);
                // Store world records in separate object keyed by player username
                this.playerWorldRecords[player.user] = worldRecords;
                this.worldRecordsLoaded[player.user] = true;
                console.log('Stored world records, playerWorldRecords now:', this.playerWorldRecords);
            } catch (e) {
                console.error('Error loading world records:', e);
            } finally {
                this.loadingWorldRecords = false;
            }
        },
    },
};
