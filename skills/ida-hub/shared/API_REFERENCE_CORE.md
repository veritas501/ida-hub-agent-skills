# IDA Domain Quick Reference: Core APIs

This file is a topic-focused API reference. The section content below is preserved unchanged from the pre-split reference.

## Database

The `Database` class is the main entry point for all operations.

### Opening a Database

```python
from ida_domain import Database

# Library mode: Open a binary file
with Database.open("binary.exe", save_on_close=True) as db:
    print(f"Module: {db.module}")

# IDA GUI mode: Get current database
db = Database.open()
```

### Database Properties

| Property | Type | Description |
|----------|------|-------------|
| `db.path` | `str` | Input file path |
| `db.module` | `str` | Module name |
| `db.base_address` | `ea_t` | Image base address |
| `db.minimum_ea` | `ea_t` | Minimum effective address |
| `db.maximum_ea` | `ea_t` | Maximum effective address |
| `db.architecture` | `str` | Processor architecture (e.g., "metapc") |
| `db.bitness` | `int` | Application bitness (32 or 64) |
| `db.format` | `str` | File format type |
| `db.md5` | `str` | MD5 hash of input file |
| `db.sha256` | `str` | SHA256 hash of input file |
| `db.crc32` | `int` | CRC32 checksum |
| `db.filesize` | `int` | Input file size |
| `db.load_time` | `str` | Database load timestamp |
| `db.execution_mode` | `ExecutionMode` | User or Kernel mode |
| `db.compiler_information` | `CompilerInformation` | Compiler details |
| `db.current_ea` | `ea_t` | Current screen address (read/write) |
| `db.start_ip` | `ea_t` | Start instruction pointer |

### Database Methods

```python
# Check if address is valid
db.is_valid_ea(0x401000)  # True/False

# Execute a script file
db.execute_script("my_script.py")
```

### Entity Handlers

Access entity handlers via properties:

```python
db.functions      # Functions handler
db.instructions   # Instructions handler
db.segments       # Segments handler
db.heads          # Heads handler
db.bytes          # Bytes handler
db.strings        # Strings handler
db.names          # Names handler
db.comments       # Comments handler
db.entries        # Entries handler
db.xrefs          # Cross-references handler
db.types          # Types handler
db.signature_files # FLIRT signatures handler
```

---

## Functions

### Iterating Functions

```python
# All functions
for func in db.functions:
    name = db.functions.get_name(func)
    print(f"{name}: 0x{func.start_ea:08X}-0x{func.end_ea:08X}")

# Function count
print(f"Total: {len(db.functions)} functions")

# Functions in address range
for func in db.functions.get_between(0x401000, 0x402000):
    print(db.functions.get_name(func))
```

### Finding Functions

```python
# By address (containing)
func = db.functions.get_at(0x401234)

# By name
func = db.functions.get_function_by_name("main")

# Next function after address
func = db.functions.get_next(0x401000)
```

### Function Properties

```python
func = db.functions.get_at(0x401000)

# Name and signature
name = db.functions.get_name(func)
sig = db.functions.get_signature(func)  # e.g., "int __cdecl(int, char **)"

# Disassembly and pseudocode
disasm = db.functions.get_disassembly(func)  # List[str]
pseudo = db.functions.get_pseudocode(func)   # List[str]
micro = db.functions.get_microcode(func)     # List[str]

# Control flow
flowchart = db.functions.get_flowchart(func)

# Instructions
for insn in db.functions.get_instructions(func):
    print(f"0x{insn.ea:08X}: {db.instructions.get_mnemonic(insn)}")

# Call graph
callers = db.functions.get_callers(func)  # Functions that call this
callees = db.functions.get_callees(func)  # Functions this calls

# Flags
flags = db.functions.get_flags(func)
if FunctionFlags.THUNK in flags:
    print("This is a thunk function")
```

### Function Manipulation

```python
# Create/remove functions
db.functions.create(0x401000)
db.functions.remove(0x401000)

# Rename
db.functions.set_name(func, "my_function")

# Comments
db.functions.set_comment(func, "Main entry point")
comment = db.functions.get_comment(func)
```

### Local Variables

```python
# Get all local variables
for lvar in db.functions.get_local_variables(func):
    print(f"{lvar.name}: {lvar.type_str} (arg={lvar.is_argument})")

# Find by name
lvar = db.functions.get_local_variable_by_name(func, "argc")

# Get references to a variable
refs = db.functions.get_local_variable_references(func, lvar)
for ref in refs:
    print(f"Line {ref.line_number}: {ref.access_type.name} in {ref.context}")
```

