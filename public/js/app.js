// Shared Application Logic

const App = {
    // API Helpers
    api: {
        getHeaders() {
            const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
            return {
                'Content-Type': 'application/json',
                'x-user-id': user ? user.id : ''
            };
        },
        async get(endpoint) {
            try {
                const res = await fetch(endpoint, {
                    headers: this.getHeaders()
                });
                // Debugging: Check if response is JSON
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") === -1) {
                    const text = await res.text();
                    console.error("API Error: Expected JSON but got", contentType, "Body:", text);
                    throw new Error("Received non-JSON response from " + endpoint);
                }

                if (res.status === 401) {
                    console.warn("401 Unauthorized - Redirecting to login");
                    App.auth.logout(); // Clears storage and redirects
                    return null;
                }
                if (!res.ok) throw new Error('API Request Failed');
                return await res.json();
            } catch (e) {
                console.error(e);
                throw e;
            }
        },
        async post(endpoint, data) {
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: this.getHeaders(),
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
                    headers: this.getHeaders(),
                    body: JSON.stringify(data)
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Request Failed');
                return json;
                if (!res.ok) throw new Error(json.error || 'Request Failed');
                return json;
            } catch (e) {
                throw e;
            }
        },
        async delete(endpoint) {
            try {
                const res = await fetch(endpoint, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });
                const json = await res.json();
                if (res.status === 401) {
                    App.auth.logout();
                    return null;
                }
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
            window.location.href = '/login';
        },
        getUser() {
            const u = localStorage.getItem('currentUser');
            return u ? JSON.parse(u) : null;
        },
        requireUser() {
            if (!this.getUser()) {
                window.location.href = '/login';
            }
        }
    },

    // UI Helpers
    ui: {
        async updateNav() {
            const user = App.auth.getUser();
            const nav = document.getElementById('main-nav');
            if (!nav) return;

            const theme = localStorage.getItem('theme') || 'light';
            // iOS Style Switch for Dark Mode
            // Reviewed CSS: .switch, .slider, input:checked + .slider present in style.css
            const isDark = theme === 'dark';

            const brandHtml = `
                <a href="/" class="nav-brand" style="display: flex; align-items: center; gap: 0.75rem; text-decoration: none;">
                    <img src="/logo.svg" alt="MN" style="width: 40px; height: 40px;">
                    <span style="font-weight: 800; font-size: 1.2rem; color: var(--text-main); letter-spacing: -0.02em;">Matrimony Nepal</span>
                </a>
            `;
            const toggleHtml = `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 0.5rem;">
                    <label class="switch">
                        <input type="checkbox" onchange="App.ui.toggleTheme()" ${isDark ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            `;

            if (user) {
                // Fetch unread count
                let badgeHtml = '';
                try {
                    const res = await App.api.get('/api/notifications/unread-count');
                    if (res && res.count > 0) {
                        badgeHtml = `<span class="nav-badge">${res.count}</span>`;
                    }
                } catch (e) {
                    console.error("Badge fetch error", e);
                }

                nav.innerHTML = `
                    ${brandHtml}
                    <div class="nav-links" id="nav-menu" style="align-items: center;">
                        <a href="/browse" class="nav-link">Browse</a>
                        <a href="/inbox" class="nav-link">Inbox ${badgeHtml}</a>
                        <a href="/profile" class="nav-link">Profile</a>
                        <a href="#" onclick="App.ui.showSupport()" class="nav-link">Help</a>
                        ${toggleHtml}
                        <a href="#" onclick="App.auth.logout()" class="nav-btn">Logout</a>
                    </div>
                `;
            } else {
                nav.innerHTML = `
                    ${brandHtml}
                    <div class="nav-links" id="nav-menu" style="align-items: center;">
                        <a href="#" onclick="App.ui.showSupport()" class="nav-link">Help</a>
                        ${toggleHtml}
                        <a href="/login" class="nav-link">Login</a>
                        <a href="/signup" class="nav-btn">Start Here</a>
                    </div>
                `;
            }
        },
        toggleTheme() {
            const current = localStorage.getItem('theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            document.documentElement.setAttribute('data-theme', next);
            this.updateNav(); // Refresh icon
        },
        // Display a toast notification
        toast(message, type = 'success') {
            const div = document.createElement('div');
            div.textContent = message;
            div.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: ${type === 'error' ? '#fee2e2' : '#dcfce7'};
                color: ${type === 'error' ? '#b91c1c' : '#166534'};
                padding: 0.75rem 1.5rem; border-radius: 99px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 2000; font-weight: 500; font-size: 0.9rem;
                opacity: 0; transition: opacity 0.3s, transform 0.3s;
            `;
            document.body.appendChild(div);
            // Animate in
            requestAnimationFrame(() => {
                div.style.opacity = '1';
                div.style.transform = 'translateX(-50%) translateY(0)';
            });
            // Remove after 3s
            setTimeout(() => {
                div.style.opacity = '0';
                div.style.transform = 'translateX(-50%) translateY(-10px)';
                setTimeout(() => div.remove(), 300);
            }, 3000);
        },
        // Custom confirmation modal
        confirm(message, onConfirm) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.5);
                display: flex; align-items: center; justify-content: center;
                z-index: 2000; backdrop-filter: blur(4px);
            `;
            const box = document.createElement('div');
            box.className = 'card animate-fade-up';
            box.style.cssText = `
                width: 90%; max-width: 400px; padding: 2rem;
                background: var(--bg-surface); border-radius: 20px; text-align: center;
            `;
            box.innerHTML = `
                <h3 style="margin-top: 0; color: var(--text-main);">Confirm Action</h3>
                <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="confirm-cancel" class="nav-btn" style="background: #003893; border: none; cursor: pointer;">Cancel</button>
                    <button id="confirm-ok" class="nav-btn" style="border: none; cursor: pointer;">Confirm</button>
                </div>
            `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            document.getElementById('confirm-cancel').onclick = () => overlay.remove();
            document.getElementById('confirm-ok').onclick = () => {
                overlay.remove();
                onConfirm();
            };
        },
        // Show Support/Donation Modal
        showSupport() {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.5);
                display: flex; align-items: center; justify-content: center;
                z-index: 2000; backdrop-filter: blur(4px);
            `;
            const box = document.createElement('div');
            box.className = 'card animate-fade-up';
            box.style.cssText = `
                width: 90%; max-width: 450px; padding: 2.5rem;
                background: var(--bg-surface); border-radius: 24px; text-align: center;
                position: relative;
            `;
            box.innerHTML = `
                <button id="support-close" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
                <div style="font-size: 3rem; margin-bottom: 1rem;">🇳🇵</div>
                <h3 style="margin-top: 0; color: var(--text-main); font-size: 1.5rem;">Support Matrimony Nepal</h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem; line-height: 1.6;">
                    Help us keep this platform <strong>ad-free</strong> and accessible for everyone. 
                    Your contribution directly supports server costs and future development.
                </p>
                <div style="background: var(--bg-subtle); padding: 1.5rem; border-radius: 16px; margin-bottom: 2rem; border: 1px solid var(--glass-border);">
                    <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Donate via eSewa</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #4CAF50; letter-spacing: 0.05em;">98XXXXXXXX</div>
                </div>
                <button id="support-done" class="btn-primary" style="width: 100%;">Thank You!</button>
            `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            document.getElementById('support-close').onclick = close;
            document.getElementById('support-done').onclick = close;

            // Close on click outside
            overlay.onclick = (e) => {
                if (e.target === overlay) close();
            };
        },
        // Verification Modal
        showVerificationModal(email) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.5);
                display: flex; align-items: center; justify-content: center;
                z-index: 2000; backdrop-filter: blur(4px);
            `;
            const box = document.createElement('div');
            box.style.cssText = `
                width: 90%; max-width: 400px; padding: 2rem;
                background: var(--bg-surface); border-radius: 24px; text-align: center;
                position: relative;
            `;
            box.innerHTML = `
                <h3 style="margin-top:0;">Verify Email</h3>
                <p>We sent a 6-digit code to <strong>${email}</strong></p>
                <input type="text" id="otp-input" class="input-field text-center" placeholder="123456" style="font-size: 1.5rem; letter-spacing: 0.5rem; margin: 1.5rem 0;">
                
                <button id="verify-btn" class="btn-primary w-full" style="margin-bottom: 1rem;">Verify & Login</button>
                
                <div style="display: flex; justify-content: space-between; gap: 1rem;">
                    <button id="resend-btn" style="background: none; border: none; color: var(--accent); cursor: pointer; font-size: 0.9rem;">Resend Code</button>
                    <button id="cancel-verify" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.9rem;">Cancel</button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            // Handler: Verify
            const handleVerify = async () => {
                const code = document.getElementById('otp-input').value;
                try {
                    const res = await App.api.post('/api/verify', { email, code });
                    App.auth.login(res);
                    App.ui.toast("Verified! Welcome to Matrimony Nepal");
                    overlay.remove();
                    window.location.href = (res.qualities && res.qualities.length > 0) ? '/browse' : '/profile';
                } catch (e) {
                    App.ui.toast(e.message, 'error');
                }
            };

            // Handler: Resend
            const handleResend = async () => {
                const btn = document.getElementById('resend-btn');
                btn.disabled = true;
                btn.textContent = "Sending...";
                try {
                    await App.api.post('/api/resend-code', { email });
                    App.ui.toast("New code sent!");
                    btn.textContent = "Sent!";
                    setTimeout(() => { btn.disabled = false; btn.textContent = "Resend Code"; }, 30000);
                } catch (e) {
                    App.ui.toast(e.message, 'error');
                    btn.disabled = false;
                    btn.textContent = "Resend Code";
                }
            };

            // Handler: Cancel
            const handleCancel = () => {
                overlay.remove();
                if (window.location.pathname.includes('signup')) {
                    // Redirect to login or home if they cancel signup verification
                    window.location.href = '/login';
                }
            };

            document.getElementById('verify-btn').onclick = handleVerify;
            document.getElementById('resend-btn').onclick = handleResend;
            document.getElementById('cancel-verify').onclick = handleCancel;
        }
    },
    init: () => {
        // Apply theme immediately
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);

        App.ui.updateNav();
        // Poll for notifications
        setInterval(() => App.ui.updateNav(), 10000);

        // Parallax Halo Effect
        const parallaxWrapper = document.createElement('div');
        parallaxWrapper.className = 'parallax-wrapper';
        document.body.appendChild(parallaxWrapper);

        const orbs = [
            { size: '600px', color: 'var(--primary)', top: '-10%', left: '-10%', speed: 0.2 },
            { size: '500px', color: 'var(--accent)', top: '40%', right: '-10%', speed: 0.15 },
            { size: '400px', color: '#DC143C', bottom: '-10%', left: '20%', speed: 0.1 },
            { size: '300px', color: '#f59e0b', top: '20%', left: '50%', speed: 0.25 }
        ];

        orbs.forEach((orb, index) => {
            const el = document.createElement('div');
            el.className = 'halo-orb';
            Object.assign(el.style, {
                width: orb.size,
                height: orb.size,
                background: orb.color,
                top: orb.top || 'auto',
                left: orb.left || 'auto',
                right: orb.right || 'auto',
                bottom: orb.bottom || 'auto'
            });
            parallaxWrapper.appendChild(el);
            orb.el = el; // Store reference
        });

        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            requestAnimationFrame(() => {
                orbs.forEach(orb => {
                    // Move orb based on scroll speed
                    const yPos = scrolled * orb.speed;
                    orb.el.style.transform = `translateY(${yPos}px)`;
                });
            });
        });
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
