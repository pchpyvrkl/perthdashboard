            const PIN_USERS = {
                '120905': 'PONGSAKORN',
                '300350': 'Aom',
                '061606': 'Dome'
            };
            let pinEntry = '';
            let currentUser = '';

            function pinPress(digit) {
                if (pinEntry.length >= 6) return;
                pinEntry += digit;
                updatePinDots();
                if (pinEntry.length === 6) {
                    setTimeout(checkPin, 80);
                }
            }

            function pinDel() {
                if (pinEntry.length === 0) return;
                pinEntry = pinEntry.slice(0, -1);
                updatePinDots();
            }

            function toggleFullscreen() {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.log(`Error attempting to enable fullscreen: ${err.message}`);
                    });
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }
            }

            function updatePinDots(state) {
                for (let i = 0; i < 6; i++) {
                    const dot = document.getElementById('d' + i);
                    dot.className = 'pin-dot';
                    if (state === 'error') dot.classList.add('error');
                    else if (state === 'success') dot.classList.add('success');
                    else if (i < pinEntry.length) dot.classList.add('filled');
                }
            }

            function checkPin() {
                if (PIN_USERS[pinEntry]) {
                    currentUser = PIN_USERS[pinEntry];
                    updatePinDots('success');
                    setTimeout(() => {
                        // Check privacy mode toggle
                        const privacyToggle = document.getElementById('privacy-mode-toggle');
                        financialPrivacyEnabled = privacyToggle.checked;

                        // Hide PIN keypad and show loading screen
                        const pinKeypadWrap = document.getElementById('pin-keypad-wrap');
                        const pinBrand = document.getElementById('pin-brand');
                        const loadingScreen = document.getElementById('loading-screen');

                        pinKeypadWrap.style.display = 'none';
                        pinBrand.style.display = 'none';
                        loadingScreen.style.display = 'flex';

                        // Load data and then show dashboard
                        setTimeout(() => {
                            continueToDashboard();
                        }, 1000);
                    }, 350);
                } else {
                    updatePinDots('error');
                    const dots = document.getElementById('pin-dots');
                    dots.classList.add('pin-shake');
                    const hint = document.getElementById('pin-hint');
                    hint.textContent = 'Incorrect PIN';
                    hint.style.color = '#FF4545';
                    setTimeout(() => {
                        pinEntry = '';
                        updatePinDots();
                        dots.classList.remove('pin-shake');
                        hint.textContent = '';
                    }, 700);
                }
            }

            function continueToDashboard() {
                const overlay = document.getElementById('pin-overlay');
                const loadingScreen = document.getElementById('loading-screen');
                const mainContent = document.getElementById('main-content');
                
                loadingScreen.style.display = 'none';
                overlay.classList.add('fade-out');
                mainContent.style.display = 'block';
                setTimeout(() => overlay.style.display = 'none', 650);
                
                // Update greeting immediately after login
                const bangkokHour = parseInt(new Intl.DateTimeFormat('en-US', { hour:'2-digit', hour12:false, timeZone:'Asia/Bangkok' }).format(new Date()), 10);
                const greetingEl = document.getElementById('user-greeting');
                if (greetingEl) greetingEl.textContent = getGreetingFromHour(bangkokHour, currentUser);
            }

            // Also allow physical keyboard input
            document.addEventListener('keydown', (e) => {
                const mainContent = document.getElementById('main-content');
                if (mainContent.style.display !== 'none') return;
                
                // Handle PIN input
                if (e.key >= '0' && e.key <= '9') pinPress(e.key);
                else if (e.key === 'Backspace') pinDel();
            });

                    // Switch PIN keypad layout based on screen width
            function applyPinLayout() {
                const isPhone = window.innerWidth < 640;
                const grid = document.getElementById('pin-grid');
                const vert = document.getElementById('pin-vertical');
                if (!grid || !vert) return;
                
                if (isPhone) {
                    grid.style.display = 'none';
                    vert.style.display = 'grid';
                    // On phone: put brand above, keypad below — already column
                } else {
                    grid.style.display = 'grid';
                    vert.style.display = 'none';
                }
            }
            applyPinLayout();
            window.addEventListener('resize', applyPinLayout);

            // Initialize overview view on page load
