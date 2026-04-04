# RapidAPI Integration & CORS Setup Guide

## Overview

Your API now supports two major features:

1. **RapidAPI Proxy Mode**: Accept `X-RapidAPI-Key` without database validation
2. **Multi-Origin CORS**: Allow requests from localhost, Render, and RapidAPI

---

## Feature 1: RapidAPI Support

### What it does:

When `RAPIDAPI_ENABLED=true`:
- ✅ Accepts any non-empty `X-RapidAPI-Key` header
- ✅ Skips MongoDB API key validation
- ✅ Allows RapidAPI proxy requests through
- ✅ Still tracks usage in `usages` collection
- ✅ Returns proper CORS headers for RapidAPI

When `RAPIDAPI_ENABLED=false` (default):
- Works as before (validates API keys against MongoDB)

### How to enable:

**Step 1: Set environment variable on Render**

In Render Dashboard → Your Service → Environment:
```
Key: RAPIDAPI_ENABLED
Value: true
```

**Step 2: Redeploy your service**

```bash
git commit --allow-empty -m "Enable RapidAPI mode"
git push origin main
```

**Step 3: Test it**

```bash
curl -X POST https://YOUR-APP.onrender.com/api/transactions/expense ^
  -H "Content-Type: application/json" ^
  -H "X-RapidAPI-Key: any-key-will-work" ^
  -d "{\"amount\":50,\"description\":\"Test\",\"category\":\"Food\"}"
```

Expected: `201 Created` (as long as the key is present and non-empty)

---

## Feature 2: Multi-Origin CORS

### What it does:

Allows requests from:
- `http://localhost:3000` (local development)
- `https://your-app.onrender.com` (production)
- Any origin when `RAPIDAPI_ENABLED=true`
- curl/Postman (no Origin header → allowed)
- Optional: Additional origins via `CORS_ORIGIN` env var

### Configuration:

#### Option A: Automatic (Recommended)

Set these environment variables:

**Render Dashboard → Environment:**

```
CORS_ORIGIN=http://localhost:3000,https://your-app.onrender.com
RENDER_URL=https://your-app.onrender.com
RAPIDAPI_ENABLED=true  # Optional: allows all RapidAPI domains
```

**Note:** The code automatically extracts your Render URL from `RENDER_URL` or `RENDER_EXTERNAL_URL` and adds both http/https variants.

#### Option B: Manual List

If you prefer explicit control:

```
CORS_ORIGIN=http://localhost:3000,https://your-app.onrender.com,https://test.your-app.onrender.com
```

### How it works:

1. **If `RAPIDAPI_ENABLED=true`**: `origin: true` (allow all)
2. **If `RAPIDAPI_ENABLED=false`**:
   - Checks the `Origin` header against allowed list
   - If `Origin` header is missing (curl/Postman) → allows
   - If origin matches → allows
   - If not → blocks with CORS error

---

## Full Environment Variables Reference

Add these to your Render Environment tab:

```bash
# Required (already set)
ADMIN_SECRET=expense-tracker-secret-4245b113f54aa6a9
JWT_SECRET=your-jwt-secret
MONGO_URI=your-mongodb-uri

# New: RapidAPI support
RAPIDAPI_ENABLED=true                    # Enable RapidAPI proxy mode
RAPIDAPI_UPGRADE_URL=https://...          # Your RapidAPI upgrade link (already exists)

# New: Multi-origin CORS
CORS_ORIGIN=http://localhost:3000,https://your-app.onrender.com
RENDER_URL=https://your-app.onrender.com  # Auto-added to CORS allow list

# Existing (keep as is)
NODE_ENV=production
PORT=10000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
REQUEST_TIMEOUT=30000
LOG_LEVEL=info
JWT_EXPIRE=7d
```

---

## Testing

### Test 1: CORS with curl

```bash
curl -X OPTIONS https://YOUR-APP.onrender.com/api/transactions ^
  -H "Origin: https://rapidapi.com" ^
  -H "Access-Control-Request-Method: POST" ^
  -v
```

Look for headers:
```
< access-control-allow-origin: *
< access-control-allow-credentials: true
```

### Test 2: RapidAPI mode (no DB key required)

```bash
curl -X POST https://YOUR-APP.onrender.com/api/transactions/expense ^
  -H "Content-Type: application/json" ^
  -H "X-RapidAPI-Key: test123" ^
  -d "{\"amount\":25,\"description\":\"Coffee\",\"category\":\"Food\"}"
```

Should succeed with `201 Created`

### Test 3: Normal API key (DB validation still works)

```bash
curl -X POST https://YOUR-APP.onrender.com/api/transactions/expense ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: your-actual-api-key-from-db" ^
  -d "{\"amount\":50,\"description\":\"Lunch\",\"category\":\"Food\"}"
```

