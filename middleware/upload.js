'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Type de fichier invalide. Formats acceptés : JPEG, PNG, WebP.');
      err.code = 'INVALID_TYPE';
      cb(err);
    }
  },
});

async function processAndSaveImage(buffer) {
  const uuid = crypto.randomUUID();
  const filename = `${uuid}.webp`;
  const filepath = path.join(IMAGES_DIR, filename);

  await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(filepath);

  return `images/${filename}`;
}

function deleteImage(imagePath) {
  if (!imagePath) return;
  const filepath = path.join(DATA_DIR, imagePath);
  fs.unlink(filepath, () => {});
}

// Wraps upload.single as a promise so routes can catch Multer errors inline.
function uploadSingle(fieldName) {
  const singleUpload = upload.single(fieldName);
  return (req, res) =>
    new Promise((resolve, reject) => {
      singleUpload(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
}

module.exports = { upload, uploadSingle, processAndSaveImage, deleteImage };
