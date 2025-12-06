// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyYOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
let app, auth, db;
let deferredPrompt = null;
let currentUser = null;
let userRole = null;
let currentFacility = null;
let offlineQueue = [];
let isOnline = navigator.onLine;

// IA2030 Vaccine Schedule
const VACCINE_SCHEDULE = {
    'BCG': { weeks: 0, dose: 'Birth', description: 'Bacillus Calmette-Guérin' },
    'OPV0': { weeks: 0, dose: 'Birth', description: 'Oral Polio Vaccine' },
    'HepB_Birth': { weeks: 0, dose: 'Birth', description: 'Hepatitis B' },
    'OPV1': { weeks: 6, dose: 1, description: 'Oral Polio Vaccine' },
    'Penta1': { weeks: 6, dose: 1, description: 'Pentavalent Vaccine' },
    'PCV1': { weeks: 6, dose: 1, description: 'Pneumococcal Conjugate Vaccine' },
    'Rota1': { weeks: 6, dose: 1, description: 'Rotavirus Vaccine' },
    'OPV2': { weeks: 10, dose: 2, description: 'Oral Polio Vaccine' },
    'Penta2': { weeks: 10, dose: 2, description: 'Pentavalent Vaccine' },
    'PCV2': { weeks: 10, dose: 2, description: 'Pneumococcal Conjugate Vaccine' },
    'Rota2': { weeks: 10, dose: 2, description: 'Rotavirus Vaccine' },
    'OPV3': { weeks: 14, dose: 3, description: 'Oral Polio Vaccine' },
    'Penta3': { weeks: 14, dose: 3, description: 'Pentavalent Vaccine' },
    'PCV3': { weeks: 14, dose: 3, description: 'Pneumococcal Conjugate Vaccine' },
    'Rota3': { weeks: 14, dose: 3, description: 'Rotavirus Vaccine' },
    'IPV1': { weeks: 14, dose: 1, description: 'Inactivated Polio Vaccine' },
    'Malaria1': { months: 6, dose: 1, description: 'Malaria Vaccine' },
    'VitaminA_6m': { months: 6, dose: 1, description: 'Vitamin A Supplement' },
    'Malaria2': { months: 7, dose: 2, description: 'Malaria Vaccine' },
    'IPV2': { months: 7, dose: 2, description: 'Inactivated Polio Vaccine' },
    'Malaria3': { months: 9, dose: 3, description: 'Malaria Vaccine' },
    'MR1': { months: 9, dose: 1, description: 'Measles-Rubella Vaccine' },
    'VitaminA_12m': { months: 12, dose: 2, description: 'Vitamin A Supplement' },
    'Malaria4': { months: 18, dose: 4, description: 'Malaria Vaccine' },
    'MR2': { months: 18, dose: 2, description: 'Measles-Rubella Vaccine' },
    'LLIN': { months: 18, dose: 1, description: 'Long-Lasting Insecticidal Net' },
    'MenA': { months: 18, dose: 1, description: 'Meningitis A Vaccine' },
    'VitaminA_18m': { months: 18, dose: 3, description: 'Vitamin A Supplement' }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        // Initialize Firebase
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Enable offline persistence
        await db.enablePersistence({ synchronizeTabs: true })
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code === 'unimplemented') {
                    console.warn('The current browser doesn\'t support persistence.');
                }
            });
        
        // Set up auth state listener
        auth.onAuthStateChanged(handleAuthStateChange);
        
        // Set up network status listener
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Set up PWA install prompt
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        // Set max date for DOB input (today)
        document.getElementById('child-dob').max = new Date().toISOString().split('T')[0];
        
        // Initialize event listeners
        setupEventListeners();
        
        // Check if app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Running in standalone mode');
        }
        
        // Show loading overlay initially
        showLoading();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Error initializing application', 'error');
    } finally {
        hideLoading();
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Auth forms
    document.getElementById('show-register').addEventListener('click', showRegisterForm);
    document.getElementById('show-login').addEventListener('click', showLoginForm);
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    
    // Navigation
    document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('notifications-btn').addEventListener('click', toggleNotifications);
    document.getElementById('close-notifications').addEventListener('click', toggleNotifications);
    
    // Page navigation
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    
    document.querySelectorAll('.dropdown-menu a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    
    // Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Install prompt
    document.getElementById('install-btn').addEventListener('click', installApp);
    document.getElementById('dismiss-install').addEventListener('click', dismissInstallPrompt);
    
    // Sync
    document.getElementById('sync-status').addEventListener('click', manualSync);
    
    // Child form
    document.getElementById('child-form').addEventListener('submit', handleAddChild);
    
    // Real-time validation
    setupRealTimeValidation();
}

// Auth State Handler
async function handleAuthStateChange(user) {
    if (user) {
        // User is signed in
        if (!user.emailVerified) {
            await auth.signOut();
            showToast('Please verify your email before logging in', 'warning');
            return;
        }
        
        currentUser = user;
        await loadUserData();
        showAppScreen();
        loadDashboard();
        startBackgroundSync();
    } else {
        // User is signed out
        currentUser = null;
        userRole = null;
        currentFacility = null;
        showAuthScreen();
    }
}

// Load User Data
async function loadUserData() {
    try {
        showLoading();
        
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            userRole = userData.role;
            currentFacility = userData.facilityId;
            
            // Update UI with user info
            document.getElementById('user-name').textContent = userData.name;
            document.getElementById('facility-info').textContent = userData.facilityName || 'No facility assigned';
            
            // Show/hide admin menu items
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = userRole === 'admin' || userRole === 'super_admin' ? 'block' : 'none';
            });
            
            // Load notifications
            loadNotifications();
            
            // Process offline queue
            if (isOnline) {
                processOfflineQueue();
            }
        } else {
            // Create user document if it doesn't exist
            await db.collection('users').doc(currentUser.uid).set({
                email: currentUser.email,
                name: currentUser.displayName || 'User',
                role: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data', 'error');
    } finally {
        hideLoading();
    }
}

// Authentication Functions
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!email || !password) {
        errorElement.textContent = 'Please enter email and password';
        errorElement.classList.add('show');
        return;
    }
    
    try {
        showLoading();
        await auth.signInWithEmailAndPassword(email, password);
        errorElement.classList.remove('show');
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = 'Invalid email or password';
        errorElement.classList.add('show');
    } finally {
        hideLoading();
    }
}

