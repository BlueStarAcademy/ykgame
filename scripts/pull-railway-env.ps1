# Pull Railway variables into .env for local development (secrets stay on disk only).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Parse-KvLines {
    param([string[]]$Lines)
    $map = @{}
    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1)
        $map[$key] = $value
    }
    return $map
}

function Derive-AuthSecret {
    param([string]$DatabaseUrl)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("ykgame-auth-v1:$DatabaseUrl")
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return [Convert]::ToBase64String($hash)
}

$webLines = & railway variable list --service YKGAME --kv
$pgLines = & railway variable list --service Postgres --kv

$web = Parse-KvLines $webLines
$pg = Parse-KvLines $pgLines

$databasePublicUrl = $pg["DATABASE_PUBLIC_URL"]
if (-not $databasePublicUrl) {
    throw "DATABASE_PUBLIC_URL not found on Postgres service. Enable Public Networking in Railway."
}

$databaseUrl = $web["DATABASE_URL"]
if (-not $databaseUrl) { $databaseUrl = $pg["DATABASE_URL"] }

$authSecret = $web["AUTH_SECRET"]
if (-not $authSecret) { $authSecret = $web["NEXTAUTH_SECRET"] }
if (-not $authSecret) { $authSecret = Derive-AuthSecret $databasePublicUrl }

$optionalKeys = @(
    "KAKAO_CLIENT_ID",
    "KAKAO_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET"
)

$out = New-Object System.Collections.Generic.List[string]
$out.Add("# Generated from Railway (YKGAME + Postgres) — local development")
$out.Add("# $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$out.Add("")
$out.Add("AUTH_URL=http://localhost:3000")
$out.Add("NODE_ENV=development")
$out.Add("")
$out.Add("DATABASE_PUBLIC_URL=$databasePublicUrl")
if ($databaseUrl) {
    $out.Add("DATABASE_URL=$databaseUrl")
}
$out.Add("")
$out.Add("AUTH_SECRET=$authSecret")

foreach ($key in $optionalKeys) {
    $value = $web[$key]
    if (-not $value) { $value = $pg[$key] }
    if ($value) { $out.Add("$key=$value") }
}

$envPath = Join-Path $root ".env"
$out | Set-Content -Path $envPath -Encoding utf8

Write-Host "Wrote .env for local development ($($out.Count) lines)"
