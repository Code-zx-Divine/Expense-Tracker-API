# Admin API Debugging Guide

## Problem
`POST /admin/apikeys` returns "Invalid admin credentials" (401) even though ADMIN_SECRET is set

## Step 1: Check Render Environment Variables

1. Go to Render Dashboard → Your Service → Environment tab
2. Verify `ADMIN_SECRET` exists and has the EXACT value:
   ```
   expense-tracker-secret-4245b113f54aa6a9
   ```
3. **IMPORTANT**: If you recently changed it, you must **Redploy** (not just restart) the service
4. Check for extra spaces or hidden characters

## Step 2: Check Server Logs on Render

1. Go to Render Dashboard → Your Service → Logs
2. Look for these debug messages after the server starts:
   ```
   [STARTUP] Admin routes enabled - ADMIN_SECRET is set
   ```
   If you see *"Admin routes DISABLED"*, the environment variable is not being read.

## Step 3: Test Admin Endpoint Locally First

### Start your server locally:
```bash
# Make sure .env has ADMIN_SECRET set
node src/server.js
# Server runs on http://localhost:3000
```

### Send a test request:
```bash
curl -X POST http://localhost:3000/admin/apikeys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: expense-tracker-secret-4245b113f54aa6a9" \
  -d '{
    "email": "test@example.com",
    "name": "Test User"
  }'
```

**Expected success response:** `201 Created` with API key data

**If you still get 401 locally**, check:
- Console logs showing `[DEBUG]` messages for header and expected secret
- The value in `.env` matches exactly what you're sending in the header

## Step 4: Check Common Issues

### Issue 1: Wrong Header Name
✅ Use: `X-Admin-Secret`
❌ NOT: `X-ADMIN-SECRET` (case sensitive!)
❌ NOT: `Authorization: Bearer <secret>`
❌ NOT: `X-API-Key`

### Issue 2: Value Mismatch
Copy the value EXACTLY from Render Environment tab. No extra spaces.

### Issue 3: Header Not Being Sent
Some HTTP clients strip custom headers. Use curl to test (bypasses client issues).

### Issue 4: Deploy Cache
Render may cache the old code. Force a fresh deploy:
```bash
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```

## Step 5: Test on Render After Deploy

```bash
# Replace YOUR-RENDER-URL with your actual Render service URL
curl -X POST https://YOUR-RENDER-URL.onrender.com/admin/apikeys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: expense-tracker-secret-4245b113f54aa6a9" \
  -d '{
    "email": "production@example.com",
    "name": "Production Test"
  }'
```

## Step 6: What to Send Me If Still Failing

1. Screenshot of Render Environment tab showing `ADMIN_SECRET`
2. Render logs showing `[STARTUP]` message
3. Full curl command you're using (with secret masked: X-Admin-Secret: ***)
4. Console output showing `[DEBUG]` lines

---

## Code Changes Made

**File: `src/routes/adminRoutes.js`**
- Added console.log debug statements to show:
  - Expected ADMIN_SECRET (truncated)
  - Received X-Admin-Secret header (truncated)
  - All headers

**File: `src/app.js`**
- Added startup log confirming if admin routes are enabled or disabled based on ADMIN_SECRET

## Temporary Debug Logs
These logs will **only appear** when admin auth fails or at server startup.
Remove them after debugging by reverting the edits.

---

## Quick Verification

Run this to verify admin routes are working on your local machine:

```bash
# Terminal 1: Start server
node src/server.js

# Terminal 2: Test
curl -X POST http://localhost:3000/admin/apikeys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: expense-tracker-secret-4245b113f54aa6a9" \
  -d '{"email":"admin@test.com","name":"Admin"}'
```

If it works locally but not on Render → Render environment variable issue.
If it fails locally → Code/header issue.
