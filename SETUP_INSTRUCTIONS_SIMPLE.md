# 🎯 Simple Setup Guide: RapidAPI + CORS

## What Was Fixed

### Problem 1: RapidAPI Was Not Working
- **Before**: Your API only accepted keys stored in your MongoDB database
- **After**: With one setting, your API accepts ANY X-RapidAPI-Key (RapidAPI proxy mode)

### Problem 2: CORS Was Blocking Requests
- **Before**: Only one origin allowed (localhost or Render, not both)
- **After**: Can allow multiple origins (localhost, Render, RapidAPI) based on settings

---

## 🛠️ What You Need to Do

### Step 1: Deploy Updated Code

Your code now includes the fixes in these files:
- `src/middleware/auth.js` (authentication logic)
- `src/app.js` (CORS configuration)
- `.env` (configuration template)

**Action**: Push to GitHub and let Render redeploy automatically.

---

### Step 2: Set Environment Variables on Render

Go to **Render Dashboard** → Your Service → **Environment** tab.

Add these **NEW** variables (or update if they exist):

#### To Enable RapidAPI:
```
Key: RAPIDAPI_ENABLED
Value: true
```

#### To Fix CORS:
```
Key: CORS_ORIGIN
Value: http://localhost:3000,https://your-app.onrender.com

Key: RENDER_URL
Value: https://your-app.onrender.com
```

**Replace** `your-app.onrender.com` with your actual Render URL (e.g., `expense-tracker.onrender.com`).

---

### Step 3: Redeploy

After setting environment variables, trigger a redeploy:

**Option A** (Git push):
```bash
git add .
git commit -m "Enable RapidAPI + multi-origin CORS"
git push origin main
```

**Option B** (Render Manual):
- Go to Render Dashboard → Your Service
- Click **Manual Deploy** → **Clear build cache & deploy**

Wait 2-5 minutes for deployment.

---

### Step 4: Test

#### Test RapidAPI Mode:
```bash
curl -X POST https://your-app.onrender.com/api/transactions/expense ^
  -H "Content-Type: application/json" ^
  -H "X-RapidAPI-Key: any-key-here" ^
  -d "{\"amount\":10,\"description\":\"Test\",\"category\":\"Food\"}"
```

**Expected**: `201 Created` (works even with fake key)

#### Test CORS:
```bash
curl -X OPTIONS https://your-app.onrender.com/api/transactions ^
  -H "Origin: https://rapidapi.com" ^
  -v
```

Look for: `access-control-allow-origin: *`

---

## 📋 Quick Reference Table

| Setting | Value for RapidAPI | Value for Normal |
|---------|-------------------|------------------|
| `RAPIDAPI_ENABLED` | `true` | `false` |
| `CORS_ORIGIN` | `http://localhost:3000,https://your-app.onrender.com` | Same |
| `RENDER_URL` | Your Render URL | Your Render URL |

**For RapidAPI integration:**
- Set `RAPIDAPI_ENABLED=true`
- CORS automatically allows all origins (`*`)
- Any `X-RapidAPI-Key` is accepted (no database validation)

**For normal operation:**
- Set `RAPIDAPI_ENABLED=false`
- CORS allows only the origins you list
- API keys must exist in database

---

## 🔍 How to Check if It's Working

1. **Go to Render → Logs**
2. Look for these startup messages:
   ```
   [CORS] Configuring CORS: { RAPIDAPI_ENABLED: true, ... }
   [CORS] Allowed origins: [ ... ]
   ```

3. **Make a request** and check logs:
   ```
   [CORS] Origin allowed: https://rapidapi.com
   [AUTH] RapidAPI mode enabled - accepting X-RapidAPI-Key without DB validation
   [AUTH] Request authenticated: { authType: 'rapidapi', ... }
   ```

If you see these → ✅ Everything is working!

---

## ❓ Common Questions

**Q: Do I still need to create API keys in the database?**
A: No, if `RAPIDAPI_ENABLED=true`, any X-RapidAPI-Key works. If `false`, you need keys in DB.

**Q: Will my existing API keys still work?**
A: Yes! Existing keys continue to work regardless of RAPIDAPI_ENABLED setting.

**Q: What about security? Anyone can use my API?**
A: With `RAPIDAPI_ENABLED=true`, yes - anyone with a RapidAPI account can call your API through RapidAPI's proxy. This is how RapidAPI works. Monitor usage in your `usages` collection.

**Q: Can I still use the API from my mobile app?**
A: Yes! curl/Postman/mobile apps don't send Origin header, and we allow those automatically.

**Q: What if I want both RapidAPI AND my own API keys to work?**
A: Set `RAPIDAPI_ENABLED=true`. Both modes work simultaneously:
- Requests with `X-RapidAPI-Key` → bypass DB check
- Requests with `X-API-Key` → check database

---

## 🚨 Troubleshooting

**Problem**: Still getting CORS errors
- **Check**: Is `RENDER_URL` set correctly in Render Environment?
- **Check**: Is `CORS_ORIGIN` comma-separated list with your Render domain?
- **Check**: Render logs for `[CORS] Origin denied:` message

**Problem**: RapidAPI requests still failing (401)
- **Check**: Is `RAPIDAPI_ENABLED=true` on Render (not just local)?
- **Check**: Are you sending `X-RapidAPI-Key` header?
- **Check**: Render logs for `[AUTH] RapidAPI mode enabled` message

**Problem**: Changes not taking effect
- **Check**: Did you redeploy after environment changes?
- **Check**: Render logs show new `[CORS]` and `[AUTH]` messages?

---

## 🎉 That's It!

1. ✅ Code already updated
2. ✅ Set environment variables on Render
3. ✅ Redeploy
4. ✅ Test with curl commands
5. ✅ Check Render logs for debug messages

**Need help?** Send me:
- Screenshot of your Render Environment tab
- Render logs showing `[CORS]` and `[AUTH]` messages
- The curl command you're testing with
