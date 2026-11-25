# Copy the web app into Android assets/www.
# Usage (in the dinner-app folder):
#   powershell -ExecutionPolicy Bypass -File delivery\sync-web.ps1
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI
# unless the file has a BOM, so non-ASCII text breaks the parser.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dst = Join-Path $root 'delivery/android/app/src/main/assets/www'

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $dst 'data') -Force | Out-Null

foreach ($f in @('index.html', 'app.js', 'styles.css')) {
    Copy-Item (Join-Path $root $f) (Join-Path $dst $f)
}
foreach ($f in @('dishes.js', 'dishes.generated.js')) {
    $src = Join-Path $root "data/$f"
    if (Test-Path $src) { Copy-Item $src (Join-Path $dst "data/$f") }
}

$size = (Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("synced -> {0} ({1:N0} KB)" -f $dst, ($size / 1KB))
