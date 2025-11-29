# React Query Setup Guide

This project has been configured with **@tanstack/react-query** for efficient data fetching, caching, and state management.

## 📦 Installed Dependencies

- `@tanstack/react-query` (v5.90.10) - Already installed ✅

## 🔧 Optional Dependencies (for persistence)

To enable offline caching and persistence, install:

```bash
npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
```

## 📁 File Structure

```
src/
├── services/
│   └── api/
│       ├── client.ts          # API client configuration and error handling
│       ├── queryClient.ts     # QueryClient setup with defaults
│       ├── queryKeys.ts       # Type-safe query keys factory
│       └── example.ts          # Example API service functions
├── hooks/
│   ├── useApiQuery.ts         # Enhanced useQuery hook
│   ├── useApiMutation.ts      # Enhanced useMutation hook
│   ├── useInfiniteQuery.ts    # Enhanced useInfiniteQuery hook
│   ├── example.ts             # Example hooks usage
│   └── index.ts              # Hooks barrel export
└── app/
    └── App.tsx                # QueryClientProvider setup
```

## 🚀 Quick Start

### 1. Basic Query Example

```typescript
import { useApiQuery } from '../hooks';
import { queryKeys } from '../services/api/queryKeys';
import { fetchUserProfile } from '../services/api/example';

function UserProfile({ userId }: { userId: number }) {
  const { data, isLoading, error } = useApiQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => fetchUserProfile(userId),
  });

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return <Text>{data.name}</Text>;
}
```

### 2. Mutation Example

```typescript
import { useApiMutation } from '../hooks';
import { queryKeys } from '../services/api/queryKeys';
import { updateUserProfile } from '../services/api/example';

function EditProfile({ userId }: { userId: number }) {
  const mutation = useApiMutation({
    mutationFn: (data: { name: string }) => updateUserProfile(userId, data),
    invalidateQueries: [
      queryKeys.users.detail(userId),
    ],
    onSuccess: () => {
      console.log('Profile updated!');
    },
  });

  const handleUpdate = () => {
    mutation.mutate({ name: 'New Name' });
  };

  return (
    <Button 
      onPress={handleUpdate} 
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Updating...' : 'Update Profile'}
    </Button>
  );
}
```

### 3. Infinite Query (Pagination) Example

```typescript
import { useInfiniteApiQuery } from '../hooks';
import { queryKeys } from '../services/api/queryKeys';

function OrdersList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteApiQuery({
    queryKey: queryKeys.orders.lists(),
    queryFn: async (pageParam) => {
      const response = await fetch(`/api/orders?page=${pageParam || 1}`);
      const result = await response.json();
      return {
        data: result.orders,
        nextCursor: result.nextPage,
        hasMore: !!result.nextPage,
      };
    },
    initialPageParam: 1,
  });

  const allOrders = data?.pages.flatMap(page => page.data) || [];

  return (
    <FlatList
      data={allOrders}
      renderItem={({ item }) => <OrderItem order={item} />}
      onEndReached={() => hasNextPage && fetchNextPage()}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator /> : null
      }
    />
  );
}
```

## 🎯 Query Keys

Query keys are centralized in `src/services/api/queryKeys.ts` for type safety and easy invalidation:

```typescript
// Users
queryKeys.users.all
queryKeys.users.list(filters)
queryKeys.users.detail(userId)

// Shops
queryKeys.shops.all
queryKeys.shops.list(filters)
queryKeys.shops.detail(shopId)
queryKeys.shops.byType(type)

// Orders
queryKeys.orders.all
queryKeys.orders.list(filters)
queryKeys.orders.detail(orderId)
queryKeys.orders.byUser(userId)
queryKeys.orders.byShop(shopId)

// And more...
```

## ⚙️ Configuration

### QueryClient Defaults

Located in `src/services/api/queryClient.ts`:

- **Cache Time**: 5 minutes
- **Stale Time**: 1 minute
- **Retry**: 3 times with exponential backoff
- **Refetch**: On window focus and reconnect
- **Network Mode**: Online only

### Customizing Defaults

Edit `src/services/api/queryClient.ts`:

```typescript
const defaultQueryOptions = {
  queries: {
    gcTime: 1000 * 60 * 10, // 10 minutes
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    // ... more options
  },
};
```

## 🔄 Cache Management

### Invalidate Queries

```typescript
import { queryClient } from '../services/api/queryClient';
import { queryKeys } from '../services/api/queryKeys';

// Invalidate all user queries
queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

// Invalidate specific user
queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });

// Invalidate all queries
queryClient.invalidateQueries();
```

### Reset Cache

```typescript
import { resetQueryCache } from '../services/api/queryClient';

resetQueryCache(); // Clears all cached data
```

## 🛠️ API Client Setup

Update `src/services/api/client.ts` with your API configuration:

```typescript
export const API_CONFIG = {
  baseURL: 'https://your-api.com/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN', // Add auth if needed
  },
};
```

## 📝 Best Practices

1. **Use Query Keys Factory**: Always use `queryKeys` for type-safe query keys
2. **Invalidate on Mutations**: Use `invalidateQueries` in mutations to refresh data
3. **Handle Loading States**: Always show loading indicators
4. **Error Handling**: Use the enhanced error parsing from `useApiQuery`
5. **Optimistic Updates**: Use `onMutate` for optimistic UI updates
6. **Prefetching**: Use `prefetchQuery` for better UX

## 🔍 Example: Complete API Service

Replace `src/services/api/example.ts` with your actual API functions:

```typescript
import { API_CONFIG, ApiException } from './client';

export const fetchShops = async (filters?: { type?: number }) => {
  const response = await fetch(`${API_CONFIG.baseURL}/shops`, {
    method: 'GET',
    headers: API_CONFIG.headers,
  });

  if (!response.ok) {
    throw new ApiException('Failed to fetch shops', response.status);
  }

  return response.json();
};
```

## 🐛 Debugging

React Query DevTools (optional, for web):

```bash
npm install @tanstack/react-query-devtools
```

Then add to your App:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Add inside QueryClientProvider
<ReactQueryDevtools initialIsOpen={false} />
```

## 📚 Resources

- [React Query Documentation](https://tanstack.com/query/latest)
- [React Query React Native Guide](https://tanstack.com/query/latest/docs/react/react-native)
- [Query Keys Best Practices](https://tkdodo.eu/blog/effective-react-query-keys)

