#!/bin/bash
# Deploy script: build local + push deploy branch lên GitHub
# Chạy: bash scripts/deploy.sh

set -e

echo "=== 1. Đảm bảo đang ở main ==="
git checkout main
git pull

echo "=== 2. Build Next.js local ==="
pnpm build

echo "=== 3. Switch sang deploy branch (force tạo lại từ main) ==="
git checkout -B deploy main

echo "=== 4. Force-add .next/ ==="
git add -f .next

echo "=== 5. Commit ==="
git -c core.autocrlf=false commit -m "build: $(date +%Y-%m-%d_%H-%M) snapshot" || echo "Nothing to commit"

echo "=== 6. Force push deploy branch ==="
git push origin deploy --force

echo "=== 7. Quay về main ==="
git checkout main

echo ""
echo "============================================================"
echo "  ✅ Deploy branch đã push lên GitHub"
echo "  Giờ vào cPanel Terminal chạy: bash ~/update.sh"
echo "============================================================"
