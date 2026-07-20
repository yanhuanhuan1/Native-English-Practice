param(
  [int]$Port = 3000,
  [string]$Path = "/daily-training"
)

$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:$Port"

try {
  $page = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl$Path" -TimeoutSec 8
  if ($page.StatusCode -ne 200) {
    exit 1
  }

  $cssMatch = [regex]::Match($page.Content, 'href="([^"]*\.css[^"]*)"')
  if (-not $cssMatch.Success) {
    exit 1
  }

  $cssHref = $cssMatch.Groups[1].Value
  $cssUrl = if ($cssHref.StartsWith("http")) { $cssHref } else { "$baseUrl$cssHref" }
  $css = Invoke-WebRequest -UseBasicParsing -Uri $cssUrl -TimeoutSec 8

  if ($css.StatusCode -eq 200 -and $css.Content.Length -gt 1000) {
    exit 0
  }

  exit 1
} catch {
  exit 1
}
