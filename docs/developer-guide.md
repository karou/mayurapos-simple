# MayuraPOS Developer Guide

## Local Development Setup

This guide will help you set up the MayuraPOS system for local development.

### Prerequisites

- Node.js v18 or higher
- npm v8 or higher
- Docker and Docker Compose
- MongoDB (can use Docker)
- RabbitMQ (can use Docker)
- Redis (can use Docker)

### Setting up Dependencies

The easiest way to set up the required dependencies is using Docker:

```bash
# Start MongoDB, RabbitMQ, and Redis
docker-compose up -d mongo-auth mongo-payment mongo-inventory mongo-order mongo-delivery mongo-reporting mongo-notification rabbitmq redis
```

### Environment Setup

1. Create a `.env` file in each service directory with the appropriate configuration:

```
# Example .env for Auth Service
NODE_ENV=development
PORT=3001
MONGO_URI=mongodb://localhost:27017/mayura-auth
RABBITMQ_URI=amqp://localhost
REDIS_URI=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
```

2. Install dependencies for all services:

```bash
# Install shared dependencies
cd shared
npm install

# Install service-specific dependencies
cd ../auth-service
npm install

cd ../payment-service
npm install

cd ../order-service
npm install

cd ../inventory-service
npm install

cd ../delivery-service
npm install

cd ../reporting-service
npm install

cd ../notification-service
npm install

cd ../api-gateway
npm install
```

### Running Individual Services

You can run each service individually for development:

```bash
# Start the Auth Service
cd auth-service
npm run dev

# Start the Payment Service
cd payment-service
npm run dev

# Start the Order Service
cd order-service
npm run dev

# Start the Inventory Service
cd inventory-service
npm run dev

# Start the Delivery Service
cd delivery-service
npm run dev

# Start the Reporting Service
cd reporting-service
npm run dev

# Start the Notification Service
cd notification-service
npm run dev

# Start the API Gateway
cd api-gateway
npm run dev
```

### Service Ports

Each service runs on a different port:

- API Gateway: 8000
- Auth Service: 3001
- Payment Service: 3002
- Inventory Service: 3003
- Order Service: 3004
- Delivery Service: 3005
- Reporting Service: 3006
- Notification Service: 3007

### Testing the API

You can use tools like Postman or cURL to test the API endpoints:

```bash
# Example: Create a user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "email": "test@example.com", "password": "password123"}'

# Example: Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "password123"}'
```

## Project Structure

Each service follows a similar structure:

```
service-name/
├── src/
│   ├── index.ts         # Entry point
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Middleware functions
│   └── utils/           # Utility functions
├── tests/               # Test files
├── .env                 # Environment variables
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript configuration
```

## Shared Code

The `shared` directory contains code shared across services:

```
shared/
├── base-service.ts      # Base service class
├── message-bus.ts       # Message broker integration
├── task-logger.ts       # Task logging utility
└── utils/               # Shared utilities
```

## Development Workflow

1. Make changes to the code
2. Run tests to ensure everything works
3. Start the service in development mode
4. Test your changes with API requests
5. Commit your changes

## Building for Production

To build a service for production:

```bash
cd service-name
npm run build
```

This will compile the TypeScript code into JavaScript in the `dist` directory.

## Running with Docker

You can also run the entire system using Docker Compose:

```bash
docker-compose up --build
```

This will build and start all services, along with the required dependencies.

## Troubleshooting

### Connection Issues

If you're having trouble connecting to MongoDB, RabbitMQ, or Redis, check:

1. Are the services running? `docker ps`
2. Are you using the correct connection URLs?
3. Are there any firewall issues?

### Service Startup Issues

If a service fails to start:

1. Check the logs for error messages
2. Ensure all dependencies are installed
3. Verify that environment variables are set correctly
4. Make sure required services (MongoDB, RabbitMQ, Redis) are running

### API Gateway Issues

If the API Gateway is not routing requests correctly:

1. Check if the target service is running
2. Ensure the API Gateway is configured with the correct service URLs
3. Check for any authentication issues

## Logging

All services use Winston for logging. In development mode, logs are written to the console and log files in the `logs` directory.

You can adjust the log level in the service configuration:

```typescript
// Change log level
this.logger.level = 'debug';
```

Available log levels: error, warn, info, http, verbose, debug, silly

## Message Bus

Services communicate asynchronously using RabbitMQ. Each service publishes events and subscribes to events from other services.

To debug message flow:

1. Access the RabbitMQ management UI at http://localhost:15672 (default credentials: guest/guest)
2. Check the exchanges, queues, and message rates
3. Use the "Publish message" feature to manually send test messages

## Further Documentation

For more detailed documentation on each service, refer to the README file in each service directory.