const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

// Path where we store uploaded OCR images
const uploadRoot = path.join(__dirname, "../../uploads");
const ocrUploadFolder = path.join(uploadRoot, "ocr");

// Ensure directory exists
fs.mkdirSync(ocrUploadFolder, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ocrUploadFolder),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanedName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();
    cb(null, `${timestamp}_${cleanedName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"), false);
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Upload endpoint. Field name: "image"
router.post("/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded with field name 'image'" });
    }

    const relativePath = path.join("uploads", "ocr", req.file.filename);
    const filePath = relativePath.split(path.sep).join("/");

    return res.json({
      success: true,
      message: "File uploaded successfully",
      filePath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "File upload failed", detail: error.message });
  }
});

module.exports = router;
