# Route Fix for /api/v1/launches

## Problem
When accessing `GET /api/v1/launches`, the request was incorrectly matched to the route `/:launch_id` where `launch_id` was set to "launches", causing a UUID validation error.

## Root Cause
Routes were mounted without explicit paths, causing Express to incorrectly match routes. The route `GET /` in `launches.routes.ts` should match `/api/v1/launches`, but Express was trying `GET /:launch_id` first.

## Solution
Mount the launches routes with an explicit path `/launches` in `routes/index.ts`:

```typescript
router.use('/launches', createLaunchRoutes(launchController));
```

This ensures:
- `GET /` in `launches.routes.ts` → `/api/v1/launches` ✅
- `GET /:launch_id` in `launches.routes.ts` → `/api/v1/launches/:launch_id` ✅

## Expected Behavior After Fix

### Before Fix
- `GET /api/v1/launches` → Error: invalid UUID "launches"

### After Fix
- `GET /api/v1/launches` → ✅ Returns list of launches
- `GET /api/v1/launches/{uuid}` → ✅ Returns launch by ID (with UUID validation)

## Testing
After server restart:
1. `GET /api/v1/launches` - Should return list of launches
2. `GET /api/v1/launches/invalid` - Should return 400 (UUID validation)
3. `GET /api/v1/launches/{valid-uuid}` - Should return launch details
