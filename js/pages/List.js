import { store } from "../main.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList, fetchLevel, fetchRecords, fetchPacks } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container" ref="listContainer" @scroll.passive="syncRows">
                <!-- SEARCH BOX: inserted here (above the levels list) -->
                <div id="level-search-wrapper" style="padding:16px;">
                  <!-- Toggle buttons: Classic / Upcoming -->
                  <div class="edi-list-toggle" style="display:flex; gap:8px; margin-bottom:8px;">
                    <button
                      class="nav__tab"
                      :class="{ active: activeList === 'classic' }"
                      type="button"
                      id="edi-btn-classic"
                      @click="setActiveList('classic')"
                    >
                      Classic list
                    </button>

                    <button
                      class="nav__tab"
                      :class="{ active: activeList === 'upcoming' }"
                      type="button"
                      id="edi-btn-upcoming"
                      @click="setActiveList('upcoming')"
                    >
                      Upcoming list
                    </button>
                  </div>

                  <input
                    id="levelSearch"
                    v-model="searchQuery"
                    type="search"
                    placeholder="Search levels..."
                    aria-label="Search levels"
                    autocomplete="off"
                    style="width:100%; padding:10px 12px; border-radius:8px; border:none; background:#2a2a2a; color:#fff; box-sizing:border-box;"
                  />
                </div>

                <div ref="listTop" :style="{ height: padTop + 'px' }"></div>

                <!-- Classic List View with Legacy Levels -->
                <table class="list" ref="listTable" v-if="list && activeList === 'classic'">
                    <template v-for="(entry, i) in visibleRows">
                        <tr v-if="entry.isLegacySeparator" :key="'separator-' + i" class="legacy-separator-row">
                            <td colspan="2" class="legacy-separator">Legacy List</td>
                        </tr>
                        <tr v-else :key="entry.index" :class="{ benchmark: entry.isBenchmark, legacy: entry.isLegacy }">
                            <td class="rank">
                                <p class="type-label-lg" v-if="!entry.isBenchmark && !entry.isLegacy">#{{ entry.displayIndex }}</p>
                                <p class="type-label-md" v-else style="margin-left:8px;">-</p>
                            </td>
                            <td class="level" :class="{ 'active': selected == entry.index, 'error': !entry.name, 'benchmark-level': entry.isBenchmark, 'legacy-level': entry.isLegacy }">
                                <button class="level-btn" @click="fetchLvl(entry.index); selected = entry.index">
                                    <span class="type-label-lg">{{ entry.name || 'Error' }}</span>
                                </button>
                            </td>
                        </tr>
                    </template>
                </table>

                <!-- Upcoming List View (original behavior) -->
                <table class="list" ref="listTable" v-if="list && activeList === 'upcoming'">
                    <tr v-for="(entry, i) in visibleRows" :key="entry.index" :class="{ benchmark: entry.isBenchmark }">
                        <td class="rank">
                            <p class="type-label-lg" v-if="!entry.isBenchmark && activeList !== 'upcoming'">#{{ entry.displayIndex }}</p>
                            <p class="type-label-md" v-else style="margin-left:8px;">-</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == entry.index, 'error': !entry.name, 'benchmark-level': entry.isBenchmark }">
                            <button v-if="!entry.isBenchmark || activeList !== 'upcoming'" class="level-btn" @click="fetchLvl(entry.index); selected = entry.index">
                                <span class="type-label-lg">{{ entry.name || 'Error' }}</span>
                            </button>
                            <div v-else class="level-btn">
                                <span class="type-label-lg">{{ entry.name || 'Error' }}</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <div :style="{ height: padBottom + 'px' }"></div>
            </div>
            <div class="level-container">
                <div class="level" v-if="level">
                    <h1>{{ displayedLevelName }}</h1>
                    <LevelAuthors :author="level.author" :creators="level.creators" :verifier="level.verifier"></LevelAuthors>
                    
                    <!-- Packs -->
                    <div v-if="levelPacks.length > 0" class="level-packs-section">
                        <h3>Packs</h3>
                        <ul class="level-packs">
                            <li v-for="pack in levelPacks" :key="pack.name" :style="{ backgroundColor: pack.color, color: pack.textColor }" @click="selectPack(pack)">
                                {{ pack.name }}
                            </li>
                        </ul>
                    </div>
                    
                    <div class="video-controls">
                        <button class="video-btn" :class="{ active: !toggledShowcase }" @click="toggledShowcase = false">Verification</button>
                        <button v-if="showShowcaseButton" class="video-btn" :class="{ active: toggledShowcase }" @click="toggledShowcase = true">Showcase</button>
                    </div>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <ul class="stats">
                        <li v-if="activeList === 'classic' && !isLegacyLevel">
                            <div class="type-title-sm">Points when completed</div>
                            <p>{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                        </li>
                        <li v-if="isLegacyLevel">
                            <div class="type-title-sm">Removal Reason</div>
                            <p>{{ level.reason || 'N/A' }}</p>
                        </li>
                        <li v-if="activeList === 'upcoming'">
                            <div class="type-title-sm">Status</div>
                            <p>{{ statusText }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level.id }}</p>
                        </li>
                        <li>
                    </ul>

                    <!-- Records: only show for classic list and non-legacy levels -->
                    <h2 v-if="activeList === 'classic' && !isLegacyLevel">Records</h2>
                    <table class="records" v-if="activeList === 'classic' && !isLegacyLevel">
                        <tr v-for="(record, idx) in (recordList[level.name] ? recordList[level.name].records : [])" :key="idx" class="record">
                            <td class="percent">
                                <p>{{ record.percent }}%</p>
                            </td>
                            <td class="user">
                                <a :href="record.link" target="_blank" class="type-label-lg">{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img v-if="record.mobile" :src="'/assets/phone-landscape' + (store.dark ? '-dark' : '') + '.svg'" alt="Mobile">
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <template v-if="editors">
                        <h3>List Editors</h3>
                        <ol class="editors">
                            <li v-for="(editor, eidx) in editors" :key="eidx">
                                <img :src="'/assets/' + roleIconMap[editor.role] + (store.dark ? '-dark' : '') + '.svg'" :alt="editor.role">
                                <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                    </template>
                    <h3>Submission Requirements</h3>
                    <p>When submitting your record, please ensure that it complies with the following guidelines:</p>
                    <p>1. Your recording must have clicks that are clearly audible throughout the entire level (Or at the very least most of it). The clicks must be consistent and fully audible from beginning to end. If there was an issue with the audio, we apologize, but we can only accept records where the clicks (or taps, if you are playing on mobile) are clearly audible for the entire duration of the level. Unless you are able to provide us raw footage, then it will be rejected most likely.</p>
                    <p>2. Your recording must include a cheat indicator on the end screen. If you are playing on vanilla GD or using a mod menu that does not feature a cheat indicator, this requirement does not apply. However, you must specify this in your notes, as we are not responsible for determining which mod menu you used or whether you were playing on vanilla.</p>
                    <p>3. If you are using an LDM or a bugfix copy of a level, it must either be approved by list staff or clearly make no difference to the gameplay. Use your best judgment, if you are unsure whether your bugfix copy or LDM is acceptable, please ask staff and include the level ID. If you are completely certain that your copy is acceptable, approval is not required for your record to be accepted. If you are unsure what qualifies as an "acceptable" copy, you should also ask staff. Copies that alter gameplay or remove so much detail that the level becomes easier will be denied.</p>
                    <p>4. Your recording must include an uncut end screen. If the video ends before the end screen is shown or your stats are not visible, the record will not be accepted.</p>
                    <p>5. It is recommended that you keep raw footage of any levels you complete. If the level places within the top 500, raw footage is required and must include split audio tracks. Submit this along with your original record in a downloadable format, such as Google Drive. If the record was streamed, a Twitch or YouTube VOD with chat enabled is also acceptable. Alternatively, if the record is listed on your Pointercrate profile, you may include that link in the additional information section, and your record will be accepted.</p>
                    <p>6. This should be self-explanatory, but your record must not be completed using any disallowed mods. This rule also applies to records showing a red cheat indicator, clearly hacked completions, or the use of bots.</p>
                    <p>7. This should also be really obvious, but you are not allowed to use any secret ways present in the level. You must use the intended path for the level.</p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        demonList: [],
        recordList: {},
        editors: [],
        packs: [],
        loading: true,
        selected: 0,
        errors: [],
        roleIconMap,
        store,
        isLoading: false,
        hasLoaded: false,
        listLevel: null,
        toggledShowcase: false,
        searchQuery: '',
        rowStart: 0,
        rowEnd: 0,
        padTop: 0,
        padBottom: 0,
        isLegacyLevel: false
    }),
    computed: {
        activeList() {
            return localStorage.getItem('edi_active_list') || 'classic';
        },
        level() {
            if (!this.hasLoaded) {
                return [];
            }
            return this.listLevel ? this.listLevel[0] : [];
        },
        displayedLevelName() {
            if (!this.level || !this.level.name) return '';
            // Only remove leading dash when the level is a legacy level (we want to keep leading dash for benchmark names like "-critical error-")
            const name = this.level.name;
            return name.startsWith('-') && this.isLegacyLevel ? name.substring(1).trim() : name;
        },
        showShowcaseButton() {
            if (this.activeList === 'classic') {
                if (!this.level || !this.level.showcase) {
                    return false;
                }
                if (this.level.showcase === this.level.verification) {
                    return false;
                }
                return true;
            }
            return true;
        },
        video() {
            if (!this.level || !this.level.showcase) {
                return embed(this.level ? this.level.verification : '');
            }

            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification
            );
        },
        list() {
            return this.demonList
        },
        levelPacks() {
            if (!this.level || !this.level.name) return [];
            return this.packs.filter(pack => pack.levels.includes(this.level.name));
        },

        baseDemonList() {
            let rank = 0;
            return Object.freeze(this.demonList.map((name, idx) => {
                const raw = (typeof name === 'string') ? name.trim() : name;
                const lower = typeof raw === 'string' ? raw.toLowerCase() : '';
                const isBench = !!lower && lower.startsWith('-') && lower !== '-critical error-' && lower !== '-à la belle étoile-';
                const displayName = isBench ? raw.replace(/^[-\s]+/, '') : raw;
                return Object.freeze({
                    name: displayName,
                    index: idx,
                    isBenchmark: isBench,
                    rawName: raw,
                    displayIndex: isBench ? null : ++rank,
                    searchName: displayName ? displayName.toLowerCase() : ''
                });
            }));
        },

        baseDemonListClassic() {
            let rank = 0;
            let addedSeparator = false;
            const result = [];
            const plain = [];
            this.demonList.forEach((name, idx) => {
                const raw = (typeof name === 'string') ? name.trim() : name;
                const lower = typeof raw === 'string' ? raw.toLowerCase() : '';
                const isLegacy = !!lower && lower.startsWith('-') && !lower.startsWith('-critical error') && !lower.startsWith('-à la belle étoile');
                const isBench = !!lower && lower.startsWith('-') && !isLegacy && lower !== '-critical error-' && lower !== '-à la belle étoile-';
                const displayName = (isBench || isLegacy) ? raw.replace(/^[-\s]+/, '') : raw;
                const entry = Object.freeze({
                    name: displayName,
                    index: idx,
                    isBenchmark: isBench,
                    isLegacy,
                    rawName: raw,
                    isLegacySeparator: false,
                    displayIndex: (isBench || isLegacy) ? null : ++rank,
                    searchName: displayName ? displayName.toLowerCase() : ''
                });
                if (isLegacy && !addedSeparator) {
                    result.push(Object.freeze({ isLegacySeparator: true, index: -1 }));
                    addedSeparator = true;
                }
                result.push(entry);
                plain.push(entry);
            });
            return Object.freeze({ withSeparator: Object.freeze(result), plain: Object.freeze(plain) });
        },

        filteredDemonList() {
            const q = this.searchQuery.toLowerCase().trim();
            if (!q) return this.baseDemonList;
            return this.baseDemonList.filter(entry => entry.searchName.includes(q));
        },

        filteredDemonListClassic() {
            const q = this.searchQuery.toLowerCase().trim();
            if (!q) return this.baseDemonListClassic.withSeparator;
            return this.baseDemonListClassic.plain.filter(entry => entry.searchName.includes(q));
        },

        rows() {
            if (!this.list) return [];
            return this.activeList === 'classic' ? this.filteredDemonListClassic : this.filteredDemonList;
        },

        visibleRows() {
            return this.rows.slice(this.rowStart, this.rowEnd);
        },

        records() {
            return this.recordList
        },
        statusText() {
            if (!this.level) return '';
            const rl = this.recordList && this.recordList[this.level.name] ? this.recordList[this.level.name] : null;

            const interpretExplicit = (val) => {
                if (val === undefined || val === null) return null;
                if (typeof val === 'boolean') return val ? 'open' : 'closed';
                if (typeof val === 'string') {
                    const s = val.trim();
                    if (!s) return null;
                    const lower = s.toLowerCase();
                    if (lower === 'open' || lower === 'closed') return lower;
                    return s;
                }
                return null;
            };

            const levelExplicit = interpretExplicit(this.level.openVerification ?? this.level.verificationOpen ?? this.level.status);
            const recordExplicit = rl ? interpretExplicit(rl.openVerification ?? rl.verificationOpen ?? rl.status) : null;

            const formatDisplay = (s) => {
                if (!s) return '';
                const lower = s.toLowerCase();
                if (lower === 'open') return 'Open Verification';
                if (lower === 'closed') return 'Closed Verification';
                return s.charAt(0).toUpperCase() + s.slice(1);
            };

            if (typeof levelExplicit === 'string' && !['open','closed'].includes(levelExplicit.toLowerCase())) {
                return formatDisplay(levelExplicit);
            }
            if (typeof recordExplicit === 'string' && !['open','closed'].includes(recordExplicit.toLowerCase())) {
                return formatDisplay(recordExplicit);
            }

            if (levelExplicit === 'open' || recordExplicit === 'open') return 'Open Verification';
            if (levelExplicit === 'closed' || recordExplicit === 'closed') return 'Closed Verification';

            return '';
        }
    },
    created() {
        this.rowHeights = new Map();
        this.rowOffsets = [0];
    },
    async mounted() {
        if (!localStorage.getItem('edi_active_list')) {
            localStorage.setItem('edi_active_list', 'classic');
        }

        const pending = Promise.all([fetchRecords(), fetchEditors(), fetchPacks()]);
        this.demonList = await fetchList();
        
        const queryLevel = this.$route.query.level;
        if (queryLevel) {
            this.selected = this.demonList.indexOf(queryLevel);
            if (this.selected === -1) this.selected = 0;
        }
        
        if (this.activeList === 'upcoming') {
            const firstNonBench = this.baseDemonList.find(entry => !entry.isBenchmark);
            if (firstNonBench) this.selected = firstNonBench.index;
        }

        this.listLevel = await fetchLevel(this.list[this.selected]);
        [this.recordList, this.editors, this.packs] = await pending;
        this.hasLoaded = true;
        this.checkIfLegacy();

        if (!this.list) {
            this.errors = [
                "Failed to load list. Retry in a few minutes or notify list staff.",
            ];
        } else {
            if (!this.editors) {
                this.errors.push("Failed to load list editors.");
            }
        }

        this.loading = false;
        window.addEventListener('resize', this.onResize);
    },
    updated() {
        this.syncRows();
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.onResize);
    },
    methods: {
        embed,
        score,
        setActiveList(key) {
            if (key !== 'classic' && key !== 'upcoming') return;
            localStorage.setItem('edi_active_list', key);
            location.reload();
        },

        // list windowing stuff below
        // I'm actually suprised this worked
        // it brough search load time from like 500 ms to being near instant LMAO

        measureRows() {
            const table = this.$refs.listTable;
            if (!table) return;
            const rows = this.visibleRows;
            Array.from(table.rows).forEach((tr, i) => {
                if (rows[i]) this.rowHeights.set(rows[i].index, tr.getBoundingClientRect().height);
            });
        },
        buildOffsets() { // finds where each row starts
            let total = 0;
            this.rowHeights.forEach(height => total += height);
            const guess = this.rowHeights.size ? total / this.rowHeights.size : 44;
            const offsets = [0];
            this.rows.forEach((entry, i) => {
                offsets.push(offsets[i] + (this.rowHeights.get(entry.index) || guess));
            });
            this.rowOffsets = offsets;
            this.offsetRows = this.rows;
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
        updateWindow() { // defines which rows to draw 
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
        syncRows() { // rerun after each render and scroll
            const box = this.$refs.listContainer;
            const top = this.$refs.listTop;
            if (!box || !top) return;
            const offsets = this.rowOffsets;
            const sameRows = this.offsetRows === this.rows;
            const first = this.rowAt(box.getBoundingClientRect().top - top.getBoundingClientRect().top);
            this.measureRows();
            this.buildOffsets();
            const shift = sameRows ? this.rowOffsets[first] - offsets[first] : 0; //stops the view from jumping
            if (shift) box.scrollTop += shift;
            this.updateWindow();
        },
        // give me a raise for this
        // half a buck a year at least :cryign:
        onResize() {
            this.rowHeights.clear();
            this.syncRows();
        },
        selectPack(pack) {
            this.$router.push({ path: '/packs', query: { pack: pack.name } });
        },
        checkIfLegacy() {
            let entry;
            if (this.activeList === 'classic') {
                entry = this.baseDemonListClassic.plain[this.selected];
            } else {
                entry = this.baseDemonList[this.selected];
            }
            this.isLegacyLevel = entry ? entry.isLegacy : false;
        },
        async fetchLvl(i) {
            if (this.isLoading) {
                return;
            }
            this.isLoading = true;
            try {
                console.log(i)
                this.listLevel = await fetchLevel(this.demonList[i])
                if(!this.level) {
                    this.errors = [
                        "Failed to load level"
                    ]
                }
                this.hasLoaded = true;
                this.checkIfLegacy();
            } finally {
                this.isLoading = false;
            }
        },
    },
};