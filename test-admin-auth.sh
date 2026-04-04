#!/bin/bash
# Test script for admin API authentication

echo "================================================"
echo "Admin API Authentication Test"
echo "================================================"

# Check if server is running on localhost:3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Server is running on port 3000"
else
    echo "❌ Server is NOT running on port 3000"
    echo "Please start the server first:"
    echo "  node src/server.js"
    exit 1
fi

# Read ADMIN_SECRET from .env file
if [ -f .env ]; then
    ADMIN_SECRET=$(grep 'ADMIN_SECRET=' .env | cut -d'=' -f2 | tr -d '[:space:]')
    if [ -z "$ADMIN_SECRET" ]; then
        echo "❌ ADMIN_SECRET not found in .env file"
        exit 1
    fi
    echo "✅ Found ADMIN_SECRET in .env (length: ${#ADMIN_SECRET})"
else
    echo "❌ .env file not found"
    exit 1
fi

# Test the admin endpoint
echo ""
echo "Testing POST /admin/apikeys with X-Admin-Secret header..."
echo "Command:"
echo "curl -X POST http://localhost:3000/admin/apikeys \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"X-Admin-Secret: ${ADMIN_SECRET}\" \\"
echo "  -d '{\"email\":\"test@example.com\",\"name\":\"Test User\"}'"
echo ""
echo "Sending request..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/admin/apikeys \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{"email":"test@example.com","name":"Test User"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
echo "================================================"
echo "Response (HTTP $HTTP_CODE):"
echo "$RESPONSE_BODY"
echo "================================================"

# Check response
if [ "$HTTP_CODE" = "201" ]; then
    echo ""
    echo "✅ SUCCESS! Admin API is working correctly."
    echo "The authentication is functional."
elif [ "$HTTP_CODE" = "401" ]; then
    echo ""
    echo "❌ FAILED: 401 Unauthorized"
    echo "Possible causes:"
    echo "  1. ADMIN_SECRET value doesn't match"
    echo "  2. Wrong header name (should be X-Admin-Secret)"
    echo "  3. Check server logs for [DEBUG] messages"
else
    echo ""
    echo "⚠️  Unexpected HTTP code: $HTTP_CODE"
    echo "Check server logs for errors."
fi
