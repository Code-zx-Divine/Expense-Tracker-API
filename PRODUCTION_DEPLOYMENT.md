# 🚀 PRODUCTION DEPLOYMENT CHECKLIST
## RapidAPI + Multi-Origin CORS Setup for Render

---

## ✅ Code Changes Applied

### 1. `src/middleware/auth.js`
- ✅ Added RapidAPI proxy mode support
- ✅ Skips MongoDB validation when `RAPIDAPI_ENABLED=true`
- ✅ Creates virtual user with fixed ObjectId for data isolation
- ✅ Skips rate limiting for RapidAPI/API key users
- ✅ Comprehensive debug logging
- ✅ Usage tracking for both RapidAPI and internal keys

### 2. `src/app.js`
- ✅ Added `getCorsOptions()` dynamic CORS configuration
- ✅ If `RAPIDAPI_ENABLED=true` → allows all origins (*)
- ✅ If `RAPIDAPI_ENABLED=false` → allows localhost + Render URL + CORS_ORIGIN list
- ✅ Allows undefined origin (curl/Postman/mobile)
- ✅ Production-ready with debug logs

### 3. `.env`
- ✅ Added RapidAPI configuration variables
- ✅ Added CORS multi-origin support
- ✅ Added RENDER_URL option

---

## 📋 Render Environment Variables

Go to **Render Dashboard → Your Service → Environment** and add/verify these:

### Required (Already set, verify):
```
ADMIN_SECRET=expense-tracker-secret-4245b113f54aa6a9
JWT_SECRET=32ff2b3d1d17e343a5f53256b288a95fdbbb7396321f9604e5811ba44f282a40
MONGO_URI=your-mongodb-uri
NODE_ENV=production
PORT=10000
```

### New - RapidAPI (Set to enable RapidAPI integration):
```
RAPIDAPI_ENABLED=true
RAPIDAPI_UPGRADE_URL=https://rapidapi.com/yourusername/expense-tracker-api
RAPIDAPI_USER_ID=507f1f77bcf86cd799439011
RAPIDAPI_USER_EMAIL=rapidapi@example.com
```

**Note:** RAPIDAPI_USER_ID and RAPIDAPI_USER_EMAIL are optional. If not set, defaults are used.

### New - CORS Configuration:
```
CORS_ORIGIN=http://localhost:3000,https://your-app.onrender.com
RENDER_URL=https://your-app.onrender.com
```

**Replace `your-app.onrender.com` with your actual Render URL.**

---

## 🧪 Testing After Deploy

### Test 1: Verify CORS is working
```bash
curl -X OPTIONS https://your-app.onrender.com/api/transactions \\
  -H "Origin: https://rapidapi.com" \\
  -H "Access-Control-Request-Method: POST" \\
  -v
```
Look for:
```
< access-control-allow-origin: *
< access-control-allow-credentials: true
```

### Test 2: RapidAPI mode (any X-RapidAPI-Key works)
```bash
curl -X POST https://your-app.onrender.com/api/transactions/expense \\
  -H "Content-Type: application/json" \\
  -H "X-RapidAPI-Key: any-key-will-work" \\
  -d '{"amount":25,"description":"Test","category":"Food"}'
```
Expected: `201 Created` (no 401/403)

Check Render logs for:
```
[CORS] Configuring CORS: { RAPIDAPI_ENABLED: true, ... }
[AUTH] RapidAPI mode enabled - accepting X-RapidAPI-Key without DB validation
```

### Test 3: Normal API key (still works)
```bash
curl -X POST https://your-app.onrender.com/api/transactions/expense \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_ACTUAL_DB_KEY" \\
  -d '{"amount":50,"description":"Lunch","category":"Food"}'
```
Expected: `201 Created` with proper user data

### Test 4: curl/Postman (no Origin header)
```bash
curl -X GET https://your-app.onrender.com/api/transactions -v
```
Should succeed (no CORS error) because Origin is undefined.

---

## 🔍 Debugging via Logs

### On Render → Logs, look for:

**Server startup:**
```
[CORS] Configuring CORS: { RAPIDAPI_ENABLED: true, NODE_ENV: 'production', ... }
[CORS] Allowed origins: [ ... ]
```

**For each request:**
```
[CORS] Origin allowed: https://rapidapi.com
[AUTH] RapidAPI mode enabled - accepting X-RapidAPI-Key without DB validation
[AUTH] API key (masked): exp_...
[AUTH] Request authenticated: { authType: 'rapidapi', ... }
[AUTH] RapidAPI usage tracked: { endpoint: '/api/transactions/expense', status: 201 }
```

---

## 🎯 How It Works

### RapidAPI Mode (`RAPIDAPI_ENABLED=true`)

1. **Any** `X-RapidAPI-Key: exp_*` header is accepted
2. No MongoDB lookup for the key
3. Request is attributed to a virtual "RapidAPI User" with fixed ObjectId
4. Usage is tracked in `usages` collection with `isRapidAPI: true`
5. Quota headers return "unlimited" (you can customize if needed)
6. CORS allows all origins (`*`)

### Normal Mode (`RAPIDAPI_ENABLED=false`)

1. `X-RapidAPI-Key` or `X-API-Key` must exist in `apikeys` collection
2. Full quota/expiry/rate-limit checks apply
3. CORS allows only specified origins
4. Usage tracked per actual user

---

## ⚙️ Configuration Summary

| Variable | Where to set | Purpose |
|----------|--------------|---------|
| `RAPIDAPI_ENABLED` | Render Environment | Enable RapidAPI proxy mode |
| `CORS_ORIGIN` | Render Environment | Comma-separated allowed origins (when RapidAPI disabled) |
| `RENDER_URL` | Render Environment | Auto-added to CORS allow list |
| `RAPIDAPI_USER_ID` | Render Environment (optional) | Fixed ObjectId for RapidAPI user data isolation |
| `RAPIDAPI_USER_EMAIL` | Render Environment (optional) | Email for RapidAPI user |

---

## 🚨 Important Notes

1. **Data Isolation**: RapidAPI requests all use the same virtual user. They will **share data** (transactions, categories). If you need per-key isolation, use normal API keys instead.

2. **Security**: RapidAPI mode (`RAPIDAPI_ENABLED=true`) accepts **any** key. This is intentional for RapidAPI's proxy model. Monitor usage in the `usages` collection.

3. **Redeploy**: After setting environment variables, **redeploy** (not just restart) your Render service:
   ```bash
   git commit --allow-empty -m "Deploy with RapidAPI+CORS"
   git push origin main
   ```

4. **Existing Keys**: Existing `apikeys` in your database continue to work normally when `RAPIDAPI_ENABLED=false`.

---

## 📁 Files Modified

1. `src/middleware/auth.js` - Full rewrite with RapidAPI support
2. `src/app.js` - Updated CORS middleware with `getCorsOptions()`
3. `.env` - Added configuration variables

---

## 🎉 Done!

Your API now:
- ✅ Works with RapidAPI proxy (any X-RapidAPI-Key)
- ✅ Supports multiple CORS origins
- ✅ Allows curl/Postman/mobile apps
- ✅ Maintains backward compatibility
- ✅ Has debug logging for troubleshooting

**Next step:** Set environment variables on Render and redeploy!
