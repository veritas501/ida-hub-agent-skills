# IDA Domain Quick Reference: Symbols APIs

This file is a topic-focused API reference. The section content below is preserved unchanged from the pre-split reference.

## Strings

### Iterating Strings

```python
# All strings
for s in db.strings:
    print(f"0x{s.address:08X}: {s}")

# String count
print(f"Total: {len(db.strings)} strings")

# By index
first_string = db.strings[0]

# Strings in range
for s in db.strings.get_between(0x401000, 0x500000):
    print(f"0x{s.address:08X}: {s}")
```

### String Properties

```python
s = db.strings.get_at(0x401000)
if s:
    print(f"Address: 0x{s.address:08X}")
    print(f"Length: {s.length}")
    print(f"Type: {s.type.name}")        # C, PASCAL, etc.
    print(f"Encoding: {s.encoding}")     # e.g., "utf-8"
    print(f"Contents: {str(s)}")         # Decoded string
    print(f"Raw bytes: {bytes(s)}")      # Raw UTF-8 bytes
```

### Rebuilding String List

```python
from ida_domain.strings import StringListConfig, StringType

# Rebuild with custom config
config = StringListConfig(
    string_types=[StringType.C, StringType.C_16],
    min_len=4,
    only_ascii_7bit=False
)
db.strings.rebuild(config)

# Clear string list
db.strings.clear()
```

---

## Names

### Iterating Names

```python
# All named locations
for ea, name in db.names:
    print(f"0x{ea:08X}: {name}")

# Name count
print(f"Total: {len(db.names)} names")

# By index
ea, name = db.names[0]
```

### Getting Names

```python
# Name at address
name = db.names.get_at(0x401000)

# Demangled name
demangled = db.names.get_demangled_name(0x401000)

# Demangle any name
clean_name = db.names.demangle_name("_Z3fooi")
```

### Setting Names

```python
from ida_domain.names import SetNameFlags

# Set name
db.names.set_name(0x401000, "my_function")

# Set with flags
db.names.set_name(0x401000, "my_func", SetNameFlags.PUBLIC)

# Force set (tries variations if exists)
db.names.force_name(0x401000, "duplicate_name")

# Delete name
db.names.delete(0x401000)
```

### Name Properties

```python
# Validation
db.names.is_valid_name("my_function")  # True/False

# Public/weak status
db.names.is_public_name(0x401000)
db.names.make_name_public(0x401000)
db.names.make_name_non_public(0x401000)

db.names.is_weak_name(0x401000)
db.names.make_name_weak(0x401000)
db.names.make_name_non_weak(0x401000)
```

---

## Comments

### Getting Comments

```python
from ida_domain.comments import CommentKind, ExtraCommentKind

# Regular comment at address
info = db.comments.get_at(0x401000)
if info:
    print(f"Comment: {info.comment}")

# Repeatable comment
info = db.comments.get_at(0x401000, CommentKind.REPEATABLE)

# Extra comments (anterior/posterior)
anterior = db.comments.get_extra_at(0x401000, 0, ExtraCommentKind.ANTERIOR)
posterior = db.comments.get_extra_at(0x401000, 0, ExtraCommentKind.POSTERIOR)

# All extra comments
for comment in db.comments.get_all_extra_at(0x401000, ExtraCommentKind.ANTERIOR):
    print(comment)
```

### Setting Comments

```python
# Set regular comment
db.comments.set_at(0x401000, "This is a comment")

# Set repeatable comment
db.comments.set_at(0x401000, "Repeatable", CommentKind.REPEATABLE)

# Set extra comments
db.comments.set_extra_at(0x401000, 0, "Before line", ExtraCommentKind.ANTERIOR)
db.comments.set_extra_at(0x401000, 0, "After line", ExtraCommentKind.POSTERIOR)
```

### Deleting Comments

```python
db.comments.delete_at(0x401000)
db.comments.delete_at(0x401000, CommentKind.REPEATABLE)
db.comments.delete_extra_at(0x401000, 0, ExtraCommentKind.ANTERIOR)
```

### Iterating Comments

```python
# All comments
for info in db.comments:
    print(f"0x{info.ea:08X}: {info.comment}")

# Filter by kind
for info in db.comments.get_all(CommentKind.REPEATABLE):
    print(f"0x{info.ea:08X}: {info.comment}")
```

