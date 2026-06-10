# Update hacs.json version from latest git tag
# Usage: ./update-version.ps1

$latestTag = git describe --tags --abbrev=0 2>$null
if (-not $latestTag) {
  Write-Host "No git tags found"
  exit 1
}

# Extract version from tag (v2.5.0 -> 2.5.0)
$version = $latestTag -replace "^v", ""

# Update hacs.json
$hacsPath = Join-Path $PSScriptRoot "hacs.json"
$hacs = Get-Content $hacsPath -Raw | ConvertFrom-Json
$hacs.version = $version
$hacs | ConvertTo-Json | Set-Content $hacsPath

Write-Host "Updated hacs.json version to $version"
Write-Host "Commit with: git add hacs.json && git commit -m 'chore: update version to $version'"
