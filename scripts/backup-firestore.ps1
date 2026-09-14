param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^gs://[a-z0-9._-]+(?:/.+)?$')]
  [string]$Bucket,
  [string]$Project = 'glassco-connect-itms-dev'
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$destination = "$($Bucket.TrimEnd('/'))/firestore/$stamp"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'Google Cloud CLI (gcloud) is required to create a managed Firestore export.'
}

Write-Host "Creating Firestore backup for $Project at $destination"
& gcloud firestore export $destination --project=$Project --async
if ($LASTEXITCODE -ne 0) { throw "Firestore export request failed with exit code $LASTEXITCODE." }

Write-Host 'Backup request accepted. Confirm completion in Google Cloud Console > Firestore > Import/Export.'
