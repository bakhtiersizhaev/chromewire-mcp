# codex-chrome-mcp-bridge

Локальный MCP bridge для управления реальным Google Chrome через официальный Codex Chrome Extension.

Проект независимый: он не связан с OpenAI, Google, Chrome или командой официального расширения.

## Безопасность

- По умолчанию сервер слушает только `127.0.0.1`.
- Не открывайте MCP endpoint в интернет.
- Bridge не должен по умолчанию отдавать cookies, пароли, историю браузера или storage.
- Инструменты могут открывать вкладки, кликать, печатать текст и читать видимый текст выбранной страницы.

## Установка

```bash
git clone https://github.com/OWNER/codex-chrome-mcp-bridge.git
cd codex-chrome-mcp-bridge
npm install
npm test
npm run check
npm run smoke
```

Stdio MCP для клиентов, которые запускают локальные MCP subprocess:

```text
node src/stdio.js
```

HTTP MCP endpoint, если bridge запущен отдельно через `npm start`:

```text
http://127.0.0.1:8962/mcp
```

## Профили Chrome

Профили определяются автоматически. Локальный выбор профиля хранится вне репозитория:

```text
~/.codex-chrome-mcp/profile-preference.json
```

Не коммитьте этот файл.

## Платформы

Windows использует named pipes и registry key для Chrome native messaging. macOS и Linux/Ubuntu используют Unix sockets от официального Codex native host. На macOS для Codex CLI используйте stdio-запуск через `/Applications/Codex.app/Contents/Resources/node src/stdio.js`, чтобы Codex владел MCP subprocess.


## Official extension link

https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg

If the Chrome Web Store page is unavailable in your region, a USA VPN/proxy or USA IP may be required to install the official extension. Use only lawful and policy-compliant access methods.
