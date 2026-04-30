import os
import re

root = r'C:\KryptoNow\KryptoNow-app'

# Matches [anything](http://anything) and replaces with just the inner text
pattern = re.compile(r'\[([^\]]+)\]\(https?://[^\)]+\)')

fixed_files = []

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d != 'node_modules']
    for filename in filenames:
        if filename.endswith(('.ts', '.tsx', '.js', '.jsx')):
            filepath = os.path.join(dirpath, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                fixed = pattern.sub(r'\1', content)
                # Run multiple times to catch nested corruptions like [[x](http://x)](http://x)
                for _ in range(5):
                    prev = fixed
                    fixed = pattern.sub(r'\1', fixed)
                    if fixed == prev:
                        break
                if fixed != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(fixed)
                    fixed_files.append(filename)
                    print(f'Fixed: {filename}')
            except Exception as e:
                print(f'Error processing {filename}: {e}')

if not fixed_files:
    print('No corrupted files found.')
else:
    print(f'\nDone! Fixed {len(fixed_files)} file(s)')

# Verify the most problematic files
print('\n--- Verification ---')
check_files = [
    r'hooks\useTransactions.ts',
    r'app\dashboard.tsx',
    r'app\buy.tsx',
]
for f in check_files:
    filepath = os.path.join(root, f)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as fh:
            content = fh.read()
        matches = pattern.findall(content)
        if matches:
            print(f'STILL CORRUPTED in {f}: {matches[:3]}')
        else:
            print(f'CLEAN: {f}')
