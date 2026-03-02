#!/bin/bash

echo "Testing API..."

echo "1. Health check:"
curl -s http://localhost:3000/health | jq .

echo -e "\n2. Creating launch:"
LAUNCH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/launches \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Launch"}')
echo "$LAUNCH_RESPONSE" | jq .

LAUNCH_ID=$(echo "$LAUNCH_RESPONSE" | jq -r '.data.id // empty')
if [ -n "$LAUNCH_ID" ]; then
  echo -e "\n3. Launch created with ID: $LAUNCH_ID"
  echo -e "\n4. Getting launch:"
  curl -s http://localhost:3000/api/v1/launches/$LAUNCH_ID | jq .
else
  echo -e "\n3. Failed to create launch"
fi