async function handleRegister() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const facility = document.getElementById('register-facility').value;
    const location = document.getElementById('register-location').value;
    const code = document.getElementById('register-code').value;
    
    if (!name || !email || !password || !facility || !location || !code) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update user profile
        await user.updateProfile({ displayName: name });
        
        // Send email verification
        await user.sendEmailVerification();
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: 'pending',
            facilityName: facility,
            facilityLocation: location,
            facilityCode: code,
            facilityId: null,
            status: 'pending_approval',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create facility request
        await db.collection('facility_requests').add({
            userId: user.uid,
            userName: name,
            userEmail: email,
            facilityName: facility,
            facilityLocation: location,
            facilityCode: code,
            status: 'pending',
            requestedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Log out user (they need to verify email first)
        await auth.signOut();
        
        showToast('Registration successful! Please check your email for verification. Your account requires admin approval.', 'success');
        showLoginForm();
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast(`Registration failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        showLoading();
        await auth.signOut();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    } finally {
        hideLoading();
    }
}

// UI Navigation Functions
function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    showLoginForm();
}

function showAppScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
}

function showLoginForm() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('register-form').classList.remove('active');
    clearAuthForms();
}

function showRegisterForm(e) {
    if (e) e.preventDefault();
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
    clearAuthForms();
}

function clearAuthForms() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-facility').value = '';
    document.getElementById('register-location').value = '';
    document.getElementById('register-code').value = '';
    document.getElementById('login-error').classList.remove('show');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function toggleNotifications() {
    document.getElementById('notifications-panel').classList.toggle('active');
}

function handleNavigation(e) {
    e.preventDefault();
    const page = e.target.getAttribute('data-page') || 
                 e.target.closest('a').getAttribute('data-page');
    
    if (page === 'profile' || page === 'settings') {
        // Handle profile/settings pages
        navigateTo(page);
    } else if (page === 'logout') {
        handleLogout();
    } else {
        // Handle main navigation
        navigateTo(page);
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        document.querySelector('.sidebar').classList.remove('active');
    }
    
    // Close notifications panel
    document.getElementById('notifications-panel').classList.remove('active');
}

function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(`${page}-page`).classList.add('active');
    document.getElementById('page-title').textContent = 
        page.charAt(0).toUpperCase() + page.slice(1);
    
    // Set active nav item
    const activeLink = document.querySelector(`.nav-menu a[data-page="${page}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load page content
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'children':
            loadChildrenPage();
            break;
        case 'vaccines':
            loadVaccinesPage();
            break;
        case 'reports':
            loadReportsPage();
            break;
        case 'stock':
            loadStockPage();
            break;
        case 'cold-chain':
            loadColdChainPage();
            break;
        case 'facilities':
            loadFacilitiesPage();
            break;
        case 'users':
            loadUsersPage();
            break;
        case 'audit':
            loadAuditPage();
            break;
    }
}

// Dashboard Functions
async function loadDashboard() {
    try {
        showLoading();
        
        const dashboardPage = document.getElementById('dashboard-page');
        
        // Create dashboard content
        dashboardPage.innerHTML = `
            <div class="dashboard-cards">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Total Children</h3>
                        <div class="card-icon total">
                            <i class="fas fa-child"></i>
                        </div>
                    </div>
                    <div class="card-value" id="total-children">0</div>
                    <div class="card-change">This month: <span id="monthly-change">0</span></div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Due Soon</h3>
                        <div class="card-icon due">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                    <div class="card-value" id="due-soon">0</div>
                    <div class="card-change">Next 7 days</div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Overdue</h3>
                        <div class="card-icon overdue">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="card-value" id="overdue">0</div>
                    <div class="card-change">Requires attention</div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Completed</h3>
                        <div class="card-icon completed">
                            <i class="fas fa-check-circle"></i>
                        </div>
                    </div>
                    <div class="card-value" id="completed">0</div>
                    <div class="card-change">This month: <span id="monthly-completed">0</span></div>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3 class="chart-title">Monthly Coverage Trend</h3>
                    <div class="chart-actions">
                        <select id="coverage-period">
                            <option value="3">Last 3 months</option>
                            <option value="6" selected>Last 6 months</option>
                            <option value="12">Last year</option>
                        </select>
                    </div>
                </div>
                <canvas id="coverage-chart" height="300"></canvas>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Recent Defaulters</h3>
                    <div class="table-actions">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="defaulter-search" placeholder="Search defaulters...">
                        </div>
                        <button class="btn-primary" onclick="exportDefaulters()">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table id="defaulters-table">
                        <thead>
                            <tr>
                                <th>Child Name</th>
                                <th>Age</th>
                                <th>Vaccine</th>
                                <th>Due Date</th>
                                <th>Days Overdue</th>
                                <th>Guardian Phone</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Defaulters will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Load dashboard data
        await loadDashboardData();
        
        // Initialize chart
        await initializeCoverageChart();
        
        // Load defaulters
        await loadDefaulters();
        
        // Add event listeners for new elements
        document.getElementById('coverage-period').addEventListener('change', initializeCoverageChart);
        document.getElementById('defaulter-search').addEventListener('input', searchDefaulters);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard', 'error');
    } finally {
        hideLoading();
    }
}

async function loadDashboardData() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        // Get total children count
        const childrenSnapshot = await db.collection('children')
            .where('facilityId', '==', currentFacility)
            .get();
        
        const totalChildren = childrenSnapshot.size;
        document.getElementById('total-children').textContent = totalChildren;
        
        // Get monthly change
        const lastMonthSnapshot = await db.collection('children')
            .where('facilityId', '==', currentFacility)
            .where('createdAt', '>=', startOfLastMonth)
            .where('createdAt', '<', startOfMonth)
            .get();
        
        const thisMonthSnapshot = await db.collection('children')
            .where('facilityId', '==', currentFacility)
            .where('createdAt', '>=', startOfMonth)
            .get();
        
        const monthlyChange = thisMonthSnapshot.size - lastMonthSnapshot.size;
        const monthlyChangeElement = document.getElementById('monthly-change');
        monthlyChangeElement.textContent = monthlyChange;
        monthlyChangeElement.className = monthlyChange >= 0 ? 'positive' : 'negative';
        
        // Calculate due soon and overdue vaccines
        let dueSoonCount = 0;
        let overdueCount = 0;
        let completedCount = 0;
        let monthlyCompletedCount = 0;
        
        childrenSnapshot.forEach(childDoc => {
            const child = childDoc.data();
            const vaccines = child.vaccines || {};
            
            Object.values(vaccines).forEach(vaccine => {
                if (vaccine.status === 'completed') {
                    completedCount++;
                    if (vaccine.administeredDate >= startOfMonth) {
                        monthlyCompletedCount++;
                    }
                } else if (vaccine.status === 'pending') {
                    const dueDate = vaccine.dueDate.toDate();
                    const today = new Date();
                    const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
                    
                    if (daysDiff < 0) {
                        overdueCount++;
                    } else if (daysDiff <= 7) {
                        dueSoonCount++;
                    }
                }
            });
        });
        
        document.getElementById('due-soon').textContent = dueSoonCount;
        document.getElementById('overdue').textContent = overdueCount;
        document.getElementById('completed').textContent = completedCount;
        document.getElementById('monthly-completed').textContent = monthlyCompletedCount;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function initializeCoverageChart() {
    try {
        const period = parseInt(document.getElementById('coverage-period').value);
        const canvas = document.getElementById('coverage-chart');
        const ctx = canvas.getContext('2d');
        
        // Get coverage data for the selected period
        const coverageData = await getCoverageData(period);
        
        // Destroy existing chart if it exists
        if (window.coverageChart) {
            window.coverageChart.destroy();
        }
        
        // Create new chart
        window.coverageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: coverageData.labels,
                datasets: [
                    {
                        label: 'Vaccination Coverage (%)',
                        data: coverageData.coverage,
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Target (90%)',
                        data: coverageData.labels.map(() => 90),
                        borderColor: '#38a169',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Coverage %'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
}

async function getCoverageData(months) {
    // This is a simplified version - in production, you'd query Firestore for actual data
    const now = new Date();
    const data = {
        labels: [],
        coverage: []
    };
    
    for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        data.labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        
        // Simulate coverage data (replace with actual Firestore queries)
        const coverage = Math.min(95, 70 + Math.random() * 30);
        data.coverage.push(parseFloat(coverage.toFixed(1)));
    }
    
    return data;
}

async function loadDefaulters() {
    try {
        const tbody = document.querySelector('#defaulters-table tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
        
        // Get children with overdue vaccines
        const childrenSnapshot = await db.collection('children')
            .where('facilityId', '==', currentFacility)
            .get();
        
        const defaulters = [];
        const today = new Date();
        
        childrenSnapshot.forEach(childDoc => {
            const child = childDoc.data();
            const vaccines = child.vaccines || {};
            
            Object.entries(vaccines).forEach(([vaccineId, vaccine]) => {
                if (vaccine.status === 'pending' && vaccine.dueDate) {
                    const dueDate = vaccine.dueDate.toDate();
                    if (dueDate < today) {
                        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                        defaulters.push({
                            childId: childDoc.id,
                            childName: `${child.firstName} ${child.lastName}`,
                            age: calculateAge(child.dob.toDate()),
                            vaccineId: vaccineId,
                            vaccineName: VACCINE_SCHEDULE[vaccineId]?.description || vaccineId,
                            dueDate: dueDate,
                            daysOverdue: daysOverdue,
                            guardianPhone: child.guardianPhone,
                            childData: child
                        });
                    }
                }
            });
        });
        
        // Sort by days overdue (descending)
        defaulters.sort((a, b) => b.daysOverdue - a.daysOverdue);
        
        // Display defaulters
        if (defaulters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No defaulters found</td></tr>';
            return;
        }
        
        tbody.innerHTML = defaulters.map(defaulter => `
            <tr>
                <td>${escapeHtml(defaulter.childName)}</td>
                <td>${defaulter.age}</td>
                <td>${escapeHtml(defaulter.vaccineName)}</td>
                <td>${formatDate(defaulter.dueDate)}</td>
                <td><span class="status-badge overdue">${defaulter.daysOverdue} days</span></td>
                <td>${escapeHtml(defaulter.guardianPhone)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="remindDefaulter('${defaulter.childId}', '${defaulter.vaccineId}')" title="Send Reminder">
                            <i class="fas fa-bell"></i>
                        </button>
                        <button class="action-btn" onclick="viewChild('${defaulter.childId}')" title="View Child">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn" onclick="markAsAdministered('${defaulter.childId}', '${defaulter.vaccineId}')" title="Mark as Administered">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading defaulters:', error);
        document.querySelector('#defaulters-table tbody').innerHTML = 
            '<tr><td colspan="7" class="text-center error">Error loading defaulters</td></tr>';
    }
}

// Child Management Functions
async function handleAddChild(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('child-first-name').value.trim();
    const lastName = document.getElementById('child-last-name').value.trim();
    const dob = document.getElementById('child-dob').value;
    const gender = document.getElementById('child-gender').value;
    const weight = document.getElementById('child-weight').value;
    const guardian = document.getElementById('child-guardian').value.trim();
    const phone = document.getElementById('child-phone').value.trim();
    const address = document.getElementById('child-address').value.trim();
    const notes = document.getElementById('child-notes').value.trim();
    
    if (!firstName || !lastName || !dob || !gender || !guardian || !phone) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        // Generate unique child ID
        const childId = generateChildId();
        
        // Calculate vaccine schedule
        const vaccines = calculateVaccineSchedule(new Date(dob));
        
        // Create child document
        const childData = {
            childId: childId,
            firstName: firstName,
            lastName: lastName,
            dob: new Date(dob),
            gender: gender,
            weight: weight ? parseFloat(weight) : null,
            guardianName: guardian,
            guardianPhone: phone,
            address: address,
            notes: notes,
            facilityId: currentFacility,
            registeredBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            vaccines: vaccines,
            status: 'active'
        };
        
        // Add to Firestore
        await db.collection('children').add(childData);
        
        // Log audit trail
        await logAudit('child_registered', `Registered child: ${firstName} ${lastName}`, {
            childId: childId,
            childName: `${firstName} ${lastName}`
        });
        
        // Close modal and reset form
        closeAllModals();
        document.getElementById('child-form').reset();
        
        showToast(`Child ${firstName} ${lastName} registered successfully!`, 'success');
        
        // Refresh children list if on children page
        if (document.getElementById('children-page').classList.contains('active')) {
            loadChildrenPage();
        }
        
        // Refresh dashboard
        loadDashboardData();
        
    } catch (error) {
        console.error('Error adding child:', error);
        showToast(`Error adding child: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function generateChildId() {
    const facilityCode = currentFacility ? currentFacility.substring(0, 6) : 'FAC001';
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${facilityCode}-${year}-${random}`;
}

function calculateVaccineSchedule(dob) {
    const schedule = {};
    const today = new Date();
    
    Object.entries(VACCINE_SCHEDULE).forEach(([vaccineId, vaccine]) => {
        let dueDate = new Date(dob);
        
        if (vaccine.weeks !== undefined) {
            dueDate.setDate(dueDate.getDate() + (vaccine.weeks * 7));
        } else if (vaccine.months !== undefined) {
            dueDate.setMonth(dueDate.getMonth() + vaccine.months);
        }
        
        // Calculate status
        let status = 'pending';
        if (dueDate < today) {
            status = 'overdue';
        }
        
        schedule[vaccineId] = {
            dueDate: dueDate,
            status: status,
            administeredDate: null,
            administeredBy: null,
            notes: '',
            missed: false,
            dose: vaccine.dose,
            description: vaccine.description
        };
    });
    
    return schedule;
}

function calculateAge(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    if (years > 0) {
        return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
    } else {
        return `${months} month${months !== 1 ? 's' : ''}`;
    }
}

// Page Loading Functions
async function loadChildrenPage() {
    try {
        showLoading();
        
        const page = document.getElementById('children-page');
        page.innerHTML = `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Children (0-59 months)</h3>
                    <div class="table-actions">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="child-search" placeholder="Search children...">
                        </div>
                        <button class="btn-primary" onclick="showAddChildModal()">
                            <i class="fas fa-plus"></i> Add Child
                        </button>
                        <button class="btn-secondary" onclick="exportChildren()">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table id="children-table">
                        <thead>
                            <tr>
                                <th>Child ID</th>
                                <th>Name</th>
                                <th>Age</th>
                                <th>Gender</th>
                                <th>Guardian</th>
                                <th>Phone</th>
                                <th>Vaccine Status</th>
                                <th>Last Visit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Children will be loaded here -->
                        </tbody>
                    </table>
                </div>
                <div class="table-footer">
                    <div class="pagination" id="children-pagination">
                        <!-- Pagination will be added here -->
                    </div>
                </div>
            </div>
        `;
        
        await loadChildrenTable();
        
        // Add event listeners
        document.getElementById('child-search').addEventListener('input', searchChildren);
        
    } catch (error) {
        console.error('Error loading children page:', error);
        showToast('Error loading children page', 'error');
    } finally {
        hideLoading();
    }
}

async function loadChildrenTable() {
    try {
        const tbody = document.querySelector('#children-table tbody');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading...</td></tr>';
        
        // Get children for current facility
        const childrenSnapshot = await db.collection('children')
            .where('facilityId', '==', currentFacility)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        if (childrenSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No children registered yet</td></tr>';
            return;
        }
        
        let tableHTML = '';
        childrenSnapshot.forEach(doc => {
            const child = doc.data();
            const age = calculateAge(child.dob.toDate());
            const vaccineStatus = calculateVaccineStatus(child.vaccines || {});
            
            tableHTML += `
                <tr>
                    <td>${child.childId}</td>
                    <td>${escapeHtml(child.firstName)} ${escapeHtml(child.lastName)}</td>
                    <td>${age}</td>
                    <td>${child.gender}</td>
                    <td>${escapeHtml(child.guardianName)}</td>
                    <td>${escapeHtml(child.guardianPhone)}</td>
                    <td>
                        <div class="status-indicators">
                            <span class="status-badge ${vaccineStatus.overdue > 0 ? 'overdue' : 'completed'}">
                                ${vaccineStatus.completed}/${vaccineStatus.total}
                            </span>
                            ${vaccineStatus.overdue > 0 ? `
                                <span class="badge-count overdue">${vaccineStatus.overdue} overdue</span>
                            ` : ''}
                            ${vaccineStatus.dueSoon > 0 ? `
                                <span class="badge-count due-soon">${vaccineStatus.dueSoon} due soon</span>
                            ` : ''}
                        </div>
                    </td>
                    <td>${child.lastVisit ? formatDate(child.lastVisit.toDate()) : 'Never'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn" onclick="viewChild('${doc.id}')" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn" onclick="editChild('${doc.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn" onclick="showVaccineHistory('${doc.id}')" title="Vaccine History">
                                <i class="fas fa-syringe"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error loading children table:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center error">Error loading children</td></tr>';
    }
}

function calculateVaccineStatus(vaccines) {
    const total = Object.keys(vaccines).length;
    let completed = 0;
    let overdue = 0;
    let dueSoon = 0;
    const today = new Date();
    
    Object.values(vaccines).forEach(vaccine => {
        if (vaccine.status === 'completed') {
            completed++;
        } else if (vaccine.status === 'pending' || vaccine.status === 'overdue') {
            if (vaccine.dueDate) {
                const dueDate = vaccine.dueDate.toDate ? vaccine.dueDate.toDate() : new Date(vaccine.dueDate);
                const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysDiff < 0) {
                    overdue++;
                } else if (daysDiff <= 7) {
                    dueSoon++;
                }
            }
        }
    });
    
    return { total, completed, overdue, dueSoon };
}

function showAddChildModal() {
    document.getElementById('add-child-modal').classList.add('active');
}

// Other Page Loading Functions (simplified for brevity)
async function loadVaccinesPage() {
    const page = document.getElementById('vaccines-page');
    page.innerHTML = '<h2>Vaccine Tracking</h2><p>Vaccine management page will be implemented here.</p>';
    // Full implementation would include vaccine administration, tracking, etc.
}

async function loadReportsPage() {
    const page = document.getElementById('reports-page');
    page.innerHTML = '<h2>Reports</h2><p>Reporting engine will be implemented here.</p>';
    // Full implementation would include all IA2030 required reports
}

async function loadStockPage() {
    const page = document.getElementById('stock-page');
    page.innerHTML = '<h2>Stock Management</h2><p>Supply chain management will be implemented here.</p>';
    // Full implementation would include stock tracking, expiry monitoring, etc.
}

async function loadColdChainPage() {
    const page = document.getElementById('cold-chain-page');
    page.innerHTML = '<h2>Cold Chain Management</h2><p>Temperature monitoring and equipment tracking will be implemented here.</p>';
}

async function loadFacilitiesPage() {
    if (userRole !== 'admin' && userRole !== 'super_admin') {
        showToast('Access denied. Admin privileges required.', 'error');
        navigateTo('dashboard');
        return;
    }
    
    const page = document.getElementById('facilities-page');
    page.innerHTML = '<h2>Facilities Management</h2><p>Facility management will be implemented here.</p>';
}

async function loadUsersPage() {
    if (userRole !== 'admin' && userRole !== 'super_admin') {
        showToast('Access denied. Admin privileges required.', 'error');
        navigateTo('dashboard');
        return;
    }
    
    const page = document.getElementById('users-page');
    page.innerHTML = '<h2>User Management</h2><p>User management will be implemented here.</p>';
}

async function loadAuditPage() {
    const page = document.getElementById('audit-page');
    page.innerHTML = '<h2>Audit Log</h2><p>Audit trail will be displayed here.</p>';
}

// Notification Functions
async function loadNotifications() {
    try {
        const notificationsList = document.querySelector('.notifications-list');
        
        // Get recent notifications for user
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        let notificationsHTML = '';
        let unreadCount = 0;
        
        if (notificationsSnapshot.empty) {
            notificationsHTML = '<div class="notification-item">No notifications</div>';
        } else {
            notificationsSnapshot.forEach(doc => {
                const notification = doc.data();
                if (!notification.read) unreadCount++;
                
                notificationsHTML += `
                    <div class="notification-item ${notification.read ? '' : 'unread'}" 
                         onclick="markNotificationAsRead('${doc.id}')">
                        <div class="notification-title">${escapeHtml(notification.title)}</div>
                        <div class="notification-message">${escapeHtml(notification.message)}</div>
                        <div class="notification-time">${formatTimeAgo(notification.createdAt?.toDate())}</div>
                    </div>
                `;
            });
        }
        
        notificationsList.innerHTML = notificationsHTML;
        document.getElementById('notification-count').textContent = unreadCount;
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Audit Trail Functions
async function logAudit(action, description, metadata = {}) {
    try {
        await db.collection('audit_logs').add({
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Unknown',
            userEmail: currentUser.email,
            action: action,
            description: description,
            metadata: metadata,
            facilityId: currentFacility,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            ipAddress: await getClientIP()
        });
    } catch (error) {
        console.error('Error logging audit trail:', error);
    }
}

async function getClientIP() {
    // This is a simplified version - in production, use a proper IP detection method
    return 'unknown';
}

// Offline & Sync Functions
function handleOnline() {
    isOnline = true;
    document.getElementById('sync-status').className = 'sync-btn online';
    document.querySelector('.offline-indicator .indicator').className = 'indicator online';
    document.querySelector('.offline-indicator span').textContent = 'Online';
    
    showToast('You are back online. Syncing data...', 'success');
    processOfflineQueue();
}

function handleOffline() {
    isOnline = false;
    document.getElementById('sync-status').className = 'sync-btn offline';
    document.querySelector('.offline-indicator .indicator').className = 'indicator offline';
    document.querySelector('.offline-indicator span').textContent = 'Offline';
    
    showToast('You are offline. Changes will be synced when online.', 'warning');
}

async function processOfflineQueue() {
    if (!isOnline || offlineQueue.length === 0) return;
    
    document.getElementById('sync-status').className = 'sync-btn syncing';
    
    try {
        for (const item of offlineQueue) {
            await processQueueItem(item);
        }
        
        offlineQueue = [];
        showToast('All offline changes have been synced', 'success');
        
    } catch (error) {
        console.error('Error processing offline queue:', error);
        showToast('Error syncing offline changes', 'error');
    } finally {
        document.getElementById('sync-status').className = 'sync-btn online';
    }
}

async function processQueueItem(item) {
    // Process different types of offline actions
    switch (item.type) {
        case 'add_child':
            await db.collection('children').add(item.data);
            break;
        case 'update_child':
            await db.collection('children').doc(item.childId).update(item.data);
            break;
        case 'administer_vaccine':
            await db.collection('children').doc(item.childId).update({
                [`vaccines.${item.vaccineId}`]: item.vaccineData
            });
            break;
        // Add more cases as needed
    }
}

function manualSync() {
    if (isOnline) {
        processOfflineQueue();
    } else {
        showToast('Cannot sync while offline', 'warning');
    }
}

function startBackgroundSync() {
    // Register for background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('sync-data').catch(console.error);
        });
    }
}

// PWA Functions
function handleBeforeInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-prompt').classList.add('active');
}

function installApp() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    
    deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
            showToast('App installed successfully!', 'success');
        }
        deferredPrompt = null;
        document.getElementById('install-prompt').classList.remove('active');
    });
}

function dismissInstallPrompt() {
    document.getElementById('install-prompt').classList.remove('active');
}

// Utility Functions
function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type]}"></i>
        </div>
        <div class="toast-text">
            <h4>${type.charAt(0).toUpperCase() + type.slice(1)}</h4>
            <p>${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return formatDate(date);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Search Functions
function searchChildren(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#children-table tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function searchDefaulters(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#defaulters-table tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Export Functions
function exportDefaulters() {
    // Implement CSV export logic
    showToast('Export feature will be implemented soon', 'info');
}

function exportChildren() {
    // Implement CSV/PDF export logic
    showToast('Export feature will be implemented soon', 'info');
}

// Real-time Validation
function setupRealTimeValidation() {
    const emailInput = document.getElementById('register-email');
    const phoneInput = document.getElementById('child-phone');
    
    if (emailInput) {
        emailInput.addEventListener('blur', validateEmail);
    }
    
    if (phoneInput) {
        phoneInput.addEventListener('blur', validatePhone);
    }
}

function validateEmail(e) {
    const email = e.target.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email && !emailRegex.test(email)) {
        showToast('Please enter a valid email address', 'warning');
        e.target.focus();
    }
}

function validatePhone(e) {
    const phone = e.target.value;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    
    if (phone && !phoneRegex.test(phone)) {
        showToast('Please enter a valid phone number', 'warning');
        e.target.focus();
    }
}

// Placeholder functions for future implementation
function viewChild(childId) {
    showToast(`View child ${childId} - To be implemented`, 'info');
}

function editChild(childId) {
    showToast(`Edit child ${childId} - To be implemented`, 'info');
}

function showVaccineHistory(childId) {
    showToast(`Vaccine history for ${childId} - To be implemented`, 'info');
}

function remindDefaulter(childId, vaccineId) {
    showToast(`Reminder sent for ${vaccineId} - To be implemented`, 'success');
}

function markAsAdministered(childId, vaccineId) {
    showToast(`Mark ${vaccineId} as administered - To be implemented`, 'info');
}

function markNotificationAsRead(notificationId) {
    showToast(`Mark notification as read - To be implemented`, 'info');
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}