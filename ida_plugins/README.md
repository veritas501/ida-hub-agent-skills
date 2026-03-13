# IDA Multi Chat Plugin - Quick Start

中文说明请见: [README_CN.md](README_CN.md)

This folder contains the IDA plugin that connects IDA Pro to the Hub server.

## What this plugin does

After loading the plugin in IDA, you can:

- Connect/disconnect to a Hub server from the IDA menu
- Receive Python code from Hub
- Execute that code inside the current IDA database context

Menu path in IDA:

- `Edit -> IDA Multi Chat -> Connect`
- `Edit -> IDA Multi Chat -> Disconnect`
- `Edit -> IDA Multi Chat -> Settings`

## Prerequisites

- IDA Pro (Python enabled)
- Running Hub server (default port: `10086`)
- Network access from IDA host to Hub host

Python dependencies:

- `websocket-client>=1.7.0`
- `ida-domain`

## Install

1. Copy these into IDA `plugins` directory:

- `ida_multi_chat_entry.py`
- `ida_multi_chat/`

2. Install dependencies in IDA's Python environment:

```bash
pip install -r requirements.txt
```

## First connection

1. Start your Hub server first.
2. Open IDA.
3. Click `Connect` directly (if Hub uses default `127.0.0.1:10086`).
4. Optional: go to `Edit -> IDA Multi Chat -> Settings`, set Hub `Host` and `Port`, then click `Save`.

Default values:

- Host: `127.0.0.1`
- Port: `10086`
- Reconnect interval: `5.0` seconds
- Auto connect: disabled

## Verify it works

- In IDA Output window, you should see plugin logs with `[IDA Multi Chat]` prefix.
- On Hub side, the instance should appear in `/api/instances`.

## Configuration file

Plugin settings are persisted to:

- `ida_multi_chat/.hub_config.json`

## Troubleshooting

- Menu not visible:
  - Make sure both `ida_multi_chat_entry.py` and `ida_multi_chat/` are in IDA `plugins` directory.
  - Restart IDA after copying files.
- Connect failed:
  - Check Hub host/port in Settings.
  - Check firewall/network reachability.
- Execution timeout or no result:
  - Verify the IDA instance is still listed in Hub `/api/instances`.
  - Retry with smaller scripts.
