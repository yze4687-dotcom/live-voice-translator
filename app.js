const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const els = {
  supportStatus: document.querySelector("#supportStatus"),
  mobilePanel: document.querySelector("#mobilePanel"),
  mobileInfo: document.querySelector("#mobileInfo"),
  copyMobileLinkButton: document.querySelector("#copyMobileLinkButton"),
  installButton: document.querySelector("#installButton"),
  sourceLang: document.querySelector("#sourceLang"),
  targetLang: document.querySelector("#targetLang"),
  swapButton: document.querySelector("#swapButton"),
  engineSelect: document.querySelector("#engineSelect"),
  autoToggle: document.querySelector("#autoToggle"),
  speakToggle: document.querySelector("#speakToggle"),
  speakerModeToggle: document.querySelector("#speakerModeToggle"),
  rateSlider: document.querySelector("#rateSlider"),
  sourceText: document.querySelector("#sourceText"),
  speakerStrip: document.querySelector("#speakerStrip"),
  speakerTabs: document.querySelector("#speakerTabs"),
  speakerLog: document.querySelector("#speakerLog"),
  speakerNote: document.querySelector("#speakerNote"),
  partialText: document.querySelector("#partialText"),
  targetText: document.querySelector("#targetText"),
  micButton: document.querySelector("#micButton"),
  recordButton: document.querySelector("#recordButton"),
  hintText: document.querySelector("#hintText"),
  clearButton: document.querySelector("#clearButton"),
  copyButton: document.querySelector("#copyButton"),
  translateNowButton: document.querySelector("#translateNowButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  historyList: document.querySelector("#historyList"),
  stopSpeakButton: document.querySelector("#stopSpeakButton"),
  nextSpeakerButton: document.querySelector("#nextSpeakerButton"),
  engineState: document.querySelector("#engineState"),
};

const speechToTranslationLang = {
  "zh-CN": "zh-CN",
  "en-US": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "fr-FR": "fr",
  "de-DE": "de",
  "es-ES": "es",
};

const translationToSpeechLang = {
  "zh-CN": "zh-CN",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
};

const labels = {
  emptyTarget: "翻译会显示在这里。",
  ready: "可以开始",
  listening: "正在听",
  paused: "已暂停",
  translating: "正在翻译...",
  networkError: "翻译接口暂时不可用，请检查网络后重试。",
  noText: "先输入或说一句话，再翻译。",
};

const iconPaths = {
  "arrow-left-right": '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  eraser: '<path d="m7 21-4.3-4.3c-.9-.9-.9-2.5 0-3.4L13 3c.9-.9 2.5-.9 3.4 0l4.3 4.3c.9.9.9 2.5 0 3.4L11 20.4c-.4.4-.9.6-1.5.6H7Z"/><path d="M22 21H7"/><path d="m5 11 8 8"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  square: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "volume-x": '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
};

let recognition = null;
let listening = false;
let translateTimer = 0;
let lastTranslatedInput = "";
let abortController = null;
let requestSerial = 0;
let historyItems = [];
let aiAvailable = false;
let activeSpeaker = "A";
let transcriptItems = [];
let networkUrls = [];
let installPrompt = null;
let wakeLock = null;
let mediaRecorder = null;
let recordedChunks = [];
let recording = false;

function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.dataset.icon;
    node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || ""}</svg>`;
  });
}

function setStatus(message, kind = "ok") {
  els.supportStatus.classList.toggle("warn", kind === "warn");
  els.supportStatus.classList.toggle("active", kind === "active");
  els.supportStatus.querySelector("span:last-child").textContent = message;
}

function setHint(message) {
  els.hintText.textContent = message;
}

function setListening(next) {
  listening = next;
  els.micButton.classList.toggle("listening", listening);
  els.micButton.querySelector(".mic-label").textContent = listening
    ? "停止翻译"
    : "开始实时翻译";
  els.micButton.querySelector(".mic-icon").innerHTML =
    `<span data-icon="${listening ? "square" : "mic"}"></span>`;
  renderIcons(els.micButton);
  if (listening) requestWakeLock();
  else releaseWakeLock();
}

function setRecording(next) {
  recording = next;
  els.recordButton?.classList.toggle("recording", recording);
  const label = els.recordButton?.querySelector(".record-label");
  if (label) label.textContent = recording ? "停止并识别" : "录音识别";
}

function saveSettings() {
  const settings = {
    sourceLang: els.sourceLang.value,
    targetLang: els.targetLang.value,
    engine: els.engineSelect.value,
    speak: els.speakToggle.checked,
    auto: els.autoToggle.checked,
    speakerMode: els.speakerModeToggle.checked,
    rate: els.rateSlider.value,
  };
  localStorage.setItem("liveVoiceTranslator.settings", JSON.stringify(settings));
}

function loadSettings() {
  try {
    const settings = JSON.parse(
      localStorage.getItem("liveVoiceTranslator.settings") || "{}",
    );
    if (settings.sourceLang) els.sourceLang.value = settings.sourceLang;
    if (settings.targetLang) els.targetLang.value = settings.targetLang;
    if (settings.engine) els.engineSelect.value = settings.engine;
    if (typeof settings.speak === "boolean") els.speakToggle.checked = settings.speak;
    if (typeof settings.auto === "boolean") els.autoToggle.checked = settings.auto;
    if (typeof settings.speakerMode === "boolean") {
      els.speakerModeToggle.checked = settings.speakerMode;
    }
    if (settings.rate) els.rateSlider.value = settings.rate;
  } catch {
    localStorage.removeItem("liveVoiceTranslator.settings");
  }
}

function createRecognition() {
  if (!SpeechRecognition) return null;

  const instance = new SpeechRecognition();
  instance.continuous = true;
  instance.interimResults = true;
  instance.lang = els.sourceLang.value;

  instance.onstart = () => {
    setListening(true);
    setStatus(labels.listening, "active");
    setHint("可以连续说话；识别到完整片段后会自动更新译文。");
  };

  instance.onresult = (event) => {
    let interim = "";
    let finalChunk = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalChunk += text;
      else interim += text;
    }

    if (finalChunk.trim()) {
      appendSource(finalChunk.trim(), activeSpeaker);
      if (els.autoToggle.checked) scheduleTranslation(getSourceText());
    }

    els.partialText.textContent = interim.trim()
      ? `正在识别：${interim.trim()}`
      : "";
  };

  instance.onerror = (event) => {
    const blocked =
      event.error === "not-allowed" || event.error === "service-not-allowed";
    setStatus(blocked ? "麦克风未授权" : "识别中断", "warn");
    setHint(
      blocked
        ? "请在浏览器地址栏允许麦克风权限后重试。"
        : "可以再点一次开始；浏览器偶尔会中断识别服务。",
    );
    setListening(false);
  };

  instance.onend = () => {
    if (listening) {
      try {
        instance.start();
      } catch {
        setListening(false);
      }
      return;
    }
    setStatus(labels.paused);
    els.partialText.textContent = "";
  };

  return instance;
}

function appendSource(text, speaker = activeSpeaker) {
  const current = getSourceText();
  const line = els.speakerModeToggle.checked ? `[说话人 ${speaker}] ${text}` : text;
  transcriptItems.push({ speaker, text, speakerMode: els.speakerModeToggle.checked });
  els.sourceText.value = current ? `${current}\n${line}` : line;
  els.sourceText.scrollTop = els.sourceText.scrollHeight;
  renderSpeakerLog();
}

function getSourceText() {
  return els.sourceText.value.trim();
}

function getLanguagePair() {
  const source = speechToTranslationLang[els.sourceLang.value] || "auto";
  const target = els.targetLang.value;
  return { source, target, pair: `${source}|${target}` };
}

function scheduleTranslation(text) {
  window.clearTimeout(translateTimer);
  translateTimer = window.setTimeout(() => translateText(text), 480);
}

async function translateText(text, options = {}) {
  const cleaned = text.trim();
  if (!cleaned) {
    setHint(labels.noText);
    return;
  }

  const { source, target, pair } = getLanguagePair();
  if (source === target) {
    setStatus("语言相同", "warn");
    els.targetText.textContent = cleaned;
    setHint("源语言和目标语言相同，已直接显示原文。");
    return;
  }

  if (!options.force && cleaned === lastTranslatedInput) return;

  abortController?.abort();
  abortController = new AbortController();
  const serial = ++requestSerial;

  lastTranslatedInput = cleaned;
  els.targetText.textContent = labels.translating;
  setStatus("翻译中", "active");

  try {
    const useAi = els.engineSelect.value === "auto" && aiAvailable;
    const translated = useAi
      ? await translateWithAi(cleaned, serial)
      : await translateWithPublicApi(cleaned, pair);

    if (serial !== requestSerial) return;
    if (!translated) throw new Error("empty translation");

    els.targetText.textContent = translated;
    setStatus(labels.ready);
    setHint(useAi ? "AI 译文已更新。" : "译文已更新。");
    addHistory(cleaned, translated);
    if (els.speakToggle.checked) speak(translated);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (serial !== requestSerial) return;
    els.targetText.textContent = labels.networkError;
    setStatus("翻译失败", "warn");
    setHint("当前使用公开翻译接口，网络或额度不稳定时可稍后再试。");
  }
}

async function translateWithPublicApi(cleaned, pair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=${encodeURIComponent(pair)}`;
  const response = await fetch(url, { signal: abortController.signal });
  if (!response.ok) throw new Error("translation failed");
  const data = await response.json();
  return data?.responseData?.translatedText?.trim();
}

