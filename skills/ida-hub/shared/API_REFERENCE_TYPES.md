# IDA Domain Quick Reference: Types APIs

This file is a topic-focused API reference. The section content below is preserved unchanged from the pre-split reference.

## Types

### Getting Types

```python
# By name
tinfo = db.types.get_by_name("DWORD")

# At address
tinfo = db.types.get_at(0x401000)

# Get type details
if tinfo:
    details = db.types.get_details(tinfo)
    print(f"Name: {details.name}")
    print(f"Size: {details.size}")
    print(f"Attributes: {details.attributes}")
```

### Iterating Types

```python
from ida_domain.types import TypeKind

# All named types
for tinfo in db.types.get_all():
    details = db.types.get_details(tinfo)
    print(f"{details.name}: {details.size} bytes")

# Numbered types
for tinfo in db.types.get_all(type_kind=TypeKind.NUMBERED):
    print(db.types.get_details(tinfo).name)
```

### Applying Types

```python
from ida_domain.types import TypeApplyFlags

tinfo = db.types.get_by_name("DWORD")
db.types.apply_at(tinfo, 0x402000, TypeApplyFlags.DEFINITE)
```

### Type Libraries

```python
from pathlib import Path

# Load library
lib = db.types.load_library(Path("mssdk.til"))

# Import types from library
db.types.import_from_library(lib)

# Import specific type
db.types.import_type(lib, "HANDLE")

# Create new library
new_lib = db.types.create_library(Path("my_types.til"), "My Types")

# Export types to library
db.types.export_to_library(new_lib)

# Save library
db.types.save_library(new_lib, Path("my_types.til"))

# Unload library
db.types.unload_library(lib)
```

### Parsing Type Declarations

```python
from ida_domain.types import TypeFormattingFlags

# Parse header file
errors = db.types.parse_header_file(lib, Path("my_header.h"))

# Parse declarations from string
errors = db.types.parse_declarations(lib, "typedef int MYINT;")

# Parse single declaration
tinfo = db.types.parse_one_declaration(lib, "int foo;", "foo")
```

### Type Comments

```python
db.types.set_comment(tinfo, "This is my type")
comment = db.types.get_comment(tinfo)
```

---

## Signature Files

FLIRT signature files for library function recognition.

### Applying Signatures

```python
from pathlib import Path

# Apply signature file
results = db.signature_files.apply(Path("vc32rtf.sig"))
for result in results:
    print(f"File: {result.path}")
    print(f"Matches: {result.matches}")
    for match in result.functions:
        print(f"  0x{match.addr:08X}: {match.name}")

# Probe only (don't save changes)
results = db.signature_files.apply(Path("vc32rtf.sig"), probe_only=True)
```

### Creating Signatures

```python
# Create .pat and .sig files from database
files = db.signature_files.create()
for path in files:
    print(f"Created: {path}")

# Create only .pat file
files = db.signature_files.create(pat_only=True)
```

### Listing Available Signatures

```python
# Get all available .sig files
for path in db.signature_files.get_files():
    print(path)

# From custom directories
sig_files = db.signature_files.get_files([Path("/custom/sigs")])
```
