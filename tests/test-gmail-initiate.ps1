<#
.SYNOPSIS
  Backend-only verification test for Kinfolk Gmail OAuth initiation.
.DESCRIPTION
  Authenticates an existing Supabase test user, requests the Gmail OAuth authorization
  URL from the deployed Edge Function, and validates the OAuth URL structure and redirect URI.
  
  SECURITY NOTICE:
  This script does NOT print or log passwords, tokens, JWTs, or secrets.
#>

param(
  [Parameter(Mandatory = $false)]
  [string]$SupabaseUrl = "https://rezhfgedjeucljtnsptw.supabase.co",

  [Parameter(Mandatory = $false)]
  [string]$AnonKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY,

  [Parameter(Mandatory = $false)]
  [string]$Email = "",

  [Parameter(Mandatory = $false)]
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Kinfolk Gmail Backend OAuth Initiation Verification     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Credential Prompt if not supplied
if (-not $AnonKey) {
  $AnonKey = Read-Host "Enter your Supabase Anon Key"
}
if (-not $Email) {
  $Email = Read-Host "Enter test user email (e.g. gomsduck@gmail.com)"
}
if (-not $Password) {
  $secPassword = Read-Host "Enter test user password" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPassword)
  $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

# 2. Authenticate against Supabase GoTrue Auth
Write-Host "`n[1/3] Authenticating test user with Supabase Auth..." -ForegroundColor Yellow
$authEndpoint = "$SupabaseUrl/auth/v1/token?grant_type=password"

try {
  $authBody = @{
    email    = $Email
    password = $Password
  } | ConvertTo-Json

  $authResponse = Invoke-RestMethod -Uri $authEndpoint `
    -Method Post `
    -Headers @{ "apikey" = $AnonKey } `
    -ContentType "application/json" `
    -Body $authBody

  if (-not $authResponse.access_token) {
    throw "Authentication failed: No access token in response."
  }
  $userJwt = $authResponse.access_token
  $userId = $authResponse.user.id
  Write-Host "  -> SUCCESS: User authenticated (User ID: $userId)" -ForegroundColor Green
} catch {
  Write-Host "  -> FAILED: Could not authenticate test user." -ForegroundColor Red
  Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
  Write-Host "  - Verify that the test user email exists in Supabase Auth."
  Write-Host "  - Check that the password is correct."
  Write-Host "  - Ensure your Supabase Anon Key is valid."
  exit 1
}

# 3. Call deployed Edge Function (POST /functions/v1/gmail-oauth-callback)
Write-Host "`n[2/3] Requesting Gmail OAuth URL from Edge Function..." -ForegroundColor Yellow
$fnEndpoint = "$SupabaseUrl/functions/v1/gmail-oauth-callback"

try {
  $reqBody = @{
    action       = "connect"
    redirectPath = "/autodetect"
  } | ConvertTo-Json

  $fnResponse = Invoke-RestMethod -Uri $fnEndpoint `
    -Method Post `
    -Headers @{
      "Authorization" = "Bearer $userJwt"
      "Content-Type"  = "application/json"
    } `
    -Body $reqBody

  if ($fnResponse.success -ne $true) {
    throw "Edge Function returned success=$($fnResponse.success)"
  }
  Write-Host "  -> SUCCESS: Edge function returned success=true" -ForegroundColor Green
} catch {
  Write-Host "  -> FAILED: Edge Function request failed." -ForegroundColor Red
  Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
  Write-Host "  - Verify the function is deployed: npx supabase functions list --project-ref rezhfgedjeucljtnsptw"
  Write-Host "  - Check Supabase secrets: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured."
  exit 1
}

# 4. Verify Google OAuth URL and Redirect URI
Write-Host "`n[3/3] Validating Google OAuth URL structure..." -ForegroundColor Yellow
$authUrl = $fnResponse.authUrl
$redirectUri = $fnResponse.redirectUri
$householdId = $fnResponse.householdId

$expectedRedirectUri = "$SupabaseUrl/functions/v1/gmail-oauth-callback"

$checks = [ordered]@{
  "authUrl returned"                   = [bool]$authUrl
  "authUrl host is Google OAuth"       = ($authUrl -match "^https://accounts\.google\.com/o/oauth2/v2/auth")
  "client_id parameter present"        = ($authUrl -match "client_id=")
  "redirect_uri matches deployed URI"  = ($redirectUri -eq $expectedRedirectUri)
  "redirect_uri embedded in authUrl"   = ($authUrl -match [regex]::Escape([uri]::EscapeDataString($expectedRedirectUri)))
  "scope contains gmail.readonly"      = ($authUrl -match "gmail\.readonly")
  "scope contains userinfo.email"      = ($authUrl -match "userinfo\.email")
  "access_type is offline"             = ($authUrl -match "access_type=offline")
  "prompt is consent"                  = ($authUrl -match "prompt=consent")
  "state parameter present"            = ($authUrl -match "state=")
  "householdId resolved"               = [bool]$householdId
}

$allPassed = $true
foreach ($name in $checks.Keys) {
  $status = $checks[$name]
  if ($status) {
    Write-Host "  [PASS] $name" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] $name" -ForegroundColor Red
    $allPassed = $false
  }
}

Write-Host "`n----------------------------------------------------------" -ForegroundColor Cyan
if ($allPassed) {
  Write-Host "VERIFICATION RESULT: ALL 11 CHECKS PASSED" -ForegroundColor Green
  Write-Host "Household ID resolved: $householdId" -ForegroundColor Gray
  Write-Host "Verified Redirect URI: $expectedRedirectUri" -ForegroundColor Gray
  Write-Host "`nNext Step: Open authUrl in browser with your Google test account to complete authorization." -ForegroundColor Yellow
} else {
  Write-Host "VERIFICATION RESULT: ONE OR MORE CHECKS FAILED" -ForegroundColor Red
}
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

