using System;
using System.Linq;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Globalization;

namespace Allure.Run.Supervisor.Windows
{
    public sealed class Failure : Exception
    {
        public readonly string Operation;
        public readonly int? NativeError;
        public Failure(string operation, string message) : base(message)
        {
            Operation = operation;
        }

        public Failure(string operation, int error) : base(
            string.Format(
                "WinAPI call '{0}' failed: {1}",
                operation,
                new Win32Exception(error).Message
            )
        )
        {
            Operation = operation;
            NativeError = error;
        }
    }

    internal static class Native
    {
        // Console control events
        internal const uint CTRL_C_EVENT = 0;

        [UnmanagedFunctionPointer(CallingConvention.Winapi)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal delegate bool ConsoleCtrlHandler(uint controlType);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool SetConsoleCtrlHandler(
            ConsoleCtrlHandler handler,
            [MarshalAs(UnmanagedType.Bool)] bool add
        );

        // Job objects and completion ports
        internal const uint KILL_ON_JOB_CLOSE = 0x2000;
        internal const int JobObjectBasicAccountingInformation = 1;
        internal const int JobObjectAssociateCompletionPortInformation = 7;
        internal const int JobObjectExtendedLimitInformation = 9;
        internal const uint JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO = 4;
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

        internal delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool PostMessageW(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);

        internal const uint WM_CLOSE = 0x0010;

        // PE inspection
        internal const ushort IMAGE_DOS_SIGNATURE = 0x5A4D; // 'MZ' in little-endian
        internal const uint E_LFANEW_OFFSET = 0x3C;
        internal const uint PE_SIGNATURE = 0x00004550; // 'PE\0\0' in little-endian
        internal const uint COFF_SIZE_OF_OPTIONAL_HEADER_OFFSET = 16;
        internal const uint COFF_FILE_HEADER_SIZE = 20;
        internal const uint PE_MAGIC_PE32 = 0x10B;
        internal const uint PE_MAGIC_PE32_PLUS = 0x20B;
        internal const uint PE_HEADER_SUBSYSTEM_OFFSET = 68;
        internal const ushort IMAGE_SUBSYSTEM_WINDOWS_GUI = 2;

        // Process creation and inspection
        internal const uint CREATE_NEW_CONSOLE = 0x10;
        internal const uint CREATE_UNICODE_ENVIRONMENT = 0x400;
        internal const uint EXTENDED_STARTUPINFO_PRESENT = 0x80000;
        internal const uint STARTF_USESHOWWINDOW = 0x1;
        internal const uint STARTF_USESTDHANDLES = 0x100;
        internal const ushort SW_HIDE = 0;
        internal static readonly IntPtr HandleListAttribute = new IntPtr(0x20002);
        internal static readonly IntPtr JobListAttribute = new IntPtr(0x2000d);

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
        internal static extern bool GetExitCodeProcess(IntPtr process, out uint code);


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

    public sealed class WindowsProcessHost : IDisposable
    {
        public const int MaxMessageBytes = 1048576;
        public const string CMD_UNQUOTED = @"#$*+-./:?@\_";

        private static readonly string[] CommandExtensions = { ".exe", ".ps1", ".bat", ".cmd" };

        public static string ResolveCommandPath(string command)
        {
            if (string.IsNullOrWhiteSpace(command))
            {
                throw new ArgumentException("Command must not be blank.", "command");
            }

            bool probeExtensions = !HasSupportedCommandExtension(command);
            string resolved = IsCommandPath(command)
                ? ProbeCommandPath(command, probeExtensions)
                : ProbeBareCommand(command, probeExtensions);

            if (resolved != null)
            {
                return resolved;
            }

            throw new Failure("resolveCommand", "Command not found: " + command);
        }

        private static bool IsCommandPath(string command)
        {
            return command.IndexOf(Path.DirectorySeparatorChar) >= 0
                || command.IndexOf(Path.AltDirectorySeparatorChar) >= 0
                || Path.IsPathRooted(command);
        }

        private static bool HasSupportedCommandExtension(string command)
        {
            string extension = Path.GetExtension(command);
            if (string.Equals(extension, ".com", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            foreach (string supported in CommandExtensions)
            {
                if (string.Equals(extension, supported, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static string ProbeBareCommand(string command, bool probeExtensions)
        {
            string searchPath = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string entry in searchPath.Split(Path.PathSeparator))
            {
                string directory = entry;
                if (directory.Length >= 2 && directory[0] == '"' && directory[directory.Length - 1] == '"')
                {
                    directory = directory.Substring(1, directory.Length - 2);
                }
                if (directory.Length == 0)
                {
                    continue;
                }

                try
                {
                    string commandPath = ProbeCommandPath(Path.Combine(directory, command), probeExtensions);
                    if (commandPath != null)
                    {
                        return commandPath;
                    }
                }
                catch (ArgumentException)
                {
                    continue;
                }
                catch (NotSupportedException)
                {
                    continue;
                }
                catch (PathTooLongException)
                {
                    continue;
                }
            }

            return null;
        }

        private static string ProbeCommandPath(string path, bool probeExtensions)
        {
            if (probeExtensions)
            {
                foreach (string extension in CommandExtensions)
                {
                    string candidate = path + extension;
                    if (File.Exists(candidate))
                    {
                        return Path.GetFullPath(candidate);
                    }
                }
            }
            else if (File.Exists(path))
            {
                return Path.GetFullPath(path);
            }

            return null;
        }

        private static string PowerShellPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            "WindowsPowerShell\\v1.0\\powershell.exe"
        );

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
        private Process signalDelivery;
        private readonly object gracefulStopLock = new object();
        private bool stopCancelled = false;
        private bool isGuiApplication = false;
        // Reserved helper exit code: AttachConsole found no console.
        private const int ConsoleSignalInapplicable = 0x20000001;

        private enum StopOutcome { Success, Failure, Inapplicable }
        private IntPtr job, port, root;
        private uint rootPid;

        // CTRL+C handling
        // Keep the native callback rooted, including during cleanup or a failed removal.
        private static readonly Native.ConsoleCtrlHandler ctrlHandler = HandleConsoleControl;

        // Lifecycle state
        private bool ctrlHandlerRegistered;
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

        private readonly Stopwatch startupClock = Stopwatch.StartNew();
        private readonly Stopwatch startupStageClock = Stopwatch.StartNew();

        private void StartupTiming(string stage)
        {
            if (Environment.GetEnvironmentVariable("ALLURE_SUPERVISOR_TIMINGS") == "1")
            {
                Console.Error.WriteLine(
                    "[AllureSupervisorTiming] {0:o} csharp {1}: {2} ms stage, {3} ms since host entry",
                    DateTime.UtcNow, stage, startupStageClock.ElapsedMilliseconds, startupClock.ElapsedMilliseconds
                );
            }
            startupStageClock.Restart();
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

        private static Dictionary<string, object> Error(Exception exception, string requestId, bool fatal)
        {
            Failure failure = exception as Failure;
            Dictionary<string, object> result = Message("error");
            if (requestId != null)
                result["requestId"] = requestId;
            result["operation"] = failure == null ? "ProcessHost" : failure.Operation;
            result["message"] = exception.Message;
            result["fatal"] = fatal;
            if (failure != null && failure.NativeError.HasValue)
                result["win32Error"] = failure.NativeError.Value;
            return result;
        }

        private static bool IsGuiApplication(string path)
        {
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
            using (var reader = new BinaryReader(stream))
            {
                long length = stream.Length;
                long minLength = Native.E_LFANEW_OFFSET + 4;
                if (length < minLength)
                {
                    return false;
                }

                if (reader.ReadUInt16() != Native.IMAGE_DOS_SIGNATURE) // 'MZ' in little-endian
                {
                    return false;
                }

                stream.Seek(Native.E_LFANEW_OFFSET, SeekOrigin.Begin);

                uint signatureOffset = reader.ReadUInt32(); // Read the e_lfanew field (offset to PE header)
                long optionalHeaderOffset = minLength = (long)signatureOffset + 4 + Native.COFF_FILE_HEADER_SIZE;
                if (length < minLength)
                {
                    return false;
                }

                stream.Seek(signatureOffset, SeekOrigin.Begin);
                if (reader.ReadUInt32() != Native.PE_SIGNATURE) // 'PE\0\0' in little-endian
                {
                    return false;
                }

                stream.Seek(Native.COFF_SIZE_OF_OPTIONAL_HEADER_OFFSET, SeekOrigin.Current);

                ushort optionalHeaderSize = reader.ReadUInt16();
                if (optionalHeaderSize < Native.PE_HEADER_SUBSYSTEM_OFFSET + 2)
                {
                    return false;
                }

                minLength += optionalHeaderSize;
                if (length < minLength)
                {
                    return false;
                }

                stream.Seek(optionalHeaderOffset, SeekOrigin.Begin);
                uint magicField = reader.ReadUInt16();
                if (magicField != Native.PE_MAGIC_PE32 && magicField != Native.PE_MAGIC_PE32_PLUS)
                {
                    return false;
                }

                stream.Seek(optionalHeaderOffset + Native.PE_HEADER_SUBSYSTEM_OFFSET, SeekOrigin.Begin);
                uint subsystem = reader.ReadUInt16();

                return subsystem == Native.IMAGE_SUBSYSTEM_WINDOWS_GUI;
            }
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
            IEnumerable<string> arguments,
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

        private uint Launch(string command, IEnumerable<string> arguments, string cwd)
        {
            bool powershell = false;
            bool batch = false;

            string extension = Path.GetExtension(command);

            switch (Path.GetExtension(command).ToLowerInvariant())
            {
                case ".exe":
                case ".com":
                    isGuiApplication = IsGuiApplication(command);
                    break;
                case ".ps1":
                    powershell = true;
                    break;
                case ".cmd":
                case ".bat":
                    batch = true;
                    break;
                default:
                    throw new Failure(
                        "ResolveCommand",
                        "Unsupported command type: " + command
                    );
            }

            string application = command;
            string commandLine;
            if (batch)
            {
                application = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.System),
                    "cmd.exe"
                );
                commandLine = MakeBatCommandLine(application, command, arguments, false);
            }
            else if (powershell)
            {
                application = PowerShellPath;

                StringBuilder script = new StringBuilder(QuoteNative(application));
                script.Append(" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ")
                    .Append(QuoteNative(command));

                foreach (string argument in arguments)
                {
                    script.Append(' ').Append(QuoteNative(argument));
                }

                commandLine = script.ToString();
            }
            else
            {
                StringBuilder native = new StringBuilder(QuoteNative(application));
                foreach (string argument in arguments)
                {
                    native.Append(' ')
                        .Append(QuoteNative(argument));
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

            StartupTiming("command preparation");
            CreateJob();
            StartupTiming("job creation");

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
                if (!isGuiApplication)
                {
                    startup.StartupInfo.dwFlags |= Native.STARTF_USESHOWWINDOW;
                    startup.StartupInfo.wShowWindow = Native.SW_HIDE;
                }
                startup.lpAttributeList = attributes;

                StartupTiming("process attributes and handles");
                success = Native.CreateProcessW(
                    application,
                    new StringBuilder(commandLine, commandLine.Length + 1),
                    IntPtr.Zero,
                    IntPtr.Zero,
                    true,
                    Native.CREATE_NEW_CONSOLE
                        | Native.CREATE_UNICODE_ENVIRONMENT
                        | Native.EXTENDED_STARTUPINFO_PRESENT,
                    IntPtr.Zero,
                    cwd,
                    ref startup,
                    out process
                );

                StartupTiming("CreateProcessW");
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

        private StopOutcome StopWithConsoleSignal(out Exception error)
        {
            error = null;
            try
            {
                lock (gracefulStopLock)
                {
                    if (stopCancelled)
                    {
                        throw new OperationCanceledException("Graceful stop was cancelled.");
                    }
                    signalDelivery = Process.Start(new ProcessStartInfo
                    {
                        FileName = Assembly.GetExecutingAssembly().Location,
                        Arguments = "signal " + rootPid.ToString(CultureInfo.InvariantCulture),
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });
                }

                signalDelivery.WaitForExit();

                int code = signalDelivery.ExitCode;

                if (code == 0)
                {
                    return StopOutcome.Success;
                }

                if (code == ConsoleSignalInapplicable)
                {
                    return StopOutcome.Inapplicable;
                }

                error = new Failure("SendConsoleSignal", code);
            }
            catch (Exception e)
            {
                error = e;
            }

            return StopOutcome.Failure;
        }

        private StopOutcome StopWithWindowClose(out Exception error)
        {
            Exception failure = null;
            bool found = false;
            try
            {
                bool enumerated = Native.EnumWindows(delegate (IntPtr window, IntPtr parameter)
                {
                    uint pid;
                    if (Native.GetWindowThreadProcessId(window, out pid) == 0 || pid != rootPid)
                    {
                        return true;
                    }

                    lock (gracefulStopLock)
                    {
                        if (stopCancelled)
                        {
                            failure = new OperationCanceledException("Graceful stop was cancelled.");
                            return false;
                        }

                        found = true;

                        if (!Native.PostMessageW(window, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero))
                        {
                            failure = Win32("PostMessageW(WM_CLOSE)");
                            return false;
                        }
                    }

                    return true;
                }, IntPtr.Zero);

                if (!enumerated && failure == null)
                {
                    failure = Win32("EnumWindows");
                }
            }
            catch (Exception e)
            {
                failure = e;
            }

            error = failure;
            return failure != null
                ? StopOutcome.Failure
                : found
                    ? StopOutcome.Success
                    : StopOutcome.Inapplicable;
        }

        private void BeginStop(string id)
        {
            uint wait = Native.WaitForSingleObject(root, 0);
            if (wait == Native.WAIT_OBJECT_0)
            {
                SendStopResult(new StopResult { RequestId = id });
                return;
            }

            if (wait == Native.WAIT_FAILED)
            {
                SendStopResult(new StopResult { RequestId = id, Error = Win32("WaitForSingleObject") });
                return;
            }

            stopPending = true;
            shutdown = new Thread(delegate ()
            {
                StopResult result = new StopResult { RequestId = id };
                StopOutcome outcome = isGuiApplication
                    ? StopWithWindowClose(out result.Error)
                    : StopWithConsoleSignal(out result.Error);

                if (outcome == StopOutcome.Inapplicable)
                {
                    outcome = isGuiApplication
                        ? StopWithConsoleSignal(out result.Error)
                        : StopWithWindowClose(out result.Error);
                }

                if (outcome == StopOutcome.Inapplicable)
                {
                    result.Error = new Failure("Stop", "The root process has no console or top-level windows.");
                }

                Enqueue(result);
            });
            shutdown.IsBackground = true;
            shutdown.Start();
        }

        private void TerminateSendConsoleSignal()
        {
            lock (gracefulStopLock)
            {
                stopCancelled = true;
                if (signalDelivery != null && !signalDelivery.HasExited)
                {
                    try
                    {
                        signalDelivery.Kill();
                    }
                    catch (InvalidOperationException)
                    {
                        if (!signalDelivery.HasExited)
                        {
                            throw;
                        }
                    }
                }
            }
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

                    BeginStop(id);
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

                    TerminateSendConsoleSignal();
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

        private static int Run(string pipeName, string command, IEnumerable<string> arguments)
        {
            using (WindowsProcessHost host = new WindowsProcessHost())
            {
                return host.Execute(pipeName, command, arguments);
            }
        }

        private static int Signal(uint processId)
        {
            Native.FreeConsole();

            if (!Native.AttachConsole(processId))
            {
                int error = Marshal.GetLastWin32Error();
                if (error == 6)
                {
                    // The target does not have a console.
                    return 0x20000001;
                }

                return error;
            }

            if (!Native.SetConsoleCtrlHandler(null, true)
                || !Native.GenerateConsoleCtrlEvent(Native.CTRL_C_EVENT, 0))
            {
                return Marshal.GetLastWin32Error();
            }

            return 0;
        }

        public static int Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.Error.WriteLine("No arguments provided to the process host.");
                return 87;
            }

            string mode = args[0];

            if (mode == "run")
            {
                if (args.Length < 3)
                {
                    Console.Error.WriteLine("Not enough arguments for the process host 'run' mode.");
                    return 87;
                }

                return Run(args[1], args[2], args.Skip(3));
            }
            else if (mode == "signal")
            {
                if (args.Length < 2)
                {
                    Console.Error.WriteLine("Not enough arguments for the process host 'signal' mode.");
                    return 87;
                }

                uint processId;
                if (!uint.TryParse(args[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out processId))
                {
                    Console.Error.WriteLine("Invalid process ID for the process host 'signal' mode.");
                    return 87;
                }

                return Signal(processId);
            }
            else
            {
                Console.Error.WriteLine(
                    string.Format(
                        "Unknown process host mode: '{0}'",
                        mode
                    )
                );
                return 1;
            }
        }

        private static bool HandleConsoleControl(uint controlType)
        {
            // The Node.js implement the escalation policy.
            // The PowerShell part must survive CTRL+C.
            return controlType == Native.CTRL_C_EVENT;
        }

        private void UnregisterConsoleCtrlHandler()
        {
            if (ctrlHandlerRegistered)
            {
                // Ignore any errors as we're about to exit anyway.
                Native.SetConsoleCtrlHandler(ctrlHandler, false);
                ctrlHandlerRegistered = false;
            }
        }

        private int Execute(string pipeName, string command, IEnumerable<string> arguments)
        {
            StartupTiming("process host entry");
            try
            {
                if (!Native.SetConsoleCtrlHandler(ctrlHandler, true))
                {
                    throw Win32("SetConsoleCtrlHandler(add)");
                }

                ctrlHandlerRegistered = true;

                pipe = new NamedPipeClientStream(
                    ".",
                    pipeName,
                    PipeDirection.InOut,
                    PipeOptions.Asynchronous
                );

                StartupTiming("console handler and pipe setup");
                pipe.Connect(ConnectTimeoutMs);
                StartupTiming("pipe connection");

                Dictionary<string, object> ready = Message("ready");
                ready["version"] = 2;
                ready["hostPid"] = Native.GetCurrentProcessId();

                Send(ready);
                StartupTiming("ready sent");

                reader = new Thread(ReadLoop);
                reader.IsBackground = true;
                reader.Start();

                string resolved = ResolveCommandPath(command);

                uint pid = Launch(resolved, arguments, Environment.CurrentDirectory);
                rootPid = pid;
                Dictionary<string, object> started = Message("started");
                started["rootPid"] = pid;
                Send(started);
                StartupTiming("launch completion and started sent");

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
            try
            {
                stopping.Cancel();
                TerminateSendConsoleSignal();

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

                if (shutdown != null)
                {
                    shutdown.Join();
                }

                if (signalDelivery != null)
                {
                    signalDelivery.Dispose();
                }

                if (root != IntPtr.Zero)
                {
                    Native.CloseHandle(root);
                }

                if (port != IntPtr.Zero)
                {
                    Native.CloseHandle(port);
                }
            }
            finally
            {
                UnregisterConsoleCtrlHandler();
            }
        }
    }
}
