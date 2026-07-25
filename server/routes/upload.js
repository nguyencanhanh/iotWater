import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import verifyUser from '../middleware/authMiddleware.js';
import Info from '../models/Info.js';

const router = express.Router();

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
    const sensorId = req.body.sensorId || 'unknown';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `logger_${sensorId}${ext}`);
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
    if (!sensorId) {
      return res.status(400).json({ success: false, message: 'Thiếu sensorId' });
    }

    // Cập nhật trường image trong Info
    await Info.findOneAndUpdate(
      { id: Number(sensorId) },
      { $set: { image: req.file.filename } },
      { new: true }
    );

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
    const sensor = await Info.findOne({ id: Number(sensorId) });

    if (!sensor || !sensor.image) {
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
