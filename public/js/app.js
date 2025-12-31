// Shared Application Logic

const App = {
    // API Helpers
    api: {
        async get(endpoint) {
            try {
                const res = await fetch(endpoint);
                if (!res.ok) throw new Error('API Request Failed');
                return await res.json();
            } catch (e) {
                console.error(e);
                return null;
            }
        },
        async post(endpoint, data) {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Request Failed');
                return json;
            } catch (e) {
                throw e;
            }
        },
        async put(endpoint, data) {
            try {
                const res = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Request Failed');
                return json;
            } catch (e) {
                throw e;
            }
        }
    },

    // Auth Management
    auth: {
        login(user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        },
        logout() {
            localStorage.removeItem('currentUser');
            window.location.href = '/login.html';
        },
        getUser() {
            const u = localStorage.getItem('currentUser');
            return u ? JSON.parse(u) : null;
        },
        requireUser() {
            if (!this.getUser()) {
                window.location.href = '/login.html';
            }
        }
    },

    // UI Helpers
    ui: {
        updateNav() {
            const user = App.auth.getUser();
            const nav = document.getElementById('main-nav');
            if (!nav) return;

            const brandHtml = `
                <a href="/" class="nav-brand" style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="/logo.svg" alt="MN" style="width: 40px; height: 40px;">
                </a>
            `;

            if (user) {
                nav.innerHTML = `
                    ${brandHtml}
                    <div class="nav-links">
                        <a href="/browse.html" class="nav-link">Browse</a>
                        <a href="/profile.html" class="nav-link">Profile</a>
                        <a href="#" onclick="App.auth.logout()" class="nav-btn">Logout</a>
                    </div>
                `;
            } else {
                nav.innerHTML = `
                    ${brandHtml}
                    <div class="nav-links">
                        <a href="/login.html" class="nav-link">Login</a>
                        <a href="/signup.html" class="nav-btn">Start Here</a>
                    </div>
                `;
            }
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    App.ui.updateNav();
});
