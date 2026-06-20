const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Nebius Config
const DEFAULT_API_KEY = "v1.CmQKHHN0YXRpY2tleS1lMDBwNzBwNmt0eW4xMXdlMmcSIXNlcnZpY2VhY2NvdW50LWUwMHZtM3YwYnB2djhwcWZwYTIMCLmg2NEGEICzpuYCOgwIt6PwnAcQgMTFkANAAloDZTAw.AAAAAAAAAAE-9wMO9dk7uKGWB-z3-KICgEO8Ji8zgYWqGqWR-l01yV5BBY-tXXI7GUUvFyL_ZC0z7FHuSfQFXekK8LBp8oYO";
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY || DEFAULT_API_KEY;
const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/chat/completions";

const PORT = 3001;

// Global System States (Simulated Telemetry)
let systemState = {
  dbPoolTotal: 10,
  dbPoolIdle: 10,
  latencyMs: 14,
  memoryUsedPercent: 34.2,
  isDbCrashed: false,
  isMemorySpiked: false
};

// In-memory Stores
const scanJobs = new Map();
const userStreakDb = {
  current_streak: 7,
  grace_cushion_used: false
};

// Mapping of GramGyan Modes to Nebius Model IDs
const MODEL_MAPPING = {
  standard_dialogue: "nvidia/Nemotron-3-Nano-Omni",
  project_guidance: "nvidia/Nemotron-3-Ultra-550b-a55b",
  stem_reasoning: "Qwen/Qwen3-Next-80B-A3B-Thinking",
  vision_ocr: "Qwen/Qwen2.5-VL-72B-Instruct",
  scam_detection: "Qwen/Qwen3-30B-A3B-Instruct-2507"
};

// Helper: Read JSON request body
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Helper: Standard envelope response
function sendJson(res, success, data, message = "", status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success,
    data: success ? data : undefined,
    error: success ? undefined : data,
    message: message || undefined,
    timestamp: new Date().toISOString()
  }));
}