Should succeed with `201 Created`

### Test 4: Localhost origin

```bash
curl -X GET https://YOUR-APP.onrender.com/api/transactions ^
  -H "Origin: http://localhost:3000" ^
  -v
```

Look for:
```
< access-control-allow-origin: http://localhost:3000
< access-control-allow-credentials: true
```

### Test 5: Disallowed origin (when RAPIDAPI_ENABLED=false)

```bash
curl -X GET https://YOUR-APP.onrender.com/api/transactions ^
  -H "Origin: https://evil.com" ^
  -v
```

Should get CORS error (no `access-control-allow-origin` header)

---

## Debug Logs

The updated middleware includes extensive logging:

### CORS logs:
```
[CORS] Configuring CORS: { RAPIDAPI_ENABLED: true, ... }
[CORS] Allowed origins: [ 'http://localhost:3000', 'https://your-app.onrender.com' ]
[CORS] Origin allowed: https://rapidapi.com
[CORS] Request with no Origin header, allowing (likely tool like curl/Postman)
```

### Auth logs:
```
[AUTH] RapidAPI mode enabled - accepting X-RapidAPI-Key without DB validation
[AUTH] API key (masked): exp_1234...
[AUTH] Request authenticated: { authType: 'rapidapi', userId: 'rapidapi-user', ... }
[AUTH] RapidAPI usage tracked: { endpoint: '/api/transactions', status: 201 }
```

---

## Important Notes

1. **RapidAPI mode allows ANY key**: Any string starting with `exp_` will work. No per-key quotas or limits unless you enforce them separately (you could add custom logic).

2. **Security implications**: When `RAPIDAPI_ENABLED=true`, anyone with a RapidAPI account can use your API through RapidAPI's proxy. You should:
   - Monitor usage in the `usages` collection
   - Set up alerts for abnormal usage
   - Consider adding rate limits per X-RapidAPI-Key header value if needed

3. **CORS and undefined Origin**: curl/Postman/mobile apps don't send `Origin` header. The middleware allows these for testing convenience. If you want to restrict non-browser clients, remove the `!origin` check.

4. **Backward compatibility**: All existing functionality preserved. No breaking changes.

5. **Render environment variables**: Render provides `RENDER_EXTERNAL_URL` automatically. You can optionally set `RENDER_URL` if you want to explicitly control it.

---

## Migration Notes

### Before:
- Only DB-stored API keys worked
- CORS was simple (`CORS_ORIGIN` only)
- Required admin to create API keys manually

### After:
- RapidAPI proxy mode allows instant RapidAPI integration
- Multi-origin CORS supports localhost, Render, and RapidAPI
- Existing internal API keys still work (no changes needed)

---

## Quick Start

1. **Update Render Environment**:
   ```
   RAPIDAPI_ENABLED=true
   CORS_ORIGIN=http://localhost:3000,https://your-app.onrender.com
   RENDER_URL=https://your-app.onrender.com
   ```

2. **Deploy** to Render

3. **Test**:
   ```bash
   curl -X POST https://your-app.onrender.com/api/transactions/expense ^
     -H "Content-Type: application/json" ^
     -H "X-RapidAPI-Key: any-exp-key" ^
     -d '{"amount":10,"description":"Test","category":"Food"}'
   ```

4. **Check Render logs** for `[CORS]` and `[AUTH]` debug messages

---

## Troubleshooting

### "CORS header 'Access-Control-Allow-Origin' missing"

- Check RAPIDAPI_ENABLED is `true` or your origin is in CORS_ORIGIN list
- Verify origin matches exactly (including http vs https)
- Check Render logs for `[CORS] Origin denied:` message

### RapidAPI requests still failing (401)

- Ensure `RAPIDAPI_ENABLED=true` on Render (not just local .env)
- Check that you're sending `X-RapidAPI-Key` header
- Look for `[AUTH] RapidAPI mode enabled` in logs
- Note: RapidAPI proxy mode only applies to endpoints using `auth.required` middleware

### Preflight (OPTIONS) failing

- The CORS middleware handles OPTIONS automatically
- Should see `[CORS]` logs with origin
- If blocked, check that OPTIONS method is being routed through CORS middleware (it is, because we use `app.use(cors(...))` before routes)

---

## Code Files Changed

1. `src/middleware/auth.js` - Updated `auth.required` to support RapidAPI proxy mode
2. `src/app.js` - Replaced simple CORS with dynamic multi-origin configuration
3. `.env` - Added new environment variables documentation

---

## Simple CORS Alternative (If you want ALL origins always)

If you don't need origin filtering at all, replace the `getCorsOptions()` function with:

```javascript
app.use(cors({
  origin: true,  // Allow all origins
  credentials: true
}));
```

But the provided solution gives you more control while still being simple.
