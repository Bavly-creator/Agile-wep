/**
 * Pulse AI Backend Server - FocusPulse
 * University Project - Team 7
 * Production-ready Express server supporting Gemini & OpenAI APIs,
 * SSE Streaming, Document Ingestion, and Study Material Generation.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import authRoutes from './server/auth.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static frontend files
const staticPath = path.join(__dirname, 'FocusPulse');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

app.use('/api/auth', authRoutes);

// In-Memory Document Store (backed by uploads)
const documentsStore = new Map();
const aiRateBuckets = new Map();
app.use('/api/ai', (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (aiRateBuckets.get(key) || []).filter(timestamp => now - timestamp < 15 * 60 * 1000);
  if (recent.length >= 60) return res.status(429).json({ error: 'Pulse AI is receiving too many requests from this connection. Please wait and try again.' });
  recent.push(now);
  aiRateBuckets.set(key, recent);
  next();
});

// Configure Multer for lecture uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Helper: Call Gemini API
async function callGemini(prompt, systemInstruction = '', stream = false) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const endpoint = stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [];
  if (systemInstruction) {
    contents.push({
      role: 'user',
      parts: [{ text: `[System Instruction: ${systemInstruction}]` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: "Understood. I will follow all instructions and grounding strictly." }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  return response;
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// 1. Health & Config Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    product: 'FocusPulse Pulse AI Engine',
    version: '1.0.0',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    documentsCount: documentsStore.size,
    timestamp: new Date().toISOString()
  });
});

// 2. Chat Endpoint (SSE Streaming & Standard JSON)
app.post('/api/ai/chat', async (req, res) => {
  const { message, mode = 'tutor', courseId, documentId, stream = true, chatHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Retrieve document text if lecture mode or combined mode
  let documentContext = '';
  let documentTitle = '';
  if (documentId && documentsStore.has(documentId)) {
    const doc = documentsStore.get(documentId);
    documentTitle = doc.title;
    documentContext = doc.text.substring(0, 15000); // ground context
  }
  if (documentId && !documentContext && (mode === 'lecture' || mode === 'combined')) {
    return res.status(404).json({ error: 'This lecture is no longer available in the AI service. Upload it again to use lecture-grounded answers.' });
  }
  if (!documentContext && typeof req.body.documentText === 'string') {
    documentContext = req.body.documentText.slice(0, 15000);
    documentTitle = String(req.body.documentTitle || 'Uploaded lecture').slice(0, 200);
  }

  // Define System Prompt according to Mode
  let systemPrompt = '';
  if (mode === 'lecture') {
    systemPrompt = `You are Pulse AI in LECTURE MODE for FocusPulse.
Strict Grounding Rule: You MUST answer strictly using the provided lecture material ("${documentTitle}").
You must provide precise inline citations using slide or section numbers, e.g. [Slide 3] or [Section 2.1].
If the student's question cannot be answered from the provided lecture text, clearly state:
"Based on the provided lecture materials, this topic is not covered. Would you like me to switch to General Tutor Mode to explain it?"
Lecture Material:\n${documentContext || 'No document attached. Request the student to upload or select a lecture.'}`;
  } else if (mode === 'combined') {
    systemPrompt = `You are Pulse AI in COMBINED MODE for FocusPulse.
Grounding Rule: Start by answering and citing the provided lecture material ("${documentTitle}") with [Slide X] or [Sec Y] citations.
Then, broaden the explanation with real-world examples, practical applications, or code snippets from wider computer science and academic knowledge.
Lecture Material:\n${documentContext || 'General context only.'}`;
  } else {
    // General Tutor Mode
    systemPrompt = `You are Pulse AI in GENERAL TUTOR MODE for FocusPulse, an elite university study assistant.
Help the student master the concept using clear conceptual explanations, real-world analogies, code examples when relevant, and high-yield study tips.
End your response with a quick self-check question to test understanding.`;
  }

  const prompt = `Student Question: ${message}`;

  // If streaming requested:
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const geminiRes = await callGemini(prompt, systemPrompt, true);
      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        // Parse Gemini SSE chunks and pipe text
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            } catch (e) {
              // raw line pass-through
            }
          }
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      console.error('Streaming error:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } else {
    // Non-streaming fallback
    try {
      const geminiRes = await callGemini(prompt, systemPrompt, false);
      const data = await geminiRes.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      res.json({ reply, mode, citations: mode === 'lecture' || mode === 'combined' });
    } catch (err) {
      console.error('Chat error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

// 3. Document Ingestion / Upload Endpoint
app.post('/api/ai/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { title, courseId } = req.body;

    let extractedText = '';
    let fileName = file ? file.originalname : 'Lecture Note.txt';
    const docTitle = title || fileName.replace(/\.[^/.]+$/, '');

    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv') {
        extractedText = fs.readFileSync(file.path, 'utf8');
      } else {
        fs.unlinkSync(file.path);
        return res.status(415).json({ error: 'This server currently extracts text from TXT, Markdown, JSON, and CSV files only. PDF, DOCX, PPTX, and image extraction is not configured.' });
      }
      if (!extractedText.trim()) { fs.unlinkSync(file.path); return res.status(400).json({ error: 'The uploaded file contains no readable text.' }); }
    } else if (req.body.text) {
      extractedText = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const docId = `doc_${randomUUID()}`;
    const docRecord = {
      id: docId,
      title: docTitle,
      fileName,
      courseId: courseId || 'general',
      text: extractedText,
      uploadedAt: new Date().toISOString(),
      size: file ? file.size : extractedText.length,
      slideCount: (extractedText.match(/\[Slide \d+\]/gi) || []).length
    };

    documentsStore.set(docId, docRecord);
    if (file) fs.unlinkSync(file.path);

    res.json({
      success: true,
      document: {
        id: docRecord.id,
        title: docRecord.title,
        courseId: docRecord.courseId,
        fileName: docRecord.fileName,
        slideCount: docRecord.slideCount,
        uploadedAt: docRecord.uploadedAt
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Generate Study Materials (Summaries, Flashcards, Quizzes)
app.post('/api/ai/generate', async (req, res) => {
  const { type, documentId, courseTitle, customTopic } = req.body;

  let context = typeof customTopic === 'string' ? customTopic.trim() : '';
  let title = courseTitle || 'Lecture Material';

  if (documentId && documentsStore.has(documentId)) {
    const doc = documentsStore.get(documentId);
    context = doc.text;
    title = doc.title;
  }

  if (!context) return res.status(400).json({ error: 'Add or select readable study material before generating notes, flashcards, or a quiz.' });

  try {
    if (type === 'summary') {
      const { summaryType = 'quick' } = req.body;
      const prompt = `Generate a ${summaryType} study summary for the following lecture material on "${title}".
Types:
- quick: 5 high-impact bullet points and key takeaways.
- detailed: structured comprehensive notes with section headers.
- exam: high-yield exam cheat sheet with definitions, key equations/rules, and potential exam questions.
- sections: slide-by-slide or section-by-section breakdown.

Material:
${context.substring(0, 10000)}

Output clean GitHub-flavored markdown.`;

      const response = await callGemini(prompt, 'You are an expert university professor creating study notes.');
      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('The AI provider returned no summary. Please try again.');

      res.json({ type: 'summary', summaryType, title, content });
    } else if (type === 'flashcards') {
      const prompt = `Based on the following academic material about "${title}", generate 6 high-yield study flashcards.
Return ONLY a valid JSON array of objects with "question", "answer", and "citation" fields.
Example format:
[
  { "question": "What is the primary role of a Scrum Master?", "answer": "To remove impediments and facilitate agile ceremonies.", "citation": "Slide 3" }
]
Material:
${context.substring(0, 8000)}`;

      const response = await callGemini(prompt, 'Return strictly valid JSON array only. No markdown formatting or code blocks.');
      const data = await response.json();
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const flashcards = JSON.parse(rawText);

      res.json({ type: 'flashcards', title, flashcards });
    } else if (type === 'quiz') {
      const prompt = `Based on the following material about "${title}", generate a 5-question multiple choice practice quiz.
Return ONLY a valid JSON array of objects with this schema:
[
  {
    "question": "Which artifact defines the single source of requirements?",
    "options": ["Sprint Backlog", "Product Backlog", "Increment", "Burndown Chart"],
    "correctIndex": 1,
    "explanation": "The Product Backlog is the single source of truth for all requirements.",
    "citation": "Slide 4"
  }
]
Material:
${context.substring(0, 8000)}`;

      const response = await callGemini(prompt, 'Return strictly valid JSON array only. No markdown formatting or code blocks.');
      const data = await response.json();
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const quiz = JSON.parse(rawText);

      res.json({ type: 'quiz', title, quiz });
    } else {
      res.status(400).json({ error: 'Unknown generation type. Use summary, flashcards, or quiz.' });
    }
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`FocusPulse - Pulse AI Server running on http://localhost:${PORT}`);
  console.log(`Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'}`);
  console.log(`===============================================`);
});
