import os, sys, json, subprocess, shutil

src = 'uploads/0868343d7f9aaf226247fdd8d15ca75c.png'
dst = 'uploads/test_no_extension_file'
shutil.copy(src, dst)

result = subprocess.run(['python', 'ocr_runner.py', dst], capture_output=True, text=True, timeout=120)

if result.stdout:
    data = json.loads(result.stdout)
    if isinstance(data, list) and len(data) > 0:
        total = sum(len(p.get('lines', [])) for p in data)
        print("SUCCESS:", len(data), "pages,", total, "lines from no-extension file")
    elif isinstance(data, dict):
        err = data.get("error", "unknown error")
        print("ENGINE ERROR:", err)
    else:
        print("FAILED: unexpected output format")
else:
    print("FAILED: empty stdout")
    print("STDERR:", result.stderr[:500])

os.remove(dst)
