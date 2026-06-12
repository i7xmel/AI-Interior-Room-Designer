@echo off
REM ============================================================
REM  Room3D / Hunyuan3D -- Texture Pipeline Installer (Windows)
REM ============================================================
REM
REM  Compiles the two C++ extensions required by
REM  Hunyuan3DPaintPipeline:
REM    - custom_rasterizer
REM    - differentiable_renderer
REM
REM  Requirements (install BEFORE running this script):
REM    1. Visual Studio 2019/2022 Build Tools with
REM       "Desktop development with C++" workload.
REM       Download: https://visualstudio.microsoft.com/downloads/
REM    2. Your conda / venv room3d environment activated.
REM    3. The Hunyuan3D-2 repo cloned somewhere on disk
REM       (default below assumes D:\Hunyuan3D-2 -- edit if needed).
REM
REM  Usage:
REM    Open "x64 Native Tools Command Prompt for VS 2022"
REM    cd path\to\room3d-viewer\scripts
REM    install_texture_windows.bat
REM ============================================================

setlocal enabledelayedexpansion

set HUNYUAN_DIR=D:\Hunyuan3D-2
if not "%1"=="" set HUNYUAN_DIR=%1

echo.
echo === Room3D texture installer ===
echo Hunyuan3D repo: %HUNYUAN_DIR%
echo.

if not exist "%HUNYUAN_DIR%\hy3dgen\texgen\custom_rasterizer\setup.py" (
    echo [ERROR] custom_rasterizer\setup.py not found under %HUNYUAN_DIR%
    echo         Pass the correct path:  install_texture_windows.bat C:\path\to\Hunyuan3D-2
    exit /b 1
)

REM -- Compile custom_rasterizer --
echo.
echo [1/2] Building custom_rasterizer ...
pushd "%HUNYUAN_DIR%\hy3dgen\texgen\custom_rasterizer"
python setup.py install
if errorlevel 1 (
    echo.
    echo [ERROR] custom_rasterizer build failed.
    echo         Make sure you launched the "x64 Native Tools Command Prompt for VS"
    echo         and that your venv / conda env is activated.
    popd
    exit /b 1
)
popd

REM -- Compile differentiable_renderer --
echo.
echo [2/2] Building differentiable_renderer ...
pushd "%HUNYUAN_DIR%\hy3dgen\texgen\differentiable_renderer"
python setup.py install
if errorlevel 1 (
    echo.
    echo [ERROR] differentiable_renderer build failed.
    popd
    exit /b 1
)
popd

echo.
echo === Done. Restart api_server.py -- texture_mode should now report "hunyuan". ===
endlocal
