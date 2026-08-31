[CmdletBinding()]
param(
    [switch]$Production,
    [switch]$CheckOnly,
    [switch]$NoBrowser,
    [switch]$ShowWindows,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Python = Join-Path $Root '.venv\Scripts\python.exe'
$Frontend = Join-Path $Root 'frontend'
$EnvFile = Join-Path $Root '.env'
$ScriptPath = $PSCommandPath
$ChildWindowStyle = if ($ShowWindows) { 'Normal' } else { 'Hidden' }

function Require-Path {
    param([string]$Path, [string]$Hint)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Path 不存在。$Hint"
    }
}

function Test-ListeningPort {
    param([int]$Port)
    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Test-Http {
    param([string]$Url)
    try {
        $null = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing
        return $true
    } catch {
        return $false
    }
}

function Test-BackendHealth {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/health" -TimeoutSec 2
        return ($health.status -eq 'ok' -and $health.database -eq 'connected')
    } catch {
        return $false
    }
}

function Wait-BackendHealth {
    param([int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-BackendHealth) { return $true }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Wait-Http {
    param([string]$Url, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-Http $Url) { return $true }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    return $false
}

Require-Path $EnvFile '请先复制 .env.example 为 .env 并填写 Neo4j 密码。'
Require-Path $Python '请先按 docs/setup.md 创建 .venv 并安装后端依赖。'
Require-Path (Join-Path $Frontend 'package.json') '前端目录不完整。'

if ($BackendOnly) {
    Set-Location $Root
    & $Python -m uvicorn backend.app.main:app --host 127.0.0.1 --port $BackendPort
    exit $LASTEXITCODE
}

if ($FrontendOnly) {
    $Npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $Npm) { throw '找不到 npm.cmd，请先安装 Node.js。' }
    Require-Path (Join-Path $Frontend 'node_modules') '请先在 frontend 目录执行 npm install。'
    $env:VITE_API_TARGET = "http://127.0.0.1:$BackendPort"
    Set-Location $Frontend
    & $Npm run dev -- --host 127.0.0.1 --port $FrontendPort
    exit $LASTEXITCODE
}

$neo4j = Test-NetConnection -ComputerName 127.0.0.1 -Port 7687 -WarningAction SilentlyContinue
if (-not $neo4j.TcpTestSucceeded) {
    throw 'Neo4j 未监听 127.0.0.1:7687，请先启动 Neo4j。'
}

if ($CheckOnly) {
    Set-Location $Root
    & $Python -m scripts.validation.validate_csv
    if ($LASTEXITCODE -ne 0) { throw '正式导入 CSV 校验失败。' }
    if (-not (Test-BackendHealth)) {
        throw "FastAPI 健康检查失败，请先启动 http://127.0.0.1:$BackendPort。"
    }
    Write-Host "检查通过：Neo4j、CSV 和 FastAPI 均正常。"
    if (Test-Http "http://127.0.0.1:$FrontendPort") {
        Write-Host "前端开发页面可访问：http://127.0.0.1:$FrontendPort"
    } elseif (Test-Path -LiteralPath (Join-Path $Frontend 'dist\index.html')) {
        Write-Host '前端构建产物存在：frontend/dist/index.html'
    } else {
        Write-Host '提示：前端开发服务和生产构建均未检测到。'
    }
    exit 0
}

$Shell = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
if (-not $Shell) { $Shell = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source }
if (-not $Shell) { throw '找不到 PowerShell。' }

if (-not (Test-BackendHealth)) {
    if (Test-ListeningPort $BackendPort) {
        throw "端口 $BackendPort 已被占用，但不是可用的 FastAPI 服务。"
    }
    Start-Process -FilePath $Shell -WindowStyle $ChildWindowStyle -WorkingDirectory $Root -ArgumentList @(
        '-NoLogo', '-NoProfile', '-NoExit', '-File', $ScriptPath,
        '-BackendOnly', '-BackendPort', "$BackendPort"
    ) | Out-Null
    if (-not (Wait-BackendHealth)) {
        throw "FastAPI 未能在 $BackendPort 端口启动，请查看后端窗口。"
    }
} else {
    Write-Host "复用已运行的 FastAPI：http://127.0.0.1:$BackendPort"
}

$Url = "http://127.0.0.1:$FrontendPort"
if ($Production) {
    $Npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $Npm) { throw '找不到 npm.cmd，请先安装 Node.js。' }
    Require-Path (Join-Path $Frontend 'node_modules') '请先在 frontend 目录执行 npm install。'
    Push-Location $Frontend
    try {
        & $Npm run build
        if ($LASTEXITCODE -ne 0) { throw '前端构建失败。' }
    } finally {
        Pop-Location
    }
    $Url = "http://127.0.0.1:$BackendPort"
} else {
    if (Test-Http $Url) {
        Write-Host "复用已运行的前端：$Url"
    } elseif (Test-ListeningPort $FrontendPort) {
        throw "端口 $FrontendPort 已被占用，但不是可用的前端服务。"
    } else {
        Start-Process -FilePath $Shell -WindowStyle $ChildWindowStyle -WorkingDirectory $Frontend -ArgumentList @(
            '-NoLogo', '-NoProfile', '-NoExit', '-File', $ScriptPath,
            '-FrontendOnly', '-FrontendPort', "$FrontendPort",
            '-BackendPort', "$BackendPort"
        ) | Out-Null
        if (-not (Wait-Http $Url)) {
            throw "前端未能在 $FrontendPort 端口启动，请查看前端窗口。"
        }
    }
}

Write-Host "项目已启动：$Url"
if (-not $NoBrowser) {
    Start-Process $Url | Out-Null
}
