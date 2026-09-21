#!/bin/bash
set -e

FRONTEND_DIR="/root/KHCA/iotWater/frontend"
DEPLOY_DIR="/var/www/iotWater"
BACKUP_DIR="/root/iotwater-backups/www-$(date +%Y%m%d-%H%M%S)"

echo "=== 1. Build ==="
cd "$FRONTEND_DIR"
npm run build

echo "=== 2. Backup ban dang chay ==="
cp -a "$DEPLOY_DIR" "$BACKUP_DIR"
echo "    -> $BACKUP_DIR"

echo "=== 3. Chep ban moi ==="
rm -rf "${DEPLOY_DIR:?}"/*
cp -r dist/* "$DEPLOY_DIR"/

echo "=== 4. Nen san .gz cho nginx gzip_static ==="
find "$DEPLOY_DIR" -type f \( -name "*.js" -o -name "*.css" -o -name "*.svg" -o -name "*.json" \) \
  -exec gzip -9 -k -f {} \;

echo "=== 5. Phan quyen ==="
chown -R www-data:www-data "$DEPLOY_DIR"
find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;
find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;

echo "=== Deploy frontend xong. Rollback: rm -rf $DEPLOY_DIR/* && cp -r $BACKUP_DIR/* $DEPLOY_DIR/ ==="
