@echo off
REM Test script for admin API authentication (Windows)

echo ================================================
echo Admin API Authentication Test
echo ================================================

REM Check if server is running on localhost:3000
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo Server is running on port 3000
) else (
    echo Server is NOT running on port 3000
    echo Please start the server first:
    echo   node src\server.js
    exit /b 1
)

REM Read ADMIN_SECRET from .env file
set ADMIN_SECRET=
for /f "tokens=1,* delims==" %%i in ('findstr "ADMIN_SECRET=" .env 2^>nul') do (
    set ADMIN_SECRET=%%j
)

if "%ADMIN_SECRET%"=="" (
    echo ADMIN_SECRET not found in .env file
    exit /b 1
)

echo Found ADMIN_SECRET in .env

echo.
echo Testing POST /admin/apikeys with X-Admin-Secret header...
echo Command:
echo curl -X POST http://localhost:3000/admin/apikeys ^
echo   -H "Content-Type: application/json" ^
echo   -H "X-Admin-Secret: %ADMIN_SECRET%" ^
echo   -d "{\"email\":\"test@example.com\",\"name\":\"Test User\"}"
echo.
echo Sending request...

curl -s -w "`n%%{http_code}" -X POST http://localhost:3000/admin/apikeys ^
  -H "Content-Type: application/json" ^
  -H "X-Admin-Secret: %ADMIN_SECRET%" ^
  -d "{\"email\":\"test@example.com\",\"name\":\"Test User\"}" ^
  -o response.json

echo.
echo ================================================
echo Response:
type response.json
echo ================================================

REM Get the HTTP code from the last line
for /f "delims=" %%a in ('type response.json') do set "last_line=%%a"
echo %last_line% > status.txt
set /p HTTP_CODE=<status.txt

if "%HTTP_CODE%"=="201" (
    echo.
    echo SUCCESS! Admin API is working correctly.
    echo The authentication is functional.
) else if "%HTTP_CODE%"=="401" (
    echo.
    echo FAILED: 401 Unauthorized
    echo Possible causes:
    echo   1. ADMIN_SECRET value doesn^'t match
    echo   2. Wrong header name (should be X-Admin-Secret)
    echo   3. Check server logs for [DEBUG] messages
) else (
    echo.
    echo Unexpected HTTP code: %HTTP_CODE%
    echo Check server logs for errors.
)

REM Cleanup
del response.json 2>nul
del status.txt 2>nul

pause
