# Deploying to Render - Complete Guide

## Pre-Deployment Checklist

- [x] Code is production-ready
- [x] Uses `process.env.PORT` for dynamic port assignment
- [x] MongoDB connection with error handling and exit on failure
- [x] Dotenv configured for local development
- [x] No nodemon in production start script
- [x] Health check endpoint (`/health`)
- [x] All routes connected (`/api/transactions`, `/api/categories`, `/api/analytics`)
- [x] Soft delete implemented
- [x] Pagination working
- [x] Category auto-seeding

---

## Step-by-Step Deployment

### 1. MongoDB Atlas Setup (If Not Already Done)

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create/verify your cluster is **Available** (not paused)
3. Go to **Network Access** → Add IP Address: `0.0.0.0/0` (allows from anywhere, safe for testing)
4. Go to **Database Access** → Verify user `prashantshinde2754_db_user` exists with correct password
5. Go to your cluster → **Connect** → **Connect your application**
6. Copy the connection string and **replace password** with: `Code0000zx`
7. Full connection string should be:
   ```
   mongodb+srv://prashantshinde2754_db_user:Code0000_zx@apitest.93gflwg.mongodb.net/expense-tracker?retryWrites=true&w=majority
   ```

### 2. GitHub Repository (Already Done ✓)

Your code is already pushed to:
`https://github.com/Code-zx-Divine/Expense-Tracker-API`

### 3. Create Render Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub account (if not already)
4. Select repository: **Expense-Tracker-API**
5. Configure service:
   - **Name**: `expense-tracker-api` (or your choice)
   - **Environment**: `Node`
   - **Region**: Choose closest to you (e.g., Oregon, Singapore)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free** (or paid for better performance)

### 4. Set Environment Variables on Render

In the Render dashboard, under **"Environment"**, add these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | `mongodb+srv://prashantshinde2754_db_user:Code0000_zx@apitest.93gflwg.mongodb.net/expense-tracker?retryWrites=true&w=majority` |
| `PORT` | `10000` (Render uses this automatically) |
| `CORS_ORIGIN` | `*` (or your frontend URL) |
| `LOG_LEVEL` | `info` |

**Important:**
- Do NOT include quotes around values
- Make sure `MONGO_URI` is exactly as shown above (with your real password)
- Render automatically sets `PORT`, but we include it for clarity

### 5. Create Web Service

Click **"Create Web Service"**

Render will:
1. Clone your repository
2. Run `npm install`
3. Build the app
4. Deploy and start the server

**Wait 5-10 minutes** for:
- Build to complete
- Health checks to pass
- Service to become "Live"

### 6. Verify Deployment

Once your service is live, Render will provide a URL like:
`https://expense-tracker-api.onrender.com`

Test your endpoints:

```bash
# Health check
curl https://expense-tracker-api.onrender.com/health

# API info (root)
curl https://expense-tracker-api.onrender.com/

# Categories (auto-seeded on first run)
curl https://expense-tracker-api.onrender.com/api/categories

# Add expense
curl -X POST https://expense-tracker-api.onrender.com/api/transactions/expense \
  -H "Content-Type: application/json" \
  -d '{"amount":25.50,"category":"<CATEGORY_ID_FROM_ABOVE>","description":"Test"}'

# Get summary
curl https://expense-tracker-api.onrender.com/api/analytics/summary
```

---

## Troubleshooting Render Deployment

### Issue: "Exited with status 1"

**Causes & Solutions:**

1. **MONGO_URI not set**
   - Check Render Environment Variables
   - Ensure `MONGO_URI` is present and correct
   - View logs in Render dashboard → "Logs" tab

2. **MongoDB Atlas IP Whitelist**
   - In Atlas, go to Network Access
   - Add `0.0.0.0/0` to allow all IPs (for testing)
   - Or add Render's IP ranges (see: https://render.com/docs/ip-addresses)

3. **Incorrect MONGO_URI format**
   - Must include database name: `/expense-tracker`
   - Must have correct query params: `?retryWrites=true&w=majority`
   - Password must be correct

4. **Cluster is paused**
   - Go to Atlas → Clusters → Click "Resume"
   - Wait 2-3 minutes

**Check logs in Render:**
- Go to your service → "Logs" tab
- Look for error messages about MongoDB connection
- Common errors:
  - `Authentication failed` → Wrong password
  - `getaddrinfo ENOTFOUND` → Wrong cluster URL
  - `ECONNREFUSED` → IP not whitelisted

### Issue: Routes Not Responding

1. **Check that server started successfully**
   - Logs should show: `✅ Server is running!`
   - If missing, server crashed early (check DB connection)

2. **Verify routes are mounted**
   - Ensure `app.use('/api/transactions', ...)` exists in app.js
   - Test `/health` first - if this fails, server isn't running

### Issue: Slow First Response

- MongoDB Atlas free tier may need to "warm up"
- First request after inactivity can take 5-10 seconds
- This is normal for free tier
- Consider paid tier for better performance

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | **Yes** | - | MongoDB Atlas connection string |
| `PORT` | No | `3000` | Server port (Render sets to `10000`) |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `LOG_LEVEL` | No | `info` | Logging verbosity |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |

---

## Testing Locally Before Deploy

```bash
# 1. Set up .env (already done with Atlas credentials)
# 2. Install dependencies
npm install

# 3. Start server
npm start

# 4. Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/categories

# If it works locally, it will work on Render!
```

---

## Important Notes

- **Do NOT commit `.env` file** - Already in `.gitignore` ✓
- **Render free tier** may sleep after 15 minutes of inactivity
- **First request** after sleep may be slow (10-15 seconds)
- **Database**: Free tier (M0) has 512MB storage, sufficient for testing
- **Backups**: Regularly export data from Atlas
- **Custom domain**: Can be added in Render dashboard

---

## Success Indicators

When deployed successfully, you should see in Render logs:

```
🚀 Starting Expense Tracker API...
📦 Environment: production
🔗 Connecting to MongoDB...
✅ MongoDB Connected Successfully
📊 Database: expense-tracker
🌍 Host: cluster0.veilklf.mongodb.net
✅ Server is running!
🔗 URL: https://your-app.onrender.com
💚 Health: https://your-app.onrender.com/health
```

---

## Need Help?

1. Check Render logs for specific error messages
2. Verify MongoDB Atlas cluster is running
3. Confirm IP whitelist includes `0.0.0.0/0`
4. Double-check `MONGO_URI` in Render environment
5. Test connection string locally with `mongosh`

---

**Deployment Status:** ✅ Ready to deploy

Your API is production-ready and configured for Render. Simply create the Web Service with the environment variables above!
