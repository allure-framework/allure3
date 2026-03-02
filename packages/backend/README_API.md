# API Testing and Data Upload Guide

## Status

✅ **API Routes Fixed** - All endpoints are now visible in Swagger UI
✅ **Swagger Documentation** - JSDoc annotations added to routes
✅ **Database Connected** - PostgreSQL is running and migrations applied

## Quick Start

### 1. Start the Server

```bash
cd packages/backend
PORT=3000 yarn dev
```

### 2. Access API Documentation

Open in browser: http://localhost:3000/api-docs

### 3. Test API

You can test the API using:
- Swagger UI (http://localhost:3000/api-docs)
- Test script: `node scripts/test_api.js`
- cURL commands

### 4. Upload Test Data

```bash
# Make sure test data is extracted to /tmp/allure_test_data
# Then run:
node scripts/upload_test_data.js
```

## Available Endpoints

### Launches
- `POST /api/v1/launches` - Create a new launch
- `GET /api/v1/launches` - List all launches
- `GET /api/v1/launches/:launch_id` - Get launch by ID
- `POST /api/v1/launches/:launch_id/complete` - Complete a launch
- `DELETE /api/v1/launches/:launch_id` - Delete a launch

### Test Results
- `POST /api/v1/launches/:launch_id/results` - Upload test results
- `GET /api/v1/launches/:launch_id/results` - List test results
- `GET /api/v1/test-results/:id` - Get test result by ID
- `GET /api/v1/test-results/:id/history` - Get test result history
- `GET /api/v1/test-results/search` - Search test results

### Attachments
- `POST /api/v1/launches/:launch_id/attachments` - Upload attachment
- `GET /api/v1/attachments/:id` - Get attachment
- `DELETE /api/v1/attachments/:id` - Delete attachment

### Widgets
- `GET /api/v1/widgets` - Get widget data
- `POST /api/v1/launches/:launch_id/widgets/generate` - Generate widgets

### Trees
- `GET /api/v1/trees` - Get tree data

### Reports
- `POST /api/v1/launches/:launch_id/reports/generate` - Generate report

## Next Steps

1. Create a launch using `POST /api/v1/launches`
2. Upload test results using `POST /api/v1/launches/:launch_id/results`
3. Generate widgets and reports
4. View data in Swagger UI
