"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const http_1 = __importDefault(require("http"));
// Apply stealth plugin to chromium
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
let browserServer = null;
// Configurable ports with defaults
const BROWSER_WS_PORT = parseInt(process.env.BROWSER_WS_PORT || '3001', 10);
const BROWSER_HEALTH_PORT = parseInt(process.env.BROWSER_HEALTH_PORT || '3002', 10);
const BROWSER_WS_HOST = process.env.BROWSER_WS_HOST || 'localhost';
/** Playwright often returns ws://127.0.0.1:port — other containers must use the service hostname. */
function publishWsEndpoint(raw) {
    const host = BROWSER_WS_HOST;
    try {
        const u = new URL(raw);
        if (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]') {
            u.hostname = host;
        }
        return u.toString();
    }
    catch {
        return raw.replace(/127\.0\.0\.1/g, host).replace(/localhost/g, host);
    }
}
async function start() {
    console.log('Starting Maxun Browser Service...');
    console.log(`WebSocket port: ${BROWSER_WS_PORT}`);
    console.log(`Health check port: ${BROWSER_HEALTH_PORT}`);
    try {
        // Launch browser server that exposes WebSocket endpoint
        browserServer = await playwright_extra_1.chromium.launchServer({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--force-color-profile=srgb',
                '--force-device-scale-factor=2',
                '--ignore-certificate-errors',
                '--mute-audio'
            ],
            port: BROWSER_WS_PORT,
        });
        console.log(`✅ Browser WebSocket endpoint ready: ${browserServer.wsEndpoint()}`);
        console.log(`✅ Stealth plugin enabled`);
        // Health check HTTP server
        const healthServer = http_1.default.createServer((req, res) => {
            if (req.url === '/health') {
                const wsEndpoint = browserServer ? publishWsEndpoint(browserServer.wsEndpoint()) : '';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'healthy',
                    wsEndpoint,
                    wsPort: BROWSER_WS_PORT,
                    healthPort: BROWSER_HEALTH_PORT,
                    timestamp: new Date().toISOString()
                }));
            }
            else if (req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                const wsEndpoint = browserServer ? publishWsEndpoint(browserServer.wsEndpoint()) : '';
                res.end(`Maxun Browser Service\nWebSocket: ${wsEndpoint}\nHealth: http://localhost:${BROWSER_HEALTH_PORT}/health`);
            }
            else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        healthServer.listen(BROWSER_HEALTH_PORT, () => {
            console.log(`✅ Health check server running on port ${BROWSER_HEALTH_PORT}`);
            console.log('Browser service is ready to accept connections!');
        });
    }
    catch (error) {
        console.error('❌ Failed to start browser service:', error);
        process.exit(1);
    }
}
// Graceful shutdown
async function shutdown() {
    console.log('Shutting down browser service...');
    if (browserServer) {
        try {
            await browserServer.close();
            console.log('Browser server closed');
        }
        catch (error) {
            console.error('Error closing browser server:', error);
        }
    }
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Start the service
start().catch(console.error);
