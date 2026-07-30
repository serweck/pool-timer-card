# Sync the version in hacs.json and the JS console banner.
# Usage: ./update-version.ps1 2.9.6
#
# Run this BEFORE creating the tag. The release workflow verifies that both files
# match the tag being pushed and refuses to publish when they drift, so the order is:
#
#   1. ./update-version.ps1 <version>
#   2. add the '## [<version>] - <date>' section to CHANGELOG.md
#   3. git commit
#   4. git tag v<version> && git push origin v<version>   -> workflow publishes it
#
# It used to read the version from `git describe --tags`, which had the order
# backwards: the files can only be verified against a tag that already exists.
#
# Replaces only the version substring in each file (regex), so existing formatting,
# indentation and line endings are preserved.

param(
  [Parameter(Position = 0)]
  [string]$Version
)

if (-not $Version) {
  Write-Host "Usage: ./update-version.ps1 <version>     e.g. ./update-version.ps1 2.9.6"
  Write-Host ""
  Write-Host "Run this before creating the tag. The release workflow fails when hacs.json"
  Write-Host "or the console banner do not match the tag being pushed."
  exit 1
}

# Accept both '2.9.6' and 'v2.9.6'.
$Version = $Version -replace "^v", ""

if ($Version -notmatch "^\d+\.\d+\.\d+$") {
  Write-Host "Not a semantic version: '$Version' (expected e.g. 2.9.6)"
  exit 1
}

# hacs.json - swap only the "version" value, keep formatting intact.
$hacsPath = Join-Path $PSScriptRoot "hacs.json"
$hacs = [IO.File]::ReadAllText($hacsPath)
$hacs = $hacs -replace '("version"\s*:\s*")[^"]*(")', ("`${1}$Version`${2}")
[IO.File]::WriteAllText($hacsPath, $hacs)

# pool-timer-card.js - keep the console banner version in sync.
$jsPath = Join-Path $PSScriptRoot "pool-timer-card.js"
$js = [IO.File]::ReadAllText($jsPath)
$js = $js -replace '(POOL-TIMER-CARD %c v)\d+\.\d+\.\d+', ("`${1}$Version")
[IO.File]::WriteAllText($jsPath, $js)

Write-Host "Synced hacs.json and the JS banner to v$Version"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. add the '## [$Version]' section to CHANGELOG.md (the workflow needs it)"
Write-Host "  2. git add -A && git commit -m 'chore: release $Version'"
Write-Host "  3. git tag v$Version && git push origin main v$Version"
