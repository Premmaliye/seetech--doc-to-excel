/** DocuStruct AI Unified Server */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { generateAIResponse } from "./services/aiService.js";
import { performOCR } from "./services/ocrService.js";
import { processDocument } from "./pipeline/documentProcessor.js";
import axios from "axios";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const HMR_PORT = 24679;

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });

  // Global Request Logger
  app.use((req, res, next) => {
    if (req.url !== "/api/health") {
      console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`);
    }
    next();
  });

  // --- API ROUTES ---

  app.post("/api/extract", async (req, res) => {
    console.log(">>> [SERVER] AI Extraction Request Received");
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid request: 'messages' is required." });
      }
      const result = await generateAIResponse(messages);
      res.json(result);
    } catch (err: any) {
      console.error("CRITICAL: AI Pipeline Failure", err.message);
      res.status(500).json({ error: err.message || "AI extraction failed" });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    console.log(">>> [SERVER] File Upload Request Received");
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      // Rename uploaded file to include proper extension (needed for format detection)
      const originalExt = path.extname(req.file.originalname).toLowerCase() || 
        (req.file.mimetype === "image/jpeg" ? ".jpg" : 
         req.file.mimetype === "image/png" ? ".png" : 
         req.file.mimetype === "application/pdf" ? ".pdf" : "");
      
      let filePath = req.file.path;
      if (originalExt && !filePath.endsWith(originalExt)) {
        const newPath = `${filePath}${originalExt}`;
        fs.renameSync(filePath, newPath);
        filePath = newPath;
      }

      const customPrompt = req.body.prompt;
      const result = await processDocument(filePath, customPrompt);
      
      let response;
      if (result && result.sheets) {
        // Ensure every sheet has a formatId (required by the Excel exporter)
        const detectedId = result.detectedFormatId || "format-a";
        response = {
          detectedFormatId: detectedId,
          sheets: result.sheets.map((s: any) => ({
            ...s,
            formatId: s.formatId || detectedId
          }))
        };
      } else {
        const rowsData = Array.isArray(result) ? result : (result?.rows || []);
        const detectedId = result?.detectedFormatId || "format-a";
        response = {
          detectedFormatId: detectedId,
          sheets: [{ 
            name: "OCR_Extraction", 
            rows: rowsData, 
            formatId: detectedId
          }]
        };
      }
      res.json(response);
    } catch (err: any) {
      console.error("CRITICAL: File Processing Failure", err.message);
      res.status(500).json({ error: err.message || "OCR processing failed" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Simple server-side test for OpenRouter connectivity using the running process env
  app.get("/api/test-openrouter", async (req, res) => {
    const apiKey = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) return res.status(400).json({ error: "OPENROUTER_API_KEY not set in server env" });

    const testModel = process.env.OPENROUTER_MODEL || "openrouter/owl-alpha";
    try {
      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: testModel,
        messages: [{ role: "user", content: "Ping from server" }],
        temperature: 0.0,
        max_tokens: 20
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 20000
      });

      return res.json({ ok: true, model: testModel, data: response.data });
    } catch (err: any) {
      const status = err.response?.status || null;
      const body = err.response?.data || err.message;
      return res.status(status || 500).json({ ok: false, status, body: body });
    }
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { port: HMR_PORT, clientPort: HMR_PORT } },
        appType: "spa",
        cacheDir: "node_modules/.vite_server",
      });
      app.use(vite.middlewares);
      
      app.get("*", async (req, res, next) => {
        if (req.url.startsWith("/api")) return next();
        try {
          const template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
          const html = await vite.transformIndexHtml(req.url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (e) {
      console.warn("Vite failed to initialize.");
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 DocuStruct AI SERVER ACTIVE`);
    console.log(`🔗 http://localhost:${PORT}\n`);
  }).on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Run: npm run kill-port   then restart with: npm run dev\n`);
      process.exit(1);
    } else {
      console.error("[SERVER] Fatal error:", err);
      process.exit(1);
    }
  });
}

startServer().catch(console.error);
