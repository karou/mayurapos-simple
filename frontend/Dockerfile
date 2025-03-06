FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --quiet

# Copy project files
COPY . .

# Build the app
RUN npm run build

# Use nginx to serve the built app
FROM nginx:alpine AS production

# Copy built app from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create .env file for runtime environment variables
RUN touch /usr/share/nginx/html/.env

# Add runtime environment variable script
COPY env.sh /docker-entrypoint.d/40-env.sh
RUN chmod +x /docker-entrypoint.d/40-env.sh

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]