// Helper: Call Nebius API via https module
function callNebiusAPI(model, messages, extraParams = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model,
      messages,
      ...extraParams
    });

    const parsedUrl = new URL(NEBIUS_BASE_URL);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NEBIUS_API_KEY}`
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error("Failed to parse Nebius response: " + data));
        }
      });
    });

    apiReq.on('error', reject);
    apiReq.write(payload);
    apiReq.end();
  });
}

// Main HTTP Server Handler
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Network-Profile, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. Health Endpoint
  if (pathname === '/api/health') {
    if (systemState.isDbCrashed) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: "unhealthy",
        services: {
          database: { status: "critical", latency_ms: -1, pool_total: 0, pool_idle: 0 },
          redis: { status: "healthy", latency_ms: 2 }
        }
      }));
    }

    const resData = {
      status: "healthy",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime_s: Math.floor(process.uptime()),
      services: {
        database: { 
          status: "healthy", 
          latency_ms: systemState.latencyMs, 
          pool_total: systemState.dbPoolTotal, 
          pool_idle: systemState.dbPoolIdle 
        },
        redis: { status: "healthy", latency_ms: 2 },
        memory: { 
          status: "healthy", 
          used_mb: systemState.isMemorySpiked ? 501.2 : 180.5, 
          threshold_mb: 512 
        }
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(resData));
  }

  // Telemetry Controls
  if (pathname === '/api/health/crash-db' && req.method === 'POST') {
    systemState.isDbCrashed = true;
    systemState.dbPoolTotal = 0;
    systemState.dbPoolIdle = 0;
    systemState.latencyMs = -1;
    return sendJson(res, true, { status: "crashed" }, "DB Pool Crashed");
  }

  if (pathname === '/api/health/spike-memory' && req.method === 'POST') {
    systemState.isMemorySpiked = true;
    systemState.latencyMs = 420;
    return sendJson(res, true, { status: "spiked" }, "Memory Spiked to 97.6%");
  }

  if (pathname === '/api/health/restore' && req.method === 'POST') {
    systemState.isDbCrashed = false;
    systemState.isMemorySpiked = false;
    systemState.dbPoolTotal = 10;
    systemState.dbPoolIdle = 10;
    systemState.latencyMs = 14;
    return sendJson(res, true, { status: "healthy" }, "System Restored");
  }

  // 2. Network Config Endpoint
  if (pathname === '/api/ai/network-config') {
    const netProfile = req.headers['x-network-profile'] || 'WiFi';
    let mediaConfig = {
      profile: netProfile,
      videoBitrate_kbps: 2500,
      audioBitrate_kbps: 192,
      resolution: "1280x720",
      audioOnly: false,
      chunkSize_kb: 256,
      bufferTarget_s: 10
    };

    if (netProfile === '2G') {
      mediaConfig = {
        profile: "2G",
        videoBitrate_kbps: 0,
        audioBitrate_kbps: 32,
        resolution: "audio_only",
        audioOnly: true,
        chunkSize_kb: 32,
        bufferTarget_s: 30
      };
      res.setHeader('X-Stream-Mode', 'audio-only');
    } else if (netProfile === '3G') {
      mediaConfig.videoBitrate_kbps = 400;
      mediaConfig.audioBitrate_kbps = 64;
      mediaConfig.resolution = "426x240";
    } else if (netProfile === '4G') {
      mediaConfig.videoBitrate_kbps = 1200;
      mediaConfig.audioBitrate_kbps = 128;
      mediaConfig.resolution = "854x480";
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: mediaConfig }));
  }

  // 3. Unified AI Query Endpoint
  if (pathname === '/api/ai/query' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { mode, messages, stream, image_base64 } = body;

      const modelId = MODEL_MAPPING[mode] || MODEL_MAPPING.standard_dialogue;
      const startTime = Date.now();

      // For Stem Reasoning, prepend a prompt guiding it to think thoroughly
      if (mode === 'stem_reasoning') {
        messages.unshift({
          role: "system",
          content: "You are Qwen reasoning assistant. Format math and equations nicely. Wrap your thinking process inside <think> and </think> tags before providing the final answer."
        });
      }

      // Vision OCR
      let extraParams = {};
      if (mode === 'vision_ocr' && image_base64) {
        messages.unshift({
          role: "system",
          content: "You are a Vision OCR assistant. Transcribe text and solve equations from the image. Format calculations clearly."
        });
      }

      const rawResult = await callNebiusAPI(modelId, messages, extraParams);

      if (!rawResult || !rawResult.choices || !rawResult.choices[0]) {
        return sendJson(res, false, "NEBIUS_API_ERROR", "Invalid response from Nebius API", 502);
      }

      const responseText = rawResult.choices[0].message.content;
      const latencyMs = Date.now() - startTime;

      let responseContent = responseText;
      let chainOfThought = "";

      // Extract thinking block if present
      if (responseText.includes('<think>') && responseText.includes('</think>')) {
        const thinkStart = responseText.indexOf('<think>') + 7;
        const thinkEnd = responseText.indexOf('</think>');
        chainOfThought = responseText.substring(thinkStart, thinkEnd).trim();
        responseContent = responseText.substring(thinkEnd + 8).trim();
      }

      const responseData = {
        model_used: modelId,
        mode: mode,
        content: responseContent,
        chain_of_thought: chainOfThought || undefined,
        tokens_used: rawResult.usage || { prompt: 10, completion: 20, total: 30 },
        latency_ms: latencyMs,
        finish_reason: rawResult.choices[0].finish_reason || "stop"
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, data: responseData }));

    } catch (err) {
      console.error(err);
      return sendJson(res, false, "SERVER_ERROR", err.message, 500);
    }
  }

  // 4. Async Scam Scanning
  if (pathname === '/api/ai/scan-link' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { url } = body;
      const jobId = Math.random().toString(36).substring(7);

      scanJobs.set(jobId, { status: "queued", result: null });

      // Trigger background assessment using Qwen3-30B
      (async () => {
        try {
          const result = await callNebiusAPI(
            "Qwen/Qwen3-30B-A3B-Instruct-2507",
            [
              {
                role: "system",
                content: "You are an expert scam and phishing detector. Analyze the job posting or link description. Return a JSON object with: { \"is_scam\": boolean, \"confidence_score\": float, \"flags\": string[] }. Flags can be: MLM_STRUCTURE, PHISHING_TEMPLATE, UPFRONT_PAYMENT_DEMAND, FAKE_JOB_LISTING, CRYPTOCURRENCY_SCAM, IMPERSONATION. Provide only the JSON and nothing else."
              },
              {
                role: "user",
                content: `Assess this: ${url}`
              }
            ]
          );

          const content = result.choices[0].message.content;
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            scanJobs.set(jobId, { status: "done", result: parsed });
          } else {
            scanJobs.set(jobId, { 
              status: "done", 
              result: { is_scam: true, confidence_score: 0.8, flags: ["UPFRONT_PAYMENT_DEMAND"] } 
            });
          }
        } catch (e) {
          console.error("Background scan failed:", e);
          scanJobs.set(jobId, { 
            status: "done", 
            result: { is_scam: false, confidence_score: 0.0, flags: [] } 
          });
        }
      })();

      res.writeHead(202, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, data: { log_id: jobId, status: "queued" } }));
    } catch (e) {
      return sendJson(res, false, "SERVER_ERROR", e.message, 500);
    }
  }

  if (pathname.startsWith('/api/ai/scan-result/')) {
    const jobId = pathname.split('/').pop();
    const job = scanJobs.get(jobId);
    if (!job) {
      return sendJson(res, false, "NOT_FOUND", "Scan job not found", 404);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      data: {
        status: job.status,
        ...job.result
      }
    }));
  }

  // 5. Offline sync delta simulation
  if (pathname === '/api/sync/delta' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { operations } = body;

      const applied = [];
      const conflicts = [];

      (operations || []).forEach(op => {
        applied.push(op.id || Math.random().toString(36).substring(7));
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          server_vector_clock: { server: Date.now() },
          applied,
          conflicts,
          rejected: [],
          server_mutations: []
        }
      }));
    } catch (e) {
      return sendJson(res, false, "SERVER_ERROR", e.message, 500);
    }
  }

  // 6. KYB Validator
  if (pathname === '/api/kyb/register' && req.method === 'POST') {
    const gstin = req.headers['x-corporate-gstin'] || '';
    const domain = req.headers['x-corporate-domain'] || '';
    const email = req.headers['x-corporate-email'] || '';

    const details = [];
    if (gstin.length !== 15) {
      details.push("GSTIN: GSTIN must be exactly 15 characters");
    }
    const freeDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const emailDomain = email.split('@').pop() || '';
    if (freeDomains.includes(emailDomain.toLowerCase()) || freeDomains.includes(domain.toLowerCase())) {
      details.push("Email: Anonymous/free email is not permitted");
    }

    if (details.length > 0) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: "KYB_VALIDATION_FAILED",
        details
      }));
    }

    return sendJson(res, true, { status: "VERIFIED" }, "Corporate Registered Successfully");
  }

  // 7. Static Files Serving
  const publicDir = __dirname;
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  // Prevent directory traversal: block if path escapes publicDir
  const relative = path.relative(publicDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end("File Not Found");
      } else {
        res.writeHead(500);
        res.end("Server Error: " + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });

});

server.listen(PORT, () => {
  console.log(`GramGyan local backend proxy running at http://localhost:${PORT}`);
});
