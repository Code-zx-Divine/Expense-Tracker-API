@echo off
REM Local test script for RapidAPI + CORS configuration

echo ================================================
echo RapidAPI + CORS Local Test
echo ================================================

REM Check if server is running
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo Server is running on port 3000
) else (
    echo Server is NOT running on port 3000
    echo Please start the server first:
    echo   node src\server.js
    exit /b 1
)

REM Read config from .env
set RAPIDAPI_ENABLED=
for /f "tokens=1,* delims==" %%i in ('findstr "RAPIDAPI_ENABLED=" .env 2^>nul') do (
    set RAPIDAPI_ENABLED=%%j
)

echo.
echo Current Configuration:
echo RAPIDAPI_ENABLED=%RAPIDAPI_ENABLED%
echo.

REM Test 1: Normal API key authentication (if you have a key)
echo Test 1: Normal API key (requires actual DB key)
echo -------------------------------------------------
echo Skipping - need a real API key from database
echo.

REM Test 2: RapidAPI mode simulation (only works if RAPIDAPI_ENABLED=true)
if "%RAPIDAPI_ENABLED%"=="true" (
    echo Test 2: RapidAPI mode (X-RapidAPI-Key bypass)
    echo -------------------------------------------------
    curl -s -X POST http://localhost:3000/api/transactions/expense ^
      -H "Content-Type: application/json" ^
      -H "X-RapidAPI-Key: test-rapidapi-key-123" ^
      -d "{\"amount\":25,\"description\":\"Test\",\"category\":\"Food\"}" ^
      -o test2.json
    echo.
    type test2.json
    echo.
) else (
    echo Test 2: RapidAPI mode SKIPPED (RAPIDAPI_ENABLED=false)
    echo Set RAPIDAPI_ENABLED=true in .env to test locally
    echo.
)

REM Test 3: CORS preflight (OPTIONS)
echo Test 3: CORS preflight check
echo -------------------------------------------------
curl -s -X OPTIONS http://localhost:3000/api/transactions ^
  -H "Origin: http://localhost:3000" ^
  -H "Access-Control-Request-Method: POST" ^
  -v 2>&1 | findstr -i "access-control"
echo.

REM Test 4: curl without Origin header (should work)
echo Test 4: curl without Origin header (Postman simulation)
echo -------------------------------------------------
curl -s -X GET http://localhost:3000/api/transactions ^
  -w "`nHTTP Status: %%{http_code}`n" 2>&1 | tail -5
echo.

echo ================================================
echo Tests complete!
echo Check logs for [CORS] and [AUTH] debug messages
echo ================================================