async function translateWithAi(cleaned, serial) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: cleaned,
      sourceLanguage: els.sourceLang.options[els.sourceLang.selectedIndex].text,
      targetLanguage: els.targetLang.options[els.targetLang.selectedIndex].text,
      speakerMode: els.speakerModeToggle.checked,
      context: historyItems.slice(0, 3).map((item) => ({
        source: item.source,
        target: item.target,
      })),
    }),
    signal: abortController.signal,
  });

  if (serial !== requestSerial) return "";
  if (!response.ok) throw new Error("ai translation failed");
  const data = await response.json();
  return data.translation?.trim();
}

function getRecordingMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) || "";
}

async function startRecording() {
  if (!window.isSecureContext) {
    setStatus("需要 HTTPS", "warn");
    setHint("iPhone/Safari/Chrome 使用麦克风录音需要 HTTPS。局域网 HTTP 只能做文字翻译。");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus("不支持录音", "warn");
    setHint("当前浏览器不支持录音上传，请换最新版 Safari 或 Chrome。");
    return;
  }

  if (!aiAvailable) {
    setStatus("AI 未配置", "warn");
    setHint("录音识别需要 OPENAI_API_KEY。请先在启动窗口设置 API Key。");
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];
  const mimeType = getRecordingMimeType();
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((track) => track.stop());
    await transcribeRecording(mimeType || recordedChunks[0]?.type || "audio/webm");
  };

  mediaRecorder.start();
  setRecording(true);
  requestWakeLock();
  setStatus("正在录音", "active");
  setHint("说完后再点一次“停止并识别”。");
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return;
  mediaRecorder.stop();
  setRecording(false);
  releaseWakeLock();
  setStatus("识别中", "active");
  setHint("正在把录音转成文字。");
}