---

## Entries

Entry points include exported functions and program entry.

### Iterating Entries

```python
# All entries
for entry in db.entries:
    print(f"0x{entry.address:08X}: {entry.name} (ord={entry.ordinal})")

# Entry count
print(f"Total: {len(db.entries)} entries")

# By index
entry = db.entries[0]
```

### Finding Entries

```python
# By ordinal
entry = db.entries.get_by_ordinal(1)

# By address
entry = db.entries.get_at(0x401000)

# By name
entry = db.entries.get_by_name("main")

# Check existence
if db.entries.exists(ordinal=1):
    print("Entry exists")
```

### Entry Properties

```python
entry = db.entries.get_at(0x401000)
if entry:
    print(f"Address: 0x{entry.address:08X}")
    print(f"Name: {entry.name}")
    print(f"Ordinal: {entry.ordinal}")
    if entry.has_forwarder():
        print(f"Forwarder: {entry.forwarder_name}")
```

### Entry Manipulation

```python
# Add entry
db.entries.add(0x401000, "my_export", ordinal=100)

# Rename
db.entries.rename(100, "new_name")

# Set forwarder
db.entries.set_forwarder(100, "other_dll.function")

# Get all forwarders
for fwd in db.entries.get_forwarders():
    print(f"Ordinal {fwd.ordinal}: {fwd.name}")
```

### Iterators

```python
# All ordinals
for ordinal in db.entries.get_ordinals():
    print(ordinal)

# All addresses
for ea in db.entries.get_addresses():
    print(f"0x{ea:08X}")

# All names
for name in db.entries.get_names():
    print(name)
```

---

## Xrefs

Cross-references show relationships between addresses.

### Getting Xrefs

```python
from ida_domain.xrefs import XrefsFlags

# All xrefs TO an address
for xref in db.xrefs.to_ea(0x401000):
    print(f"From 0x{xref.from_ea:08X}, type={xref.type.name}")

# All xrefs FROM an address
for xref in db.xrefs.from_ea(0x401000):
    print(f"To 0x{xref.to_ea:08X}, type={xref.type.name}")

# Filter by flags
for xref in db.xrefs.to_ea(0x401000, XrefsFlags.CODE_NOFLOW):
    print(f"Code xref from 0x{xref.from_ea:08X}")
```

### Convenience Methods

```python
# Code references (addresses only)
for ea in db.xrefs.code_refs_to_ea(0x401000):
    print(f"Code ref from 0x{ea:08X}")

for ea in db.xrefs.code_refs_from_ea(0x401000):
    print(f"Code ref to 0x{ea:08X}")

# Data references
for ea in db.xrefs.data_refs_to_ea(0x401000):
    print(f"Data ref from 0x{ea:08X}")

# Calls specifically
for ea in db.xrefs.calls_to_ea(0x401000):
    print(f"Called from 0x{ea:08X}")

for ea in db.xrefs.calls_from_ea(0x401000):
    print(f"Calls 0x{ea:08X}")

# Jumps
for ea in db.xrefs.jumps_to_ea(0x401000):
    print(f"Jump from 0x{ea:08X}")

# Data access
for ea in db.xrefs.reads_of_ea(0x402000):
    print(f"Read by 0x{ea:08X}")

for ea in db.xrefs.writes_to_ea(0x402000):
    print(f"Written by 0x{ea:08X}")
```

### Caller Information

```python
# Detailed caller info for a function
for caller in db.xrefs.get_callers(0x401000):
    print(f"Called from 0x{caller.ea:08X}")
    print(f"  Function: {caller.name}")
    print(f"  Type: {caller.xref_type.name}")
```

### Xref Properties

```python
xref = next(db.xrefs.to_ea(0x401000))

# Basic info
print(f"From: 0x{xref.from_ea:08X}")
print(f"To: 0x{xref.to_ea:08X}")
print(f"Type: {xref.type.name}")
print(f"Is code: {xref.is_code}")
print(f"User defined: {xref.user}")

# Type checks
xref.is_call()   # Is a call reference
xref.is_jump()   # Is a jump reference
xref.is_read()   # Is a data read
xref.is_write()  # Is a data write
xref.is_flow()   # Is ordinary flow
```
