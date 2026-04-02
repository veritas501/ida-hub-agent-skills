# IDA Multi Chat Plugin - Quick Start

This directory contains the plugin used to connect IDA Pro to the Hub server.

## Plugin features

After the plugin is loaded, you can do the following in IDA:

- Connect to or disconnect from the Hub server through the menu
- Receive Python code pushed from the Hub
- Execute code in the context of the current IDA database

IDA menu path:

- `Edit -> IDA Multi Chat -> Connect`
- `Edit -> IDA Multi Chat -> Disconnect`
- `Edit -> IDA Multi Chat -> Settings`

## Prerequisites

- IDA Pro (with Python enabled)
- A running Hub server
- Network access from the host running IDA to the Hub host

## Installation

1. Copy the following into IDA's `plugins` directory:

- `ida_multi_chat_entry.py`
- `ida_multi_chat/`

2. Install dependencies in IDA's Python environment:

```bash
pip install -r requirements.txt
```

## First connection

1. Start the Hub server first.
2. Log in to the Hub Web UI.
3. Open the IDA Config page and copy the generated `idahub://...` config string.
4. Open IDA.
5. In IDA, go to `Edit -> IDA Multi Chat -> Settings`, paste the config string, click `Check`, then click `Save`.
6. Click `Connect`.

Default configuration:

- Config string: `idahub://...`
- Reconnect interval: `5.0` seconds
- Auto connect: disabled

## Verify it works

- In the IDA Output window, you should see logs prefixed with `[IDA Multi Chat]`.
- On the Hub side, the instance should appear in `/api/instances`.

## Configuration file location

Plugin settings are persisted to:

- `ida_multi_chat/.hub_config.json`

## Common issues

- Menu not visible:
  - Make sure both `ida_multi_chat_entry.py` and `ida_multi_chat/` are in IDA's `plugins` directory.
  - Restart IDA after copying the files.
- Connection failed:
  - Copy the latest `idahub://...` config string again from the Hub and run `Check` in Settings.
  - Check network connectivity and firewall rules.
- Execution timed out or no result returned:
  - First confirm that the IDA instance still appears in Hub `/api/instances`.
  - Retry with a smaller script first.
