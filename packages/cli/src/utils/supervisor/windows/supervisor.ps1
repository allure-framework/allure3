$ErrorActionPreference = 'Stop'

try
{
    # Fixed prefix: pipe name, command, arguments.
    # No param block: command flags must never bind to supervisor parameters.

    if ($args.Count -lt 2)
    {
        throw 'Expected pipe name and command.'
    }

    $PipeName = [string] $args[0]
    if ([string]::IsNullOrWhiteSpace($PipeName))
    {
        throw 'Pipe name must not be blank.'
    }

    $Command = [string] $args[1]
    if ([string]::IsNullOrWhiteSpace($Command))
    {
        throw 'Command must not be blank.'
    }

    [string[]] $Arguments = @()
    if ($args.Count -gt 2)
    {
        $Arguments = $args[2..($args.Count - 1)]
    }

    $ResolvedCommand = $null
    $ResolutionError = $null
    try
    {
        # Get-Command uses PowerShell's own precedence and module discovery.
        # Escape wildcard syntax so one requested command cannot select another.
        $LookupName = $Command
        $AliasNames = [System.Collections.Generic.HashSet[string]]::new(
            [System.StringComparer]::OrdinalIgnoreCase
        )

        do
        {
            if (!$AliasNames.Add($LookupName))
            {
                throw "Alias cycle resolving: $Command"
            }

            $ResolvedCommand = Get-Command -Name $LookupName -ErrorAction Stop
            if ($ResolvedCommand.Count -gt 1)
            {
                throw "Ambiguous command: $Command"
            }
            if ($ResolvedCommand.CommandType -eq 'Alias')
            {
                $LookupName = $ResolvedCommand.Definition
            }
        } while ($ResolvedCommand -and $ResolvedCommand.CommandType -eq 'Alias')

        if ($null -eq $ResolvedCommand)
        {
            throw "Command not found: $Command"
        }
    }
    catch
    {
        # Report lookup failures over the control pipe after ready, like launch failures.
        $ResolutionError = $_.Exception.Message
    }

    $source = Get-Item -Path (Join-Path $PSScriptRoot 'supervisor.cs') | Get-Content -Raw

    Add-Type -TypeDefinition $source -ReferencedAssemblies @(
        'System.dll'
        'System.Core.dll'
        'System.Web.Extensions.dll'
        [System.Management.Automation.PowerShell].Assembly.Location
    ) -ErrorAction Stop | Out-Null

    $status = [JobSupervisor.Supervisor]::Run(
        $PipeName,
        (Join-Path $PSScriptRoot 'worker.ps1'),
        $(if ($null -eq $ResolutionError) { $ResolvedCommand } else { $null }),
        $Arguments,
        $ResolutionError
    )

    exit $status
}
catch
{
    exit 1
}
