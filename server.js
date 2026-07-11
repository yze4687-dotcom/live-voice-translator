const http = require("node:http");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = __dirname;
const preferredPort = Number(process.env.PORT || process.env.DEFAULT_PORT || 8765);
let activePort = preferredPort;
const host = process.env.HOST || "0.0.0.0";
const isCloudRuntime = Boolean(process.env.PORT || process.env.SITES_ENV || process.env.NODE_ENV === "production");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/config") {
    sendJson(response, 200, {
      aiAvailable: Boolean(process.env.OPENAI_API_KEY),
      transcriptionAvailable: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      transcriptionModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
      port: activePort,
      networkUrls: getNetworkUrls(activePort),
      secure: isSecureRequest(request),
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && request.url === "/api/translate") {
    handleAiTranslation(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/transcribe") {
    handleAudioTranscription(request, response);
    return;
  }

  const url = new URL(request.url || "/", getLocalUrl(activePort));
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(root, requestedPath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(data);
  });
});

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function readJson(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

async function handleAiTranslation(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const payload = await readJson(request);
    const text = String(payload.text || "").trim();
    if (!text) {
      sendJson(response, 400, { error: "Text is required" });
      return;
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const instructions = [
      "You are a real-time interpreter.",
      "Translate faithfully and naturally.",
      "Preserve speaker labels like [说话人 A] on separate lines when present.",
      "Do not add explanations, notes, markdown, or quotation marks.",
      "If the input contains filler words or speech recognition noise, lightly correct obvious errors while preserving meaning.",
    ].join(" ");

    const input = [
      `Source language: ${payload.sourceLanguage || "auto"}`,
      `Target language: ${payload.targetLanguage || "English"}`,
      payload.speakerMode ? "Speaker mode: preserve speaker labels." : "",
      Array.isArray(payload.context) && payload.context.length
        ? `Recent context: ${JSON.stringify(payload.context.slice(0, 3))}`
        : "",
      `Text:\n${text}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        store: false,
      }),
    });

    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      sendJson(response, apiResponse.status, {
        error: result.error?.message || "OpenAI request failed",
      });
      return;
    }

    const translation =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content || [])
        ?.map((content) => content.text || "")
        ?.join("")
        ?.trim();

    sendJson(response, 200, { translation, model });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "AI translation failed" });
  }
}

async function handleAudioTranscription(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const payload = await readJson(request, 36 * 1024 * 1024);
    const audioBase64 = String(payload.audioBase64 || "");
    if (!audioBase64) {
      sendJson(response, 400, { error: "Audio is required" });
      return;
    }

    const mimeType = String(payload.mimeType || "audio/webm").split(";")[0];
    const extension = getAudioExtension(mimeType);
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const file = new Blob([audioBuffer], { type: mimeType });
    const speakerMode = Boolean(payload.speakerMode);
    const formData = new FormData();

    formData.set("file", file, `recording.${extension}`);
    formData.set(
      "model",
      speakerMode
        ? process.env.OPENAI_DIARIZE_MODEL || "gpt-4o-transcribe-diarize"
        : process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
    );

    if (speakerMode) {
      formData.set("response_format", "diarized_json");
      formData.set("chunking_strategy", "auto");
    } else {
      formData.set("response_format", "json");
    }

    const apiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      sendJson(response, apiResponse.status, {
        error: result.error?.message || "OpenAI transcription failed",
      });
      return;
    }

    const segments = normalizeDiarizedSegments(result);
    sendJson(response, 200, {
      text: result.text || segments.map((segment) => segment.text).join("\n"),
      segments,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Audio transcription failed" });
  }
}

function getAudioExtension(mimeType) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("aac")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function normalizeDiarizedSegments(result) {
  const rawSegments = result.segments || result.output?.segments || [];
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments
    .map((segment) => ({
      speaker: normalizeSpeaker(segment.speaker),
      text: String(segment.text || "").trim(),
    }))
    .filter((segment) => segment.text);
}

function normalizeSpeaker(value) {
  const text = String(value || "A");
  const letter = text.match(/[A-D]/i)?.[0];
  return (letter || "A").toUpperCase();
}

function startServer(portToTry = preferredPort) {
  activePort = portToTry;
  server.listen(activePort, host, () => {
    printStartupInfo(activePort);
  });
}

function printStartupInfo(port) {
  const localUrl = getLocalUrl(port);
  console.log(`Live Voice Translator is running at ${localUrl}`);
  if (isCloudRuntime) {
    console.log("Cloud mode: listening for HTTPS traffic from the platform.");
    return;
  }
  console.log("");
  console.log("Open on this computer:");
  console.log(`  ${localUrl}`);
  const networkUrls = getNetworkUrls(port);
  if (networkUrls.length) {
    console.log("");
    console.log("Open on your phone on the same Wi-Fi:");
    networkUrls.forEach((url) => console.log(`  ${url}`));
  }
  console.log("");
  console.log("For reliable microphone access on phones, use an HTTPS deployment.");
  console.log("If your phone cannot open the Wi-Fi address, allow Node.js through Windows Firewall for private networks.");
  console.log("Keep this window open while using the app.");
  childProcess.exec(`start "" "${localUrl}"`);
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = activePort + 1;
    if (!process.env.PORT && nextPort <= preferredPort + 20) {
      console.log(`Port ${activePort} is already in use. Trying ${nextPort}...`);
      setTimeout(() => startServer(nextPort), 0);
      return;
    }
    console.error(`Port ${activePort} is already in use. Close the other server window or set a different PORT.`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

function getLocalUrl(port) {
  return `http://127.0.0.1:${port}/`;
}

function getNetworkUrls(port) {
  if (isCloudRuntime) return [];
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network && network.family === "IPv4" && !network.internal)
    .map((network) => `http://${network.address}:${port}/`);
}

function isSecureRequest(request) {
  return request.headers["x-forwarded-proto"] === "https" || request.headers["x-forwarded-ssl"] === "on";
}

startServer();
