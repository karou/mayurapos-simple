#!/bin/sh

# Create runtime environment variables accessible to the frontend app
# We recreate the .env file at runtime to support container orchestration

ENV_FILE=/usr/share/nginx/html/.env

# Remove existing env file if it exists
rm -f $ENV_FILE

# Recreate .env file with runtime environment variables
echo "REACT_APP_API_URL=${REACT_APP_API_URL:-http://localhost:8000}" >> $ENV_FILE
echo "REACT_APP_VERSION=${REACT_APP_VERSION:-1.0.0}" >> $ENV_FILE
echo "REACT_APP_BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> $ENV_FILE
echo "REACT_APP_ENVIRONMENT=${NODE_ENV:-production}" >> $ENV_FILE

# Add any other environment variables that start with REACT_APP_
# This allows dynamically setting env vars when deploying containers
for envvar in $(env | grep -E "^REACT_APP_" | cut -d= -f1); do
  # Skip variables we've already handled
  if [ "$envvar" != "REACT_APP_API_URL" ] && [ "$envvar" != "REACT_APP_VERSION" ] && [ "$envvar" != "REACT_APP_ENVIRONMENT" ]; then
    echo "${envvar}=${!envvar}" >> $ENV_FILE
  fi
done

# Make the script to inject env vars into window object
cat << EOF > /usr/share/nginx/html/env-config.js
window.env = {
  API_URL: "${REACT_APP_API_URL:-http://localhost:8000}",
  VERSION: "${REACT_APP_VERSION:-1.0.0}",
  BUILD_DATE: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  ENVIRONMENT: "${NODE_ENV:-production}"
};
EOF

# Add any other environment variables to the window.env object
for envvar in $(env | grep -E "^REACT_APP_" | cut -d= -f1); do
  # Skip variables we've already handled
  if [ "$envvar" != "REACT_APP_API_URL" ] && [ "$envvar" != "REACT_APP_VERSION" ] && [ "$envvar" != "REACT_APP_ENVIRONMENT" ]; then
    # Remove REACT_APP_ prefix and convert the rest to the property name
    prop_name=$(echo ${envvar#REACT_APP_})
    echo "window.env.${prop_name} = \"${!envvar}\";" >> /usr/share/nginx/html/env-config.js
  fi
done

echo "Runtime environment variables configured:"
cat $ENV_FILE
echo "Window environment object configured in env-config.js"