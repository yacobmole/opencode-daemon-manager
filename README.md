# opencode-daemon-manager

> Warning: This project is completely vibe-coded with OpenAI GPT 5.3 Codex.

`odm` is a small Bun CLI to manage `opencode serve` as a background service.

## Latest Update

- `536b768`: Added support for `OPENCODE_PORT` as the default port source when `--port`/`-p` is not set.

## Setup

1) Clone the repo:

```bash
git clone <your-repo-url>
cd opencode-daemon-manager
```

2) Install dependencies:

```bash
bun install
```

3) Link the CLI globally:

```bash
bun link
```

4) Verify install:

```bash
odm --help
```

## Usage

Start on default port (`45023`):

```bash
odm start
```

Start using `OPENCODE_PORT` when `--port` is not provided:

```bash
OPENCODE_PORT=5555 odm start
```

Start on custom port:

```bash
odm start --port 5555
# or
odm start -p 5555
```

Port resolution order:

1) `--port` / `-p`
2) `OPENCODE_PORT`
3) Default `45023`

Stop service:

```bash
odm stop
```

Check status:

```bash
odm status
```

## State Directory

Runtime state is stored in an OS-specific location:

- Linux: `$XDG_STATE_HOME/opencode-daemon-manager` (fallback: `~/.local/state/opencode-daemon-manager`)
- macOS: `~/Library/Application Support/opencode-daemon-manager`
- Windows: `%LOCALAPPDATA%\\opencode-daemon-manager` (fallback: `%APPDATA%`)

Override this location with:

```bash
OPENCODE_DAEMON_STATE_DIR=/custom/path odm status
```
