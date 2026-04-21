#!/bin/bash

SRC_DB=iot
DEST_DB=iot_backup

# Xoá DB backup cũ
mongosh --eval "db.getSiblingDB('$DEST_DB').dropDatabase()"

# Dump DB gốc
mongodump --db $SRC_DB --out /tmp/mongo_clone

# Restore sang DB backup
mongorestore --db $DEST_DB /tmp/mongo_clone/$SRC_DB

# Xoá file tạm
rm -rf /tmp/mongo_clone

echo "Backup clone done at $(date)"
