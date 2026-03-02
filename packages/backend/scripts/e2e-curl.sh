#!/usr/bin/env bash
# E2E test via curl: upload results and GET all results.
# Prerequisites: server running (yarn dev), DB up (docker-compose up -d postgres), migrations applied.
# Usage: from repo root or packages/backend:
#   ./scripts/e2e-curl.sh
#   API_URL=http://localhost:3000 ./scripts/e2e-curl.sh

set -e
API_URL="${API_URL:-http://localhost:3000}"
PREFIX="${API_URL}/api/v1"

echo "=== E2E curl: $PREFIX ==="

# 1. Health
echo "1. GET /health"
curl -s -S "${API_URL}/health" | jq .

# 2. Create launch
echo "2. POST /api/v1/launches"
LAUNCH_JSON=$(curl -s -S -X POST "${PREFIX}/launches" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E curl launch","environment":"e2e"}')
echo "$LAUNCH_JSON" | jq .
LAUNCH_ID=$(echo "$LAUNCH_JSON" | jq -r '.data.id')
if [ -z "$LAUNCH_ID" ] || [ "$LAUNCH_ID" = "null" ]; then
  echo "Failed to create launch"
  exit 1
fi
echo "Launch ID: $LAUNCH_ID"

# 3. Upload results
echo "3. POST /api/v1/launches/$LAUNCH_ID/results"
UPLOAD_PAYLOAD='[
  {"id":"curl-test-1","name":"Curl Test 1","status":"passed","flaky":false,"muted":false,"known":false,"hidden":false,"labels":[],"parameters":[],"links":[],"steps":[],"sourceMetadata":{"readerId":"curl","metadata":{}}},
  {"id":"curl-test-2","name":"Curl Test 2","status":"failed","flaky":false,"muted":false,"known":false,"hidden":false,"labels":[],"parameters":[],"links":[],"steps":[],"sourceMetadata":{"readerId":"curl","metadata":{}}}
]'
curl -s -S -X POST "${PREFIX}/launches/${LAUNCH_ID}/results" \
  -H "Content-Type: application/json" \
  -d "$UPLOAD_PAYLOAD" | jq .

# 4. GET all results for launch
echo "4. GET /api/v1/launches/$LAUNCH_ID/results"
curl -s -S "${PREFIX}/launches/${LAUNCH_ID}/results" | jq .

# 5. GET launch (with statistic)
echo "5. GET /api/v1/launches/$LAUNCH_ID"
curl -s -S "${PREFIX}/launches/${LAUNCH_ID}" | jq .

# 6. List launches
echo "6. GET /api/v1/launches"
curl -s -S "${PREFIX}/launches" | jq '.data | length' 
echo "launches listed (see above for count)"

echo "=== E2E curl done ==="