async function transcribeRecording(mimeType) {
  const blob = new Blob(recordedChunks, { type: mimeType });
  if (!blob.size) {
    setStatus(labels.ready);
    setHint("没有录到声音，请再试一次。");
    return;
  }

  try {
    const audioBase64 = await blobToBase64(blob);
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType,
        language: els.sourceLang.value,
        speakerMode: els.speakerModeToggle.checked,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "transcription failed");

    if (Array.isArray(data.segments) && data.segments.length) {
      data.segments.forEach((segment) => {
        const speaker = segment.speaker || activeSpeaker;
        appendSource(segment.text, speaker);
      });
    } else if (data.text) {
      appendSource(data.text, activeSpeaker);
    }

    setStatus(labels.ready);
    setHint("录音已识别。");
    if (els.autoToggle.checked) scheduleTranslation(getSourceText());
  } catch (error) {
    setStatus("识别失败", "warn");
    setHint(error.message || "录音识别失败，请稍后再试。");
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = translationToSpeechLang[els.targetLang.value] || els.targetLang.value;
  utterance.rate = Number(els.rateSlider.value);
  window.speechSynthesis.speak(utterance);
}

function addHistory(source, target) {
  const newest = { source, target, time: new Date().toLocaleTimeString() };
  if (historyItems[0]?.source === source && historyItems[0]?.target === target) return;
  historyItems = [newest, ...historyItems].slice(0, 8);
  renderHistory();
}

