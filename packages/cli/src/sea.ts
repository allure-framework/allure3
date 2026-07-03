// Entry point for the Single Executable Application (SEA) build.
// The registry import must come first: it statically registers all bundled
// plugins before the CLI (imported for its side effects) starts executing commands.
import "./seaRegistry.js";
import "./index.js";
