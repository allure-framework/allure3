#!/bin/bash

API_URL="http://localhost:3000/api/v1"
DATA_DIR="/tmp/allure_test_data"

echo "=== Testing API ==="
echo ""

echo "1. Health check:"
curl -s "$API_URL/../health" | jq . || echo "Health check failed"
echo ""

echo "2. Test route:"
curl -s "http://localhost:3000/test" | jq . || echo "Test route failed"
echo ""

echo "3. Creating launch:"
LAUNCH_RESPONSE=$(curl -s -X POST "$API_URL/launches" \
  -H "Content-Type: application/json" \
  -d '{"name": "Allure Test Data Import", "startTime": "2024-01-01T00:00:00.000Z"}')

echo "$LAUNCH_RESPONSE" | jq . || echo "$LAUNCH_RESPONSE"
echo ""

LAUNCH_ID=$(echo "$LAUNCH_RESPONSE" | jq -r '.data.id // empty')
if [ -z "$LAUNCH_ID" ] || [ "$LAUNCH_ID" = "null" ]; then
  echo "ERROR: Failed to create launch or extract launch ID"
  echo "Response was: $LAUNCH_RESPONSE"
  exit 1
fi

echo "Launch created with ID: $LAUNCH_ID"
echo ""

echo "4. Getting launch:"
curl -s "$API_URL/launches/$LAUNCH_ID" | jq . || echo "Failed to get launch"
echo ""

echo "=== Loading test data ==="
if [ ! -d "$DATA_DIR" ]; then
  echo "ERROR: Data directory not found: $DATA_DIR"
  exit 1
fi

RESULT_FILES=$(find "$DATA_DIR" -name "*-result.json" | head -5)
RESULT_COUNT=$(find "$DATA_DIR" -name "*-result.json" | wc -l)

echo "Found $RESULT_COUNT result files"
echo "Will upload first 5 files for testing"
echo ""

# For now, just show what we found
echo "Sample result files:"
echo "$RESULT_FILES" | head -3
echo ""

echo "To upload results, run:"
echo "node scripts/upload_test_data.js"
echo ""

echo "=== Summary ==="
echo "Launch ID: $LAUNCH_ID"
echo "View launch: $API_URL/launches/$LAUNCH_ID"
echo "API docs: http://localhost:3000/api-docs"
