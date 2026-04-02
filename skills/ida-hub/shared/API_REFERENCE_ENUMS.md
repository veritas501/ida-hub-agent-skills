# IDA Domain Quick Reference: Enums Reference

This file is a topic-focused API reference. The section content below is preserved unchanged from the pre-split reference.

## Enums Reference

### XrefType

```python
from ida_domain.xrefs import XrefType

# Data xref types
XrefType.OFFSET         # Offset reference
XrefType.WRITE          # Write access
XrefType.READ           # Read access
XrefType.TEXT           # Text reference
XrefType.INFORMATIONAL  # Informational
XrefType.SYMBOLIC       # Enum member reference

# Code xref types
XrefType.CALL_FAR       # Far call
XrefType.CALL_NEAR      # Near call
XrefType.JUMP_FAR       # Far jump
XrefType.JUMP_NEAR      # Near jump
XrefType.ORDINARY_FLOW  # Sequential flow
```

### StringType

```python
from ida_domain.strings import StringType

StringType.C            # Null-terminated
StringType.C_16         # 16-bit null-terminated
StringType.C_32         # 32-bit null-terminated
StringType.PASCAL       # Length-prefixed
StringType.PASCAL_16    # 16-bit length-prefixed
StringType.LEN2         # 2-byte length prefix
StringType.LEN4         # 4-byte length prefix
```

### OperandType

```python
from ida_domain.operands import OperandType

OperandType.VOID        # No operand
OperandType.REGISTER    # Register
OperandType.MEMORY      # Memory access
OperandType.PHRASE      # Base register + displacement
OperandType.DISPLACEMENT # Register + displacement
OperandType.IMMEDIATE   # Immediate value
OperandType.FAR_ADDRESS # Far address
OperandType.NEAR_ADDRESS # Near address
```

### AccessType

```python
from ida_domain.operands import AccessType

AccessType.NONE         # Not accessed
AccessType.READ         # Read only
AccessType.WRITE        # Write only
AccessType.READ_WRITE   # Both
```

### FunctionFlags

```python
from ida_domain.functions import FunctionFlags

FunctionFlags.NORET     # Doesn't return
FunctionFlags.FAR       # Far function
FunctionFlags.LIB       # Library function
FunctionFlags.THUNK     # Thunk/jump function
FunctionFlags.FRAME     # Uses frame pointer
FunctionFlags.HIDDEN    # Hidden chunk
FunctionFlags.TAIL      # Function tail
FunctionFlags.LUMINA    # Lumina info
```

### SegmentPermissions

```python
from ida_domain.segments import SegmentPermissions

SegmentPermissions.NONE   # No permissions
SegmentPermissions.READ   # Readable
SegmentPermissions.WRITE  # Writable
SegmentPermissions.EXEC   # Executable
SegmentPermissions.ALL    # All permissions
```

### AddressingMode

```python
from ida_domain.segments import AddressingMode

AddressingMode.BIT16    # 16-bit
AddressingMode.BIT32    # 32-bit
AddressingMode.BIT64    # 64-bit
```

### CommentKind

```python
from ida_domain.comments import CommentKind

CommentKind.REGULAR     # Regular comment
CommentKind.REPEATABLE  # Repeatable comment
CommentKind.ALL         # Both types
```

### ExtraCommentKind

```python
from ida_domain.comments import ExtraCommentKind

ExtraCommentKind.ANTERIOR   # Before line
ExtraCommentKind.POSTERIOR  # After line
```

### FlowChartFlags

```python
from ida_domain.flowchart import FlowChartFlags

FlowChartFlags.NONE     # Default
FlowChartFlags.NOEXT    # No external blocks
FlowChartFlags.PREDS    # Compute predecessors
```

### ExecutionMode

```python
from ida_domain.database import ExecutionMode

ExecutionMode.User      # User mode
ExecutionMode.Kernel    # Kernel mode
```