---

## Instructions

### Iterating Instructions

```python
# All instructions in database
for insn in db.instructions:
    mnem = db.instructions.get_mnemonic(insn)
    print(f"0x{insn.ea:08X}: {mnem}")

# Instructions in range
for insn in db.instructions.get_between(0x401000, 0x401100):
    print(db.instructions.get_disassembly(insn))
```

### Decoding Instructions

```python
# Decode at address
insn = db.instructions.get_at(0x401000)

# Previous instruction
prev = db.instructions.get_previous(0x401005)

# Check validity
if db.instructions.is_valid(insn):
    print("Valid instruction")
```

### Instruction Properties

```python
insn = db.instructions.get_at(0x401000)

# Mnemonic and disassembly
mnem = db.instructions.get_mnemonic(insn)      # e.g., "mov"
disasm = db.instructions.get_disassembly(insn) # e.g., "mov eax, ebx"

# Instruction type checks
if db.instructions.is_call_instruction(insn):
    print("This is a call")
if db.instructions.is_indirect_jump_or_call(insn):
    print("Indirect control flow")
if db.instructions.breaks_sequential_flow(insn):
    print("Flow stops here (ret, jmp, etc.)")
```

### Operands

```python
# Get operand count
count = db.instructions.get_operands_count(insn)

# Get specific operand
op0 = db.instructions.get_operand(insn, 0)

# Get all operands
for op in db.instructions.get_operands(insn):
    info = op.get_info()
    print(f"  Op{info.number}: {info.type.name}, access={info.access_type.name}")
```

---

## Operands

Operands are accessed through instructions.

### Getting Operands

```python
insn = db.instructions.get_at(0x401000)

# All operands
for op in db.instructions.get_operands(insn):
    info = op.get_info()
    print(f"Op{info.number}: {info.type.name}")

# Specific operand
op0 = db.instructions.get_operand(insn, 0)
op1 = db.instructions.get_operand(insn, 1)
```

### Operand Information

```python
op = db.instructions.get_operand(insn, 0)
info = op.get_info()

print(f"Number: {info.number}")
print(f"Type: {info.type.name}")           # REGISTER, MEMORY, IMMEDIATE, etc.
print(f"Data type: {info.data_type.name}") # BYTE, WORD, DWORD, etc.
print(f"Access: {info.access_type.name}")  # READ, WRITE, READ_WRITE
print(f"Size: {info.size_bytes} bytes")
```

### Register Operands

```python
from ida_domain.operands import RegisterOperand

if isinstance(op, RegisterOperand):
    print(f"Register: {op.get_register_name()}")
    print(f"Register number: {op.register_number}")
```

### Immediate Operands

```python
from ida_domain.operands import ImmediateOperand

if isinstance(op, ImmediateOperand):
    print(f"Value: 0x{op.get_value():X}")
    if op.is_address():
        print(f"Name: {op.get_name()}")
```

### Memory Operands

```python
from ida_domain.operands import MemoryOperand

if isinstance(op, MemoryOperand):
    if op.is_direct_memory():
        print(f"Address: 0x{op.get_address():X}")
        print(f"Name: {op.get_name()}")
    elif op.is_register_based():
        print(f"Displacement: {op.get_displacement()}")
```

---

## FlowChart

Control flow graphs for functions.

### Creating FlowCharts

```python
from ida_domain.flowchart import FlowChartFlags

func = db.functions.get_at(0x401000)

# Basic flowchart
fc = db.functions.get_flowchart(func)

# With predecessor info
fc = db.functions.get_flowchart(func, FlowChartFlags.PREDS)
```

### Iterating Basic Blocks

```python
# All blocks
for block in fc:
    print(f"Block {block.id}: 0x{block.start_ea:08X}-0x{block.end_ea:08X}")

# Block count
print(f"Total: {len(fc)} basic blocks")

# By index
first_block = fc[0]
```

### Basic Block Navigation

```python
block = fc[0]

# Successors (blocks this leads to)
for succ in block.get_successors():
    print(f"  -> Block {succ.id}")

# Predecessors (blocks leading here)
for pred in block.get_predecessors():
    print(f"  <- Block {pred.id}")

# Counts
print(f"Successors: {block.count_successors()}")
print(f"Predecessors: {block.count_predecessors()}")
```

### Block Instructions

```python
for block in fc:
    print(f"Block {block.id}:")
    for insn in block.get_instructions():
        print(f"  0x{insn.ea:08X}: {db.instructions.get_mnemonic(insn)}")
```
