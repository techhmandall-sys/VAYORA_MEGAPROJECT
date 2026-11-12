@echo off
rem Starts all of VAYORA on Windows: Docker Desktop if it is not running, then every
rem service (rebuilt where the code changed), then the app in the browser. On request it also
rem fills the app with demo rides and members to look at.
rem Double-click it, or run "run.bat" from a terminal. stop.bat shuts it down.
setlocal
cd /d "%~dp0"
title VAYORA

rem Docker's command-line tools, if Docker Desktop has not put them on the PATH.
where docker >nul 2>nul
if not errorlevel 1 goto have_docker
if not exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" goto no_docker
set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
:have_docker

docker info >nul 2>nul
if not errorlevel 1 goto docker_ready
echo Starting Docker Desktop...
start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
set /a tries=0
:wait_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>nul
if not errorlevel 1 goto docker_ready
set /a tries+=1
if %tries% lss 60 goto wait_docker
echo Docker Desktop did not start within 5 minutes. Open it yourself, then run this again.
goto fail
:docker_ready

echo.
echo Building and starting VAYORA. The very first run downloads and prepares the
echo corridor's road map and can take 10 minutes or more; later runs take a minute or two.
echo.
docker compose up -d --build --wait
if errorlevel 1 goto not_healthy

rem The ports the services were actually given, in case .env changed them.
set "WEB=5173"
set "API=8080"
set "INTEL=8000"
set "GATEWAY=3000"
for /f "tokens=2 delims=:" %%p in ('docker compose port web 80 2^>nul ^| findstr /b "0.0.0.0:"') do set "WEB=%%p"
for /f "tokens=2 delims=:" %%p in ('docker compose port core-api 8080 2^>nul ^| findstr /b "0.0.0.0:"') do set "API=%%p"
for /f "tokens=2 delims=:" %%p in ('docker compose port intel 8000 2^>nul ^| findstr /b "0.0.0.0:"') do set "INTEL=%%p"
for /f "tokens=2 delims=:" %%p in ('docker compose port gateway 3000 2^>nul ^| findstr /b "0.0.0.0:"') do set "GATEWAY=%%p"

rem The administrator and the demo accounts' password, as .env sets them. No password is shown.
set "ADMIN_EMAIL="
set "ADMIN_PASSWORD="
set "DEMO_PASSWORD="
if not exist .env goto env_read
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
  if /i "%%a"=="ADMIN_EMAIL" set "ADMIN_EMAIL=%%b"
  if /i "%%a"=="ADMIN_PASSWORD" set "ADMIN_PASSWORD=%%b"
  if /i "%%a"=="DEMO_PASSWORD" set "DEMO_PASSWORD=%%b"
)
:env_read

echo.
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo.
echo VAYORA is running.
echo   App:              http://localhost:%WEB%
echo   API reference:    http://localhost:%API%/swagger-ui.html
echo   Health:           http://localhost:%API%/actuator/health
echo                     http://localhost:%INTEL%/health
echo                     http://localhost:%GATEWAY%/health
if defined ADMIN_EMAIL echo   Administrator:    %ADMIN_EMAIL%, password ADMIN_PASSWORD in .env
if not defined ADMIN_EMAIL echo   Administrator:    none yet: add ADMIN_EMAIL and ADMIN_PASSWORD to .env
echo.

rem Demo data only when asked. N, or no answer within 20 seconds, opens the app without it.
choice /c YN /n /t 20 /d N /m "Add demo rides and members to look at? [Y/N, N in 20 seconds] "
if errorlevel 2 goto open_app
call :demo_data

:open_app
echo.
echo   To stop it all:   stop.bat
start "" "http://localhost:%WEB%"
goto done

rem Four drivers with six days of rides, two passengers, and a past to look at, all made up
rem (scripts/demo-data.mjs). Safe to run again: it signs into the accounts it made before and
rem adds rides only where none are to come, so running it every few days keeps the demo current.
:demo_data
where node >nul 2>nul
if not errorlevel 1 goto have_node
echo Demo data needs Node.js 20 or later, from https://nodejs.org . Skipped.
exit /b 0
:have_node
if defined DEMO_PASSWORD goto have_demo_password
rem One password for every demo account, made once and kept in .env so that later runs can sign in.
for /f "usebackq" %%p in (`node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"`) do set "DEMO_PASSWORD=%%p"
>>.env echo.
>>.env echo # Every demo account signs in with this. Made by run.bat for scripts/demo-data.mjs.
>>.env echo DEMO_PASSWORD=%DEMO_PASSWORD%
:have_demo_password
set "DEMO_ADMIN_EMAIL=%ADMIN_EMAIL%"
set "DEMO_ADMIN_PASSWORD=%ADMIN_PASSWORD%"
node scripts\demo-data.mjs --api http://localhost:%API%
if errorlevel 1 echo The demo data stopped part-way. Running this again carries on from there.
echo Demo members sign in with the password DEMO_PASSWORD in .env.
exit /b 0

:no_docker
echo Docker Desktop is not installed. Install it from
echo https://www.docker.com/products/docker-desktop/ and run this again.
goto fail

:not_healthy
echo.
echo Something did not start. Each service's state:
docker compose ps --all --format "table {{.Service}}\t{{.Status}}"
echo.
echo "docker compose logs SERVICE" shows why, for example: docker compose logs core-api
echo If a port "is already allocated", another program has it. Give VAYORA another one with
echo that service's *_PORT setting in .env, for example MONGO_PORT=27018, and run this again.
goto fail

:fail
echo.
pause
exit /b 1

:done
pause
exit /b 0
