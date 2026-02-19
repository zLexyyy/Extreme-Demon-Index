import routes from './routes.js';

export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,
    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    },
});

const app = Vue.createApp({
    data: () => ({ store }),
});
const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

app.use(router);

app.mount('#app');

// Handle scrollbar interaction on mobile
document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.querySelector('.list-container');
    if (!listContainer) return;

    let isScrolling = false;
    
    // Track mouse/touch down on scrollbar area
    listContainer.addEventListener('pointerdown', (e) => {
        const scrollbarWidth = 16;
        const isNearScrollbar = e.clientX > listContainer.offsetWidth - scrollbarWidth;
        if (isNearScrollbar) {
            isScrolling = true;
            handleScroll(e, listContainer);
        }
    });

    // Handle scroll while dragging
    document.addEventListener('pointermove', (e) => {
        if (isScrolling) {
            handleScroll(e, listContainer);
        }
    });

    // Stop scrolling
    document.addEventListener('pointerup', () => {
        isScrolling = false;
    });
});

function handleScroll(e, container) {
    const rect = container.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    container.scrollTop = percentage * (container.scrollHeight - container.clientHeight);
}

