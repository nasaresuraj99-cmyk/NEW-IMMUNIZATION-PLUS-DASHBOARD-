/**
 * Firebase Configuration
 * Replace with your Firebase project configuration
 */

export const firebaseConfig = {
    apiKey: "AIzaSyYourAPIKeyHere",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-messaging-sender-id",
    appId: "1:your-app-id:web:your-app-specific-id",
    measurementId: "G-XXXXXXXXXX"
};

// Firestore Security Rules Reference
export const firestoreRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Super Admin full access
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    // User data access
    match /users/{userId} {
      allow read: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin']);
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Facility access
    match /facilities/{facilityCode} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin'];
    }
    
    // Children data - role-based access
    match /children/{childId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.resource.data.facilityCode in 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.facilities;
      allow update: if request.auth != null && 
        resource.data.facilityCode in 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.facilities;
    }
    
    // Stock management
    match /stock/{facilityCode} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        facilityCode in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.facilities;
    }
    
    // Audit logs - read only for admins
    match /auditLogs/{logId} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin'];
      allow write: if false; // Only server-side writes
    }
    
    // Reports
    match /reports/{reportId} {
      allow read, write: if request.auth != null;
    }
  }
}
`;

// Collection References
export const COLLECTIONS = {
    USERS: 'users',
    FACILITIES: 'facilities',
    CHILDREN: 'children',
    STOCK: 'stock',
    COLD_CHAIN: 'coldChain',
    AUDIT_LOGS: 'auditLogs',
    REPORTS: 'reports',
    NOTIFICATIONS: 'notifications',
    VACCINE_BATCHES: 'vaccineBatches'
};

// User Roles
export const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    USER: 'user',
    VIEWER: 'viewer'
};

// Vaccine Status
export const VACCINE_STATUS = {
    PENDING: 'pending',
    ADMINISTERED: 'administered',
    MISSED: 'missed',
    CONTRAINDICATED: 'contraindicated'
};

// Child Status
export const CHILD_STATUS = {
    ACTIVE: 'active',
    TRANSFERRED: 'transferred',
    LOST_TO_FOLLOWUP: 'lost_to_followup',
    DECEASED: 'deceased'
};

// Alert Types
export const ALERT_TYPES = {
    LOW_STOCK: 'low_stock',
    EXPIRY_WARNING: 'expiry_warning',
    COLD_CHAIN_EXCURSION: 'cold_chain_excursion',
    DEFAULT_ALERT: 'default_alert',
    SYSTEM_ALERT: 'system_alert'
};

// Export configuration
export default {
    firebaseConfig,
    firestoreRules,
    COLLECTIONS,
    USER_ROLES,
    VACCINE_STATUS,
    CHILD_STATUS,
    ALERT_TYPES
};