# Expense Tracker API

A production-ready REST API for tracking expenses and income with MongoDB Atlas.

## Features

- Add expenses and income transactions
- List transactions with filtering and pagination
- Category-wise analytics
- Summary endpoint (total income, expenses, balance)
- AI-powered spending insights
- Category management
- Soft delete support (isDeleted flag)
- Rate limiting and security middleware
- Comprehensive error handling
- Structured logging (Winston)

## Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier works)
- npm or yarn

## MongoDB Atlas Setup

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

2. Create a new cluster (M0 sandbox is free)

3. Once cluster is created, click "Connect"

4. Choose "Connect your application"

5. Copy the connection string. It will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.veilklf.mongodb.net/?retryWrites=true&w=majority
   ```

6. Replace `<username>` and `<password>` with your database user credentials

7. Add database name to the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.veilklf.mongodb.net/expense-tracker?retryWrites=true&w=majority
   ```

## Local Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set your `MONGO_URI` with the Atlas connection string:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster0.veilklf.mongodb.net/expense-tracker?retryWrites=true&w=majority
   PORT=3000
   NODE_ENV=development
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## API Endpoints

### Transactions

#### Add Expense
```http
POST /api/transactions/expense
Content-Type: application/json

{
  "amount": 50.00,
  "category": "category_id",
  "description": "Lunch at restaurant"
}
```

#### Add Income
```http
POST /api/transactions/income
Content-Type: application/json

{
  "amount": 3000.00,
  "category": "category_id",
  "description": "Monthly salary"
}
```

#### List Transactions
```http
GET /api/transactions?page=1&limit=20&type=expense&category=category_id&startDate=2024-01-01&endDate=2024-12-31&sortBy=date&sortOrder=desc
```

Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `type` - Filter by type: `income` or `expense`
- `category` - Filter by category ID
- `startDate` - Filter from date (ISO format: YYYY-MM-DD)
- `endDate` - Filter to date (ISO format: YYYY-MM-DD)
- `sortBy` - Sort field: `date`, `amount`, `createdAt` (default: `date`)
- `sortOrder` - Sort direction: `asc` or `desc` (default: `desc`)

#### Get Single Transaction
```http
GET /api/transactions/:id
```

#### Update Transaction
```http
PUT /api/transactions/:id
Content-Type: application/json

{
  "amount": 75.00,
  "category": "category_id",
  "description": "Updated description"
}
```

#### Delete Transaction (Soft Delete)
```http
DELETE /api/transactions/:id
```

### Categories

#### List Categories
```http
GET /api/categories?type=expense&active=false&page=1&limit=20
```

Query Parameters:
- `type` - Filter by type: `income`, `expense`, or `both`
- `active` - Show only active (false) or include deleted (true) - default shows non-deleted
- `page`, `limit` - Pagination

#### Get Single Category
```http
GET /api/categories/:id
```

#### Create Category
```http
POST /api/categories
Content-Type: application/json

{
  "name": "Freelance",
  "type": "income",
  "icon": "briefcase",
  "color": "#4CAF50"
}
```

#### Update Category
```http
PUT /api/categories/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "color": "#FF5722"
}
```

#### Delete Category (Soft Delete)
```http
DELETE /api/categories/:id
```

### Analytics

#### Summary
```http
GET /api/analytics/summary?startDate=2024-01-01&endDate=2024-12-31
```

Response:
```json
{
  "success": true,
  "message": "Summary retrieved successfully",
  "data": {
    "totalIncome": 10000.00,
    "totalExpense": 5000.00,
    "balance": 5000.00
  }
}
```

#### Category-wise Analytics
```http
GET /api/analytics/categories?type=expense&startDate=2024-01-01&endDate=2024-12-31
```

Response:
```json
{
  "success": true,
  "message": "Category analytics retrieved successfully",
  "data": [
    {
      "category": {
        "id": "...",
        "name": "Food",
        "color": "#FF5722"
      },
      "totalAmount": 1500.00,
      "transactionCount": 30
    }
  ]
}
```

#### Monthly Trends
```http
GET /api/analytics/monthly?year=2024&months=12
```

Response:
```json
{
  "success": true,
  "message": "Monthly trends retrieved successfully",
  "data": [
    {
      "_id": "2024-01",
      "income": 5000.00,
      "expense": 2000.00
    }
  ]
}
```

### Insights
```http
GET /api/analytics/insights?month=3&year=2024
```

