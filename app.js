/**
 * Immunization Tracker PWA - Main Application
 * IA2030 Compliant System
 */

// Firebase Configuration
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        console.error("Offline persistence error: ", err.code);
    });

// Global Variables
let currentUser = null;
let currentFacility = null;
let userRole = 'user';
let offlineQueue = [];
let isOnline = navigator.onLine;
let deferredPrompt = null;

// Vaccine Schedule Data
const VACCINE_SCHEDULE = {
    birth: [
        { id: 'bcg', name: 'BCG', dueDays: 0, dose: 1, protection: 'Tuberculosis' },
        { id: 'opv0', name: 'OPV0', dueDays: 0, dose: 1, protection: 'Polio' },
        { id: 'hepb0', name: 'Hepatitis B', dueDays: 0, dose: 1, protection: 'Hepatitis B' }
    ],
    weeks6: [
        { id: 'opv1', name: 'OPV1', dueDays: 42, dose: 1, protection: 'Polio' },
        { id: 'penta1', name: 'Penta1', dueDays: 42, dose: 1, protection: 'Diphtheria, Tetanus, Pertussis, Hepatitis B, Hib' },
        { id: 'pcv1', name: 'PCV1', dueDays: 42, dose: 1, protection: 'Pneumococcal' },
        { id: 'rota1', name: 'Rotavirus1', dueDays: 42, dose: 1, protection: 'Rotavirus' }
    ],
    weeks10: [
        { id: 'opv2', name: 'OPV2', dueDays: 70, dose: 2, protection: 'Polio' },
        { id: 'penta2', name: 'Penta2', dueDays: 70, dose: 2, protection: 'Diphtheria, Tetanus, Pertussis, Hepatitis B, Hib' },
        { id: 'pcv2', name: 'PCV2', dueDays: 70, dose: 2, protection: 'Pneumococcal' },
        { id: 'rota2', name: 'Rotavirus2', dueDays: 70, dose: 2, protection: 'Rotavirus' }
    ],
    weeks14: [
        { id: 'opv3', name: 'OPV3', dueDays: 98, dose: 3, protection: 'Polio' },
        { id: 'penta3', name: 'Penta3', dueDays: 98, dose: 3, protection: 'Diphtheria, Tetanus, Pertussis, Hepatitis B, Hib' },
        { id: 'pcv3', name: 'PCV3', dueDays: 98, dose: 3, protection: 'Pneumococcal' },
        { id: 'rota3', name: 'Rotavirus3', dueDays: 98, dose: 3, protection: 'Rotavirus' },
        { id: 'ipv1', name: 'IPV1', dueDays: 98, dose: 1, protection: 'Polio' }
    ],
    months6to12: [
        { id: 'malaria1', name: 'Malaria1', dueDays: 180, dose: 1, protection: 'Malaria' },
        { id: 'vitamin_a_6m', name: 'Vitamin A', dueDays: 180, dose: 1, protection: 'Vitamin A Deficiency' },
        { id: 'malaria2', name: 'Malaria2', dueDays: 210, dose: 2, protection: 'Malaria' },
        { id: 'ipv2', name: 'IPV2', dueDays: 210, dose: 2, protection: 'Polio' },
        { id: 'malaria3', name: 'Malaria3', dueDays: 270, dose: 3, protection: 'Malaria' },
        { id: 'mr1', name: 'Measles-Rubella1', dueDays: 270, dose: 1, protection: 'Measles, Rubella' },
        { id: 'vitamin_a_12m', name: 'Vitamin A', dueDays: 365, dose: 2, protection: 'Vitamin A Deficiency' }
    ],
    months18: [
        { id: 'malaria4', name: 'Malaria4', dueDays: 540, dose: 4, protection: 'Malaria' },
        { id: 'mr2', name: 'Measles-Rubella2', dueDays: 540, dose: 2, protection: 'Measles, Rubella' },
        { id: 'llin', name: 'LLIN', dueDays: 540, dose: 1, protection: 'Malaria Prevention' },
        { id: 'men_a', name: 'Men A', dueDays: 540, dose: 1, protection: 'Meningitis A' },
        { id: 'vitamin_a_18m', name: 'Vitamin A', dueDays: 540, dose: 3, protection: 'Vitamin A Deficiency' }
    ],
    years2to5: [
        { id: 'vitamin_a_24m', name: 'Vitamin A', dueDays: 720, dose: 4, protection: 'Vitamin A Deficiency' },
        { id: 'vitamin_a_30m', name: 'Vitamin A', dueDays: 900, dose: 5, protection: 'Vitamin A Deficiency' },
        { id: 'vitamin_a_36m', name: 'Vitamin A', dueDays: 1080, dose: 6, protection: 'Vitamin A Deficiency' },
        { id: 'vitamin_a_42m', name: 'Vitamin A', dueDays: 1260, dose: 7, protection: 'Vitamin A Deficiency' },
        { id: 'vitamin_a_48m', name: 'Vitamin A', dueDays: 1440, dose: 8, protection: 'Vitamin A Deficiency' },
        { id: 'vitamin_a_54m', name: 'Vitamin A', dueDays: 1620, dose: 9, protection: 'Vitamin A Deficiency' },
        { id: 'vitamin_a_60m', name: 'Vitamin A', dueDays: 1800, dose: 10, protection: 'Vitamin A Deficiency' }
    ]
};

