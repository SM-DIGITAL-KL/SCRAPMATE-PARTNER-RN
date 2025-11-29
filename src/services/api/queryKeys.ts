/**
 * Query Keys Factory
 * Centralized query keys for type-safe query management
 */

export const queryKeys = {
  // User queries
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.users.details(), id] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
  },

  // Shop queries
  shops: {
    all: ['shops'] as const,
    lists: () => [...queryKeys.shops.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      filters ? [...queryKeys.shops.lists(), filters] : queryKeys.shops.lists(),
    details: () => [...queryKeys.shops.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.shops.details(), id] as const,
    byType: (type: number) => [...queryKeys.shops.all, 'type', type] as const,
  },

  // Order queries
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      filters ? [...queryKeys.orders.lists(), filters] : queryKeys.orders.lists(),
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.orders.details(), id] as const,
    byUser: (userId: string | number) => [...queryKeys.orders.all, 'user', userId] as const,
    byShop: (shopId: string | number) => [...queryKeys.orders.all, 'shop', shopId] as const,
  },

  // Product queries
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      filters ? [...queryKeys.products.lists(), filters] : queryKeys.products.lists(),
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.products.details(), id] as const,
    byCategory: (categoryId: string | number) => 
      [...queryKeys.products.all, 'category', categoryId] as const,
  },

  // Category queries
  categories: {
    all: ['categories'] as const,
    lists: () => [...queryKeys.categories.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      filters ? [...queryKeys.categories.lists(), filters] : queryKeys.categories.lists(),
    details: () => [...queryKeys.categories.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.categories.details(), id] as const,
  },

  // Dashboard queries
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    counts: () => [...queryKeys.dashboard.all, 'counts'] as const,
    byUser: (userId: string | number) => 
      [...queryKeys.dashboard.all, 'user', userId] as const,
  },

  // Notification queries
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      filters ? [...queryKeys.notifications.lists(), filters] : queryKeys.notifications.lists(),
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
    count: () => [...queryKeys.notifications.all, 'count'] as const,
  },

  // Shop Types & Dashboard Management (v2 API)
  shopTypes: {
    all: ['shopTypes'] as const,
    list: () => [...queryKeys.shopTypes.all, 'list'] as const,
    userDashboards: (userId: number | string | null) => 
      [...queryKeys.shopTypes.all, 'userDashboards', userId] as const,
  },
} as const;