function renderHistory() {
  if (!historyItems.length) {
    els.historyList.innerHTML =
      '<p class="empty-history">完成的翻译会保存在这里，方便回看和复制。</p>';
    return;
  }

  els.historyList.innerHTML = historyItems
    .map(
      (item, index) => `
        <button class="history-item" type="button" data-history-index="${index}">
          <span class="history-time">${item.time}</span>
          <span class="history-source">${escapeHtml(item.source)}</span>
          <span class="history-target">${escapeHtml(item.target)}</span>
        </button>
      `,
    )
    .join("");
}

function renderSpeakerLog() {
  if (!els.speakerModeToggle.checked || !transcriptItems.length) {
    els.speakerLog.innerHTML = "";
    return;
  }

  els.speakerLog.innerHTML = transcriptItems
    .slice(-8)
    .map(
      (item) => `
        <div class="speaker-line speaker-${item.speaker}">
          <span>说话人 ${item.speaker}</span>
          <p>${escapeHtml(item.text)}</p>
        </div>
      `,
    )
    .join("");
}

function setSpeaker(speaker) {
  activeSpeaker = speaker;
  els.speakerTabs.querySelectorAll("[data-speaker]").forEach((button) => {
    button.classList.toggle("active", button.dataset.speaker === speaker);
  });
  els.speakerNote.textContent = `当前说话人：${speaker}`;
}

function toggleSpeakerMode() {
  els.speakerStrip.hidden = !els.speakerModeToggle.checked;
  renderSpeakerLog();
  saveSettings();
}

async function loadServerConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("config unavailable");
    const config = await response.json();
    aiAvailable = Boolean(config.aiAvailable);
    networkUrls = Array.isArray(config.networkUrls) ? config.networkUrls : [];
    els.engineState.textContent = aiAvailable
      ? `AI：已连接 ${config.model || ""}`.trim()
      : "AI：未配置";
    updateMobilePanel();
  } catch {
    aiAvailable = false;
    networkUrls = [];
    els.engineState.textContent = "AI：不可用";
    updateMobilePanel();
  }
}

function updateMobilePanel() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSecure = window.isSecureContext;
  const currentHost = window.location.hostname;
  const onLanHttp =
    window.location.protocol === "http:" &&
    currentHost !== "localhost" &&
    currentHost !== "127.0.0.1";

  if (!els.mobilePanel) return;

  const shouldShow = isMobile || networkUrls.length || onLanHttp;
  els.mobilePanel.hidden = !shouldShow;

  if (isMobile && !isSecure) {
    els.mobileInfo.textContent =
      "当前不是 HTTPS，文字翻译可以用，但手机语音识别可能被浏览器限制。要稳定使用麦克风，建议部署到 HTTPS 网站。";
    return;
  }

  if (networkUrls.length) {
    els.mobileInfo.textContent =
      `手机和电脑连接同一个 Wi-Fi 后，在手机浏览器打开：${networkUrls[0]}`;
    return;
  }

  els.mobileInfo.textContent = "手机端建议使用 Chrome，并把页面添加到主屏幕。";
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // Ignore release errors; the browser may have already released it.
  }
  wakeLock = null;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function start() {
  if (!recognition) recognition = createRecognition();
  if (!recognition) return;

  recognition.lang = els.sourceLang.value;
  try {
    recognition.start();
  } catch {
    setHint("语音识别已经在运行。");
  }
}

function stop() {
  setListening(false);
  window.speechSynthesis?.cancel();
  recognition?.stop();
}

