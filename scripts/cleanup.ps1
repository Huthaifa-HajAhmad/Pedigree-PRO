# PowerShell cleanup script for repo root (run from scripts\cleanup.ps1)
$root = (Resolve-Path "$PSScriptRoot\..").Path
Write-Output "Repository root: $root"

$paths = @(
    Join-Path $root 'data'
    Join-Path $root '.cache'
    Join-Path $root '.local'
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
        Write-Output "Removed: $p"
    } else {
        Write-Output "Not found: $p"
    }
}

Get-ChildItem -Path $root -Recurse -Filter '*.sqlite' -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        Write-Output "Removed sqlite: $($_.FullName)"
    } catch {
        Write-Output "Failed to remove sqlite: $($_.FullName)"
    }
}

$distDirs = @(
    Join-Path $root 'artifacts\ppro\dist'
)

foreach ($d in $distDirs) {
    if (Test-Path $d) {
        Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue
        Write-Output "Removed: $d"
    } else {
        Write-Output "Not found: $d"
    }
}

Write-Output "Cleanup complete."