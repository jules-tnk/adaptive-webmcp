$ErrorActionPreference = 'Stop'

pnpm --filter webmcp-capability-forge-extension build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Path 'output' -Force | Out-Null
$required = @(
  'manifest.json',
  'background.js',
  'content.js',
  'main-world.js',
  'sidepanel.js',
  'sidepanel.html',
  'styles.css',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png'
)
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path 'extension/dist' $name))) {
    throw "Missing extension artifact: $name"
  }
}

$archive = 'output/webmcp-capability-forge-extension.zip'
Compress-Archive -Path 'extension/dist/*' -DestinationPath $archive -Force
Write-Output $archive
