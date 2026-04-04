# 🚀 Quick Start: RapidAPI + CORS (Production)

## TL;DR

Your API now works with RapidAPI and multiple CORS origins.

**To deploy:**
1. Set these on Render Environment tab:
   ```
   RAPIDAPI_ENABLED=true
   CORS_ORIGIN=http://localhost:3000,https://YOUR-APP.onrender.com
   RENDER_URL=https://YOUR-APP.onrender.com
   ```
2. Redeploy
3. Test with:
   ```bash
   curl -X POST https://YOUR-APP.onrender.com/api/transactions/expense ^
     -H "X-RapidAPI-Key: any-key-here" ^
     -d '{"amount":10,"description":"Test","category":"Food"}'
   ```

---

## What Changed

### `src/middleware/auth.js`
- Added `RAPIDAPI_ENABLED` check
- When true + X-RapidAPI-Key present → bypass DB validation
- Creates virtual user with fixed ObjectId
- Skips rate limiting for rapidapi/api_key

### `src/app.js`
- Added `getCorsOptions()` function
- If `RAPIDAPI_ENABLED=true` → allow all origins
- If false → allow localhost + Render + CORS_ORIGIN list
- Undefined origin (curl/Postman) always allowed

---

## Render Environment Variables

Add/Update these:

| Key | Value | Required |
|-----|-------|----------|
| `RAPIDAPI_ENABLED` | `true` | ✅ Yes |
| `CORS_ORIGIN` | `http://localhost:3000,https://YOUR-APP.onrender.com` | ✅ Yes |
| `RENDER_URL` | `https://YOUR-APP.onrender.com` | ✅ Yes |
| `RAPIDAPI_UPGRADE_URL` | Your RapidAPI upgrade link | Optional |

**Note:** Replace `YOUR-APP.onrender.com` with your actual Render service URL.

---

## Verification

### 1. Check Render Logs
Look for startup:
```
[CORS] Configuring CORS: { RAPIDAPI_ENABLED: true, ... }
[CORS] Allowed origins: [ ... ]
```

### 2. Test RapidAPI
```bash
curl -X POST https://YOUR-APP.onrender.com/api/transactions/expense ^
  -H "Content-Type: application/json" ^
  -H "X-RapidAPI-Key: test-exp-key" ^
  -d "{\"amount\":10,\"description\":\"Test\",\"category\":\"Food\"}"
```
Expected: `201 Created`

### 3. Test CORS
```bash
curl -X OPTIONS https://YOUR-APP.onrender.com/api/transactions ^
  -H "Origin: https://rapidapi.com" ^
  -v
```
Look for: `access-control-allow-origin: *`

---

## Need Help?

1. Check Render logs for `[CORS]` and `[AUTH]` messages
2. Verify environment variables are set correctly
3. Redeploy if you changed env vars
4. Ensure `X-RapidAPI-Key` header is sent (any value starting with `exp_`)

---

## Files Added

- `COMPLETE_IMPLEMENTATION_SUMMARY.md` - Full technical details
- `PRODUCTION_DEPLOYMENT.md` - Deployment checklist
- `SETUP_INSTRUCTIONS_SIMPLE.md` - Non-technical guide
- `test-rapidapi-cors.bat` - Local test script

---

**That's it! Set env vars, redeploy, and your API works with RapidAPI.** 🎉
