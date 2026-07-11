# 实时语音翻译

这是一个手机优先的实时语音翻译 Web App。它支持：

- 手机 HTTPS 访问，不依赖电脑
- iPhone 录音识别
- Android / 桌面实时语音识别
- AI 增强翻译
- 译文朗读
- 多人模式
- 添加到手机主屏幕

## 最终手机使用方式

部署到 HTTPS 后，手机直接打开线上地址即可使用：

```text
https://你的站点地址/
```

电脑不需要开着。

## iPhone 说明

iPhone Safari 和 iPhone Chrome 都不能可靠使用浏览器自带的实时 `SpeechRecognition`。因此本项目提供了更适合 iPhone 的“录音识别”：

1. 手机通过 HTTPS 打开站点。
2. 点击“录音识别”。
3. 说完后再点一次停止。
4. 后端把录音转成文字。
5. 再自动翻译和朗读。

注意：iPhone 麦克风基本要求 HTTPS。局域网 `http://192.168.x.x:8765/` 适合测试文字翻译，但不适合作为 iPhone 语音正式方案。

## 云端环境变量

部署后请在云端设置：

```text
OPENAI_API_KEY=你的_API_Key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
OPENAI_DIARIZE_MODEL=gpt-4o-transcribe-diarize
```

没有 `OPENAI_API_KEY` 时，页面仍可打开；AI 翻译和录音识别会提示未配置。

## 本地电脑测试

在 Windows 上运行：

```bat
start-preview.cmd
```

它会打开：

```text
http://127.0.0.1:8765/
```

如果要让同 Wi-Fi 手机临时访问，启动窗口会显示类似：

```text
http://192.168.x.x:8765/
```

但正式手机语音使用请部署 HTTPS。

## 技术实现

- 前端：原生 HTML/CSS/JavaScript
- 本地/云端服务：Node.js
- AI 翻译：OpenAI Responses API
- 录音转写：OpenAI Audio Transcriptions API
- 兜底翻译：MyMemory 公开翻译接口
- PWA：manifest、图标、service worker

## 启动命令

云端 Node 服务启动：

```bash
npm start
```

健康检查：

```text
/api/health
```
