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

    $source = @'
using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Management.Automation;

namespace JobSupervisor
{
    public sealed class Failure : Exception
    {
        public readonly string Operation;
        public readonly int? NativeError;
        public Failure(string operation, string message) : base(message)
        {
            Operation = operation;
        }

        public Failure(string operation, int error) : base(new Win32Exception(error).Message)
        {
            Operation = operation;
            NativeError = error;
        }
    }

    internal static class Native
    {
        // Job objects and completion ports
        internal const uint KILL_ON_JOB_CLOSE = 0x2000;
        internal const int JobObjectBasicAccountingInformation = 1;
        internal const int JobObjectAssociateCompletionPortInformation = 7;
        internal const int JobObjectExtendedLimitInformation = 9;
        internal const uint JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO = 4;
        internal const int JobObjectBasicProcessIdList = 3;
        internal static readonly UIntPtr JobKey = new UIntPtr(1);
        internal static readonly UIntPtr StopKey = new UIntPtr(2);

        [StructLayout(LayoutKind.Sequential)]
        internal struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct BASIC_ACCOUNTING
        {
            public long TotalUserTime;
            public long TotalKernelTime;
            public long ThisPeriodTotalUserTime;
            public long ThisPeriodTotalKernelTime;
            public uint TotalPageFaultCount;
            public uint TotalProcesses;
            public uint ActiveProcesses;
            public uint TotalTerminatedProcesses;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct BASIC_LIMIT
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct EXTENDED_LIMIT
        {
            public BASIC_LIMIT BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct COMPLETION_PORT
        {
            public IntPtr CompletionKey, CompletionPort;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool SetInformationJobObject(
            IntPtr job,
            int infoClass,
            IntPtr info,
            uint length
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool TerminateJobObject(IntPtr job, uint code);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool QueryInformationJobObject(
            IntPtr job,
            int kind,
            IntPtr info,
            uint size,
            out uint returned
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool QueryInformationJobObject(
            IntPtr job,
            int kind,
            out BASIC_ACCOUNTING info,
            uint size,
            out uint returned
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool IsProcessInJob(
            IntPtr process,
            IntPtr job,
            out bool member
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr CreateIoCompletionPort(
            IntPtr file,
            IntPtr existing,
            UIntPtr key,
            uint threads
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool GetQueuedCompletionStatus(
            IntPtr port,
            out uint message,
            out UIntPtr key,
            out IntPtr overlapped,
            uint timeout
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool PostQueuedCompletionStatus(
            IntPtr port,
            uint message,
            UIntPtr key,
            IntPtr overlapped
        );

        // Process creation and inspection
        internal const uint EXTENDED_STARTUPINFO_PRESENT = 0x80000;
        internal const uint CREATE_UNICODE_ENVIRONMENT = 0x400;
        internal const uint STARTF_USESTDHANDLES = 0x100;
        internal static readonly IntPtr HandleListAttribute = new IntPtr(0x20002);
        internal static readonly IntPtr JobListAttribute = new IntPtr(0x2000d);
        internal const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        internal struct STARTUPINFO
        {
            public uint cb;
            public IntPtr lpReserved;
            public IntPtr lpDesktop;
            public IntPtr lpTitle;
            public uint dwX;
            public uint dwY;
            public uint dwXSize;
            public uint dwYSize;
            public uint dwXCountChars;
            public uint dwYCountChars;
            public uint dwFillAttribute;
            public uint dwFlags;
            public ushort wShowWindow;
            public ushort cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct STARTUPINFOEX
        {
            public STARTUPINFO StartupInfo;
            public IntPtr lpAttributeList;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct PROCESS_INFORMATION
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint dwProcessId;
            public uint dwThreadId;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct FILETIME
        {
            public uint Low;
            public uint High;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool InitializeProcThreadAttributeList(
            IntPtr list,
            int count,
            uint flags,
            ref UIntPtr size
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool UpdateProcThreadAttribute(
            IntPtr list,
            uint flags,
            IntPtr attribute,
            IntPtr value,
            UIntPtr size,
            IntPtr previous,
            IntPtr returned
        );

        [DllImport("kernel32.dll")]
        internal static extern void DeleteProcThreadAttributeList(IntPtr list);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool CreateProcessW(
            string application,
            StringBuilder commandLine,
            IntPtr processAttributes,
            IntPtr threadAttributes,
            bool inheritHandles,
            uint flags,
            IntPtr environment,
            string cwd,
            ref STARTUPINFOEX startup,
            out PROCESS_INFORMATION process
        );

        [DllImport("kernel32.dll")]
        internal static extern IntPtr GetCurrentProcess();

        [DllImport("kernel32.dll")]
        internal static extern uint GetCurrentProcessId();

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool GetExitCodeProcess(IntPtr process, out uint code);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool GetProcessTimes(
            IntPtr process,
            out FILETIME created,
            out FILETIME exited,
            out FILETIME kernel,
            out FILETIME user
        );

        // Handles, waits, and Win32 errors
        internal const uint DUPLICATE_SAME_ACCESS = 2;
        internal const uint GENERIC_READ = 0x80000000;
        internal const uint GENERIC_WRITE = 0x40000000;
        internal const uint FILE_SHARE_READ = 1;
        internal const uint FILE_SHARE_WRITE = 2;
        internal const uint OPEN_EXISTING = 3;
        internal const int STD_INPUT_HANDLE = -10;
        internal const int STD_OUTPUT_HANDLE = -11;
        internal const int STD_ERROR_HANDLE = -12;
        internal static readonly IntPtr InvalidHandle = new IntPtr(-1);
        internal const uint INFINITE = 0xffffffff;
        internal const uint WAIT_OBJECT_0 = 0;
        internal const uint WAIT_FAILED = 0xffffffff;
        internal const int ERROR_INVALID_HANDLE = 6;
        internal const int ERROR_INSUFFICIENT_BUFFER = 122;
        internal const int ERROR_MORE_DATA = 234;
        internal const int ERROR_INVALID_PARAMETER = 87;

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CloseHandle(IntPtr handle);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr GetStdHandle(int id);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool DuplicateHandle(
            IntPtr sourceProcess,
            IntPtr source,
            IntPtr targetProcess,
            out IntPtr target,
            uint access,
            bool inherit,
            uint options
        );

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern IntPtr CreateFileW(
            string name,
            uint access,
            uint share,
            IntPtr security,
            uint disposition,
            uint flags,
            IntPtr template
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern uint WaitForSingleObject(IntPtr handle, uint timeout);

        // Restart Manager
        internal const uint RM_SHUTDOWN_GRACEFUL = 0;
        internal const int CCH_RM_SESSION_KEY = 32;

        [StructLayout(LayoutKind.Sequential)]
        internal struct RM_UNIQUE_PROCESS
        {
            public uint ProcessId;
            public FILETIME ProcessStartTime;
        }

        // Restart Manager returns error codes directly; GetLastError is not applicable.
        [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
        internal static extern int RmStartSession(
            out uint session,
            uint flags,
            StringBuilder key
        );

        [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
        internal static extern int RmRegisterResources(
            uint session,
            uint files,
            IntPtr fileNames,
            uint count,
            [In] RM_UNIQUE_PROCESS[] processes,
            uint services,
            IntPtr names
        );

        [DllImport("rstrtmgr.dll")]
        internal static extern int RmShutdown(uint session, uint flags, IntPtr callback);

        [DllImport("rstrtmgr.dll")]
        internal static extern int RmEndSession(uint session);
    }

    public sealed class Supervisor : IDisposable
    {
        public const int MaxMessageBytes = 1048576;
        public const string CMD_UNQUOTED = @"#$*+-./:?@\_";

        // Communication and event delivery
        // The script uses JavaScriptSerializer because the newer System.Text.Json is not available in PowerShell 5.1.
        private readonly JavaScriptSerializer json = new JavaScriptSerializer
        {
            MaxJsonLength = MaxMessageBytes,
            RecursionLimit = 64
        };
        private readonly BlockingCollection<object> events = new BlockingCollection<object>(64);
        private readonly CancellationTokenSource stopping = new CancellationTokenSource();
        private readonly UTF8Encoding utf8 = new UTF8Encoding(false, true);
        private NamedPipeClientStream pipe;
        private const int ConnectTimeoutMs = 10000;
        private const int WriteTimeoutMs = 5000;
        private const int CompletionCheckIntervalMs = 2000;

        // Background threads and process resources
        private Thread reader, monitor, shutdown;
        private IntPtr job, port, root;
        private uint rootPid;
        private string workerPath, tempDirectory;

        // Lifecycle state
        private bool terminateSeen, launched, terminationSucceeded;
        private bool stopSeen, stopPending, stopSucceeded, jobEmpty;

        // Event payloads
        private sealed class StopResult
        {
            internal string RequestId;
            internal Exception Error;
        }

        private sealed class EmptyJob
        {
        }

        private sealed class Frame
        {
            internal string Text;
        }

        private static Failure Win32(string operation)
        {
            return new Failure(operation, Marshal.GetLastWin32Error());
        }

        private static Dictionary<string, object> Message(string type)
        {
            return new Dictionary<string, object>
            {
                { "type", type }
            };
        }

        private void Enqueue(object item)
        {
            try
            {
                events.Add(item, stopping.Token);
            }
            catch (OperationCanceledException)
            {
            }
        }

        private async Task ReadExact(byte[] data)
        {
            int offset = 0;
            while (offset < data.Length)
            {
                int count = await pipe.ReadAsync(
                    data,
                    offset,
                    data.Length - offset,
                    stopping.Token
                ).ConfigureAwait(false);
                if (count == 0)
                    throw new Failure(
                        "ReadPipe",
                        "Control pipe disconnected or frame was truncated."
                    );
                offset += count;
            }
        }

        private void ReadLoop()
        {
            try
            {
                while (!stopping.IsCancellationRequested)
                {
                    byte[] header = new byte[4];
                    ReadExact(header).GetAwaiter().GetResult();

                    uint size =
                        (uint)header[0]
                            | ((uint)header[1] << 8)
                            | ((uint)header[2] << 16)
                            | ((uint)header[3] << 24);

                    if (size == 0 || size > MaxMessageBytes)
                        throw new Failure("ReadFrame", "Payload length must be between 1 and 1048576 bytes.");
                    byte[] payload = new byte[(int)size];
                    ReadExact(payload).GetAwaiter().GetResult();
                    Enqueue(new Frame { Text = utf8.GetString(payload) });
                }
            }
            catch (Exception e)
            {
                if (!stopping.IsCancellationRequested)
                    Enqueue(e);
            }
        }

        // Only the event-loop thread writes. Async I/O plus a deadline bounds even final/error writes.
        private void Send(Dictionary<string, object> message)
        {
            byte[] payload = utf8.GetBytes(json.Serialize(message));
            byte[] frame = new byte[4 + payload.Length];
            uint size = (uint)payload.Length;
            for (int i = 0; i < 4; i++)
            {
                frame[i] = (byte)(size >> (8 * i));
            }

            Buffer.BlockCopy(payload, 0, frame, 4, payload.Length);

            Task write = pipe.WriteAsync(frame, 0, frame.Length);
            if (!write.Wait(WriteTimeoutMs))
            {
                pipe.Dispose();
                throw new Failure("WritePipe", "Control pipe write timed out.");
            }

            Task flush = pipe.FlushAsync();
            if (!flush.Wait(WriteTimeoutMs))
            {
                pipe.Dispose();
                throw new Failure("FlushPipe", "Control pipe flush timed out.");
            }
        }

        private Dictionary<string, object> Error(Exception exception, string requestId, bool fatal)
        {
            Failure failure = exception as Failure;
            Dictionary<string, object> result = Message("error");
            if (requestId != null)
                result["requestId"] = requestId;
            result["operation"] = failure == null ? "Supervisor" : failure.Operation;
            result["message"] = exception.Message;
            result["fatal"] = fatal;
            if (failure != null && failure.NativeError.HasValue)
                result["win32Error"] = failure.NativeError.Value;
            return result;
        }

        private void SetJobInformation<T>(int kind, T value)
        {
            int size = Marshal.SizeOf(typeof(T));
            IntPtr memory = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(value, memory, false);
                if (!Native.SetInformationJobObject(job, kind, memory, (uint)size))
                    throw Win32("SetInformationJobObject");
            }
            finally
            {
                Marshal.FreeHGlobal(memory);
            }
        }

        private void CreateJob()
        {
            job = Native.CreateJobObjectW(IntPtr.Zero, null);
            if (job == IntPtr.Zero)
                throw Win32("CreateJobObjectW");
            Native.EXTENDED_LIMIT limits = new Native.EXTENDED_LIMIT();
            limits.BasicLimitInformation.LimitFlags = Native.KILL_ON_JOB_CLOSE;
            SetJobInformation(Native.JobObjectExtendedLimitInformation, limits);
            port = Native.CreateIoCompletionPort(Native.InvalidHandle, IntPtr.Zero, UIntPtr.Zero, 1);
            if (port == IntPtr.Zero)
                throw Win32("CreateIoCompletionPort");
            SetJobInformation(Native.JobObjectAssociateCompletionPortInformation,
                new Native.COMPLETION_PORT { CompletionKey = new IntPtr(1), CompletionPort = port });
            monitor = new Thread(delegate ()
            {
                try
                {
                    while (true)
                    {
                        uint message;
                        UIntPtr key;
                        IntPtr overlapped;
                        if (!Native.GetQueuedCompletionStatus(port, out message, out key, out overlapped,
                            Native.INFINITE))
                            throw Win32("GetQueuedCompletionStatus");
                        if (key == Native.StopKey)
                            return;
                        if (key == Native.JobKey && message == Native.JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO)
                            Enqueue(new EmptyJob());
                    }
                }
                catch (Exception e)
                {
                    if (!stopping.IsCancellationRequested)
                        Enqueue(e);
                }
            });
            monitor.IsBackground = true;
            monitor.Start();
        }

        // Conventional Microsoft C runtime argument quoting, including an explicitly empty argument.
        public static string QuoteNative(string value)
        {
            StringBuilder result = new StringBuilder("\"");
            int slashes = 0;
            foreach (char ch in value)
            {
                if (ch == '\\')
                {
                    slashes++;
                    continue;
                }

                if (ch == '"')
                    result.Append('\\', slashes * 2 + 1).Append('"');
                else
                    result.Append('\\', slashes).Append(ch);
                slashes = 0;
            }

            return result.Append('\\', slashes * 2).Append('"').ToString();
        }

        // Adapted from Rust's std::sys::windows::args source code.
        // See https://github.com/rust-lang/rust/blob/ea137335b78829b4514bf1b4c16302f74fab8581/library/std/src/sys/args/windows.rs#L219
        private static void AppendBatArg(StringBuilder commandLine, string argument, bool quote)
        {
            if (commandLine == null)
            {
                throw new ArgumentNullException("commandLine");
            }

            if (argument == null)
            {
                throw new ArgumentNullException("argument");
            }

            if (argument.IndexOf('\0') >= 0)
            {
                throw new ArgumentException("Batch arguments cannot contain null characters.", "argument");
            }

            if (argument.Length == 0 || argument[argument.Length - 1] == '\\')
            {
                quote = true;
            }

            foreach (char c in argument)
            {
                bool asciiNeedsQuoting =
                    IsAscii(c) && !(IsAsciiAlphanumeric(c) || CMD_UNQUOTED.IndexOf(c) >= 0);
                if (asciiNeedsQuoting || IsControl(c))
                {
                    quote = true;
                }
            }

            if (quote)
            {
                commandLine.Append('"');
            }

            int backslashes = 0;
            foreach (char c in argument)
            {
                if (c == '\\')
                {
                    backslashes += 1;
                }
                else
                {
                    if (c == '"')
                    {
                        commandLine
                            .Append('\\', backslashes)
                            .Append('"');
                    }
                    else if (c == '%')
                    {
                        commandLine.Append("%%cd:~,");
                    }

                    backslashes = 0;
                }

                commandLine.Append(c);
            }

            if (quote)
            {
                commandLine
                    .Append('\\', backslashes)
                    .Append('"');
            }
        }

        // Adapted from Rust's std::sys::windows::args source code.
        // See https://github.com/rust-lang/rust/blob/ea137335b78829b4514bf1b4c16302f74fab8581/library/std/src/sys/args/windows.rs#L292.
        private static string MakeBatCommandLine(
            string cmdExePath,
            string scriptPath,
            string[] arguments,
            bool forceQuotes
        )
        {
            if (scriptPath == null)
            {
                throw new ArgumentNullException("scriptPath");
            }

            if (arguments == null)
            {
                throw new ArgumentNullException("arguments");
            }

            if (scriptPath.Length == 0)
            {
                throw new ArgumentException(
                    "The script path cannot be empty.",
                    "scriptPath"
                );
            }

            if (scriptPath.IndexOf('"') >= 0 || scriptPath[scriptPath.Length - 1] == '\\')
            {
                throw new ArgumentException(
                    "The script path cannot contain quotes or end with a backslash.",
                    "scriptPath"
                );
            }

            StringBuilder commandLine = new StringBuilder(QuoteNative(cmdExePath))
                .Append(" /e:ON /v:OFF /d /c \"")
                .Append('"')
                .Append(
                    scriptPath[scriptPath.Length - 1] == '\0'
                        ? scriptPath.Substring(0, scriptPath.Length - 1)
                        : scriptPath
                )
                .Append('"');

            foreach (string argument in arguments)
            {
                if (argument.IndexOf('\r') >= 0 || argument.IndexOf('\n') >= 0)
                {
                    throw new ArgumentException(
                        "Batch file arguments cannot contain carriage return or newline characters.",
                        "arguments"
                    );
                }

                commandLine.Append(' ');
                AppendBatArg(commandLine, argument, forceQuotes);
            }

            commandLine.Append('"');

            return commandLine.ToString();
        }

        private static bool IsAscii(char c)
        {
            return c >= '\x00' && c <= '\x7F';
        }

        private static bool IsAsciiAlphanumeric(char c)
        {
            return c >='0' && c <='9' || c >='A' && c <='Z' || c >='a' && c <='z';
        }

        private static bool IsControl(char c)
        {
            return c >= '\x00' && c <= '\x1F' || c >= '\x7F' && c <= '\u009F';
        }

        private static IntPtr StandardHandle(int id, bool input)
        {
            bool success = false;
            IntPtr source = Native.GetStdHandle(id), duplicate;
            if (source != IntPtr.Zero && source != Native.InvalidHandle)
            {
                // Duplicate the handle to ensure it is inheritable.
                // The original handle may be non-inheritable, which would prevent the child process from using it.
                success = Native.DuplicateHandle(
                    Native.GetCurrentProcess(),
                    source,
                    Native.GetCurrentProcess(),
                    out duplicate,
                    access: 0,
                    inherit: true,
                    options: Native.DUPLICATE_SAME_ACCESS
                );

                if (success)
                    return duplicate;

                int error = Marshal.GetLastWin32Error();
                if (error != Native.ERROR_INVALID_HANDLE)
                    throw new Failure("DuplicateHandle", error);
            }

            // If no stdin/stdout/stderr is available, open NUL for reading or writing.
            IntPtr nul = Native.CreateFileW(
                "NUL",
                input ? Native.GENERIC_READ : Native.GENERIC_WRITE,
                Native.FILE_SHARE_READ | Native.FILE_SHARE_WRITE,
                IntPtr.Zero,
                Native.OPEN_EXISTING,
                0,
                IntPtr.Zero
            );

            if (nul == Native.InvalidHandle)
                throw Win32("CreateFileW(NUL)");

            try
            {
                success = Native.DuplicateHandle(
                    Native.GetCurrentProcess(),
                    nul,
                    Native.GetCurrentProcess(),
                    out duplicate,
                    access: 0,
                    inherit: true,
                    options: Native.DUPLICATE_SAME_ACCESS
                );

                if (!success)
                    throw Win32("DuplicateHandle(NUL)");

                return duplicate;
            }
            finally
            {
                Native.CloseHandle(nul);
            }
        }

        private uint Launch(CommandInfo command, string[] arguments, string cwd)
        {
            bool powershell = false;
            bool batch = false;
            string resolved;

            ApplicationInfo applicationInfo = command as ApplicationInfo;
            ExternalScriptInfo scriptInfo = command as ExternalScriptInfo;

            if (applicationInfo != null)
            {
                resolved = applicationInfo.Path;
                string resolvedExtension = Path.GetExtension(resolved);

                batch = resolvedExtension.Equals(".cmd", StringComparison.OrdinalIgnoreCase)
                    || resolvedExtension.Equals(".bat", StringComparison.OrdinalIgnoreCase);
            }
            else if (scriptInfo != null)
            {
                resolved = scriptInfo.Path;
                powershell = true;
            }
            else if (command.CommandType == CommandTypes.Cmdlet
                || command.CommandType == CommandTypes.Function)
            {
                resolved = String.IsNullOrEmpty(command.ModuleName)
                    ? command.Name
                    : command.ModuleName + "\\" + command.Name;
                powershell = true;
            }
            else
            {
                throw new Failure("ResolveCommand", "Unsupported command type: " + command.CommandType);
            }

            string application = resolved;
            string commandLine;
            if (batch)
            {
                application = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.System),
                    "cmd.exe"
                );
                commandLine = MakeBatCommandLine(application, resolved, arguments, false);
            }
            else if (scriptInfo != null)
            {
                application = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.System),
                    "WindowsPowerShell\\v1.0\\powershell.exe"
                );
                StringBuilder script = new StringBuilder(QuoteNative(application));
                script.Append(" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ")
                    .Append(QuoteNative(resolved));
                for (int i = 0; i < arguments.Length; i++)
                {
                    script.Append(' ').Append(QuoteNative(arguments[i]));
                }
                commandLine = script.ToString();
            }
            else if (powershell)
            {
                tempDirectory = Path.Combine(
                    Path.GetTempPath(),
                    "ps-supervisor-" + Guid.NewGuid().ToString("N")
                );
                Directory.CreateDirectory(tempDirectory);
                string request = Path.Combine(tempDirectory, "request.json");
                File.WriteAllText(
                    request,
                    json.Serialize(new Dictionary<string, object>
                    {
                        { "command", resolved },
                        { "arguments", arguments }
                    }),
                    utf8
                );
                application = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.System),
                    "WindowsPowerShell\\v1.0\\powershell.exe"
                );
                commandLine = QuoteNative(application)
                    + " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "
                    + QuoteNative(workerPath)
                    + " -RequestFile " + QuoteNative(request);
            }
            else
            {
                StringBuilder native = new StringBuilder(QuoteNative(application));
                for (int i = 0; i < arguments.Length; i++)
                {
                    native.Append(' ')
                        .Append(QuoteNative(arguments[i]));
                }
                commandLine = native.ToString();
            }

            if (commandLine.Length >= 32767)
            {
                throw new Failure(
                    "CommandLine",
                    "Launch command exceeds the Windows limit of 32766 UTF-16 code units plus NUL."
                );
            }

            CreateJob();

            IntPtr attributes = IntPtr.Zero, handlesMemory = IntPtr.Zero, jobsMemory = IntPtr.Zero;
            IntPtr[] handles = new IntPtr[3];
            bool initialized = false;
            Native.PROCESS_INFORMATION process = new Native.PROCESS_INFORMATION();
            try
            {
                handles[0] = StandardHandle(Native.STD_INPUT_HANDLE, true);
                handles[1] = StandardHandle(Native.STD_OUTPUT_HANDLE, false);
                handles[2] = StandardHandle(Native.STD_ERROR_HANDLE, false);

                UIntPtr bytes = UIntPtr.Zero;
                bool probe = Native.InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref bytes);

                int probeError = Marshal.GetLastWin32Error();
                if (probe || probeError != Native.ERROR_INSUFFICIENT_BUFFER)
                {
                    throw new Failure("InitializeProcThreadAttributeList", probeError);
                }

                attributes = Marshal.AllocHGlobal(checked((int)bytes.ToUInt64()));

                if (!Native.InitializeProcThreadAttributeList(attributes, 2, 0, ref bytes))
                {
                    throw Win32("InitializeProcThreadAttributeList");
                }

                initialized = true;

                handlesMemory = Marshal.AllocHGlobal(IntPtr.Size * handles.Length);
                Marshal.Copy(handles, 0, handlesMemory, handles.Length);

                jobsMemory = Marshal.AllocHGlobal(IntPtr.Size);
                Marshal.WriteIntPtr(jobsMemory, job);

                bool success = Native.UpdateProcThreadAttribute(
                    attributes,
                    0,
                    Native.HandleListAttribute,
                    handlesMemory,
                    new UIntPtr((uint)(IntPtr.Size * handles.Length)),
                    IntPtr.Zero,
                    IntPtr.Zero
                );

                if (!success)
                {
                    throw Win32("UpdateProcThreadAttribute(HANDLE_LIST)");
                }

                success = Native.UpdateProcThreadAttribute(
                    attributes,
                    0,
                    Native.JobListAttribute,
                    jobsMemory,
                    new UIntPtr((uint)IntPtr.Size),
                    IntPtr.Zero,
                    IntPtr.Zero
                );

                if (!success)
                {
                    throw Win32("UpdateProcThreadAttribute(JOB_LIST)");
                }

                Native.STARTUPINFOEX startup = new Native.STARTUPINFOEX();
                startup.StartupInfo.cb = (uint)Marshal.SizeOf(typeof(Native.STARTUPINFOEX));
                startup.StartupInfo.dwFlags = Native.STARTF_USESTDHANDLES;
                startup.StartupInfo.hStdInput = handles[0];
                startup.StartupInfo.hStdOutput = handles[1];
                startup.StartupInfo.hStdError = handles[2];
                startup.lpAttributeList = attributes;

                success = Native.CreateProcessW(
                    application,
                    new StringBuilder(commandLine, commandLine.Length + 1),
                    IntPtr.Zero,
                    IntPtr.Zero,
                    true,
                    Native.EXTENDED_STARTUPINFO_PRESENT | Native.CREATE_UNICODE_ENVIRONMENT,
                    IntPtr.Zero,
                    cwd,
                    ref startup,
                    out process
                );

                if (!success)
                {
                    throw Win32("CreateProcessW");
                }

                root = process.hProcess;
                launched = true;
                return process.dwProcessId;
            }
            finally
            {
                if (process.hThread != IntPtr.Zero)
                    Native.CloseHandle(process.hThread);
                foreach (IntPtr handle in handles)
                    if (handle != IntPtr.Zero)
                        Native.CloseHandle(handle);
                if (initialized)
                    Native.DeleteProcThreadAttributeList(attributes);
                if (attributes != IntPtr.Zero)
                    Marshal.FreeHGlobal(attributes);
                if (handlesMemory != IntPtr.Zero)
                    Marshal.FreeHGlobal(handlesMemory);
                if (jobsMemory != IntPtr.Zero)
                    Marshal.FreeHGlobal(jobsMemory);
            }
        }

        private bool IsJobEmpty()
        {
            Native.BASIC_ACCOUNTING accounting;
            uint returned;
            if (!Native.QueryInformationJobObject(
                job,
                Native.JobObjectBasicAccountingInformation,
                out accounting,
                (uint)Marshal.SizeOf(typeof(Native.BASIC_ACCOUNTING)),
                out returned))
            {
                throw Win32("QueryInformationJobObject(completion)");
            }
            return accounting.ActiveProcesses == 0;
        }

        private static Failure Invalid(string message)
        {
            return new Failure("ValidateRequest", message);
        }

        private Native.RM_UNIQUE_PROCESS[] SnapshotJobProcesses()
        {
            // The variable-length PID array begins after two DWORDs on both architectures.
            int capacity = 64;
            for (int attempt = 0; attempt < 16; attempt++)
            {
                int bytes = checked(8 + capacity * IntPtr.Size);
                IntPtr memory = Marshal.AllocHGlobal(bytes);
                try
                {
                    uint returned;
                    bool success = Native.QueryInformationJobObject(
                        job,
                        Native.JobObjectBasicProcessIdList,
                        memory,
                        (uint)bytes,
                        out returned
                    );

                    int error = success ? 0 : Marshal.GetLastWin32Error();

                    if (!success && error != Native.ERROR_MORE_DATA)
                    {
                        throw new Failure("QueryInformationJobObject", error);
                    }

                    int assigned = Marshal.ReadInt32(memory);
                    int count = Marshal.ReadInt32(memory, 4);
                    if (!success || assigned > count)
                    {
                        capacity = checked(Math.Max(capacity * 2, assigned));
                        continue;
                    }

                    List<Native.RM_UNIQUE_PROCESS> processes = new List<Native.RM_UNIQUE_PROCESS>();
                    for (int i = 0; i < count; i++)
                    {
                        uint pid = unchecked((uint)Marshal.ReadIntPtr(
                            memory,
                            8 + i * IntPtr.Size
                        ).ToInt64());

                        IntPtr process = Native.OpenProcess(
                            Native.PROCESS_QUERY_LIMITED_INFORMATION,
                            false,
                            pid
                        );

                        if (process == IntPtr.Zero)
                        {
                            error = Marshal.GetLastWin32Error();
                            if (error == Native.ERROR_INVALID_PARAMETER)
                            {
                                // The process has exited between the QueryInformationJobObject and OpenProcess calls.
                                continue;
                            }
                            throw new Failure("OpenProcess(stop)", error);
                        }

                        try
                        {
                            bool member;
                            if (!Native.IsProcessInJob(process, job, out member))
                            {
                                throw Win32("IsProcessInJob");
                            }

                            if (!member)
                            {
                                continue; // PID reused outside our job.
                            }

                            Native.FILETIME created, exited, kernel, user;
                            success = Native.GetProcessTimes(
                                process,
                                out created,
                                out exited,
                                out kernel,
                                out user
                            );
                            if (!success)
                            {
                                throw Win32("GetProcessTimes");
                            }

                            processes.Add(new Native.RM_UNIQUE_PROCESS
                            {
                                ProcessId = pid,
                                ProcessStartTime = created,
                            });
                        }
                        finally
                        {
                            Native.CloseHandle(process);
                        }
                    }

                    return processes.ToArray();
                }
                finally
                {
                    Marshal.FreeHGlobal(memory);
                }
            }

            throw new Failure("QueryInformationJobObject", "Job process list kept growing during stop snapshot.");
        }

        private Native.RM_UNIQUE_PROCESS[] SnapshotRootProcess()
        {
            uint wait = Native.WaitForSingleObject(root, 0);
            if (wait == Native.WAIT_OBJECT_0)
            {
                return new Native.RM_UNIQUE_PROCESS[0];
            }
            if (wait == Native.WAIT_FAILED)
            {
                throw Win32("WaitForSingleObject");
            }

            Native.FILETIME created, exited, kernel, user;
            if (!Native.GetProcessTimes(root, out created, out exited, out kernel, out user))
            {
                throw Win32("GetProcessTimes");
            }
            return new[] { new Native.RM_UNIQUE_PROCESS
            {
                ProcessId = rootPid,
                ProcessStartTime = created,
            } };
        }

        private void BeginStop(string id, string target)
        {
            Native.RM_UNIQUE_PROCESS[] processes;
            try
            {
                processes = target == "root" ? SnapshotRootProcess() : SnapshotJobProcesses();
            }
            catch (Exception e)
            {
                SendStopResult(new StopResult { RequestId = id, Error = e });
                return;
            }

            stopPending = true;
            shutdown = new Thread(delegate ()
            {
                StopResult result = new StopResult
                {
                    RequestId = id
                };
                uint session = 0;
                bool opened = false;
                try
                {
                    if (processes.Length != 0)
                    {
                        int error = Native.RmStartSession(
                            out session,
                            flags: 0,
                            key: new StringBuilder(Native.CCH_RM_SESSION_KEY + 1)
                        );
                        if (error != 0)
                        {
                            throw new Failure("RmStartSession", error);
                        }

                        opened = true;

                        error = Native.RmRegisterResources(
                            session,
                            files: 0,
                            fileNames: IntPtr.Zero,
                            count: (uint)processes.Length,
                            processes: processes,
                            services: 0,
                            names: IntPtr.Zero
                        );
                        if (error != 0)
                        {
                            throw new Failure("RmRegisterResources", error);
                        }

                        if (!stopping.IsCancellationRequested)
                        {
                            error = Native.RmShutdown(
                                session,
                                flags: Native.RM_SHUTDOWN_GRACEFUL,
                                callback: IntPtr.Zero
                            );
                            if (error != 0)
                            {
                                throw new Failure("RmShutdown", error);
                            }
                        }
                    }
                }
                catch (Exception e)
                {
                    result.Error = e;
                }
                finally
                {
                    if (opened)
                    {
                        int error = Native.RmEndSession(session);
                        if (error != 0 && result.Error == null)
                        {
                            result.Error = new Failure("RmEndSession", error);
                        }
                    }
                }

                Enqueue(result);
            });
            shutdown.IsBackground = true;
            shutdown.Start();
        }

        private void SendStopResult(StopResult result)
        {
            stopPending = false;
            stopSucceeded = result.Error == null;
            Dictionary<string, object> response = Message("stopResult");
            response["requestId"] = result.RequestId;
            response["success"] = stopSucceeded;
            if (result.Error != null)
            {
                response["error"] = Error(result.Error, result.RequestId, false);
            }
            Send(response);
        }

        private void Request(string text)
        {
            Dictionary<string, object> request;
            try
            {
                request = json.DeserializeObject(text) as Dictionary<string, object>;
            }
            catch (Exception e)
            {
                throw new Failure("ParseJSON", e.Message);
            }

            if (request == null)
            {
                throw new Failure("ParseJSON", "A request must be a JSON object.");
            }

            object value;
            string id = request.TryGetValue("requestId", out value) ? value as string : null;

            try
            {
                if (String.IsNullOrWhiteSpace(id))
                {
                    throw Invalid("requestId must be a nonempty string.");
                }

                string type = request.TryGetValue("type", out value)
                    ? value as string
                    : null;

                if (type == "stop")
                {
                    if (stopSeen)
                    {
                        throw Invalid("Stop already handled.");
                    }

                    stopSeen = true;

                    if (!launched)
                    {
                        throw Invalid("Stop before start.");
                    }

                    if (terminateSeen)
                    {
                        throw Invalid("Stop after termination request.");
                    }

                    string target = "all";
                    if (request.TryGetValue("target", out value))
                    {
                        target = value as string;
                        if (target != "all" && target != "root")
                        {
                            throw Invalid("target must be either 'root' or 'all'.");
                        }
                    }

                    BeginStop(id, target);
                }
                else if (type == "terminate")
                {
                    if (terminateSeen)
                    {
                        throw Invalid("Termination already handled.");
                    }

                    terminateSeen = true;

                    uint code = 1;
                    if (request.TryGetValue("exitCode", out value))
                    {
                        if (!(value is int || value is long || value is decimal))
                        {
                            throw Invalid("exitCode must be an unsigned 32-bit integer.");
                        }
                        decimal number = Convert.ToDecimal(value);
                        if (number < 0 || number > UInt32.MaxValue || Decimal.Truncate(number) != number)
                        {
                            throw Invalid("exitCode must be an unsigned 32-bit integer.");
                        }

                        code = (uint)number;
                    }

                    if (!launched)
                    {
                        throw Invalid("Termination before start.");
                    }

                    Dictionary<string, object> response = Message("terminationResult");
                    response["requestId"] = id;

                    bool success = Native.TerminateJobObject(job, code);

                    int error = success ? 0 : Marshal.GetLastWin32Error();
                    response["success"] = success;
                    if (success)
                    {
                        terminationSucceeded = true;
                    }
                    else
                    {
                        response["error"] = Error(
                            new Failure("TerminateJobObject", error),
                            id,
                            false
                        );
                    }
                    Send(response);
                }
                else
                {
                    throw Invalid("Unknown request type.");
                }
            }
            catch (Failure e)
            {
                if (e.Operation != "ValidateRequest")
                {
                    throw;
                }
                Send(Error(e, id, false));
            }
        }

        public static int Run(
            string pipeName,
            string workerPath,
            CommandInfo command,
            string[] arguments,
            string resolutionError
        )
        {
            using (Supervisor supervisor = new Supervisor())
            {
                return supervisor.Execute(pipeName, workerPath, command, arguments, resolutionError);
            }
        }

        private int Execute(
            string pipeName,
            string worker,
            CommandInfo command,
            string[] arguments,
            string resolutionError
        )
        {
            workerPath = worker;
            try
            {
                pipe = new NamedPipeClientStream(
                    ".",
                    pipeName,
                    PipeDirection.InOut,
                    PipeOptions.Asynchronous
                );

                pipe.Connect(ConnectTimeoutMs);

                Dictionary<string, object> ready = Message("ready");
                ready["version"] = 2;
                ready["supervisorPid"] = Native.GetCurrentProcessId();

                Send(ready);

                reader = new Thread(ReadLoop);
                reader.IsBackground = true;
                reader.Start();

                if (!String.IsNullOrEmpty(resolutionError))
                {
                    throw new Failure("ResolveCommand", resolutionError);
                }

                uint pid = Launch(command, arguments, Environment.CurrentDirectory);
                rootPid = pid;
                Dictionary<string, object> started = Message("started");
                started["rootPid"] = pid;
                Send(started);

                Stopwatch completionClock = Stopwatch.StartNew();
                long nextCompletionCheck = CompletionCheckIntervalMs;
                while (true)
                {
                    int timeout = jobEmpty ? Timeout.Infinite : (int)Math.Max(
                        0L, nextCompletionCheck - completionClock.ElapsedMilliseconds);
                    object item;
                    events.TryTake(out item, timeout);

                    Exception error = item as Exception;
                    if (error != null)
                    {
                        throw error;
                    }

                    Frame frame = item as Frame;
                    if (frame != null)
                    {
                        Request(frame.Text);
                    }

                    StopResult stopResult = item as StopResult;
                    if (stopResult != null)
                    {
                        SendStopResult(stopResult);
                    }

                    if (item is EmptyJob && launched)
                    {
                        jobEmpty = true;
                    }

                    // Job notifications are not guaranteed.
                    // Hence, we periodically check if all the job processes have exited.
                    // This way we ensure the loop ends even if no notification is received.
                    if (!jobEmpty && completionClock.ElapsedMilliseconds >= nextCompletionCheck)
                    {
                        jobEmpty = IsJobEmpty();
                        nextCompletionCheck = completionClock.ElapsedMilliseconds + CompletionCheckIntervalMs;
                    }

                    // Preserve result-before-completed ordering when shutdown itself empties the job.
                    if (jobEmpty && (!stopPending || terminationSucceeded))
                    {
                        uint code;
                        // The job is already empty; this is a zero-time verification, never a root wait.
                        uint wait = Native.WaitForSingleObject(root, 0);
                        if (wait == Native.WAIT_FAILED)
                        {
                            throw Win32("WaitForSingleObject");
                        }

                        if (wait != Native.WAIT_OBJECT_0)
                        {
                            throw new Failure(
                                "JobCompletion",
                                "Root was not signaled when the job became empty."
                            );
                        }

                        if (!Native.GetExitCodeProcess(root, out code))
                        {
                            throw Win32("GetExitCodeProcess");
                        }

                        Dictionary<string, object> completed = Message("completed");
                        completed["rootExitCode"] = code;
                        completed["reason"] = terminationSucceeded
                            ? "terminated"
                            : stopSucceeded
                                ? "stopped"
                                : "normal";

                        Send(completed);

                        return 0;
                    }
                }
            }
            catch (Exception e)
            {
                try
                {
                    if (pipe != null && pipe.IsConnected)
                    {
                        Send(Error(e, null, true));
                    }
                }
                catch
                {
                }

                if (job != IntPtr.Zero)
                {
                    Native.TerminateJobObject(job, 1);
                }

                return 1;
            }
        }

        public void Dispose()
        {
            stopping.Cancel();

            if (pipe != null)
            {
                pipe.Dispose();
            }

            // Closing the sole owning handle is the final safety net on every failure path.
            if (job != IntPtr.Zero)
            {
                Native.CloseHandle(job);
                job = IntPtr.Zero;
            }

            if (port != IntPtr.Zero)
            {
                Native.PostQueuedCompletionStatus(port, 0, Native.StopKey, IntPtr.Zero);
            }

            if (reader != null)
            {
                reader.Join(1000);
            }

            if (monitor != null)
            {
                monitor.Join(1000);
            }

            // Give an interrupted RM call a bounded chance to end its session after job cleanup.
            if (shutdown != null)
            {
                shutdown.Join(1000);
            }

            if (root != IntPtr.Zero)
            {
                Native.CloseHandle(root);
            }

            if (port != IntPtr.Zero)
            {
                Native.CloseHandle(port);
            }

            if (tempDirectory != null)
            {
                try
                {
                    Directory.Delete(tempDirectory, true);
                }
                catch
                {
                }
            }
        }
    }
}
'@

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
