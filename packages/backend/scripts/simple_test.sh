#!/bin/bash

API_URL="http://localhost:3000/api/v1"

echo "=== Testing Upload and GET Results ==="
echo ""

# 1. Create launch
echo "1. Creating launch..."
LAUNCH_RESPONSE=$(curl -s -X POST "$API_URL/launches" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Upload Results", "startTime": "2024-01-01T00:00:00.000Z"}')

echo "$LAUNCH_RESPONSE" | jq . || echo "$LAUNCH_RESPONSE"
LAUNCH_ID=$(echo "$LAUNCH_RESPONSE" | jq -r '.data.id // empty')

if [ -z "$LAUNCH_ID" ] || [ "$LAUNCH_ID" = "null" ]; then
  echo "ERROR: Failed to create launch"
  exit 1
fi

echo "Launch ID: $LAUNCH_ID"
echo ""

# 2. Upload test results
echo "2. Uploading test results..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/launches/$LAUNCH_ID/results" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "test-1",
      "name": "Test Case 1",
      "fullName": "com.example.Test#test1",
      "status": "passed",
      "flaky": false,
      "muted": false,
      "known": false,
      "hidden": false,
      "start": 1700000000000,
      "stop": 1700000001000,
      "labels": [],
      "parameters": [],
      "links": [],
      "steps": [],
      "attachments": [],
      "sourceMetadata": {"readerId": "test", "metadata": {}}
    }
  ]')

echo "$UPLOAD_RESPONSE" | jq . || echo "$UPLOAD_RESPONSE"
echo ""

# 3. Get results list
echo "3. Getting results list..."
LIST_RESPONSE=$(curl -s "$API_URL/launches/$LAUNCH_ID/results?page=1&limit=10")
echo "$LIST_RESPONSE" | jq . || echo "$LIST_RESPONSE"
echo ""

# 4. Get single result (if available)
RESULT_ID=$(echo "$LIST_RESPONSE" | jq -r '.data[0].id // empty')
if [ -n "$RESULT_ID" ] && [ "$RESULT_ID" != "null" ]; then
  echo "4. Getting single result: $RESULT_ID"
  GET_RESPONSE=$(curl -s "$API_URL/test-results/$RESULT_ID")
  echo "$GET_RESPONSE" | jq . || echo "$GET_RESPONSE"
  echo ""
fi

echo "=== Test completed ==="
