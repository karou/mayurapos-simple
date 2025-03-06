# MayuraPOS - Microservices-based Point of Sale System

MayuraPOS is a comprehensive business management system designed around a modern, resilient microservices architecture. It enables businesses to process customer payments, track sales, manage inventory, handle purchase orders, and coordinate deliveries - all with offline capabilities for continued operation during internet outages.

## Architecture Overview

MayuraPOS is built on a microservices architecture with the following key components:

- **API Gateway**: Central entry point that routes client requests to appropriate services
- **Auth Service**: Handles authentication, authorization, and user management
- **Payment Service**: Manages payment processing with offline capabilities
- **Inventory Service**: Controls stock, purchase orders, and supplier connections
- **Order Service**: Tracks sales and manages the checkout process
- **Delivery Service**: Coordinates logistics and delivery tracking
- **Reporting Service**: Generates analytics and financial reports
- **Notification Service**: Sends alerts to customers and staff

Each service has its own database, uses RabbitMQ for asynchronous communication, and is containerized with Docker for consistent deployment.

## Technology Stack

- **Backend**: Node.js with TypeScript
- **API Framework**: Express.js
- **Database**: MongoDB (separate instance for each service)
- **Caching**: Redis
- **Message Broker**: RabbitMQ
- **Containerization**: Docker & Docker Compose
- **API Gateway**: Express with http-proxy-middleware
- **Authentication**: JSON Web Tokens (JWT)
- **Offline Support**: Transaction queuing for synchronization when connectivity returns

## Setup and Installation

### Prerequisites

- Docker and Docker Compose
- Node.js v18 or higher
- npm v8 or higher

### Environment Configuration

1. Create a `.env` file in the project root with the following variables:

```
# General
NODE_ENV=development
JWT_SECRET=your-secret-key

# RabbitMQ
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# Email (for notification service)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password

# SMS (for notification service)
SMS_API_KEY=your-sms-api-key
```

### Starting the System

1. **Build and start all services**:

```bash
docker-compose up --build
```

2. **For development**, you can run individual services:

```bash
# Start dependencies first
docker-compose up -d mongo-auth mongo-payment mongo-inventory mongo-order mongo-delivery mongo-reporting mongo-notification rabbitmq redis

# Then run a specific service in development mode
cd auth-service
npm install
npm run dev
```

3. **Access the API Gateway**:

The API Gateway will be available at `http://localhost:8000`

## API Endpoints

### Auth Service
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get tokens
- `POST /auth/refresh-token` - Refresh access token
- `GET /auth/me` - Get current user info

### Payment Service
- `POST /api/payment/payments` - Process a payment
- `GET /api/payment/payments/:id` - Get payment by ID
- `POST /api/payment/payments/:id/refund` - Process a refund
- `POST /api/payment/offline/submit` - Submit offline payment for processing

### Inventory Service
- `GET /api/inventory/products` - Search products
- `POST /api/inventory/products` - Create a product
- `GET /api/inventory/inventory/store/:storeId` - Get store inventory
- `POST /api/inventory/inventory/adjust` - Adjust inventory quantity
- `GET /api/inventory/alerts/low-stock` - Get low stock alerts

### Order Service
- `POST /api/orders` - Create a new order
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id` - Update an order
- `POST /api/orders/:id/confirm` - Confirm an order
- `GET /api/orders/stats/summary` - Get order statistics

## Offline Capabilities

MayuraPOS is designed to work in environments with unreliable internet connectivity:

1. **Payment Processing**: The system can accept payments offline and queue them for processing when connectivity is restored.

2. **Inventory Management**: Inventory operations are cached locally and synchronized with the central system when connectivity is available.

3. **Order Processing**: Orders can be created, processed, and fulfilled offline, with data synchronization upon reconnection.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature-name`)
5. Open a Pull Request

## License

This project is proprietary software.

## Project Structure

```
mayura-pos/
├── .cline/                             # Task logging directory
├── docker-compose.yml                  # Main docker compose for all services
├── api-gateway/                        # API Gateway service
├── auth-service/                       # Authentication & Authorization service
├── payment-service/                    # Payment processing service
├── inventory-service/                  # Inventory management service
├── order-service/                      # Order management service
├── delivery-service/                   # Delivery tracking service
├── reporting-service/                  # Analytics and reporting service
├── notification-service/               # Notifications and alerts service
└── shared/                             # Shared libraries and utilities
```