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
        internal const int JobObjectBasicProcessIdList = 3;
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

        internal const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool QueryFullProcessImageNameW(
            IntPtr process,
            uint flags,
            StringBuilder name,
            ref uint size
        );

        [DllImport("ntdll.dll")]
        internal static extern int NtQueryInformationProcess(
            IntPtr process,
            int kind,
            IntPtr info,
            uint size,
            out uint returned
        );

        [StructLayout(LayoutKind.Sequential)]
        internal struct UNICODE_STRING
        {
            public ushort Length, MaximumLength;
            public IntPtr Buffer;
        }

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
        internal static extern bool PostMessageW(
            IntPtr window,
            uint message,
            IntPtr wParam,
            IntPtr lParam
        );

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
        internal const int ERROR_ACCESS_DENIED = 5;
        internal const int ERROR_INVALID_HANDLE = 6;
        internal const int ERROR_INVALID_PARAMETER = 87;
        internal const int ERROR_BROKEN_PIPE = 109;
        internal const int ERROR_INSUFFICIENT_BUFFER = 122;
        internal const int ERROR_NO_DATA = 232;
        internal const int ERROR_NOT_FOUND = 1168;

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

        internal const uint FILE_TYPE_CHAR = 0x0002;
        internal const uint FILE_TYPE_UNKNOWN = 0x0000;

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern uint GetFileType(IntPtr handle);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool GetConsoleMode(IntPtr handle, out uint mode);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool CreatePipe(
            out IntPtr readPipe,
            out IntPtr writePipe,
            IntPtr attributes,
            uint size
        );

        [DllImport("kernel32.dll")]
        internal static extern IntPtr GetCurrentThread();

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CancelSynchronousIo(IntPtr thread);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool ReadFile(
            IntPtr handle,
            [Out] byte[] buffer,
            uint size,
            out uint read,
            IntPtr overlapped
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool WriteFile(
            IntPtr handle,
            IntPtr buffer,
            uint size,
            out uint written,
            IntPtr overlapped
        );

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool ReadConsoleW(
            IntPtr handle,
            [Out] char[] buffer,
            uint size,
            out uint read,
            IntPtr control
        );

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool WriteConsoleW(
            IntPtr handle,
            string buffer,
            uint size,
            out uint written,
            IntPtr reserved
        );

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

    internal sealed class WindowsProcessHost : IDisposable
    {
        internal const int MaxMessageBytes = 1048576;
        internal const string CMD_UNQUOTED = @"#$*+-./:?@\_";

        private static readonly string[] CommandExtensions = { ".exe", ".ps1", ".bat", ".cmd" };

        private static string PowerShellPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            "WindowsPowerShell\\v1.0\\powershell.exe"
        );

        // Communication and event delivery.
        // The host uses JavaScriptSerializer.
        // The newer System.Text.Json is not available in .NET Framework 4.5.
        private readonly JavaScriptSerializer json = new JavaScriptSerializer
        {
            MaxJsonLength = MaxMessageBytes,
            RecursionLimit = 64
        };
        private readonly BlockingCollection<object> events = new BlockingCollection<object>(64);
        private readonly CancellationTokenSource stopping = new CancellationTokenSource();
        private readonly List<ConsoleRelay> consoleRelays = new List<ConsoleRelay>();
        private readonly UTF8Encoding utf8 = new UTF8Encoding(false, true);
        private NamedPipeClientStream pipe;
        private const int ConnectTimeoutMs = 10000;
        private const int WriteTimeoutMs = 5000;
        private const int CompletionCheckIntervalMs = 2000;
        private const int DiagnosticIntervalMs = 30000;
        private const int SignalDeliveryTimeoutMs = 10000;
        private const int ShutdownCleanupTimeoutMs = 1000;
        private readonly bool diagnosticsEnabled =
            Environment.GetEnvironmentVariable("__ALLURE_PROCESS_HOST_DIAGNOSTICS__") == "1";

        private readonly object diagnosticFileLock = new object();
        private readonly string diagnosticFilePath =
            Environment.GetEnvironmentVariable("__ALLURE_PROCESS_HOST_DIAGNOSTICS_FILE__");

        private static readonly TimeSpan terminationOutputDrainGracePeriod = TimeSpan.FromSeconds(1);

        // Background threads and process resources
        private Thread reader;
        private Thread monitor;
        private Thread shutdown;
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

        private bool launched;

        private bool stopSeen;
        private bool stopPending;
        private bool stopSucceeded;

        private bool terminateSeen;
        private readonly Stopwatch terminationTimer = new Stopwatch();
        private bool terminationSucceeded;

        private bool jobEmpty;

        private bool cleanupFailed = false;

        internal bool CleanupFailed { get { return this.cleanupFailed; } }

        private bool ShouldAbandonOutput
        {
            get
            {
                return this.terminationTimer.Elapsed > terminationOutputDrainGracePeriod;
            }
        }

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

        // Pipes console data between the host and the target process not sharing the console.
        private abstract class ConsoleRelay : IDisposable
        {
            internal const int CancellationCompletionTimeoutMs = 3000;
            private readonly IntPtr console;
            private readonly IntPtr pipe;
            private readonly Action<Exception> onFatalError;
            private readonly Action<Exception> onError;
            private readonly ManualResetEvent ready = new ManualResetEvent(false);
            private readonly string name;
            private bool cleanupFailed = false;
            private bool cancellationErrorReported = false;

            private Thread worker;
            private IntPtr nativeThread;
            private volatile bool cancelled;
            private Exception error;
            private readonly Stopwatch cancellationTimer = new Stopwatch();

            internal string Name { get { return this.name; } }
            protected IntPtr Console { get { return this.console; } }
            protected IntPtr Pipe { get { return this.pipe; } }
            protected bool Cancelled { get { return this.cancelled; } }
            protected Exception Error { get { return this.error; } }
            internal bool CleanupFailed { get { return this.cleanupFailed; } }
            internal bool CancellationTimedOut
            {
                get
                {
                    return this.cancelled
                        && this.cancellationTimer.ElapsedMilliseconds > CancellationCompletionTimeoutMs;
                }
            }

            internal ConsoleRelay(
                string name,
                IntPtr console,
                IntPtr pipe,
                Action<Exception> onFatalError,
                Action<Exception> onError
            )
            {
                this.name = name;
                this.console = console;
                this.pipe = pipe;
                this.onFatalError = onFatalError;
                this.onError = onError;
            }

            internal void Start()
            {
                this.worker = new Thread(Run);
                this.worker.IsBackground = true;
                this.worker.Start();

                this.ready.WaitOne();

                if (this.nativeThread == IntPtr.Zero)
                {
                    throw this.error;
                }
            }

            internal void RequestCancellation()
            {
                this.cancelled = true;
                this.cancellationTimer.Start();

                Failure error = this.CancelSynchronousIo();
                if (error != null && !this.cancellationErrorReported)
                {
                    this.cancellationErrorReported = true;
                    this.onError(error);
                }
            }

            private void Run()
            {
                try
                {
                    bool success = Native.DuplicateHandle(
                        sourceProcess: Native.GetCurrentProcess(),
                        source: Native.GetCurrentThread(),
                        targetProcess: Native.GetCurrentProcess(),
                        target: out this.nativeThread,
                        access: 0,
                        inherit: false,
                        options: Native.DUPLICATE_SAME_ACCESS
                    );

                    if (!success)
                    {
                        throw Win32(this.FormatOperation("DuplicateHandle(relay thread)"));
                    }

                    this.ready.Set();

                    this.Forward();
                }
                catch (Exception failure)
                {
                    if (!this.cancelled)
                    {
                        this.error = failure;
                        this.onFatalError(failure);
                    }
                }
                finally
                {
                    this.ready.Set();
                    // Closing input's write end delivers EOF; closing output's
                    // read end releases the last relay-owned pipe handle.
                    Native.CloseHandle(this.pipe);
                }
            }

            protected bool Join(int timeout)
            {
                return this.worker.Join(timeout);
            }

            protected abstract void Forward();

            internal virtual bool TryFinishDraining()
            {
                return true;
            }

            internal string FormatOperation(string operation)
            {
                return string.Format(
                    "ConsoleRelay({0}).{1}",
                    this.name,
                    operation
                );
            }

            public void Dispose()
            {
                this.cancelled = true;
                this.cancellationTimer.Start();

                if (this.worker == null)
                {
                    Native.CloseHandle(pipe);
                }
                else
                {
                    while (!this.worker.Join(10))
                    {
                        if (this.CancellationTimedOut)
                        {
                            this.cleanupFailed = true;
                            this.onError(
                                new Failure(
                                    this.FormatOperation("Dispose()"),
                                    string.Format(
                                        "The relay worker did not exit within {0} "
                                            + "second(s) after cancellation was requested.",
                                        CancellationCompletionTimeoutMs / 1000
                                    )
                                )
                            );

                            // The worker is still running. Avoid cleaning up its resources.
                            // It's a background thread, which does not keep the process alive.
                            // When the process exits, Windows reclaims its resources.
                            return;
                        }

                        // Retry because the worker may enter synchronous I/O between cancellation attempts.
                        this.RequestCancellation();
                    }
                }

                if (this.nativeThread != IntPtr.Zero)
                {
                    Native.CloseHandle(this.nativeThread);
                }

                this.ready.Dispose();
            }

            private Failure CancelSynchronousIo()
            {
                if (this.nativeThread == IntPtr.Zero)
                {
                    return null;
                }

                if (Native.CancelSynchronousIo(this.nativeThread))
                {
                    return null;
                }

                int code = Marshal.GetLastWin32Error();

                if (code == Native.ERROR_NOT_FOUND)
                {
                    // No pending synchronous I/O was found.
                    // The worker may be between calls or may have exited.
                    return null;
                }

                return new Failure(this.FormatOperation("CancelSynchronousIo()"), code);
            }
        }

        private sealed class InputConsoleRelay : ConsoleRelay
        {
            internal InputConsoleRelay(
                string name,
                IntPtr console,
                IntPtr pipe,
                Action<Exception> onFatalError,
                Action<Exception> onError
            ) : base(name, console, pipe, onFatalError, onError)
            {
            }

            protected override void Forward()
            {
                char[] characters = new char[2048];
                byte[] bytes = new byte[Encoding.UTF8.GetMaxByteCount(characters.Length)];
                Encoder encoder = Encoding.UTF8.GetEncoder();
                while (!this.Cancelled)
                {
                    uint count;
                    bool success = Native.ReadConsoleW(
                        handle: this.Console,
                        buffer: characters,
                        size: (uint)characters.Length,
                        read: out count,
                        control: IntPtr.Zero
                    );
                    if (!success)
                    {
                        throw Win32(this.FormatOperation("ReadConsoleW()"));
                    }

                    if (count == 0 || this.Cancelled)
                    {
                        return;
                    }

                    int length = encoder.GetBytes(
                        chars: characters,
                        charIndex: 0,
                        charCount: (int)count,
                        bytes: bytes,
                        byteIndex: 0,
                        flush: false
                    );

                    GCHandle pinned = GCHandle.Alloc(bytes, GCHandleType.Pinned);

                    try
                    {
                        int offset = 0;
                        while (offset < length && !this.Cancelled)
                        {
                            uint written;
                            success = Native.WriteFile(
                                handle: this.Pipe,
                                buffer: IntPtr.Add(
                                    pinned.AddrOfPinnedObject(),
                                    offset
                                ),
                                size: (uint)(length - offset),
                                written: out written,
                                overlapped: IntPtr.Zero
                            );

                            if (!success)
                            {
                                int code = Marshal.GetLastWin32Error();
                                if (code == Native.ERROR_BROKEN_PIPE || code == Native.ERROR_NO_DATA)
                                {
                                    // Target has closed stdin.
                                    // No point in relaying further.
                                    return;
                                }

                                throw new Failure(this.FormatOperation("WriteFile()"), code);
                            }

                            if (written == 0)
                            {
                                throw new Failure(this.FormatOperation("WriteFile()"), "No progress writing input.");
                            }

                            offset += (int)written;
                        }
                    }
                    finally
                    {
                        pinned.Free();
                    }
                }
            }
        }

        private sealed class OutputConsoleRelay : ConsoleRelay
        {
            internal OutputConsoleRelay(
                string name,
                IntPtr console,
                IntPtr pipe,
                Action<Exception> onFatalError,
                Action<Exception> onError
            ) : base(name, console, pipe, onFatalError, onError)
            {
            }

            protected override void Forward()
            {
                byte[] bytes = new byte[8192];
                char[] characters = new char[Encoding.UTF8.GetMaxCharCount(bytes.Length)];
                Decoder decoder = Encoding.UTF8.GetDecoder();

                while (!this.Cancelled)
                {
                    uint count;
                    bool success = Native.ReadFile(
                        handle: this.Pipe,
                        buffer: bytes,
                        size: (uint)bytes.Length,
                        read: out count,
                        overlapped: IntPtr.Zero
                    );
                    if (!success)
                    {
                        int code = Marshal.GetLastWin32Error();
                        if (code != Native.ERROR_BROKEN_PIPE)
                        {
                            throw new Failure(this.FormatOperation("ReadFile()"), code);
                        }

                        // The pipe reached EOF.
                        // Setting count to zero will flush any text buffered by the UTF-8 decoder.
                        count = 0;
                    }

                    int length = decoder.GetChars(
                        bytes: bytes,
                        byteIndex: 0,
                        byteCount: (int)count,
                        chars: characters,
                        charIndex: 0,
                        flush: count == 0
                    );

                    string text = new string(characters, 0, length);
                    int offset = 0;
                    while (offset < text.Length && !this.Cancelled)
                    {
                        uint written;
                        string remaining = text.Substring(offset);
                        success = Native.WriteConsoleW(
                            handle: this.Console,
                            buffer: remaining,
                            size: (uint)remaining.Length,
                            written: out written,
                            reserved: IntPtr.Zero
                        );
                        if (!success)
                        {
                            throw Win32(this.FormatOperation("WriteConsoleW()"));
                        }
                        if (written == 0)
                        {
                            throw new Failure(
                                this.FormatOperation("WriteConsoleW()"),
                                "No progress writing output."
                            );
                        }

                        offset += (int)written;
                    }

                    if (count == 0)
                    {
                        return;
                    }
                }
            }

            internal override bool TryFinishDraining()
            {
                if (!this.Join(0))
                {
                    if (this.CancellationTimedOut)
                    {
                        throw new Failure(
                            this.FormatOperation("OutputRelayCancellationTimeout"),
                            string.Format(
                                "The output relay worker did not exit within {0} "
                                    + "second(s) after cancellation was requested.",
                                CancellationCompletionTimeoutMs / 1000
                            )
                        );
                    }

                    return false;
                }

                if (this.Error != null)
                {
                    throw this.Error;
                }

                return true;
            }
        }

        private abstract class ConsoleRelayFactory
        {
            private readonly string name;

            internal string Name { get { return this.name; } }

            internal ConsoleRelayFactory(string name)
            {
                this.name = name;
            }

            protected sealed class PipeEnds
            {
                public IntPtr HostEnd { get; set; }
                public IntPtr TargetEnd { get; set; }
            }

            public ConsoleRelay Create(
                IntPtr console,
                Action<Exception> onFatalError,
                Action<Exception> onError,
                out IntPtr targetPipeEnd
            )
            {
                IntPtr readEnd, writeEnd;
                bool success = Native.CreatePipe(
                    readPipe: out readEnd,
                    writePipe: out writeEnd,
                    attributes: IntPtr.Zero,
                    size: 0
                );

                PipeEnds pipeEnds = this.ClassifyPipeEnds(readEnd, writeEnd);

                if (!success)
                {
                    throw Win32("CreatePipe");
                }

                try
                {
                    IntPtr inheritableTargetPipeEnd = DuplicateInheritableHandle(pipeEnds.TargetEnd);
                    try
                    {
                        targetPipeEnd = inheritableTargetPipeEnd;
                        return this.CreateRelay(console, pipeEnds.HostEnd, onFatalError, onError);
                    }
                    catch
                    {
                        Native.CloseHandle(inheritableTargetPipeEnd);
                        throw;
                    }
                }
                catch
                {
                    Native.CloseHandle(pipeEnds.HostEnd);
                    throw;
                }
                finally
                {
                    // A copy of the target's pipe end handle will be inherited by the target.
                    // The original handle can be safely closed here.
                    Native.CloseHandle(pipeEnds.TargetEnd);
                }
            }

            internal bool IsConsoleHandle(IntPtr handle)
            {
                // The check short-circuits disks and pipes out.
                // Character devices are potential console handles and are further probed.
                return IsCharDevice(handle) && this.ProbeConsoleHandle(handle);
            }

            protected abstract bool ProbeConsoleHandle(IntPtr handle);

            protected abstract PipeEnds ClassifyPipeEnds(IntPtr readEnd, IntPtr writeEnd);

            protected abstract ConsoleRelay CreateRelay(
                IntPtr console,
                IntPtr pipe,
                Action<Exception> onFatalError,
                Action<Exception> onError
            );

            private static bool IsCharDevice(IntPtr handle)
            {
                uint fileType = Native.GetFileType(handle);
                if (fileType == Native.FILE_TYPE_UNKNOWN)
                {
                    int code = Marshal.GetLastWin32Error();

                    if (code == Native.ERROR_INVALID_HANDLE)
                    {
                        // Let standard-handle preparation replace the invalid handle with NUL.
                        return false;
                    }

                    if (code != 0)
                    {
                        throw new Failure("GetFileType", code);
                    }
                }
                return fileType == Native.FILE_TYPE_CHAR;
            }
        }

        private sealed class InputRelayFactory : ConsoleRelayFactory
        {
            internal InputRelayFactory(string name) : base(name)
            {
            }

            protected override bool ProbeConsoleHandle(IntPtr handle)
            {
                uint mode;
                bool success = Native.GetConsoleMode(handle, out mode);
                int code;

                // Continue through direct inheritance; invalid handles fall back to NUL.
                if (!success && (code = Marshal.GetLastWin32Error()) != Native.ERROR_INVALID_HANDLE)
                {
                    throw new Failure("GetConsoleMode", code);
                }
                return success;
            }

            protected override PipeEnds ClassifyPipeEnds(IntPtr readEnd, IntPtr writeEnd)
            {
                return new PipeEnds
                {
                    HostEnd = writeEnd,
                    TargetEnd = readEnd,
                };
            }

            protected override ConsoleRelay CreateRelay(
                IntPtr console,
                IntPtr pipe,
                Action<Exception> onFatalError,
                Action<Exception> onError
            )
            {
                return new InputConsoleRelay(this.Name, console, pipe, onFatalError, onError);
            }
        }

        private sealed class OutputRelayFactory : ConsoleRelayFactory
        {
            internal OutputRelayFactory(string name) : base(name)
            {
            }

            protected override bool ProbeConsoleHandle(IntPtr handle)
            {
                uint mode;
                bool success = Native.GetConsoleMode(handle, out mode);
                if (success)
                {
                    return true;
                }

                int code = Marshal.GetLastWin32Error();
                if (code == Native.ERROR_INVALID_HANDLE)
                {
                    // Continue through direct inheritance; invalid handles fall back to NUL.
                    return false;
                }

                // GetConsoleMode fails for write-only consoles, which are perfectly fine for output.
                // Use zero-length write to check whether the handle supports console output without
                // writing any characters.
                if (code == Native.ERROR_ACCESS_DENIED)
                {
                    return ProbeConsoleWrite(handle);
                }

                throw new Failure("GetConsoleMode", code);
            }

            protected override PipeEnds ClassifyPipeEnds(IntPtr readEnd, IntPtr writeEnd)
            {
                return new PipeEnds
                {
                    HostEnd = readEnd,
                    TargetEnd = writeEnd,
                };
            }

            protected override ConsoleRelay CreateRelay(
                IntPtr console,
                IntPtr pipe,
                Action<Exception> onFatalError,
                Action<Exception> onError
            )
            {
                return new OutputConsoleRelay(this.Name, console, pipe, onFatalError, onError);
            }

            private static bool ProbeConsoleWrite(IntPtr handle)
            {
                uint written;
                bool success = Native.WriteConsoleW(
                    handle: handle,
                    buffer: string.Empty,
                    size: 0,
                    written: out written,
                    reserved: IntPtr.Zero
                );

                if (success)
                {
                    return true;
                }

                int code = Marshal.GetLastWin32Error();
                if (code == Native.ERROR_INVALID_HANDLE)
                {
                    return false;
                }

                throw new Failure("WriteConsoleW", code);
            }
        }

        private void Diagnostic(string stage, object details)
        {
            if (!diagnosticsEnabled)
            {
                return;
            }

            try
            {
                if (pipe == null || !pipe.IsConnected)
                {
                    TryWriteToDiagnosticFile(
                        string.Format("ProcessDiagnostics.{0}", stage),
                        details
                    );
                    return;
                }

                Dictionary<string, object> message = Message("diagnostics");
                message["hostPid"] = Native.GetCurrentProcessId();
                message["timestamp"] = DateTime.UtcNow.ToString("o");
                message["stage"] = stage;
                message["details"] = details;
                Send(message);
            }
            catch
            {
                // All diagnostic errors are swallowed.
            }
        }

        /// <summary>
        /// Returns best-effort diagnostic details about the specified process.
        /// Includes its PID and any executable path, name, and command line
        /// that could be retrieved, along with any inspection errors.
        /// </summary>
        private static object DescribeProcess(uint pid)
        {
            Dictionary<string, object> details = new Dictionary<string, object> { { "pid", pid } };
            IntPtr process = Native.OpenProcess(Native.PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (process == IntPtr.Zero)
            {
                details["inspectionError"] = Win32("OpenProcess(diagnostics)").Message;
                return details;
            }
            try
            {
                StringBuilder image = new StringBuilder(32768);
                uint size = (uint)image.Capacity;
                if (Native.QueryFullProcessImageNameW(process, 0, image, ref size))
                {
                    details["executable"] = image.ToString();
                    details["name"] = Path.GetFileName(image.ToString());
                }
                else
                {
                    details["imageError"] = Win32("QueryFullProcessImageNameW").Message;
                }

                uint required;
                Native.NtQueryInformationProcess(process, 60, IntPtr.Zero, 0, out required);
                if (required < Marshal.SizeOf(typeof(Native.UNICODE_STRING)) || required > 1024 * 1024)
                {
                    throw new InvalidOperationException("Command line size unavailable or too large.");
                }

                IntPtr buffer = Marshal.AllocHGlobal((int)required);
                try
                {
                    int status = Native.NtQueryInformationProcess(process, 60, buffer, required, out required);
                    if (status < 0)
                    {
                        throw new InvalidOperationException(
                            "Command line query failed: NTSTATUS=0x" + status.ToString("X8")
                        );
                    }
                    Native.UNICODE_STRING commandLine = (Native.UNICODE_STRING)Marshal.PtrToStructure(
                        buffer,
                        typeof(Native.UNICODE_STRING)
                    );
                    details["commandLine"] = Marshal.PtrToStringUni(
                        commandLine.Buffer,
                        commandLine.Length / 2
                    );
                }
                finally
                {
                    Marshal.FreeHGlobal(buffer);
                }
            }
            catch (Exception error)
            {
                // The process may have exited since enumeration, or access may have been denied
                details["inspectionError"] = error.Message;
            }
            finally
            {
                Native.CloseHandle(process);
            }
            return details;
        }

        // Prints diagnostic information about remaining processes in the job.
        private void DiagnoseRemainingProcesses()
        {
            try
            {
                // Read actual job membership, including nested jobs.
                // Bound retries if the job grows.
                int capacity = 64;
                for (int attempt = 0; attempt < 3; attempt++)
                {
                    int size = 8 + capacity * IntPtr.Size;
                    IntPtr buffer = Marshal.AllocHGlobal(size);
                    try
                    {
                        uint returned;
                        bool success = Native.QueryInformationJobObject(
                            job,
                            Native.JobObjectBasicProcessIdList,
                            buffer,
                            (uint)size,
                            out returned
                        );
                        int error = Marshal.GetLastWin32Error();
                        if (!success && error != 234) // ERROR_MORE_DATA
                        {
                            throw new Failure("QueryInformationJobObject(diagnostics)", error);
                        }

                        int assigned = Marshal.ReadInt32(buffer);
                        int count = Math.Min(capacity, Marshal.ReadInt32(buffer, 4));
                        if (!success && attempt < 2)
                        {
                            capacity = Math.Min(65536, Math.Max(capacity * 2, assigned));
                            continue;
                        }

                        this.Diagnostic(
                            "waiting for job processes after root exit",
                            new { rootPid, assigned, listed = count }
                        );

                        for (int index = 0; index < count; index++)
                        {
                            uint pid = unchecked(
                                (uint)Marshal.ReadIntPtr(
                                    buffer,
                                    8 + index * IntPtr.Size
                                ).ToInt64()
                            );
                            this.Diagnostic("remaining job process", DescribeProcess(pid));
                        }
                        return;
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(buffer);
                    }
                }
            }
            catch (Exception error)
            {
                this.Diagnostic("job process inspection failed", new { error = error.Message });
            }
        }

        private void TryWriteToDiagnosticFile(string source, object data)
        {
            string entry;
            try
            {
                entry = json.Serialize(data);
            }
            catch
            {
                return;
            }

            TryWriteToDiagnosticFile(source, entry);
        }

        private void TryWriteToDiagnosticFile(string source, Exception error)
        {
            string entry;
            try
            {
                entry = error.ToString();
            }
            catch
            {
                return;
            }

            TryWriteToDiagnosticFile(source, entry);
        }

        private void TryWriteToDiagnosticFile(string source, string message)
        {
            if (string.IsNullOrEmpty(this.diagnosticFilePath))
            {
                return;
            }

            try
            {
                string entry = string.Format(
                    "{0:o} [{1}] {2}{3}",
                    DateTime.UtcNow,
                    source,
                    message,
                    Environment.NewLine
                );

                lock (this.diagnosticFileLock)
                {
                    File.AppendAllText(
                        this.diagnosticFilePath,
                        entry,
                        new UTF8Encoding(false)
                    );
                }
            }
            catch
            {
                // Any error during diagnostic reporting is ignored.
            }
        }

        private static string ResolveCommandPath(string command)
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
                this.events.Add(item, this.stopping.Token);
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
                while (!this.stopping.IsCancellationRequested)
                {
                    byte[] header = new byte[4];
                    this.ReadExact(header)
                        .GetAwaiter()
                        .GetResult();

                    uint size =
                        (uint)header[0]
                            | ((uint)header[1] << 8)
                            | ((uint)header[2] << 16)
                            | ((uint)header[3] << 24);

                    if (size == 0 || size > MaxMessageBytes)
                    {
                        throw new Failure("ReadFrame", "Payload length must be between 1 and 1048576 bytes.");
                    }

                    byte[] payload = new byte[(int)size];
                    this.ReadExact(payload)
                        .GetAwaiter()
                        .GetResult();

                    this.Enqueue(new Frame { Text = utf8.GetString(payload) });
                }
            }
            catch (Exception e)
            {
                if (!stopping.IsCancellationRequested)
                {
                    this.Enqueue(e);
                }
            }
        }

        // Only the event-loop thread writes.
        // Async I/O plus a deadline bounds even final/error writes.
        private void Send(Dictionary<string, object> message)
        {
            byte[] payload = this.utf8.GetBytes(json.Serialize(message));
            byte[] frame = new byte[4 + payload.Length];
            uint size = (uint)payload.Length;
            for (int i = 0; i < 4; i++)
            {
                frame[i] = (byte)(size >> (8 * i));
            }

            Buffer.BlockCopy(payload, 0, frame, 4, payload.Length);

            Task write = this.pipe.WriteAsync(frame, 0, frame.Length);
            if (!write.Wait(WriteTimeoutMs))
            {
                this.pipe.Dispose();
                throw new Failure("WritePipe", "Control pipe write timed out.");
            }

            Task flush = this.pipe.FlushAsync();
            if (!flush.Wait(WriteTimeoutMs))
            {
                this.pipe.Dispose();
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
            using (FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
            using (BinaryReader reader = new BinaryReader(stream))
            {
                long length = stream.Length;
                long minLength = Native.E_LFANEW_OFFSET + 4;
                if (length < minLength)
                {
                    return false;
                }

                if (reader.ReadUInt16() != Native.IMAGE_DOS_SIGNATURE)
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
            {
                throw Win32("CreateJobObjectW");
            }

            Native.EXTENDED_LIMIT limits = new Native.EXTENDED_LIMIT();
            limits.BasicLimitInformation.LimitFlags = Native.KILL_ON_JOB_CLOSE;

            SetJobInformation(Native.JobObjectExtendedLimitInformation, limits);

            port = Native.CreateIoCompletionPort(Native.InvalidHandle, IntPtr.Zero, UIntPtr.Zero, 1);
            if (port == IntPtr.Zero)
            {
                throw Win32("CreateIoCompletionPort");
            }

            SetJobInformation(
                Native.JobObjectAssociateCompletionPortInformation,
                new Native.COMPLETION_PORT { CompletionKey = new IntPtr(1), CompletionPort = port }
            );

            monitor = new Thread(delegate ()
            {
                try
                {
                    while (true)
                    {
                        uint message;
                        UIntPtr key;
                        IntPtr overlapped;

                        // Blocks the thread until an I/O completion packet is dequeued or an error occurs.
                        if (!Native.GetQueuedCompletionStatus(
                            port,
                            out message,
                            out key,
                            out overlapped,
                            Native.INFINITE
                        ))
                        {
                            throw Win32("GetQueuedCompletionStatus");
                        }

                        if (key == Native.StopKey)
                        {
                            return;
                        }

                        // Receiving this message indicates that there are no active processes in the job.
                        if (key == Native.JobKey && message == Native.JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO)
                        {
                            Enqueue(new EmptyJob());
                        }
                    }
                }
                catch (Exception e)
                {
                    if (!stopping.IsCancellationRequested)
                    {
                        Enqueue(e);
                    }
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
                {
                    result.Append('\\', slashes * 2 + 1).Append('"');
                }
                else
                {
                    result.Append('\\', slashes).Append(ch);
                }

                slashes = 0;
            }

            return result.Append('\\', slashes * 2)
                .Append('"')
                .ToString();
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

        private static IntPtr DuplicateInheritableHandle(IntPtr source)
        {
            IntPtr duplicate;
            bool success = Native.DuplicateHandle(
                sourceProcess: Native.GetCurrentProcess(),
                source: source,
                targetProcess: Native.GetCurrentProcess(),
                target: out duplicate,
                access: 0,
                inherit: true,
                options: Native.DUPLICATE_SAME_ACCESS
            );
            if (!success)
            {
                throw Win32("DuplicateHandle");
            }
            return duplicate;
        }

        private IntPtr PrepareTargetStandardHandle(int id, uint access, ConsoleRelayFactory relayFactory)
        {
            IntPtr source = Native.GetStdHandle(id);
            if (source != IntPtr.Zero && source != Native.InvalidHandle)
            {
                if (relayFactory.IsConsoleHandle(source))
                {
                    IntPtr targetPipeEnd;
                    this.consoleRelays.Add(
                        relayFactory.Create(
                            console: source,
                            onFatalError: delegate (Exception error)
                            {
                                this.events.TryAdd(error);
                            },
                            onError: delegate (Exception error)
                            {
                                TryReportRelayError(relayFactory.Name, error);
                            },
                            targetPipeEnd: out targetPipeEnd
                        )
                    );
                    return targetPipeEnd;
                }
                try
                {
                    return DuplicateInheritableHandle(source);
                }
                catch (Failure error)
                {
                    if (error.NativeError != Native.ERROR_INVALID_HANDLE)
                    {
                        throw;
                    }
                }
            }
            return PrepareNullHandle(access);
        }

        private void TryReportRelayError(string relayName, Exception error)
        {
            string source = string.Format("ConsoleRelay({0})", relayName);

            if (this.pipe != null && this.pipe.IsConnected)
            {
                try
                {
                    Failure failure = error as Failure;

                    Dictionary<string, object> message = Error(error, null, false);
                    if (failure == null)
                    {
                        message["operation"] = source;
                    }

                    this.Send(message);
                    return;
                }
                catch
                {
                }
            }

            TryWriteToDiagnosticFile(source, error);
        }

        private static IntPtr PrepareNullHandle(uint access)
        {
            // If no stdin/stdout/stderr is available, open NUL for reading or writing.
            // This is similar to redirecting to/from /dev/null on Unix systems.
            IntPtr nul = Native.CreateFileW(
                "NUL",
                access,
                Native.FILE_SHARE_READ | Native.FILE_SHARE_WRITE,
                IntPtr.Zero,
                Native.OPEN_EXISTING,
                0,
                IntPtr.Zero
            );

            if (nul == Native.InvalidHandle)
            {
                throw Win32("CreateFileW(NUL)");
            }

            try
            {
                return DuplicateInheritableHandle(nul);
            }
            finally
            {
                Native.CloseHandle(nul);
            }
        }

        private IntPtr PrepareTargetStandardInputHandle(string name, int id)
        {
            return PrepareTargetStandardHandle(id, Native.GENERIC_READ, new InputRelayFactory(name));
        }

        private IntPtr PrepareTargetStandardOutputHandle(string name, int id)
        {
            return PrepareTargetStandardHandle(id, Native.GENERIC_WRITE, new OutputRelayFactory(name));
        }

        private uint Launch(string command, IEnumerable<string> arguments, string cwd)
        {
            bool powershell = false;
            bool batch = false;

            string extension = Path.GetExtension(command);

            switch (extension.ToLowerInvariant())
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
                    script.Append(' ')
                        .Append(QuoteNative(argument));
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

            CreateJob();

            IntPtr attributes = IntPtr.Zero, handlesMemory = IntPtr.Zero, jobsMemory = IntPtr.Zero;
            IntPtr[] handles = new IntPtr[3];
            bool initialized = false;
            Native.PROCESS_INFORMATION process = new Native.PROCESS_INFORMATION();
            try
            {
                handles[0] = PrepareTargetStandardInputHandle("stdin", Native.STD_INPUT_HANDLE);
                handles[1] = PrepareTargetStandardOutputHandle("stdout", Native.STD_OUTPUT_HANDLE);
                handles[2] = PrepareTargetStandardOutputHandle("stderr", Native.STD_ERROR_HANDLE);

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
                {
                    Native.CloseHandle(process.hThread);
                }

                foreach (IntPtr handle in handles)
                {
                    if (handle != IntPtr.Zero)
                    {
                        Native.CloseHandle(handle);
                    }
                }

                if (initialized)
                {
                    Native.DeleteProcThreadAttributeList(attributes);
                }

                if (attributes != IntPtr.Zero)
                {
                    Marshal.FreeHGlobal(attributes);
                }

                if (handlesMemory != IntPtr.Zero)
                {
                    Marshal.FreeHGlobal(handlesMemory);
                }

                if (jobsMemory != IntPtr.Zero)
                {
                    Marshal.FreeHGlobal(jobsMemory);
                }
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
                lock (this.gracefulStopLock)
                {
                    if (this.stopCancelled)
                    {
                        throw new OperationCanceledException("Graceful stop was cancelled.");
                    }
                    this.signalDelivery = Process.Start(new ProcessStartInfo
                    {
                        FileName = Assembly.GetExecutingAssembly().Location,
                        Arguments = "signal " + this.rootPid.ToString(CultureInfo.InvariantCulture),
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });
                }

                if (!this.signalDelivery.WaitForExit(SignalDeliveryTimeoutMs))
                {
                    this.TerminateSendConsoleSignal();

                    error = new Failure(
                        "SendConsoleSignal",
                        string.Format(
                            "The console-signal helper did not exit within {0} second(s). " +
                                "Signal delivery could not be confirmed.",
                            SignalDeliveryTimeoutMs / 1000
                        )
                    );
                    return StopOutcome.Failure;
                }

                int code = this.signalDelivery.ExitCode;

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

                    lock (this.gracefulStopLock)
                    {
                        if (this.stopCancelled)
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
            lock (this.gracefulStopLock)
            {
                this.stopCancelled = true;
                if (this.signalDelivery != null && !this.signalDelivery.HasExited)
                {
                    try
                    {
                        this.signalDelivery.Kill();
                    }
                    catch (InvalidOperationException)
                    {
                        if (!this.signalDelivery.HasExited)
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
                request = this.json.DeserializeObject(text) as Dictionary<string, object>;
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
            string id = request.TryGetValue("requestId", out value)
                ? value as string
                : null;

            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    throw Invalid("requestId must be a nonempty string.");
                }

                string type = request.TryGetValue("type", out value)
                    ? value as string
                    : null;

                if (type == "stop")
                {
                    if (this.stopSeen)
                    {
                        throw Invalid("Stop already handled.");
                    }

                    this.stopSeen = true;

                    if (!this.launched)
                    {
                        throw Invalid("Stop before start.");
                    }

                    if (this.terminateSeen)
                    {
                        throw Invalid("Stop after termination request.");
                    }

                    this.BeginStop(id);
                }
                else if (type == "terminate")
                {
                    if (this.terminateSeen)
                    {
                        throw Invalid("Termination already handled.");
                    }

                    this.terminateSeen = true;
                    this.terminationTimer.Start();

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

                    if (!this.launched)
                    {
                        throw Invalid("Termination before start.");
                    }

                    Dictionary<string, object> response = Message("terminationResult");
                    response["requestId"] = id;

                    this.TerminateSendConsoleSignal();
                    bool success = Native.TerminateJobObject(this.job, code);

                    int error = success ? 0 : Marshal.GetLastWin32Error();
                    response["success"] = success;
                    if (success)
                    {
                        this.terminationSucceeded = true;
                    }
                    else
                    {
                        response["error"] = Error(
                            new Failure("TerminateJobObject", error),
                            id,
                            false
                        );
                    }
                    this.Send(response);
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
                this.Send(Error(e, id, false));
            }
        }

        private static int Run(string pipeName, string command, IEnumerable<string> arguments)
        {
            WindowsProcessHost host = new WindowsProcessHost();
            int exitCode = 0;

            try
            {
                exitCode = host.Execute(pipeName, command, arguments);
            }
            finally
            {
                host.Dispose();
            }

            return host.CleanupFailed ? 1 : exitCode;
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
                    // Return a distinct error code. The host might try a different stop method.
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
            // The supervisor implements the escalation policy and manages the host's lifetime.
            // The host is attached to the same console and must survive CTRL+C.
            return controlType == Native.CTRL_C_EVENT;
        }

        private void UnregisterConsoleCtrlHandler()
        {
            if (ctrlHandlerRegistered)
            {
                // Ignore any errors: we're about to exit anyway.
                Native.SetConsoleCtrlHandler(ctrlHandler, false);
                ctrlHandlerRegistered = false;
            }
        }

        private int Execute(string pipeName, string command, IEnumerable<string> arguments)
        {
            // allure run can execute a nested allure run.
            // Disable diagnostics for nested hosts.
            // The outer host will report all job processes anyway.
            Environment.SetEnvironmentVariable("__ALLURE_PROCESS_HOST_DIAGNOSTICS__", null);

            try
            {
                if (!Native.SetConsoleCtrlHandler(ctrlHandler, true))
                {
                    throw Win32("SetConsoleCtrlHandler(add)");
                }

                this.ctrlHandlerRegistered = true;

                this.pipe = new NamedPipeClientStream(
                    ".",
                    pipeName,
                    PipeDirection.InOut,
                    PipeOptions.Asynchronous
                );

                this.pipe.Connect(ConnectTimeoutMs);

                Dictionary<string, object> ready = Message("ready");
                ready["version"] = 2;
                ready["hostPid"] = Native.GetCurrentProcessId();

                this.Send(ready);

                this.reader = new Thread(this.ReadLoop);
                this.reader.IsBackground = true;
                this.reader.Start();

                string resolved = ResolveCommandPath(command);

                uint pid = Launch(resolved, arguments, Environment.CurrentDirectory);
                this.rootPid = pid;

                foreach (ConsoleRelay relay in consoleRelays)
                {
                    relay.Start();
                }

                Dictionary<string, object> started = Message("started");
                started["rootPid"] = pid;
                this.Send(started);

                this.Diagnostic("target started", new { rootPid });

                Stopwatch completionClock = Stopwatch.StartNew();

                long nextCompletionCheck = CompletionCheckIntervalMs;
                bool rootExitReported = false;
                long nextDiagnostic = 0;
                bool waitingForOutputDrain = false;

                while (true)
                {
                    bool jobWasEmpty = this.jobEmpty;
                    int timeout = this.jobEmpty
                        ? (waitingForOutputDrain ? 100 : Timeout.Infinite)
                        : (int)Math.Max(
                            0L,
                            nextCompletionCheck - completionClock.ElapsedMilliseconds
                        );

                    if (this.terminationSucceeded)
                    {
                        // Wake at least every 100 ms after termination succeeds
                        // to check the drain grace period and retry relay cancellation.
                        timeout = timeout == Timeout.Infinite
                            ? 100
                            : Math.Min(timeout, 100);
                    }

                    object item;
                    this.events.TryTake(out item, timeout);

                    Exception error = item as Exception;
                    if (error != null)
                    {
                        throw error;
                    }

                    Frame frame = item as Frame;
                    if (frame != null)
                    {
                        this.Request(frame.Text);
                    }

                    StopResult stopResult = item as StopResult;
                    if (stopResult != null)
                    {
                        this.SendStopResult(stopResult);
                    }

                    if (item is EmptyJob && this.launched)
                    {
                        this.jobEmpty = true;
                    }

                    // Windows does not guarantee JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO to be delivered:
                    //   https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port#remarks
                    // Although, in most cases it will be delivered, we cannot fully rely on it.
                    // Hence, we periodically check if all the job processes have exited.
                    if (!this.jobEmpty && completionClock.ElapsedMilliseconds >= nextCompletionCheck)
                    {
                        this.jobEmpty = this.IsJobEmpty();
                        nextCompletionCheck =
                            completionClock.ElapsedMilliseconds + CompletionCheckIntervalMs;
                    }

                    if (!jobWasEmpty && this.jobEmpty)
                    {
                        this.Diagnostic("job became empty", new { this.rootPid });
                    }

                    if (this.diagnosticsEnabled && Native.WaitForSingleObject(this.root, 0) == Native.WAIT_OBJECT_0)
                    {
                        if (!rootExitReported)
                        {
                            uint rootExitCode;
                            bool exitCodeAvailable = Native.GetExitCodeProcess(this.root, out rootExitCode);
                            this.Diagnostic("root exited", new { this.rootPid, exitCodeAvailable, rootExitCode });
                            rootExitReported = true;
                        }
                        if (!this.jobEmpty && completionClock.ElapsedMilliseconds >= nextDiagnostic)
                        {
                            this.DiagnoseRemainingProcesses();
                            nextDiagnostic = completionClock.ElapsedMilliseconds + DiagnosticIntervalMs;
                        }
                    }

                    if (this.terminationSucceeded && this.ShouldAbandonOutput)
                    {
                        foreach (ConsoleRelay relay in this.consoleRelays)
                        {
                            relay.RequestCancellation();
                        }
                    }

                    // Preserve result-before-completed ordering when shutdown itself empties the job.
                    if (this.jobEmpty && (!this.stopPending || this.terminationSucceeded))
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

                        bool outputsFinished = true;

                        if (!waitingForOutputDrain)
                        {
                            this.Diagnostic(
                                "console relay drain starting",
                                new { this.rootPid, relayCount = this.consoleRelays.Count }
                            );
                        }

                        // The entire job has exited, so no target can keep a pipe writer open.
                        // Some data might still reside in output buffers, so we need to drain them.
                        for (int index = 0; index < this.consoleRelays.Count; index++)
                        {
                            ConsoleRelay relay = this.consoleRelays[index];
                            bool relayFinished = relay.TryFinishDraining();
                            outputsFinished &= relayFinished;

                            if (!relayFinished && !waitingForOutputDrain)
                            {
                                this.Diagnostic(
                                    "console relay drain pending",
                                    new
                                    {
                                        this.rootPid,
                                        index,
                                        relay = relay.Name
                                    }
                                );
                            }
                        }

                        if (!outputsFinished)
                        {
                            // An output relay may remain blocked in console I/O.
                            // Keep processing control requests while waiting.
                            waitingForOutputDrain = true;
                            continue;
                        }

                        waitingForOutputDrain = false;
                        this.Diagnostic("console relay drain finished", new { this.rootPid });

                        Dictionary<string, object> completed = Message("completed");
                        completed["rootExitCode"] = code;
                        completed["reason"] = terminationSucceeded
                            ? "terminated"
                            : stopSucceeded
                                ? "stopped"
                                : "normal";

                        this.Diagnostic(
                            "sending completed frame",
                            new
                            {
                                this.rootPid,
                                rootExitCode = code,
                                this.stopPending,
                                this.terminationSucceeded
                            }
                        );
                        this.Send(completed);
                        this.Diagnostic("completed frame sent", new { this.rootPid });

                        return 0;
                    }
                }
            }
            catch (Exception e)
            {
                try
                {
                    if (this.pipe != null && this.pipe.IsConnected)
                    {
                        this.Send(Error(e, null, true));
                    }
                    else
                    {
                        TryWriteToDiagnosticFile("ProcessHost", e);
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
            this.Diagnostic("disposing host resources", new { rootPid });
            try
            {
                stopping.Cancel();
                this.TerminateSendConsoleSignal();

                if (pipe != null)
                {
                    pipe.Dispose();
                }

                // Closing the sole owning handle is the final safety net on every failure path.
                // Windows terminates the entire job due to KILL_ON_JOB_CLOSE.
                if (job != IntPtr.Zero)
                {
                    Native.CloseHandle(job);
                    job = IntPtr.Zero;
                }

                foreach (ConsoleRelay relay in consoleRelays)
                {
                    relay.RequestCancellation();
                }

                foreach (ConsoleRelay relay in consoleRelays)
                {
                    relay.Dispose();
                    this.cleanupFailed |= relay.CleanupFailed;
                }

                if (this.port != IntPtr.Zero)
                {
                    Native.PostQueuedCompletionStatus(this.port, 0, Native.StopKey, IntPtr.Zero);
                }

                if (this.reader != null)
                {
                    this.reader.Join(1000);
                }

                if (this.monitor != null)
                {
                    this.monitor.Join(1000);
                }

                bool shutdownFinished = this.shutdown == null
                    || this.shutdown.Join(ShutdownCleanupTimeoutMs);
                if (!shutdownFinished)
                {
                    this.cleanupFailed = true;
                    this.TryWriteToDiagnosticFile(
                        "ShutdownWorker",
                        new Failure(
                            "ShutdownCleanup",
                            string.Format(
                                "The graceful-stop worker did not exit within {0} second(s).",
                                ShutdownCleanupTimeoutMs / 1000
                            )
                        )
                    );
                }

                // If shutdown thread is not finished, don't dispose its resources.
                // As we're exiting, Windows will reclaim the resources itself.
                // The background thread won't prevent that.
                if (shutdownFinished && this.signalDelivery != null)
                {
                    this.signalDelivery.Dispose();
                }

                if (this.root != IntPtr.Zero)
                {
                    Native.CloseHandle(this.root);
                }

                if (this.port != IntPtr.Zero)
                {
                    Native.CloseHandle(this.port);
                }
            }
            finally
            {
                this.UnregisterConsoleCtrlHandler();
                this.Diagnostic("host resource disposal complete", new { this.rootPid });
            }
        }
    }
}