function resetTranslationState() {
  lastTranslatedInput = "";
  abortController?.abort();
  abortController = null;
}

els.micButton.addEventListener("click", () => {
  if (listening) stop();
  else start();
});

els.recordButton?.addEventListener("click", () => {
  if (recording) stopRecording();
  else startRecording().catch((error) => {
    setRecording(false);
    setStatus("录音失败", "warn");
    setHint(error.message || "无法打开麦克风。");
  });
});

els.sourceText.addEventListener("input", () => {
  resetTranslationState();
  if (els.autoToggle.checked) scheduleTranslation(getSourceText());
});

els.translateNowButton.addEventListener("click", () => {
  translateText(getSourceText(), { force: true });
});

[els.sourceLang, els.targetLang, els.engineSelect, els.speakToggle, els.autoToggle, els.speakerModeToggle, els.rateSlider].forEach(
  (control) => control.addEventListener("change", saveSettings),
);

els.speakerModeToggle.addEventListener("change", toggleSpeakerMode);

els.sourceLang.addEventListener("change", () => {
  resetTranslationState();
  if (listening) {
    stop();
    window.setTimeout(start, 160);
  }
});

els.targetLang.addEventListener("change", () => {
  resetTranslationState();
  if (els.autoToggle.checked) scheduleTranslation(getSourceText());
});

els.swapButton.addEventListener("click", () => {
  const sourceAsTarget = speechToTranslationLang[els.sourceLang.value];
  const targetAsSource = Object.entries(speechToTranslationLang).find(
    ([, code]) => code === els.targetLang.value,
  )?.[0];

  if (targetAsSource) els.sourceLang.value = targetAsSource;
  if (sourceAsTarget) els.targetLang.value = sourceAsTarget;
  saveSettings();
  resetTranslationState();
  if (els.autoToggle.checked) scheduleTranslation(getSourceText());
});

els.clearButton.addEventListener("click", () => {
  resetTranslationState();
  transcriptItems = [];
  els.sourceText.value = "";
  renderSpeakerLog();
  els.partialText.textContent = "";
  els.targetText.textContent = labels.emptyTarget;
  setHint("已清空当前内容。");
});

els.speakerTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-speaker]");
  if (!button) return;
  setSpeaker(button.dataset.speaker);
});

els.nextSpeakerButton.addEventListener("click", () => {
  const speakers = ["A", "B", "C", "D"];
  const next = speakers[(speakers.indexOf(activeSpeaker) + 1) % speakers.length];
  setSpeaker(next);
});

els.copyButton.addEventListener("click", async () => {
  const text = els.targetText.textContent.trim();
  if (!text || text === labels.emptyTarget) return;
  await navigator.clipboard?.writeText(text);
  setHint("译文已复制。");
});

els.stopSpeakButton.addEventListener("click", () => {
  window.speechSynthesis?.cancel();
  setHint("已停止朗读。");
});

els.clearHistoryButton.addEventListener("click", () => {
  historyItems = [];
  renderHistory();
});

els.copyMobileLinkButton?.addEventListener("click", async () => {
  const text = networkUrls[0] || window.location.href;
  await navigator.clipboard?.writeText(text);
  setHint("手机访问地址已复制。");
});

els.installButton?.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  els.installButton.hidden = true;
});

els.historyList.addEventListener("click", async (event) => {
  const item = event.target.closest("[data-history-index]");
  if (!item) return;
  const history = historyItems[Number(item.dataset.historyIndex)];
  if (!history) return;
  await navigator.clipboard?.writeText(`${history.source}\n${history.target}`);
  setHint("该片段已复制。");
});

loadSettings();
renderIcons();
renderHistory();
toggleSpeakerMode();
setSpeaker(activeSpeaker);
loadServerConfig();
registerServiceWorker();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  if (els.installButton) els.installButton.hidden = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && listening) requestWakeLock();
});

if (!SpeechRecognition) {
  setStatus("当前浏览器不支持", "warn");
  els.micButton.disabled = true;
  setHint("当前浏览器不支持实时语音识别；可用“录音识别”或手动输入文字翻译。");
} else {
  setStatus(labels.ready);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
