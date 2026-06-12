# start_backend.ps1 -- Start the Room3D Flask backend
# Usage: .\start_backend.ps1

Write-Host ""
Write-Host "  Room3D Viewer -- Starting Backend" -ForegroundColor Cyan
Write-Host "  =================================" -ForegroundColor Cyan
Write-Host ""

# Activate conda
try {
    conda activate room3d
    Write-Host "  Conda environment: room3d" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Could not activate conda. Make sure 'room3d' env exists." -ForegroundColor Yellow
    Write-Host "  Run: conda create -n room3d python=3.10 -y" -ForegroundColor Yellow
}

# Verify torch
Write-Host "  Checking PyTorch..." -ForegroundColor Gray
python -c "import torch; print(f'  CUDA: {torch.cuda.is_available()}')"

# Start server
Write-Host ""
Write-Host "  Starting api_server.py on port 8080..." -ForegroundColor Cyan
Write-Host ""
python api_server.py
