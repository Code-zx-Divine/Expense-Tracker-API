# Admin API 401 Fix - Summary

## Changes Made

### 1. File: `src/routes/adminRoutes.js`

**Lines 14-25 (adminAuth middleware)** - Added debug logging:

```javascript
// Middleware to protect admin routes
const adminAuth = (req, res, next) => {
  // DEBUG: Log what we're checking
  console.log('[DEBUG] Admin auth check:');
  console.log('[DEBUG] Expected ADMIN_SECRET:', ADMIN_SECRET ? `${ADMIN_SECRET.substring(0, 10)}...` : 'UNDEFINED');
  console.log('[DEBUG] Received header:', req.headers['x-admin-secret'] ? `${req.headers['x-admin-secret'].substring(0, 10)}...` : 'UNDEFINED');
  console.log('[DEBUG] All headers:', req.headers);

  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid admin credentials'
    });
  }
  next();
};
```

**Purpose:** Shows what admin secret is expected and what header was received when a request fails.

---

### 2. File: `src/app.js`

**Lines 274-277** - Added startup logging:

```javascript
// Admin routes (protected by admin secret)
if (process.env.ADMIN_SECRET) {
  console.log('[STARTUP] Admin routes enabled - ADMIN_SECRET is set');
  app.use('/admin', adminRoutes);
} else {
  console.log('[STARTUP] Admin routes DISABLED - ADMIN_SECRET not set');
}
```

**Purpose:** Confirms whether admin routes are registered at server startup.

---

## How to Test

### Local Testing (Windows)

1. Start your server:
```
node src/server.js
```

2. Run the test script (double-click or run in cmd):
```
test-admin-auth.bat
```

3. **Expected Result:**
   - Server logs show: `[STARTUP] Admin routes enabled - ADMIN_SECRET is set`
   - Test returns `201 Created` with API key in response
   - Debug logs show matching secret values

### Render Testing

1. Push changes to GitHub to trigger redeploy:
```
git add .
git commit -m "Add admin auth debug logging"
git push origin main
```

2. Wait for Render deployment to complete

3. Test with curl (replace `YOUR-APP` with your Render URL):
```
curl -X POST https://YOUR-APP.onrender.com/admin/apikeys ^
  -H "Content-Type: application/json" ^
  -H "X-Admin-Secret: expense-tracker-secret-4245b113f54aa6a9" ^
  -d "{\"email\":\"test@example.com\",\"name\":\"Test User\"}"
```

4. Check Render logs:
   - Look for `[STARTUP]` message after deployment
   - If 401 occurs, logs will show `[DEBUG]` messages with values

---

## What the Debug Logs Will Show

When a request fails with 401, you'll see:

```
[DEBUG] Admin auth check:
[DEBUG] Expected ADMIN_SECRET: expense-tracker-secret...
[DEBUG] Received header: expense-tracker-secret... (or UNDEFINED)
[DEBUG] All headers: { ... }
```

**Compare the values:**
- If `Expected ADMIN_SECRET` is `UNDEFINED` → Render env var not set
- If `Received header` is `UNDEFINED` → Header not being sent
- If both show same prefix → Values match (should work) - investigate further
- If different prefixes → Value mismatch (typo, extra space, etc.)

---

## Common Fixes Based on Logs

### If Expected is UNDEFINED:
1. Go to Render Dashboard
2. Service → Environment tab
3. Add `ADMIN_SECRET` with value: `expense-tracker-secret-4245b113f54aa6a9`
4. **Redepoly** (not just restart) the service

### If Received is UNDEFINED:
1. Verify you're sending `X-Admin-Secret` header (not `Authorization`)
2. Try curl command above
3. Don't use Swagger UI (it may not send custom headers properly)

### If Values Don't Match:
1. Copy exact value from Render Environment tab
2. Remove any trailing/leading spaces
3. Update your `.env` file to match exactly
4. Redeploy

---

## Removing Debug Logs After Fix

Once you identify and fix the issue, revert these changes:

```bash
# Undo changes
git checkout src/routes/adminRoutes.js src/app.js
git push origin main
```

---

## Need More Help?

Send me:
1. Screenshot of Render Environment tab
2. Render logs showing `[STARTUP]` and `[DEBUG]` lines
3. The curl command you're using (mask the actual secret: `X-Admin-Secret: ***`)
4. Output from local test script
