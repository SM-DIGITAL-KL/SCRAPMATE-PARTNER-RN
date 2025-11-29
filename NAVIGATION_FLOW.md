# Navigation Flow Documentation

## App Flow Overview

The app follows this navigation flow:

### First Time User Flow
1. **Splash Screen** → **Language Selection** → **Login Screen** → **Dashboard**

### Returning User Flow
- **If logged in**: **Splash Screen** → **Dashboard**
- **If not logged in**: **Splash Screen** → **Login Screen** → **Dashboard**

## Implementation Details

### B2CStack Navigation Logic

The `B2CStack` component determines the initial route based on:

1. **Language Selection Status**
   - Checks `@app_language_set` flag
   - Checks `@app_language` value
   - If neither exists → Show `SelectLanguage` screen

2. **Authentication Status**
   - Checks `auth_token` in AsyncStorage
   - If no token → Show `Login` screen
   - If token exists → Show `Dashboard` screen

### Flow Logic

```typescript
if (!languageSelected) {
  → SelectLanguage Screen
} else if (!isLoggedIn) {
  → Login Screen
} else {
  → Dashboard Screen
}
```

## Screen Flow

### 1. SelectLanguageScreen
- **Purpose**: First-time language selection
- **Action on Save**: 
  - Saves language preference
  - Navigates to `Login` screen

### 2. LoginScreen
- **Purpose**: Phone number authentication with OTP
- **Features**:
  - Phone number input (10-digit Indian format)
  - OTP input (6 digits)
  - Auto-focus between OTP inputs
  - Resend OTP with countdown timer
  - Change phone number option
- **Action on Success**:
  - Stores auth token in AsyncStorage
  - Stores user data in AsyncStorage
  - Navigates to `Dashboard` screen

### 3. DashboardScreen
- **Purpose**: Main app dashboard
- **Access**: Only accessible after login

## Authentication Service

Located in `src/services/auth/authService.ts`:

### Functions Available:
- `isLoggedIn()` - Check if user is authenticated
- `getAuthToken()` - Get stored auth token
- `setAuthToken(token)` - Store auth token
- `getUserData()` - Get stored user data
- `setUserData(userData)` - Store user data
- `logout()` - Clear all auth data
- `clearAuthToken()` - Clear only auth token

## Storage Keys

- `@app_language` - Selected language code
- `@app_language_set` - Flag indicating language was set
- `auth_token` - Authentication token
- `user_data` - User profile data (JSON string)

## Usage Example

### Check if user is logged in:
```typescript
import { isLoggedIn } from '../services/auth/authService';

const loggedIn = await isLoggedIn();
if (loggedIn) {
  // User is authenticated
}
```

### Logout user:
```typescript
import { logout } from '../services/auth/authService';

await logout();
// Navigate to login screen
navigation.navigate('Login');
```

## Navigation Stack

```
B2CStack
├── SelectLanguage (First time only)
├── Login (If not authenticated)
└── Dashboard (If authenticated)
    ├── DeliveryTracking
    ├── AssignPartner
    ├── UserProfile
    ├── AddCategory
    └── MyOrders
```

## Notes

- Language selection is a one-time process
- Login is required every time the app is opened (unless token exists)
- Auth token is stored securely in AsyncStorage
- User data is stored alongside auth token for quick access
- All screens respect the selected theme

