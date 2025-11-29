# V2 API Integration Guide - React Native

## Overview

This document maps the v2 microservice API endpoints to the React Native UI components.

## API Endpoints Mapping

### 1. Shop Types API
**Endpoint:** `GET /api/v2/shop-types`  
**Service:** `src/services/api/v2/shopTypes.ts`  
**Hook:** `src/hooks/useShopTypes.ts` → `useShopTypes()`  
**UI Components:**
- **UserProfileScreen** (B2C & B2B) - Display shop type information
- **DealerSignupScreen** (B2B) - Show available shop types during registration
- **Settings/Profile** - Show user's shop type

**Usage Example:**
```typescript
import { useShopTypes } from '../hooks/useShopTypes';

const { data: shopTypes, isLoading } = useShopTypes();
```

---

### 2. User Dashboards API
**Endpoint:** `GET /api/v2/user/dashboards/:userId`  
**Service:** `src/services/api/v2/shopTypes.ts`  
**Hook:** `src/hooks/useShopTypes.ts` → `useUserDashboards(userId)`  
**UI Components:**
- **AppNavigator** - Control which tabs are visible based on allowed dashboards
- **DashboardScreen** (B2C) - Check if user can access B2C
- **DealerDashboardScreen** (B2B) - Check if user can access B2B
- **UserProfileScreen** - Show available dashboards and switch option

**Usage Example:**
```typescript
import { useUserDashboards } from '../hooks/useShopTypes';
import { getUserData } from '../services/auth/authService';

const userData = await getUserData();
const { data: dashboardInfo } = useUserDashboards(userData?.id);
```

---

### 3. Validate Dashboard API
**Endpoint:** `POST /api/v2/user/validate-dashboard`  
**Service:** `src/services/api/v2/shopTypes.ts`  
**Hook:** `src/hooks/useShopTypes.ts` → `useValidateDashboard()`  
**UI Components:**
- **AppNavigator** - Validate before allowing tab navigation
- **Dashboard Switch Component** - Validate before switching

**Usage Example:**
```typescript
import { useValidateDashboard } from '../hooks/useShopTypes';

const validateMutation = useValidateDashboard();

const handleValidate = async () => {
  const result = await validateMutation.mutateAsync({
    userId: userData.id,
    dashboardType: 'b2c',
  });
  
  if (result.canAccess) {
    // Allow navigation
  } else {
    // Show error: result.reason
  }
};
```

---

### 4. Switch Dashboard API
**Endpoint:** `POST /api/v2/user/switch-dashboard`  
**Service:** `src/services/api/v2/shopTypes.ts`  
**Hook:** `src/hooks/useShopTypes.ts` → `useSwitchDashboard()`  
**UI Components:**
- **UserProfileScreen** (B2C & B2B) - Dashboard switch button
- **AppNavigator** - Programmatic dashboard switching
- **Dashboard Header** - Quick switch button

**Usage Example:**
```typescript
import { useSwitchDashboard } from '../hooks/useShopTypes';
import { switchUserDashboard } from '../services/dashboard/dashboardService';

const switchMutation = useSwitchDashboard();

const handleSwitch = async () => {
  try {
    await switchUserDashboard(userData.id, 'b2b');
    // Navigate to B2B dashboard
    navigation.navigate('B2B', { screen: 'DealerDashboard' });
  } catch (error) {
    // Show error message
  }
};
```

---

## Component Integration Map

### 1. AppNavigator (`src/navigation/AppNavigator.tsx`)
**Purpose:** Control tab visibility based on user's allowed dashboards

**Integration:**
```typescript
import { useUserDashboards } from '../hooks/useShopTypes';
import { getUserData } from '../services/auth/authService';

// In AppNavigator component
const [userData, setUserData] = useState(null);
const { data: dashboardInfo } = useUserDashboards(userData?.id);

// Conditionally show/hide tabs
<Tab.Screen 
  name="B2C" 
  component={B2CStack}
  options={{ tabBarButton: dashboardInfo?.allowedDashboards.includes('b2c') ? undefined : () => null }}
/>
<Tab.Screen 
  name="B2B" 
  component={B2BStack}
  options={{ tabBarButton: dashboardInfo?.allowedDashboards.includes('b2b') ? undefined : () => null }}
/>
<Tab.Screen 
  name="Delivery" 
  component={DeliveryStack}
  options={{ tabBarButton: dashboardInfo?.allowedDashboards.includes('delivery') ? undefined : () => null }}
/>
```

---

### 2. UserProfileScreen (B2C & B2B)
**Purpose:** Display shop type and allow dashboard switching

