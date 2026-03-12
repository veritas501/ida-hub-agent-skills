"""IDA plugin entry module.

Place this file and the sibling ``ida_multi_chat`` package into the IDA
``plugins`` directory. This module intentionally stays minimal and only
creates the plugin instance from the package implementation.
"""

from ida_multi_chat.plugin import IDAMultiChatPlugin

__all__ = ["PLUGIN_ENTRY"]


def PLUGIN_ENTRY() -> IDAMultiChatPlugin:
    return IDAMultiChatPlugin()
