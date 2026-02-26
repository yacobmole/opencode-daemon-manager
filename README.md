# opencode-daemon-manager

Simple Bun CLI to start/stop a background `opencode serve` process.

## Install

```bash
bun install
```

## Usage

Start service on default port (`4444`):

```bash
bun run index.ts start
```

Start service on a custom port:

```bash
bun run index.ts start --port 5555
# or
bun run index.ts start -p 5555
```

Stop service:

```bash
bun run index.ts stop
```

Check status:

```bash
bun run index.ts status
```

You can also use scripts:

```bash
bun run start -- --port 5555
bun run stop
bun run status
```

Runtime state is stored in an OS-specific location:

- Linux: `$XDG_STATE_HOME/opencode-daemon-manager` (or `~/.local/state/opencode-daemon-manager`)
- macOS: `~/Library/Application Support/opencode-daemon-manager`
- Windows: `%LOCALAPPDATA%\\opencode-daemon-manager` (fallback `%APPDATA%`)

You can override this with `OPENCODE_DAEMON_STATE_DIR`.
