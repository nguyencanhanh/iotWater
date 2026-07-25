#!/bin/bash
set -e

FRONTEND_DIR="/root/KHCA/iotWater/frontend"
DEPLOY_DIR="/var/www/iotWaterTest"

echo "=== 1. Di chuyển vào thư mục Frontend ==="
cd "$FRONTEND_DIR"

echo "=== 2. Bắt đầu build ứng dụng ở chế độ TEST ==="
npm run build -- --mode test

echo "=== 3. Dọn dẹp thư mục deploy test cũ ==="
rm -rf "$DEPLOY_DIR"/* || true
mkdir -p "$DEPLOY_DIR"

echo "=== 4. Sao chép file build mới sang thư mục Test ==="
cp -r dist/* "$DEPLOY_DIR"/

echo "=== 5. Cấp quyền cho Nginx ==="
chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

echo "=== Đã cập nhật bản Test Frontend thành công! ==="
