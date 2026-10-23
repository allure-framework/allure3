param([string]$NodePath, [string]$ScriptPath, [string]$OutputPath)
$ErrorActionPreference = "Stop"

# Run the CLI with real console handles even when Vitest itself uses pipes.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class ConsoleOutputFixture {

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
    static extern bool GetConsoleScreenBufferInfo(IntPtr handle, out ConsoleBufferInfo info);

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

    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

    static void Check(bool success)
    {
        if (!success)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }

    static IntPtr Buffer()
    {
        IntPtr handle = CreateConsoleScreenBuffer(0xC0000000, 3, IntPtr.Zero, 1, IntPtr.Zero);
        Check(handle != new IntPtr(-1));
        Check(SetHandleInformation(handle, 1, 1));
        return handle;
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
                cells,
                (uint)length,
                new Coord { x = 0, y = row },
                out read
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

    public static string[] Run(string node, string script)
    {
        FreeConsole();
        Check(AllocConsole());

        IntPtr stdout = IntPtr.Zero, stderr = IntPtr.Zero;

        ProcessInfo process = new ProcessInfo();

        try {
            stdout = Buffer();
            stderr = Buffer();
            StartupInfo startup = new StartupInfo();
            startup.cb = Marshal.SizeOf(typeof(StartupInfo));
            startup.flags = 0x100; // STARTF_USESTDHANDLES
            startup.stdout = stdout;
            startup.stderr = stderr;

            Check(CreateProcessW(
                node,
                new StringBuilder("\"" + node + "\" \"" + script + "\""),
                IntPtr.Zero,
                IntPtr.Zero,
                true,
                0,
                IntPtr.Zero,
                null,
                ref startup,
                out process
            ));

            if (WaitForSingleObject(process.process, 30000) != 0)
            {
                TerminateProcess(process.process, 1);
                throw new Exception("Console fixture timed out waiting for the CLI");
            }

            uint code;
            Check(GetExitCodeProcess(process.process, out code));

            return new string[] { Read(stdout), Read(stderr), code.ToString() };
        } finally {
            if (process.thread != IntPtr.Zero)
            {
                CloseHandle(process.thread);
            }

            if (process.process != IntPtr.Zero)
            {
                CloseHandle(process.process);
            }

            if (stdout != IntPtr.Zero)
            {
                CloseHandle(stdout);
            }

            if (stderr != IntPtr.Zero)
            {
                CloseHandle(stderr);
            }

            FreeConsole();
        }
    }
}
'@

$result = [ConsoleOutputFixture]::Run($NodePath, $ScriptPath)
@{ stdout = $result[0]; stderr = $result[1]; exitCode = [int]$result[2] } |
    ConvertTo-Json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
