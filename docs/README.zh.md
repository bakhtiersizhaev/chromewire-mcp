# codex-chrome-mcp-bridge

这是一个本地 MCP 桥接服务，用于通过官方 Codex Chrome Extension 控制真实的 Google Chrome。

本项目是独立项目，不隶属于 OpenAI、Google、Chrome 或官方扩展团队。

## 安全说明

- 默认只监听 `127.0.0.1`。
- 不要把 MCP endpoint 暴露到公网。
- 默认不暴露 cookies、密码、浏览器历史记录或 storage。
- 工具仍然可以打开标签页、点击按钮、输入文本、读取目标页面的可见文本。

## 安装

```bash
git clone https://github.com/OWNER/codex-chrome-mcp-bridge.git
cd codex-chrome-mcp-bridge
npm install
npm test
npm run check
npm run smoke
npm start
```

MCP endpoint:

```text
http://127.0.0.1:8962/mcp
```

## Chrome 配置文件

Chrome profiles 会自动检测。用户本地偏好保存在仓库外：

```text
~/.codex-chrome-mcp/profile-preference.json
```

不要提交这个文件。

## 平台状态

当前 Windows 可用。macOS 和 Linux 已规划，但需要验证官方扩展 native-host 的传输方式。


## Official extension link

https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg

If the Chrome Web Store page is unavailable in your region, a USA VPN/proxy or USA IP may be required to install the official extension. Use only lawful and policy-compliant access methods.