// Initialize Application
function initializeApp() {
    console.log('Initializing Immunization Tracker PWA...');
    
    // Check service worker support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
                registration.update();
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Check authentication state
    auth.onAuthStateChanged(handleAuthStateChanged);
    
    // Monitor online/offline status
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Before install prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Show loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
        }, 300);
    }, 1000);
}

// Event Listeners
function initializeEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Registration form
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
    
    // Child registration form
    document.getElementById('child-registration-form').addEventListener('submit', handleChildRegistration);
    
    // DOB age calculation
    document.getElementById('child-dob').addEventListener('change', calculateAge);
    
    // Search functionality
    document.getElementById('search-children').addEventListener('input', debounce(searchChildren, 300));
    
    // Filter changes
    document.getElementById('filter-age').addEventListener('change', filterChildren);
    document.getElementById('filter-status').addEventListener('change', filterChildren);
    document.getElementById('filter-vaccine').addEventListener('change', filterChildren);
    
    // Report period changes
    document.getElementById('report-period').addEventListener('change', handleReportPeriodChange);
    
    // Real-time validation for password confirmation
    document.getElementById('confirm-password').addEventListener('input', validatePassword);
}

// Authentication Handlers
function handleAuthStateChanged(user) {
    if (user) {
        if (!user.emailVerified) {
            auth.signOut();
            showError('Please verify your email before logging in');
            return;
        }
        
        currentUser = user;
        loadUserData();
        showScreen('main-app');
        hideScreen('auth-screens');
        updateUIForUser();
    } else {
        currentUser = null;
        showScreen('login-screen');
        hideScreen('main-app');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    try {
        errorElement.classList.add('hidden');
        showLoading();
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        if (!userCredential.user.emailVerified) {
            await auth.signOut();
            throw new Error('Please verify your email before logging in');
        }
        
        // Log login activity
        await logActivity('login', 'User logged in');
        
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = 'Invalid email or password';
        errorElement.classList.remove('hidden');
    } finally {
        hideLoading();
    }
}

async function handleRegistration(e) {
    e.preventDefault();
    
    // Validate passwords match
    const password = document.getElementById('user-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    // Collect form data
    const userData = {
        facility: {
            name: document.getElementById('facility-name').value,
            code: document.getElementById('facility-code').value.toUpperCase(),
            type: document.getElementById('facility-type').value,
            region: document.getElementById('facility-region').value,
            status: 'pending',
            createdAt: new Date()
        },
        user: {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            phone: document.getElementById('user-phone').value,
            role: 'admin', // Initial role for facility creator
            status: 'active',
            createdAt: new Date()
        }
    };
    
    try {
        showLoading('Registering facility...');
        
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(
            userData.user.email,
            password
        );
        
        // Send email verification
        await userCredential.user.sendEmailVerification();
        
        // Store user data in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            ...userData.user,
            uid: userCredential.user.uid,
            facilities: [userData.facility.code]
        });
        
        // Store facility data
        await db.collection('facilities').doc(userData.facility.code).set({
            ...userData.facility,
            admin: userCredential.user.uid,
            users: [userCredential.user.uid]
        });
        
        // Log registration
        await logActivity('facility_registration', 'New facility registered', userData.facility.code);
        
        showSuccess('Registration submitted for approval. Please check your email for verification.');
        showScreen('login-screen');
        
    } catch (error) {
        console.error('Registration error:', error);
        showError('Registration failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Child Management
function calculateAge() {
    const dob = new Date(document.getElementById('child-dob').value);
    if (!dob) return;
    
    const today = new Date();
    const months = (today.getFullYear() - dob.getFullYear()) * 12 + 
                   (today.getMonth() - dob.getMonth());
    
    document.getElementById('child-age').textContent = months;
    
    // Validate age (0-59 months)
    if (months < 0 || months > 59) {
        showError('Child must be between 0-59 months old');
        document.getElementById('child-dob').value = '';
        document.getElementById('child-age').textContent = '0';
    }
}

async function handleChildRegistration(e) {
    e.preventDefault();
    
    if (!currentUser || !currentFacility) {
        showError('Please login and select a facility');
        return;
    }
    
    const childData = collectChildFormData();
    
    try {
        showLoading('Registering child...');
        
        // Generate Child ID
        const year = new Date().getFullYear().toString().slice(-2);
        const sequence = await getNextSequenceNumber();
        const childId = `${currentFacility.code}-${year}-${sequence.toString().padStart(5, '0')}`;
        
        // Calculate vaccine schedule
        const vaccineSchedule = calculateVaccineSchedule(childData.dob);
        
        // Prepare child document
        const childDoc = {
            ...childData,
            childId,
            facilityCode: currentFacility.code,
            registeredBy: currentUser.uid,
            registeredAt: new Date(),
            vaccineSchedule,
            status: 'active',
            lastUpdated: new Date()
        };
        
        // Save to Firestore
        await db.collection('children').doc(childId).set(childDoc);
        
        // Log activity
        await logActivity('child_registration', `Child ${childId} registered`, childId);
        
        // Show success and reset form
        showSuccess(`Child registered successfully! ID: ${childId}`);
        document.getElementById('generated-id').innerHTML = `
            <strong>✅ Registration Successful!</strong><br>
            Child ID: <code>${childId}</code><br>
            <small>Please note this ID for future reference</small>
        `;
        
        // Reset form after 3 seconds
        setTimeout(() => {
            resetForm();
            showChildList();
        }, 3000);
        
    } catch (error) {
        console.error('Child registration error:', error);
        showError('Registration failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

function collectChildFormData() {
    return {
        firstName: document.getElementById('child-first-name').value.trim(),
        lastName: document.getElementById('child-last-name').value.trim(),
        dob: new Date(document.getElementById('child-dob').value),
        gender: document.getElementById('child-gender').value,
        birthWeight: parseFloat(document.getElementById('child-birth-weight').value) || null,
        guardianName: document.getElementById('guardian-name').value.trim(),
        guardianPhone: document.getElementById('guardian-phone').value.trim(),
        guardianRelationship: document.getElementById('guardian-relationship').value,
        address: document.getElementById('residence-address').value.trim(),
        village: document.getElementById('village').value.trim(),
        district: document.getElementById('district').value.trim(),
        birthComplications: document.getElementById('birth-complications').value.trim(),
        allergies: Array.from(document.querySelectorAll('input[name="allergies"]:checked'))
            .map(cb => cb.value),
        chronicConditions: document.getElementById('chronic-conditions').value.trim(),
        previousVaccinations: document.getElementById('previous-vaccinations').value.trim(),
        notes: document.getElementById('child-id-notes').value.trim()
    };
}

function calculateVaccineSchedule(dob) {
    const schedule = {};
    const dobDate = new Date(dob);
    
    // Calculate all vaccine due dates
    Object.values(VACCINE_SCHEDULE).flat().forEach(vaccine => {
        const dueDate = new Date(dobDate);
        dueDate.setDate(dueDate.getDate() + vaccine.dueDays);
        
        schedule[vaccine.id] = {
            name: vaccine.name,
            dueDate,
            status: 'pending',
            administeredDate: null,
            administeredBy: null,
            facility: null,
            batchNumber: null,
            expiryDate: null,
            notes: '',
            missed: false,
            protection: vaccine.protection,
            dose: vaccine.dose
        };
    });
    
    return schedule;
}

// Vaccine Administration
async function administerVaccine(childId, vaccineId, batchInfo) {
    if (!currentUser || !currentFacility) {
        throw new Error('User not authenticated');
    }
    
    try {
        const childRef = db.collection('children').doc(childId);
        const childDoc = await childRef.get();
        
        if (!childDoc.exists) {
            throw new Error('Child not found');
        }
        
        const vaccineData = childDoc.data().vaccineSchedule[vaccineId];
        if (!vaccineData) {
            throw new Error('Vaccine not found in schedule');
        }
        
        // Update vaccine status
        const updateData = {};
        updateData[`vaccineSchedule.${vaccineId}.status`] = 'administered';
        updateData[`vaccineSchedule.${vaccineId}.administeredDate`] = new Date();
        updateData[`vaccineSchedule.${vaccineId}.administeredBy`] = currentUser.uid;
        updateData[`vaccineSchedule.${vaccineId}.facility`] = currentFacility.code;
        updateData[`vaccineSchedule.${vaccineId}.batchNumber`] = batchInfo.batchNumber;
        updateData[`vaccineSchedule.${vaccineId}.expiryDate`] = batchInfo.expiryDate;
        updateData[`vaccineSchedule.${vaccineId}.notes`] = batchInfo.notes;
        updateData[`vaccineSchedule.${vaccineId}.missed`] = false;
        
        // Update stock
        await updateStockLevel(vaccineId, -1);
        
        // Update child document
        await childRef.update(updateData);
        
        // Log activity
        await logActivity('vaccine_administered', 
            `${vaccineData.name} administered to ${childId}`, 
            childId);
        
        // Check for cold chain violations
        await checkColdChainViolation(batchInfo);
        
        return true;
        
    } catch (error) {
        console.error('Vaccine administration error:', error);
        throw error;
    }
}

// Stock Management
async function updateStockLevel(vaccineId, quantityChange, batchInfo = null) {
    const stockRef = db.collection('stock').doc(currentFacility.code);
    
    try {
        await db.runTransaction(async (transaction) => {
            const stockDoc = await transaction.get(stockRef);
            
            let stockData = {};
            if (stockDoc.exists) {
                stockData = stockDoc.data();
            }
            
            if (!stockData[vaccineId]) {
                stockData[vaccineId] = {
                    currentStock: 0,
                    totalReceived: 0,
                    totalAdministered: 0,
                    totalWastage: 0,
                    batches: [],
                    lastUpdated: new Date()
                };
            }
            
            // Update stock levels
            stockData[vaccineId].currentStock += quantityChange;
            
            if (quantityChange > 0) {
                stockData[vaccineId].totalReceived += quantityChange;
                if (batchInfo) {
                    stockData[vaccineId].batches.push({
                        ...batchInfo,
                        receivedDate: new Date(),
                        receivedBy: currentUser.uid
                    });
                }
            } else if (quantityChange < 0) {
                stockData[vaccineId].totalAdministered += Math.abs(quantityChange);
            }
            
            // Check low stock alert
            if (stockData[vaccineId].currentStock <= stockData[vaccineId].reorderLevel) {
                await createAlert('low_stock', `${vaccineId} stock is low`, {
                    vaccineId,
                    currentStock: stockData[vaccineId].currentStock,
                    reorderLevel: stockData[vaccineId].reorderLevel
                });
            }
            
            transaction.set(stockRef, stockData, { merge: true });
        });
        
        // Log stock activity
        await logActivity('stock_updated', 
            `Stock updated for ${vaccineId}: ${quantityChange > 0 ? '+' : ''}${quantityChange}`,
            vaccineId);
            
    } catch (error) {
        console.error('Stock update error:', error);
        throw error;
    }
}

// Cold Chain Management
async function logTemperatureReading(equipmentId, temperature, humidity = null) {
    const reading = {
        equipmentId,
        temperature,
        humidity,
        timestamp: new Date(),
        recordedBy: currentUser.uid,
        facilityCode: currentFacility.code
    };
    
    try {
        await db.collection('coldChainReadings').add(reading);
        
        // Check for excursions
        if (temperature < 2 || temperature > 8) {
            await createAlert('cold_chain_excursion', 
                `Temperature excursion detected: ${temperature}°C`, {
                equipmentId,
                temperature,
                recommendedRange: '2-8°C'
            });
        }
        
        // Log activity
        await logActivity('temperature_logged', 
            `Temperature ${temperature}°C logged for ${equipmentId}`,
            equipmentId);
            
    } catch (error) {
        console.error('Temperature logging error:', error);
        throw error;
    }
}

// Reporting Engine
async function generateReport(type, period, startDate = null, endDate = null) {
    try {
        showLoading('Generating report...');
        
        let query = db.collection('children')
            .where('facilityCode', '==', currentFacility.code);
        
        // Apply date filter
        if (startDate && endDate) {
            query = query.where('registeredAt', '>=', startDate)
                        .where('registeredAt', '<=', endDate);
        }
        
        const snapshot = await query.get();
        const children = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let reportData = {};
        
        switch (type) {
            case 'coverage':
                reportData = generateCoverageReport(children);
                break;
            case 'dropout':
                reportData = generateDropoutReport(children);
                break;
            case 'defaulters':
                reportData = generateDefaultersReport(children);
                break;
            case 'stock':
                reportData = await generateStockReport();
                break;
            case 'cold-chain':
                reportData = await generateColdChainReport();
                break;
        }
        
        // Display report
        displayReport(type, reportData);
        
        // Log report generation
        await logActivity('report_generated', `${type} report generated`, null, {
            period,
            recordCount: children.length
        });
        
    } catch (error) {
        console.error('Report generation error:', error);
        showError('Failed to generate report: ' + error.message);
    } finally {
        hideLoading();
    }
}

function generateCoverageReport(children) {
    const report = {
        totalChildren: children.length,
        coverageByAntigen: {},
        coverageByAgeGroup: {},
        monthlyTrend: {},
        facilityPerformance: {}
    };
    
    // Calculate coverage for each antigen
    Object.values(VACCINE_SCHEDULE).flat().forEach(vaccine => {
        const administered = children.filter(child => 
            child.vaccineSchedule?.[vaccine.id]?.status === 'administered'
        ).length;
        
        const due = children.filter(child => {
            const childAge = calculateMonthsFromDate(child.dob);
            const vaccineDueAge = vaccine.dueDays / 30;
            return childAge >= vaccineDueAge;
        }).length;
        
        report.coverageByAntigen[vaccine.id] = {
            name: vaccine.name,
            administered,
            due,
            coverageRate: due > 0 ? (administered / due) * 100 : 0
        };
    });
    
    return report;
}

function generateDropoutReport(children) {
    const report = {
        pentaDropout: calculateDropoutRate(children, 'penta1', 'penta3'),
        bcgMrDropout: calculateDropoutRate(children, 'bcg', 'mr1'),
        mr1Mr2Dropout: calculateDropoutRate(children, 'mr1', 'mr2'),
        dropoutReasons: {},
        trendAnalysis: {}
    };
    
    return report;
}

function calculateDropoutRate(children, startVaccine, endVaccine) {
    const started = children.filter(child => 
        child.vaccineSchedule?.[startVaccine]?.status === 'administered'
    ).length;
    
    const completed = children.filter(child => 
        child.vaccineSchedule?.[endVaccine]?.status === 'administered'
    ).length;
    
    return started > 0 ? ((started - completed) / started) * 100 : 0;
}

// Defaulters Management
async function identifyDefaulters() {
    const today = new Date();
    const defaulters = [];
    
    try {
        const snapshot = await db.collection('children')
            .where('facilityCode', '==', currentFacility.code)
            .where('status', '==', 'active')
            .get();
        
        snapshot.forEach(doc => {
            const child = { id: doc.id, ...doc.data() };
            const overdueVaccines = [];
            
            // Check each vaccine
            Object.entries(child.vaccineSchedule || {}).forEach(([vaccineId, vaccine]) => {
                if (vaccine.status === 'pending' && vaccine.dueDate) {
                    const dueDate = vaccine.dueDate.toDate();
                    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysOverdue > 7) { // Overdue by more than 7 days
                        overdueVaccines.push({
                            vaccineId,
                            name: vaccine.name,
                            dueDate,
                            daysOverdue
                        });
                    }
                }
            });
            
            if (overdueVaccines.length > 0) {
                defaulters.push({
                    childId: child.childId,
                    name: `${child.firstName} ${child.lastName}`,
                    age: calculateMonthsFromDate(child.dob),
                    guardianPhone: child.guardianPhone,
                    overdueVaccines,
                    lastContact: child.lastContact || null
                });
            }
        });
        
        return defaulters;
        
    } catch (error) {
        console.error('Defaulters identification error:', error);
        throw error;
    }
}

// SMS Reminder System (Placeholder)
async function sendSMSReminder(childId, vaccineId) {
    // This is a placeholder for SMS integration
    // In production, integrate with SMS gateway API
    
    console.log(`SMS reminder would be sent for ${childId}, vaccine ${vaccineId}`);
    
    // Log the reminder attempt
    await logActivity('sms_reminder', `SMS reminder sent for ${vaccineId}`, childId);
    
    return true;
}

// Audit Logging
async function logActivity(action, description, resourceId = null, metadata = {}) {
    if (!currentUser) return;
    
    const logEntry = {
        action,
        description,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        facilityCode: currentFacility?.code,
        resourceId,
        metadata,
        timestamp: new Date(),
        ipAddress: await getClientIP()
    };
    
    try {
        await db.collection('auditLogs').add(logEntry);
    } catch (error) {
        console.error('Audit logging error:', error);
        // Store locally if offline
        if (!isOnline) {
            storeOfflineLog(logEntry);
        }
    }
}

// Offline Support
function storeOfflineQueue(action, data) {
    const queueItem = {
        action,
        data,
        timestamp: new Date(),
        attempts: 0
    };
    
    offlineQueue.push(queueItem);
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    
    updateSyncStatus();
}

async function processOfflineQueue() {
    if (!isOnline || offlineQueue.length === 0) return;
    
    showLoading('Syncing offline data...');
    
    for (let i = 0; i < offlineQueue.length; i++) {
        const item = offlineQueue[i];
        
        try {
            // Process based on action type
            switch (item.action) {
                case 'child_registration':
                    await db.collection('children').add(item.data);
                    break;
                case 'vaccine_administered':
                    await administerVaccine(item.data.childId, item.data.vaccineId, item.data.batchInfo);
                    break;
                case 'stock_update':
                    await updateStockLevel(item.data.vaccineId, item.data.quantity, item.data.batchInfo);
                    break;
            }
            
            // Remove from queue on success
            offlineQueue.splice(i, 1);
            i--;
            
        } catch (error) {
            console.error(`Failed to process offline action ${item.action}:`, error);
            item.attempts++;
            
            if (item.attempts > 3) {
                offlineQueue.splice(i, 1);
                i--;
            }
        }
    }
    
    // Update localStorage
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    updateSyncStatus();
    
    hideLoading();
}

// UI Helpers
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.content-screen, .auth-screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show requested screen
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
    }
    
    // Update page title
    const titleMap = {
        'dashboard-screen': 'Dashboard',
        'child-registration-screen': 'Register Child',
        'children-list-screen': 'Children Registry',
        'vaccine-schedule-screen': 'Vaccine Schedule',
        'reports-screen': 'Reports & Analytics'
    };
    
    if (titleMap[screenId]) {
        document.getElementById('page-title').textContent = titleMap[screenId];
    }
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('hidden');
    }
}

function showLoading(message = 'Loading...') {
    // Create or update loading overlay
    let loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loader"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function showError(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
        <span>❌ ${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function showSuccess(message) {
    // Create success toast
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
        <span>✅ ${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function calculateMonthsFromDate(date) {
    const birthDate = date.toDate ? date.toDate() : new Date(date);
    const today = new Date();
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + 
           (today.getMonth() - birthDate.getMonth());
}

async function getNextSequenceNumber() {
    const counterRef = db.collection('counters').doc('childSequence');
    
    try {
        const result = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let sequence = 1;
            
            if (counterDoc.exists) {
                sequence = counterDoc.data().sequence + 1;
            }
            
            transaction.set(counterRef, { sequence }, { merge: true });
            return sequence;
        });
        
        return result;
    } catch (error) {
        console.error('Sequence generation error:', error);
        // Fallback to timestamp
        return Date.now() % 100000;
    }
}

// Event Handlers
function handleOnline() {
    isOnline = true;
    document.getElementById('connection-status').innerHTML = `
        <span class="status-indicator online"></span> Online
    `;
    
    // Process offline queue
    processOfflineQueue();
}

function handleOffline() {
    isOnline = false;
    document.getElementById('connection-status').innerHTML = `
        <span class="status-indicator offline"></span> Offline
    `;
    
    showInfo('Working offline. Changes will sync when online.');
}

function handleBeforeInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install prompt
    const installPrompt = document.getElementById('install-prompt');
    installPrompt.classList.remove('hidden');
}

async function installApp() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
    }
    
    deferredPrompt = null;
    document.getElementById('install-prompt').classList.add('hidden');
}

function dismissInstall() {
    deferredPrompt = null;
    document.getElementById('install-prompt').classList.add('hidden');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for use in console
window.ImmunizationTracker = {
    initializeApp,
    handleLogin,
    handleRegistration,
    administerVaccine,
    generateReport,
    identifyDefaulters,
    showScreen,
    logout: () => auth.signOut()
};