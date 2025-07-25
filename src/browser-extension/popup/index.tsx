import React, { useState, useEffect } from "react";
import "./index.css";

// 储存和读取 API Key（本地存储）
const GEMINI_KEY_STORAGE = "gemini_api_key";
function saveGeminiApiKey(key: string) {
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
}
function loadGeminiApiKey(): string {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || "";
}

// 调用 Gemini OCR API 识别图片文字
async function recognizeImageWithGemini(imageBlob: Blob, apiKey: string): Promise<string> {
  if (!apiKey) return "未填写 Gemini API Key";
  const base64Image = await blobToBase64(imageBlob);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: imageBlob.type,
                  data: base64Image.replace(/^data:.+;base64,/, ""),
                },
              },
              { text: "请识别图片中的所有中文和英文文本" },
            ],
          },
        ],
      }),
    }
  );
  const data = await response.json();
  if (
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0].text
  ) {
    return data.candidates[0].content.parts[0].text;
  }
  return "未能识别图片文字";
}

// Blob 转 base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 获取剪贴板图片
async function getImageFromClipboard(): Promise<Blob | null> {
  try {
    // @ts-ignore
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          return blob;
        }
      }
    }
  } catch (e) {
    alert("获取剪贴板图片失败，请确认已授权浏览器访问剪贴板，并使用新版 Chrome。");
  }
  return null;
}

// 调用原有翻译 API（以有道为例，可替换为您原插件的翻译函数）
async function translateText(text: string): Promise<string> {
  const response = await fetch(
    `https://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i=${encodeURIComponent(text)}`
  );
  const data = await response.json();
  if (data && data.translateResult && data.translateResult[0] && data.translateResult[0][0]) {
    return data.translateResult[0][0].tgt;
  }
  return "翻译失败";
}

// 主界面
const Popup: React.FC = () => {
  const [tab, setTab] = useState<"main" | "settings">("main");
  // 截图翻译相关
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  // API Key 相关
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  // 初始化加载 API Key
  useEffect(() => {
    const key = loadGeminiApiKey();
    setApiKey(key);
    setApiKeyInput(key);
  }, []);

  // 截图翻译主逻辑
  const handleScreenshotTranslate = async () => {
    setLoading(true);
    setRecognizedText("");
    setTranslatedText("");
    setImageSrc(null);

    if (!apiKey) {
      setLoading(false);
      alert("请先在设置中填写 Gemini API Key！");
      setTab("settings");
      return;
    }

    // 1. 获取剪贴板图片
    const imageBlob = await getImageFromClipboard();
    if (!imageBlob) {
      setLoading(false);
      alert("未检测到剪贴板中的图片，请用 Win+Shift+S 截图，然后再点击按钮。");
      return;
    }

    // 显示图片预览
    const imageUrl = URL.createObjectURL(imageBlob);
    setImageSrc(imageUrl);

    // 2. 调用 Gemini API 识别图片文字
    const text = await recognizeImageWithGemini(imageBlob, apiKey);
    setRecognizedText(text);

    // 3. 调用翻译 API 翻译识别结果
    const translated = await translateText(text);
    setTranslatedText(translated);

    setLoading(false);
  };

  // 保存 API Key
  const handleSaveKey = () => {
    saveGeminiApiKey(apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    alert("Gemini API Key 已保存！");
    setTab("main");
  };

  return (
    <div className="container" style={{ minWidth: 350 }}>
      {tab === "main" && (
        <>
          <h2>OpenAI Translator 截图翻译</h2>
          <button onClick={handleScreenshotTranslate} disabled={loading}>
            {loading ? "处理中..." : "截图翻译（剪贴板图片->识别->翻译）"}
          </button>
          <button
            style={{ marginLeft: 10, background: "#eee", color: "#333" }}
            onClick={() => setTab("settings")}
          >
            设置
          </button>
          <p style={{ fontSize: 12, color: "#666" }}>
            用 <b>Win+Shift+S</b> 截图后，点“截图翻译”即可。<br />
            <span style={{ color: "#f40" }}>首次使用请先点“设置”填写 Gemini API Key。</span>
          </p>
          {imageSrc && (
            <div>
              <p>图片预览：</p>
              <img src={imageSrc} alt="剪贴板图片" style={{ maxWidth: "300px" }} />
            </div>
          )}
          {recognizedText && (
            <div>
              <h4>图片文字识别结果：</h4>
              <textarea style={{ width: "100%", height: 60 }} value={recognizedText} readOnly />
            </div>
          )}
          {translatedText && (
            <div>
              <h4>翻译结果：</h4>
              <textarea style={{ width: "100%", height: 60 }} value={translatedText} readOnly />
            </div>
          )}
        </>
      )}
      {tab === "settings" && (
        <>
          <h2>Gemini API Key 设置</h2>
          <p style={{ fontSize: 12, color: "#666" }}>
            您的 Gemini API Key 只会储存在本地浏览器，不会上传到网络。<br />
            获取方法请参考 Gemini 官网文档。
          </p>
          <input
            type="text"
            style={{ width: "100%" }}
            placeholder="请输入您的 Gemini API Key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <button onClick={handleSaveKey}>保存</button>
            <button
              style={{ marginLeft: 10, background: "#eee", color: "#333" }}
              onClick={() => setTab("main")}
            >
              返回
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Popup;
