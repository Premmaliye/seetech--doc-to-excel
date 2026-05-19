import subprocess
import json
import sys

result = subprocess.run(
    ["python", "ocr_runner.py", "uploads/0868343d7f9aaf226247fdd8d15ca75c.png"],
    capture_output=True, text=True, timeout=120
)

print("=== STDERR ===")
print(result.stderr[:500] if result.stderr else "(none)")
print("=== STDOUT (first 500 chars) ===")
print(result.stdout[:500] if result.stdout else "(EMPTY - this is the problem)")

try:
    data = json.loads(result.stdout)
    if isinstance(data, list):
        total_lines = sum(len(p.get("lines", [])) for p in data)
        print(f"\n✅ SUCCESS: {len(data)} pages, {total_lines} lines extracted")
    elif isinstance(data, dict) and "error" in data:
        print(f"\n❌ ENGINE ERROR: {data['error']}")
except Exception as e:
    print(f"\n❌ JSON PARSE FAILED: {e}")
