const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const uploadController = require('../controllers/uploadController');

// Configure Multer for temp storage
const uploadDir = path.join(__dirname, '../../uploads');
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const handleUpload = (req, res, next) => {
    upload.single('video')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                 return res.status(400).json({ 
                    error: `Unexpected field name. Please use key 'video' for your file.` 
                });
            }
            return res.status(400).json({ error: `Multer error: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ error: `Upload error: ${err.message}` });
        }
        next();
    });
};

// Routes
router.post('/upload', handleUpload, uploadController.uploadVideo);
router.get('/status/:fileId', uploadController.getStatus);

module.exports = router;
