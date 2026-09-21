import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import verifyUser from '../middleware/authMiddleware.js';
import Info from '../models/Info.js';

const router = express.Router();
const normalizeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getSensorQuery = (sensorId, user) => {
  const numericSensorId = normalizeNumber(sensorId);
  if (numericSensorId === null) return null;

  const query = { id: numericSensorId };
  const numericUser = normalizeNumber(user);
  if (numericUser !== null) query.user = numericUser;
  return query;
};

const safeUnlink = (filePath) => {
  fs.unlink(filePath, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error('Remove old logger image error:', error);
    }
  });
};

const isLegacyUnknownImage = (filename = '') => /^logger_unknown\./.test(filename);

// Cấu hình multer lưu file vào thư mục upload/
const uploadDir = path.join(path.resolve(), 'upload');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sensorId = normalizeNumber(req.body.sensorId) ?? 'unknown';
    const user = normalizeNumber(req.body.user) ?? 'unknown';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `logger_${user}_${sensorId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép upload file ảnh (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Upload ảnh cho logger
router.post('/', verifyUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file nào được upload' });
    }

    const sensorId = req.body.sensorId;
    const query = getSensorQuery(sensorId, req.body.user);
    if (!query) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, message: 'Thiếu sensorId' });
    }

    const oldSensor = await Info.findOne(query).lean();
    if (!oldSensor) {
      safeUnlink(req.file.path);
      return res.status(404).json({ success: false, message: 'Không tìm thấy logger trong user/nhóm này' });
    }

    await Info.findOneAndUpdate(
      query,
      { $set: { image: req.file.filename } },
      { new: true }
    );

    if (oldSensor.image && oldSensor.image !== req.file.filename) {
      safeUnlink(path.join(uploadDir, oldSensor.image));
    }

    res.status(200).json({
      success: true,
      message: 'Upload ảnh thành công',
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi upload ảnh' });
  }
});

// Lấy ảnh của logger theo sensor ID
router.get('/image/:id', async (req, res) => {
  try {
    const sensorId = req.params.id;
    const query = getSensorQuery(sensorId, req.query.user);
    if (!query) {
      return res.status(400).json({ success: false, message: 'Thiếu sensorId' });
    }
    const sensor = await Info.findOne(query);

    if (!sensor || !sensor.image || isLegacyUnknownImage(sensor.image)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh' });
    }

    const filePath = path.join(uploadDir, sensor.image);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File ảnh không tồn tại' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy ảnh' });
  }
});

export default router;
