param([Parameter(Mandatory = $true)][string]$RequestFile)

# User data is never parsed as PowerShell source or as named parameters.
$ErrorActionPreference = 'Stop'
try {
    $request = [System.IO.File]::ReadAllText(
        $RequestFile,
        [System.Text.UTF8Encoding]::new($false, $true)
    ) | ConvertFrom-Json
    Remove-Item -LiteralPath $RequestFile -Force
    [string[]]$positionalArguments = @($request.arguments)
    $global:LASTEXITCODE = 0
    & $request.command @positionalArguments
    $succeeded = $?
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($succeeded) { exit 0 } else { exit 1 }
} catch {
    # Worker diagnostics are command output, unlike supervisor diagnostics.
    [Console]::Error.WriteLine($_.ToString())
    exit 1
}
