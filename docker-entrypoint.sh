#!/bin/sh
set -e

# This script determines which service to start based on the SERVICE_NAME environment variable

# Default to api-gateway if no service name is provided
SERVICE_NAME=${SERVICE_NAME:-api-gateway}

echo "Starting MayuraPOS $SERVICE_NAME..."

# Ensure log directories exist and have proper permissions
mkdir -p /app/logs/$SERVICE_NAME
chmod 755 /app/logs/$SERVICE_NAME

# Switch based on service name
case "$SERVICE_NAME" in
  "api-gateway")
    cd /app/api-gateway && node dist/index.js
    ;;
  "auth-service")
    cd /app/auth-service && node dist/index.js
    ;;
  "payment-service")
    cd /app/payment-service && node dist/index.js
    ;;
  "inventory-service")
    cd /app/inventory-service && node dist/index.js
    ;;
  "order-service")
    cd /app/order-service && node dist/index.js
    ;;
  "delivery-service")
    cd /app/delivery-service && node dist/index.js
    ;;
  "reporting-service")
    cd /app/reporting-service && node dist/index.js
    ;;
  "notification-service")
    cd /app/notification-service && node dist/index.js
    ;;
  *)
    echo "Unknown service: $SERVICE_NAME"
    echo "Available services: api-gateway, auth-service, payment-service, inventory-service, order-service, delivery-service, reporting-service, notification-service"
    exit 1
    ;;
esac