Get AI-like spending insights based on your transaction patterns.

Response:
```json
{
  "success": true,
  "message": "Insights generated successfully",
  "data": {
    "insights": [
      {
        "type": "warning",
        "title": "High spending concentration",
        "message": "You're spending 45.2% of your budget on Food. Consider diversifying expenses.",
        "severity": "high"
      },
      {
        "type": "suggestion",
        "title": "Biggest expense category",
        "message": "Your largest expense is Food ($1,500.00). This is where most of your money goes.",
        "severity": "low"
      }
    ],
    "period": "2024-03",
    "totalExpenses": 3320.50,
    "totalIncome": 5000.00,
    "categoryCount": 8,
    "transactionCount": 45
  }
}
```

#### Health Check
```http
GET /health
```

## Response Format

Success:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Invalid input data",
  "details": {
    "amount": "Amount must be a positive number"
  }
}
```

Paginated:
```json
{
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Error Codes

- `400` - Bad Request (validation errors)
- `404` - Not Found
- `405` - Method Not Allowed
- `409` - Conflict (duplicate category name)
- `422` - Unprocessable Entity (invalid category type for transaction)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable (database connection issues)

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `3000` |
| `MONGO_URI` | Yes | MongoDB Atlas connection string | - |
| `NODE_ENV` | No | Environment (development/production) | `development` |
| `CORS_ORIGIN` | No | Allowed CORS origins | `*` |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window | `100` |
| `REQUEST_TIMEOUT` | No | Request timeout in ms | `30000` |
| `LOG_LEVEL` | No | Logging level | `info` |

## Project Structure

```
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js  # MongoDB connection
│   │   └── logger.js    # Winston logger
│   ├── middleware/      # Express middleware
│   │   ├── asyncHandler.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── validation.js
│   ├── models/          # Mongoose models
│   │   ├── Transaction.js
│   │   └── Category.js
│   ├── controllers/     # Request handlers
│   │   ├── transactionController.js
│   │   └── categoryController.js
│   ├── routes/          # Route definitions
│   │   ├── transactionRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── analyticsRoutes.js
│   │   └── healthRoutes.js
│   ├── utils/           # Utilities
│   │   ├── constants.js
│   │   ├── responses.js
│   │   └── validators.js
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── logs/                # Application logs (auto-created)
│   ├── error.log
│   └── combined.log
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Production

```bash
npm start
```

Set `NODE_ENV=production` and configure all environment variables.

## Deploying to Render

This API is configured for easy deployment on [Render](https://render.com):

1. Create a new Web Service
2. Connect your repository
3. Set these environment variables in Render dashboard:
   ```
   NODE_ENV=production
   MONGO_URI=your_mongodb_atlas_uri
   PORT=10000  # Render sets PORT automatically, keep as 10000
   ```
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Click "Create Web Service"

**Note:** Render automatically sets the `PORT` environment variable. Make sure your `.env` uses it.

## Seeding Default Categories

The API automatically seeds 20+ default categories on first startup in non-production mode:

**Income Categories:** Salary, Freelance, Investment, Business, Other Income

**Expense Categories:** Food, Transportation, Entertainment, Utilities, Healthcare, Education, Shopping, Housing, Insurance, Other Expense

**Both Types:** Transfer

## Important Notes

- All queries automatically exclude soft-deleted records (`isDeleted: false`)
- Categories are required for each transaction
- Transaction amounts must be positive numbers (> 0)
- Soft delete is used for data safety (deleted records are kept in database)
- The `/api/insights` endpoint provides automated spending analysis
- All dates are stored in UTC and returned in ISO format
- No authentication included (MVP). Can be added with JWT middleware.
- Rate limiting: 100 requests per 15 minutes

## Testing Quick Start

```bash
# 1. Start the server
npm run dev

# 2. Check health
curl http://localhost:3000/health

# 3. Categories will auto-seed on first run. List them:
curl http://localhost:3000/api/categories

# 4. Add an expense (use a category ID from step 3):
curl -X POST http://localhost:3000/api/transactions/expense \
  -H "Content-Type: application/json" \
  -d '{"amount":25.50,"category":"<CATEGORY_ID>","description":"Coffee"}'

# 5. Get summary:
curl http://localhost:3000/api/analytics/summary

# 6. Get insights:
curl http://localhost:3000/api/analytics/insights
```

## License

MIT
