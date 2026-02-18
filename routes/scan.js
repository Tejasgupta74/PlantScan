const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze', ensureAuthenticated, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const imageData = req.file.buffer.toString('base64');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      'Analyze this plant image and provide detailed analysis of its species, health, and care recommendations. Plain text only.',
      { inlineData: { mimeType: req.file.mimetype, data: imageData } },
    ]);
    const plantInfo = result.response.text();
    // remove all asterisks from the AI output to avoid '*' appearing in UI/PDF
    const cleanPlantInfo = (plantInfo || "").replace(/\*/g, "");
    res.json({ result: cleanPlantInfo, image: `data:${req.file.mimetype};base64,${imageData}` });
  } catch (err) {
    console.error('Error analyzing image:', err);
    res.status(500).json({ error: 'Error analyzing image' });
  }
});

router.post('/download', ensureAuthenticated, async (req, res) => {
  try {
    const { result, image } = req.body;
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="plant_report.pdf"');
      res.send(pdfBuffer);
    });
    doc.fontSize(24).text('Plant Analysis Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    const cleanResult = (result || '').replace(/\*/g, '');
    doc.fontSize(12).text(cleanResult || 'No data available');
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      doc.addPage();
      doc.image(buffer, { fit: [500, 400], align: 'center', valign: 'center' });
    }
    doc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ error: 'Error generating PDF report' });
  }
});

module.exports = router;
