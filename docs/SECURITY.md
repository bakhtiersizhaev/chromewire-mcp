# Security

This bridge controls a real Chrome browser profile. Treat it as local browser automation power, not as a remote web service.

## Safe defaults

- Default bind host: `127.0.0.1`.
- Default port: `8962`.
- Do not expose the MCP endpoint to the public internet.
- The bridge does not expose cookies, passwords, browser history, localStorage, or sessionStorage by default.

## Risk surface

Tools may still open tabs, navigate pages, click buttons, type text, scroll pages, execute targeted JavaScript in explicit tabs, and read visible text from selected pages.

Use destructive actions only when the user explicitly requested them.


## Official extension link

https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg

If the Chrome Web Store page is unavailable in your region, a USA VPN/proxy or USA IP may be required to install the official extension. Use only lawful and policy-compliant access methods.
