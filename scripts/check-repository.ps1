$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$required = @(
    ".gitignore",
    ".gitattributes",
    "README.md",
    "CONTRIBUTING.md",
    "docs/project-scope.md",
    "docs/schema.md",
    "docs/team-roles.md",
    "docs/ai-usage-rules.md",
    "data/import/entities.csv",
    "data/import/relations.csv",
    "data/evaluation/questions.csv",
    ".github/pull_request_template.md"
)

$missing = @()
foreach ($item in $required) {
    $path = Join-Path $root $item
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $item
    }
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing required files: " + ($missing -join ", "))
}

$trackedForbidden = git -C $root ls-files | Where-Object {
    $_ -match '\.(pdf|docx?|pptx?|pem|key)$' -or
    ($_ -match '(^|/)\.env($|\.)' -and $_ -notmatch '(^|/)\.env\.example$') -or
    $_ -match '(^|/)node_modules/'
}

if ($trackedForbidden) {
    Write-Error ("Forbidden tracked files: " + ($trackedForbidden -join ", "))
}

Write-Host "Repository structure check passed."

