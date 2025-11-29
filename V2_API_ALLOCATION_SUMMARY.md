# V2 API Allocation Summary

## Created Files

### 1. API Services
- ✅ `src/services/api/v2/shopTypes.ts` - API service functions for v2 endpoints
- ✅ `src/services/dashboard/dashboardService.ts` - Dashboard management service

### 2. React Query Hooks
- ✅ `src/hooks/useShopTypes.ts` - Hooks for shop types and dashboard management
- ✅ Updated `src/hooks/index.ts` - Exported new hooks

### 3. Query Keys
- ✅ Updated `src/services/api/queryKeys.ts` - Added shopTypes query keys

### 4. Documentation
- ✅ `V2_API_INTEGRATION.md` - Complete integration guide

---

## API Endpoints → UI Components Mapping

### 1. GET /api/v2/shop-types
**Hook:** `useShopTypes()`  
**Allocated to:**
- `UserProfileScreen` (B2C & B2B) - Display shop type
- `DealerSignupScreen` (B2B) - Shop type selection
- Settings/Profile screens

### 2. GET /api/v2/user/dashboards/:userId
**Hook:** `useUserDashboards(userId)`  
**Allocated to:**
- `AppNavigator` - Control tab visibility
- `DashboardScreen` (B2C) - Access validation
- `DealerDashboardScreen` (B2B) - Access validation
- `UserProfileScreen` - Show available dashboards

### 3. POST /api/v2/user/validate-dashboard
**Hook:** `useValidateDashboard()`  
**Allocated to:**
- `AppNavigator` - Pre-navigation validation
- Dashboard switch components - Pre-switch validation

### 4. POST /api/v2/user/switch-dashboard
**Hook:** `useSwitchDashboard()`  
**Allocated to:**
- `UserProfileScreen` (B2C & B2B) - Dashboard switch button
- `AppNavigator` - Programmatic switching
- Dashboard headers - Quick switch

---

## Next Steps for UI Integration

### Priority 1: Core Functionality
1. **AppNavigator** - Integrate `useUserDashboards` to show/hide tabs
2. **UserProfileScreen** - Add dashboard switch functionality
3. **Dashboard Screens** - Add access validation

### Priority 2: Enhanced Features
1. **DealerSignupScreen** - Integrate shop types selection
2. **Error Handling** - Add user-friendly error messages
3. **Loading States** - Add loading indicators

### Priority 3: Polish
1. **Caching** - Implement dashboard preference caching
2. **Analytics** - Track dashboard switches
3. **Animations** - Smooth dashboard transitions

---

## API Key Configuration

**TODO:** Add API key to environment variables or secure storage:
```typescript
// In src/services/api/v2/shopTypes.ts
// Replace process.env.API_KEY with:
import { getApiKey } from '../config'; // Create this config file
```

---

## Testing Checklist

- [ ] Test with Industrial shop type (B2B only)
- [ ] Test with Retailer shop type (B2C only)
- [ ] Test with Wholesaler shop type (B2B, can switch to B2C)
- [ ] Test with Door Step Buyer (Delivery only)
- [ ] Test dashboard switching
- [ ] Test tab visibility based on allowed dashboards
- [ ] Test error handling

---

## Files Ready for Integration

All API services and hooks are ready. The UI components need to be updated to use these hooks as described in `V2_API_INTEGRATION.md`.

