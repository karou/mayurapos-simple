# MayuraPOS Frontend Project Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   ├── index.html
│   ├── logo192.png
│   ├── logo512.png
│   ├── manifest.json
│   ├── robots.txt
│   └── serviceWorker.js
├── src/
│   ├── api/
│   │   ├── apiClient.ts                # Base API client with authentication
│   │   ├── authApi.ts                  # Authentication API endpoints
│   │   ├── inventoryApi.ts             # Inventory API endpoints
│   │   ├── orderApi.ts                 # Order API endpoints
│   │   ├── paymentApi.ts               # Payment API endpoints
│   │   └── syncService.ts              # Offline data synchronization service
│   ├── assets/
│   │   ├── icons/                      # SVG icons and app icons
│   │   └── images/                     # Images and graphics
│   ├── components/
│   │   ├── common/                     # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Toast.tsx
│   │   ├── inventory/                  # Inventory-related components
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductList.tsx
│   │   │   └── StockIndicator.tsx
│   │   ├── layout/                     # Layout components
│   │   │   ├── AppBar.tsx
│   │   │   ├── BottomNavigation.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── orders/                     # Order-related components
│   │   │   ├── Cart.tsx
│   │   │   ├── CartItem.tsx
│   │   │   ├── OrderDetails.tsx
│   │   │   └── OrderList.tsx
│   │   └── payment/                    # Payment-related components
│   │       ├── PaymentForm.tsx
│   │       ├── PaymentMethod.tsx
│   │       └── PaymentStatus.tsx
│   ├── contexts/                       # React context providers
│   │   ├── AuthContext.tsx             # Authentication context
│   │   ├── CartContext.tsx             # Shopping cart context
│   │   ├── OfflineContext.tsx          # Network status context
│   │   └── ToastContext.tsx            # Toast notification context
│   ├── hooks/                          # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useCart.ts
│   │   ├── useOffline.ts
│   │   └── useToast.ts
│   ├── pages/                          # Application pages
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryPage.tsx
│   │   │   └── ProductDetailsPage.tsx
│   │   ├── orders/
│   │   │   ├── CartPage.tsx
│   │   │   ├── CheckoutPage.tsx
│   │   │   ├── OrderDetailsPage.tsx
│   │   │   └── OrdersPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── services/                       # Business logic services
│   │   ├── authService.ts              # Authentication service
│   │   ├── cartService.ts              # Cart management service
│   │   ├── storageService.ts           # Local storage service
│   │   └── syncService.ts              # Data synchronization service
│   ├── store/                          # State management
│   │   ├── slices/                     # Redux slices
│   │   │   ├── authSlice.ts
│   │   │   ├── cartSlice.ts
│   │   │   ├── inventorySlice.ts
│   │   │   └── uiSlice.ts
│   │   ├── hooks.ts                    # Redux hooks
│   │   └── store.ts                    # Redux store configuration
│   ├── types/                          # TypeScript type definitions
│   │   ├── auth.types.ts
│   │   ├── inventory.types.ts
│   │   ├── order.types.ts
│   │   └── payment.types.ts
│   ├── utils/                          # Utility functions
│   │   ├── currency.ts                 # Currency formatting
│   │   ├── date.ts                     # Date formatting and manipulation
│   │   ├── storage.ts                  # Storage helpers
│   │   └── validation.ts               # Form validation helpers
│   ├── App.tsx                         # Main App component
│   ├── index.css                       # Global styles
│   ├── index.tsx                       # Application entry point
│   ├── react-app-env.d.ts              # React app type declarations
│   ├── reportWebVitals.ts              # Web Vitals reporting
│   └── setupTests.ts                   # Test setup
├── .env                                # Environment variables
├── .eslintrc.js                        # ESLint configuration
├── .gitignore                          # Git ignore file
├── .prettierrc                         # Prettier configuration
├── package.json                        # NPM package configuration
├── tailwind.config.js                  # Tailwind CSS configuration
├── tsconfig.json                       # TypeScript configuration
└── README.md                           # Project documentation
```