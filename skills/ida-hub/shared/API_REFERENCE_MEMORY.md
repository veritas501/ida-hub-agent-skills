# IDA Domain Quick Reference: Memory APIs

This file is a topic-focused API reference. The section content below is preserved unchanged from the pre-split reference.

## Segments

### Iterating Segments

```python
# All segments
for seg in db.segments:
    name = db.segments.get_name(seg)
    size = db.segments.get_size(seg)
    print(f"{name}: 0x{seg.start_ea:08X}-0x{seg.end_ea:08X} ({size} bytes)")

# Segment count
print(f"Total: {len(db.segments)} segments")
```

### Finding Segments

```python
# By address
seg = db.segments.get_at(0x401000)

# By name
seg = db.segments.get_by_name(".text")
```

### Segment Properties

```python
seg = db.segments.get_at(0x401000)

name = db.segments.get_name(seg)
size = db.segments.get_size(seg)
bitness = db.segments.get_bitness(seg)    # 16, 32, or 64
seg_class = db.segments.get_class(seg)    # e.g., "CODE"
comment = db.segments.get_comment(seg)
```

### Segment Manipulation

```python
from ida_domain.segments import AddSegmentFlags, SegmentPermissions, AddressingMode

# Add new segment
new_seg = db.segments.add(
    seg_para=0,
    start_ea=0x500000,
    end_ea=0x501000,
    seg_name=".myseg",
    seg_class="DATA"
)

# Append segment after last
new_seg = db.segments.append(
    seg_para=0,
    seg_size=0x1000,
    seg_name=".extra"
)

# Rename
db.segments.set_name(seg, "new_name")

# Permissions
db.segments.set_permissions(seg, SegmentPermissions.READ | SegmentPermissions.EXEC)
db.segments.add_permissions(seg, SegmentPermissions.WRITE)
db.segments.remove_permissions(seg, SegmentPermissions.WRITE)

# Addressing mode
db.segments.set_addressing_mode(seg, AddressingMode.BIT64)

# Comments
db.segments.set_comment(seg, "Code section")
```

---

## Heads

Heads are the starting addresses of items (instructions or data).

### Iterating Heads

```python
# All heads
for ea in db.heads:
    if db.heads.is_code(ea):
        print(f"0x{ea:08X}: code")
    elif db.heads.is_data(ea):
        print(f"0x{ea:08X}: data")

# Heads in range
for ea in db.heads.get_between(0x401000, 0x402000):
    print(f"0x{ea:08X}")
```

### Navigation

```python
# Next/previous head
next_ea = db.heads.get_next(0x401000)
prev_ea = db.heads.get_previous(0x401010)
```

### Head Properties

```python
ea = 0x401000

# Type checks
db.heads.is_head(ea)     # Is start of an item
db.heads.is_tail(ea)     # Is part of item but not start
db.heads.is_code(ea)     # Is code
db.heads.is_data(ea)     # Is data
db.heads.is_unknown(ea)  # Is unknown/undefined

# Size and bounds
size = db.heads.size(ea)           # Size in bytes
start, end = db.heads.bounds(ea)   # Item bounds
```

---

## Bytes

### Reading Data

```python
# Single values
byte_val = db.bytes.get_byte_at(0x401000)
word_val = db.bytes.get_word_at(0x401000)
dword_val = db.bytes.get_dword_at(0x401000)
qword_val = db.bytes.get_qword_at(0x401000)

# Floating point
float_val = db.bytes.get_float_at(0x401000)
double_val = db.bytes.get_double_at(0x401000)

# Bulk read
data = db.bytes.get_bytes_at(0x401000, 100)  # 100 bytes

# Strings
string = db.bytes.get_string_at(0x401000)
cstring = db.bytes.get_cstring_at(0x401000)

# Disassembly text
disasm = db.bytes.get_disassembly_at(0x401000)
```

### Writing Data

```python
# Set values (modify database view)
db.bytes.set_byte_at(0x401000, 0x90)
db.bytes.set_word_at(0x401000, 0x9090)
db.bytes.set_dword_at(0x401000, 0x90909090)
db.bytes.set_qword_at(0x401000, 0x9090909090909090)
db.bytes.set_bytes_at(0x401000, b"\x90\x90\x90")
```

### Patching (Preserves Original)

```python
# Patch (saves original for revert)
db.bytes.patch_byte_at(0x401000, 0x90)
db.bytes.patch_word_at(0x401000, 0x9090)
db.bytes.patch_dword_at(0x401000, 0x90909090)
db.bytes.patch_qword_at(0x401000, 0x9090909090909090)
db.bytes.patch_bytes_at(0x401000, b"\x90\x90\x90")

# Revert to original
db.bytes.revert_byte_at(0x401000)

# Get original values
orig = db.bytes.get_original_byte_at(0x401000)
orig_bytes = db.bytes.get_original_bytes_at(0x401000, 10)
```

### Searching

```python
from ida_domain.bytes import SearchFlags

# Find byte pattern
ea = db.bytes.find_bytes_between(b"\x55\x8B\xEC")

# Find text
ea = db.bytes.find_text_between("error", flags=SearchFlags.CASE)

# Find immediate value in instructions
ea = db.bytes.find_immediate_between(0x12345678)

# Find all occurrences
all_matches = db.bytes.find_binary_sequence(b"\x90\x90")
```

### Data Type Checks

```python
ea = 0x401000

db.bytes.is_code_at(ea)
db.bytes.is_data_at(ea)
db.bytes.is_unknown_at(ea)
db.bytes.is_head_at(ea)
db.bytes.is_tail_at(ea)

# Specific data types
db.bytes.is_byte_at(ea)
db.bytes.is_word_at(ea)
db.bytes.is_dword_at(ea)
db.bytes.is_qword_at(ea)
db.bytes.is_float_at(ea)
db.bytes.is_string_literal_at(ea)
db.bytes.is_struct_at(ea)
```

### Creating Data Items

```python
from ida_domain.strings import StringType

# Create data types
db.bytes.create_byte_at(0x401000)
db.bytes.create_word_at(0x401000)
db.bytes.create_dword_at(0x401000)
db.bytes.create_qword_at(0x401000)
db.bytes.create_float_at(0x401000)
db.bytes.create_double_at(0x401000)

# Create arrays
db.bytes.create_dword_at(0x401000, count=10)

# Create string
db.bytes.create_string_at(0x401000, string_type=StringType.C)

# Create struct
db.bytes.create_struct_at(0x401000, count=1, tid=struct_type_id)
```

### Navigation

```python
# Next/previous head
next_head = db.bytes.get_next_head(0x401000)
prev_head = db.bytes.get_previous_head(0x401010)

# Next/previous address
next_addr = db.bytes.get_next_address(0x401000)
prev_addr = db.bytes.get_previous_address(0x401010)

# Data item size
size = db.bytes.get_data_size_at(0x401000)
```
