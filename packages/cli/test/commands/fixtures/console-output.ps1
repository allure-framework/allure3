param(
    [string]$NodePath,
    [string]$ScriptPath,
    [string]$OutputPath,
    [string]$InputText = "",
    [string]$OutputAccess = "read-write",
    [string]$TracePath = "$OutputPath.trace.log"
)
$ErrorActionPreference = "Stop"

function Write-FixtureTrace([string]$Stage) {
    $line = "{0:o} powershell pid={1} {2}" -f [DateTime]::UtcNow, $PID, $Stage
    [System.IO.File]::AppendAllText($TracePath, $line + [Environment]::NewLine)
}

Write-FixtureTrace "script started"

# Run the CLI with real console handles even when Vitest itself uses pipes.
Write-FixtureTrace "Add-Type starting"
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class ConsoleOutputFixture
{
    static void Trace(string path, string stage)
    {
        try
        {
            File.AppendAllText(
                path,
                string.Format(
                    "{0:o} csharp pid={1} thread={2} {3}{4}",
                    DateTime.UtcNow,
                    System.Diagnostics.Process.GetCurrentProcess().Id,
                    Thread.CurrentThread.ManagedThreadId,
                    stage,
                    Environment.NewLine
                ),
                new UTF8Encoding(false)
            );
        }
        catch
        {
            // Temporary best-effort diagnostics must not change fixture behavior.
        }
    }

    static string Snapshot(string value)
    {
        const int partLength = 8000;
        return value.Length <= partLength * 2
            ? value
            : value.Substring(0, partLength)
                + Environment.NewLine
                + "<snapshot truncated>"
                + Environment.NewLine
                + value.Substring(value.Length - partLength);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct StartupInfo
    {
        public int cb;
        public IntPtr reserved;
        public IntPtr desktop;
        public IntPtr title;
        public int x;
        public int y;
        public int width;
        public int height;
        public int columns;
        public int rows;
        public int fill;
        public int flags;
        public short show;
        public short reservedSize;
        public IntPtr reservedData;
        public IntPtr stdin;
        public IntPtr stdout;
        public IntPtr stderr;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo
    {
        public IntPtr process;
        public IntPtr thread;
        public int pid;
        public int tid;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct Coord
    {
        public short x;
        public short y;
    }

    [StructLayout(LayoutKind.Explicit, CharSet = CharSet.Unicode, Size = 20)]
    struct InputRecord
    {
        [FieldOffset(0)]
        public ushort type;
        [FieldOffset(4)]
        public int keyDown;
        [FieldOffset(8)]
        public ushort repeat;
        [FieldOffset(10)]
        public ushort virtualKey;
        [FieldOffset(14)]
        public char character;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateFileW(
        string name,
        uint access,
        uint share,
        IntPtr security,
        uint disposition,
        uint flags,
        IntPtr template
    );

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool WriteConsoleInputW(
        IntPtr handle,
        InputRecord[] records,
        uint length,
        out uint written
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetConsoleScreenBufferSize(IntPtr handle, Coord size);

    [StructLayout(LayoutKind.Sequential)]
    struct SmallRect
    {
        public short left;
        public short top;
        public short right;
        public short bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ConsoleBufferInfo
    {
        public Coord size;
        public Coord cursor;
        public ushort attributes;
        public SmallRect window;
        public Coord maximumSize;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetConsoleScreenBufferInfo(
        IntPtr handle,
        out ConsoleBufferInfo info
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AllocConsole();

    [DllImport("kernel32.dll")]
    static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateConsoleScreenBuffer(
        uint access,
        uint share,
        IntPtr security,
        uint flags,
        IntPtr data
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll")]
    static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DuplicateHandle(
        IntPtr sourceProcess,
        IntPtr source,
        IntPtr targetProcess,
        out IntPtr target,
        uint access,
        bool inherit,
        uint options
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetConsoleMode(IntPtr handle, out uint mode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetConsoleActiveScreenBuffer(IntPtr handle);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CreateProcessW(
        string application,
        StringBuilder command,
        IntPtr processSecurity,
        IntPtr threadSecurity,
        bool inherit,
        uint flags,
        IntPtr environment,
        string cwd,
        ref StartupInfo startup,
        out ProcessInfo process
    );

    [DllImport("kernel32.dll")]
    static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll")]
    static extern bool GetExitCodeProcess(IntPtr process, out uint code);

    [DllImport("kernel32.dll")]
    static extern bool TerminateProcess(IntPtr process, uint code);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool ReadConsoleOutputCharacterW(
        IntPtr handle,
        [Out] char[] text,
        uint length,
        Coord origin,
        out uint read
    );

    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    static void Check(bool success)
    {
        if (!success)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }

    static IntPtr CreateScreenBuffer()
    {
        IntPtr handle = CreateConsoleScreenBuffer(
            access: 0xC0000000, // GENERIC_READ | GENERIC_WRITE
            share: 3, // FILE_SHARE_READ | FILE_SHARE_WRITE
            security: IntPtr.Zero,
            flags: 1, // CONSOLE_TEXTMODE_BUFFER (required by this API)
            data: IntPtr.Zero
        );
        Check(handle != new IntPtr(-1));

        // Setting dimensions that provide enough space to retain output from the large-output test.
        Check(SetConsoleScreenBufferSize(handle, new Coord { x = 120, y = 5000 }));

        return handle;
    }

    static IntPtr CreateInheritableConsoleOutputHandle(
        IntPtr screenBuffer,
        bool writeOnly,
        out int modeError
    )
    {
        IntPtr target;
        if (writeOnly)
        {
            // Open the same buffer with write-only access rather than duplicating its access rights.
            Check(SetConsoleActiveScreenBuffer(screenBuffer));
            target = CreateFileW(
                name: "CONOUT$",
                access: 0x40000000, // GENERIC_WRITE
                share: 3, // FILE_SHARE_READ | FILE_SHARE_WRITE
                security: IntPtr.Zero,
                disposition: 3, // OPEN_EXISTING
                flags: 0,
                template: IntPtr.Zero
            );
            Check(target != new IntPtr(-1));
        }
        else
        {
            // Duplicating the handle to the screen buffer to ensure it can be inherited by the child process.
            Check(DuplicateHandle(
                sourceProcess: GetCurrentProcess(),
                source: screenBuffer,
                targetProcess: GetCurrentProcess(),
                target: out target,
                access: 0,
                inherit: true,
                options: 2 // DUPLICATE_SAME_ACCESS
            ));
        }

        try
        {
            // Ensure the handle is inheritable by the child process.
            // CreateFileW with security: IntPtr.Zero creates a non-inheritable handle.
            Check(SetHandleInformation(target, mask: 1, flags: 1)); // HANDLE_FLAG_INHERIT

            // Validating that the handle has the expected console mode.
            // Failing this check means the fixture could not perform setup for the test.
            uint mode;
            bool readableMode = GetConsoleMode(target, out mode);
            modeError = readableMode ? 0 : Marshal.GetLastWin32Error();

            // With writeOnly = true, we expect GetConsoleMode to fail with ERROR_ACCESS_DENIED (error 5).
            // With writeOnly = false, we expect GetConsoleMode to succeed.
            if (writeOnly ? readableMode || modeError != 5 : !readableMode)
            {
                throw new Exception("Unexpected console access: GetConsoleMode error " + modeError);
            }

            return target;
        }
        catch
        {
            CloseHandle(target);
            throw;
        }
    }

    static string Read(IntPtr handle)
    {
        // We're reading just the text, omitting unused console screen cells.
        // Otherwise, the test output will be obstructed.

        ConsoleBufferInfo info;
        Check(GetConsoleScreenBufferInfo(handle, out info));
        StringBuilder text = new StringBuilder();

        // Console buffers contain padded screen cells, not newline-delimited text.
        for (short row = 0; row <= info.cursor.y; row++)
        {
            int length = row == info.cursor.y ? info.cursor.x : info.size.x;
            if (length == 0)
            {
                continue;
            }

            char[] cells = new char[length];
            uint read;
            Check(ReadConsoleOutputCharacterW(
                handle,
                text: cells,
                length: (uint)length,
                origin: new Coord { x = 0, y = row },
                read: out read
            ));
            if (text.Length > 0)
            {
                text.Append('\n');
            }

            text.Append(
                new string(cells, 0, checked((int)read))
                    .TrimEnd(' ', '\0')
            );
        }

        return text.ToString();
    }

    public static string[] Run(
        string node,
        string script,
        string inputText,
        bool writeOnlyOutput,
        string tracePath
    )
    {
        Trace(tracePath, "Run entered");

        // This fixture changes the active screen buffer and may inject keyboard input.
        // It allocates a new console to prevent interference with the caller of the test.
        Trace(tracePath, "FreeConsole starting");
        FreeConsole();
        Trace(tracePath, "FreeConsole finished; AllocConsole starting");
        Check(AllocConsole());
        Trace(tracePath, "AllocConsole finished");

        IntPtr stdin = IntPtr.Zero;
        IntPtr stdout = IntPtr.Zero;
        IntPtr stderr = IntPtr.Zero;
        IntPtr targetStdout = IntPtr.Zero;
        IntPtr targetStderr = IntPtr.Zero;

        ProcessInfo process = new ProcessInfo();

        try
        {
            Trace(tracePath, "stdout screen buffer creation starting");
            stdout = CreateScreenBuffer();
            Trace(tracePath, "stdout screen buffer creation finished; stderr starting");
            stderr = CreateScreenBuffer();
            Trace(tracePath, "stderr screen buffer creation finished");

            // The fixture will use the original handles to capture the output.
            // The target will receives copies with the selected access only.
            int stdoutModeError, stderrModeError;
            Trace(tracePath, "stdout target handle creation starting");
            targetStdout = CreateInheritableConsoleOutputHandle(
                screenBuffer: stdout,
                writeOnly: writeOnlyOutput,
                modeError: out stdoutModeError
            );
            Trace(tracePath, "stdout target handle creation finished; stderr starting");
            targetStderr = CreateInheritableConsoleOutputHandle(
                screenBuffer: stderr,
                writeOnly: writeOnlyOutput,
                modeError: out stderrModeError
            );
            Trace(tracePath, "stderr target handle creation finished");

            Trace(tracePath, "stdin handle creation starting");
            stdin = CreateFileW(
                name: "CONIN$",
                access: 0xC0000000, // GENERIC_READ | GENERIC_WRITE
                share: 3, // FILE_SHARE_READ | FILE_SHARE_WRITE
                security: IntPtr.Zero,
                disposition: 3, // OPEN_EXISTING
                flags: 0,
                template: IntPtr.Zero
            );
            Check(stdin != new IntPtr(-1));

            // Enable handle inheritance.
            Check(SetHandleInformation(stdin, 1, 1)); // HANDLE_FLAG_INHERIT
            Trace(tracePath, "stdin handle creation finished");

            StartupInfo startup = new StartupInfo();
            startup.cb = Marshal.SizeOf(typeof(StartupInfo));
            startup.flags = 0x100; // STARTF_USESTDHANDLES
            startup.stdin = stdin;
            startup.stdout = targetStdout;
            startup.stderr = targetStderr;

            Trace(tracePath, "CreateProcessW starting");
            Check(CreateProcessW(
                application: node,
                command: new StringBuilder("\"" + node + "\" \"" + script + "\""),
                processSecurity: IntPtr.Zero,
                threadSecurity: IntPtr.Zero,
                inherit: true,
                flags: 0,
                environment: IntPtr.Zero,
                cwd: null,
                startup: ref startup,
                process: out process
            ));
            Trace(tracePath, "CreateProcessW finished; child pid=" + process.pid);

            if (inputText.Length > 0)
            {
                Trace(tracePath, "stdin-ready wait starting");
                var deadline = System.Diagnostics.Stopwatch.StartNew();

                // Waiting for the launcher script to create a marker file
                // signaling that it is ready to receive console input.
                while (!System.IO.File.Exists(script + ".stdin-ready"))
                {
                    if (deadline.ElapsedMilliseconds > 20000 || WaitForSingleObject(process.process, 10) == 0)
                    {
                        throw new Exception("Target did not become ready for console input");
                    }
                }
                Trace(tracePath, "stdin-ready marker observed");

                string line = inputText + "\r";
                InputRecord[] records = new InputRecord[line.Length];
                for (int index = 0; index < line.Length; index++)
                {
                    records[index] = new InputRecord
                    {
                        type = 1,
                        keyDown = 1,
                        repeat = 1,
                        virtualKey = line[index] == '\r' ? (ushort)13 : (ushort)0,
                        character = line[index]
                    };
                }

                uint written;
                Trace(tracePath, "WriteConsoleInputW starting");
                Check(WriteConsoleInputW(stdin, records, (uint)records.Length, out written));
                Check(written == records.Length);
                Trace(tracePath, "WriteConsoleInputW finished");
            }

            // Wait for the process to exit or timeout before reading the output.
            Trace(tracePath, "30-second child wait starting");
            uint waitResult = WaitForSingleObject(process.process, 30000);
            Trace(tracePath, "child wait finished; result=" + waitResult);
            if (waitResult != 0)
            {
                Trace(tracePath, "child timeout; TerminateProcess starting");
                TerminateProcess(process.process, code: 1);
                Trace(tracePath, "TerminateProcess finished; timeout stdout read starting");
                string timeoutStdout = Read(stdout);
                Trace(tracePath, "timeout stdout read finished; stderr starting");
                string timeoutStderr = Read(stderr);
                Trace(tracePath, "timeout stdout snapshot:" + Environment.NewLine + Snapshot(timeoutStdout));
                Trace(tracePath, "timeout stderr snapshot:" + Environment.NewLine + Snapshot(timeoutStderr));
                Trace(tracePath, "timeout stderr read finished; throwing timeout error");
                throw new Exception(
                    "Console fixture timed out waiting for the CLI. stdout: " + timeoutStdout
                        + "; stderr: " + timeoutStderr
                );
            }

            uint code;
            Trace(tracePath, "GetExitCodeProcess starting");
            Check(GetExitCodeProcess(process.process, out code));
            Trace(tracePath, "GetExitCodeProcess finished; code=" + code);

            Trace(tracePath, "stdout buffer read starting");
            string stdoutText = Read(stdout);
            Trace(tracePath, "stdout buffer read finished; stderr starting");
            string stderrText = Read(stderr);
            Trace(tracePath, "stderr buffer read finished; returning result");

            return new string[]
            {
                stdoutText,
                stderrText,
                code.ToString(),
                stdoutModeError.ToString(),
                stderrModeError.ToString()
            };
        }
        finally
        {
            Trace(tracePath, "cleanup entered");
            if (targetStdout != IntPtr.Zero)
            {
                CloseHandle(targetStdout);
            }

            if (targetStderr != IntPtr.Zero)
            {
                CloseHandle(targetStderr);
            }
            Trace(tracePath, "target output handles closed");

            if (stdin != IntPtr.Zero && stdin != new IntPtr(-1))
            {
                CloseHandle(stdin);
            }
            Trace(tracePath, "stdin handle closed");

            if (process.thread != IntPtr.Zero)
            {
                CloseHandle(process.thread);
            }
            Trace(tracePath, "child thread handle closed");

            if (process.process != IntPtr.Zero)
            {
                Trace(tracePath, "child process cleanup starting");
                if (WaitForSingleObject(process.process, 0) != 0)
                {
                    Trace(tracePath, "child still running during cleanup; TerminateProcess starting");
                    TerminateProcess(process.process, code: 1);
                    Trace(tracePath, "cleanup TerminateProcess finished");
                }

                CloseHandle(process.process);
            }
            Trace(tracePath, "child process handle closed");

            if (stdout != IntPtr.Zero)
            {
                CloseHandle(stdout);
            }

            if (stderr != IntPtr.Zero)
            {
                CloseHandle(stderr);
            }
            Trace(tracePath, "screen buffer handles closed; FreeConsole starting");

            FreeConsole();
            Trace(tracePath, "FreeConsole finished; cleanup complete");
        }
    }
}
'@

Write-FixtureTrace "Add-Type finished; Run starting"
$result = [ConsoleOutputFixture]::Run(
    $NodePath,
    $ScriptPath,
    $InputText,
    $OutputAccess -eq "write-only",
    $TracePath
)
Write-FixtureTrace "Run finished; JSON write starting"
@{
    stdout = $result[0]
    stderr = $result[1]
    exitCode = [int]$result[2]
    stdoutModeError = [int]$result[3]
    stderrModeError = [int]$result[4]
} | ConvertTo-Json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-FixtureTrace "JSON write finished; script complete"
