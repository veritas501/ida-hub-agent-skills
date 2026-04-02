"""IDA Multi Chat plugin entry.

Copy this file and the ``ida_multi_chat`` folder into IDA's ``plugins``
directory, then restart IDA.

After loading, you can use:
- Edit -> IDA Multi Chat -> Connect
- Edit -> IDA Multi Chat -> Disconnect
- Edit -> IDA Multi Chat -> Settings

The plugin connects IDA to a Hub Server and allows remote Python execution
in the current IDA database context.
"""

from ida_multi_chat.plugin import IDAMultiChatPlugin

__all__ = ["PLUGIN_ENTRY"]


def PLUGIN_ENTRY() -> IDAMultiChatPlugin:
    return IDAMultiChatPlugin()
