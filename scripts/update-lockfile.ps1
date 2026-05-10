# PowerShell script to regenerate pnpm lockfile
Write-Output "Regenerating pnpm lockfile (no frozen lockfile)..."
$pwd = Resolve-Path ..\
Push-Location $pwd
try {
    $res = & pnpm install --no-frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed with exit code $LASTEXITCODE" }
    Write-Output "pnpm install completed."
} finally {
    Pop-Location
}
