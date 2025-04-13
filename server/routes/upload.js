import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Dùng memoryStorage vì dữ liệu bạn nhận là base64
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route nhận ảnh
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname);

    const base64Data = req.file.buffer.toString('utf-8');

    // Giải mã base64
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const uploadDir = path.join(path.resolve(), 'upload');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    const filePath = path.join(uploadDir, 'image.jpeg');

    // Ghi file đã decode ra đúng định dạng
    fs.writeFileSync(filePath, imageBuffer);

    res.status(200).json({
      success: true,
      message: 'Image uploaded and saved successfully',
      filePath: filePath
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Error processing image' });
  }
});

export default router;