**Integration:**
```typescript
import { useUserDashboards, useSwitchDashboard } from '../hooks/useShopTypes';
import { useShopTypes } from '../hooks/useShopTypes';

// Show shop type
const { data: shopTypes } = useShopTypes();
const { data: dashboardInfo } = useUserDashboards(userData?.id);
const switchMutation = useSwitchDashboard();

// Display shop type name
const shopTypeName = shopTypes?.find(st => st.id === dashboardInfo?.shopType)?.name;

// Show switch button if canSwitch is true
{dashboardInfo?.canSwitch && (
  <Button 
    onPress={() => handleSwitchDashboard()}
    title={`Switch to ${dashboardInfo.allowedDashboards.find(d => d !== currentDashboard)}`}
  />
)}
```

---

### 3. DashboardScreen (B2C)
**Purpose:** Validate access and show appropriate content

**Integration:**
```typescript
import { useUserDashboards } from '../hooks/useShopTypes';

const { data: dashboardInfo, isLoading } = useUserDashboards(userData?.id);

// Validate access
if (!isLoading && !dashboardInfo?.allowedDashboards.includes('b2c')) {
  // Redirect or show error
  return <ErrorScreen message="You don't have access to B2C dashboard" />;
}
```

---

### 4. DealerDashboardScreen (B2B)
**Purpose:** Validate access and show appropriate content

**Integration:**
```typescript
import { useUserDashboards } from '../hooks/useShopTypes';

const { data: dashboardInfo, isLoading } = useUserDashboards(userData?.id);

// Validate access
if (!isLoading && !dashboardInfo?.allowedDashboards.includes('b2b')) {
  // Redirect or show error
  return <ErrorScreen message="You don't have access to B2B dashboard" />;
}
```

---

### 5. DealerSignupScreen (B2B)
**Purpose:** Show available shop types during registration

**Integration:**
```typescript
import { useShopTypes } from '../hooks/useShopTypes';

const { data: shopTypes, isLoading } = useShopTypes();

// Filter to show only B2B shop types
const b2bShopTypes = shopTypes?.filter(st => st.dashboard_type === 'b2b');

// Display in picker/selector
{b2bShopTypes?.map(shopType => (
  <Picker.Item 
    key={shopType.id} 
    label={shopType.name} 
    value={shopType.id} 
  />
))}
```

---

## Dashboard Access Rules

### Shop Type → Dashboard Mapping

| Shop Type ID | Shop Type Name | Primary Dashboard | Can Switch To |
|--------------|----------------|-------------------|---------------|
| 1 | Industrial | B2B | B2C (if user is also customer) |
| 2 | Door Step Buyer | Delivery | None (cannot access B2B/B2C) |
| 3 | Retailer | B2C | B2B (if user is shop owner) |
| 4 | Wholesaler | B2B | B2C (if user is also customer) |

---

## Implementation Checklist

### Phase 1: Basic Integration
- [x] Create API service functions (`src/services/api/v2/shopTypes.ts`)
- [x] Create React Query hooks (`src/hooks/useShopTypes.ts`)
- [x] Update query keys (`src/services/api/queryKeys.ts`)
- [x] Create dashboard service (`src/services/dashboard/dashboardService.ts`)

### Phase 2: UI Integration
- [ ] Integrate `useUserDashboards` in `AppNavigator` to control tab visibility
- [ ] Add shop type display in `UserProfileScreen` (B2C & B2B)
- [ ] Add dashboard switch button in `UserProfileScreen`
- [ ] Add access validation in `DashboardScreen` (B2C)
- [ ] Add access validation in `DealerDashboardScreen` (B2B)
- [ ] Integrate shop types in `DealerSignupScreen`

### Phase 3: Enhanced Features
- [ ] Add dashboard switch confirmation dialog
- [ ] Add loading states during dashboard switch
- [ ] Cache dashboard preferences in AsyncStorage
- [ ] Add error handling and user feedback
- [ ] Add analytics tracking for dashboard switches

---

## Error Handling

All API calls should handle errors gracefully:

```typescript
try {
  const result = await switchDashboard(userId, 'b2c');
  // Success
} catch (error) {
  // Show error message to user
  Alert.alert('Error', error.message || 'Failed to switch dashboard');
}
```

---

## Testing

Test the integration with:

1. **Different Shop Types:**
   - Test with Industrial (B2B only)
   - Test with Retailer (B2C only)
   - Test with Wholesaler (B2B, can switch to B2C)
   - Test with Door Step Buyer (Delivery only)

2. **Dashboard Switching:**
   - Test switching from B2B to B2C
   - Test switching from B2C to B2B
   - Test switching when not allowed (should show error)

3. **Tab Visibility:**
   - Verify only allowed tabs are visible
   - Verify tabs update when dashboard is switched

---

## Notes

- API key should be stored securely (use environment variables or secure storage)
- Dashboard preferences are cached in AsyncStorage for offline access
- All API calls use React Query for caching and automatic refetching
- Dashboard switching invalidates relevant queries to ensure fresh data

