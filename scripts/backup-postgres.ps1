param(
  [string]$OutputDirectory = "backups"
)

if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }
$backupDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupDirectory "zetgaming-$stamp.dump"
& pg_dump --format=custom --file=$backupFile $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
Write-Output "Created $backupFile"
