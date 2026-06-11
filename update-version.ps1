# Sync the version in hacs.json and the JS console banner from the latest git tag.
# Usage: ./update-version.ps1
#
# Replaces only the version substring in each file (regex), so existing
# formatting, indentation and line endings are preserved.

$latestTag = git describe --tags --abbrev=0 2>$null
if (-not $latestTag) {
  Write-Host "No git tags found"
  exit 1
}

# Extract version from tag (v2.5.0 -> 2.5.0)
$version = $latestTag -replace "^v", ""

# hacs.json — swap only the "version" value, keep formatting intact.
$hacsPath = Join-Path $PSScriptRoot "hacs.json"
$hacs = [IO.File]::ReadAllText($hacsPath)
$hacs = $hacs -replace '("version"\s*:\s*")[^"]*(")', ("`${1}$version`${2}")
[IO.File]::WriteAllText($hacsPath, $hacs)

# pool-timer-card.js — keep the console banner version in sync.
$jsPath = Join-Path $PSScriptRoot "pool-timer-card.js"
$js = [IO.File]::ReadAllText($jsPath)
$js = $js -replace '(POOL-TIMER-CARD %c v)\d+\.\d+\.\d+', ("`${1}$version")
[IO.File]::WriteAllText($jsPath, $js)

Write-Host "Synced hacs.json and JS banner to v$version"
Write-Host "Commit with: git add hacs.json pool-timer-card.js && git commit -m 'chore: update version to $version'"
