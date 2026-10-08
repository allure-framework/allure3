$ErrorActionPreference = 'Stop'

try
{
    [System.UInt32] $ProcessId = 0

    if ($args.Count -lt 1 -or
        -not [System.UInt32]::TryParse($args[0], [ref] $ProcessId))
    {
        exit 87
    }

    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class Native
{
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AttachConsole(uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetConsoleCtrlHandler(
        IntPtr handler,
        [MarshalAs(UnmanagedType.Bool)] bool add
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GenerateConsoleCtrlEvent(
        uint controlEvent,
        uint processGroupId
    );
}
"@

    [Native]::FreeConsole() | Out-Null

    If (-not [Native]::AttachConsole($ProcessId) -or
        -not [Native]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) -or
        -not [Native]::GenerateConsoleCtrlEvent(0, 0))
    {
        exit [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    }
}
catch
{
    exit 1
}
