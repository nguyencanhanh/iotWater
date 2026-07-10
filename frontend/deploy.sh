#!/bin/bash

# Dừng script nếu có lỗi xảy ra
set -e

# Đường dẫn thư mục frontend
FRONTEND_DIR="/root/KHCA/iotWater/frontend"
DEPLOY_DIR="/var/www/iotWater"

echo "=== 1. Di chuyển vào thư mục Frontend ==="
cd "$FRONTEND_DIR"

echo "=== 2. Bắt đầu build ứng dụng ==="
npm run build

echo "=== 3. Dọn dẹp thư mục deploy cũ ==="
rm -rf "$DEPLOY_DIR"/*

echo "=== 4. Sao chép file build mới sang thư mục Nginx ==="
cp -r dist/* "$DEPLOY_DIR"/

echo "=== 5. Cấp quyền cho Nginx ==="
chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

echo "=== Đã cập nhật bản Release Frontend thành công! ==="
