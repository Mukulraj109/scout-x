import { Router, Request, Response } from 'express';
import { connectToRemoteBrowser } from '../browser-management/browserConnection';
import User from '../models/User';
import { encrypt, decrypt } from '../utils/auth';
import { maskProxyUrl, normalizeProxyServer } from '../services/proxyConfig';
import { requireSignIn } from '../middlewares/auth';
import logger from '../logger';

export const router = Router();

interface AuthenticatedRequest extends Request {
    user?: { id: string };
}

router.post('/config', requireSignIn, async (req: Request, res: Response) => {
    const { server_url, username, password } = req.body;
    const authenticatedReq = req as AuthenticatedRequest;

    try {

        if (!authenticatedReq.user) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        const user = await User.findById(authenticatedReq.user.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!server_url) {
            return res.status(400).send('Proxy URL is required');
        }

        const normalizedServerUrl = normalizeProxyServer(server_url);
        if (!normalizedServerUrl) {
            return res.status(400).json({ ok: false, error: 'Invalid proxy URL format' });
        }

        const encryptedProxyUrl = encrypt(normalizedServerUrl);
        let encryptedProxyUsername: string | null = null;
        let encryptedProxyPassword: string | null = null;

        if (username && password) {
            encryptedProxyUsername = encrypt(username);
            encryptedProxyPassword = encrypt(password);
        } else if (username && !password) {
            return res.status(400).send('Proxy password is required when proxy username is provided');
        }

        user.proxy_url = encryptedProxyUrl;
        user.proxy_username = encryptedProxyUsername;
        user.proxy_password = encryptedProxyPassword;
        await user.save();

        res.status(200).json({ ok: true });
    } catch (error: any) {
        console.log(`Could not save proxy configuration - ${error}`);
        res.status(500).json({ ok: false, error: 'Could not save proxy configuration' });
    }
});

router.get('/test', requireSignIn, async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    let browser: any = null;
    try {
        if (!authenticatedReq.user) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        const user = await User.findById(authenticatedReq.user.id)
            .select('proxy_url proxy_username proxy_password')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const decryptedProxyUrl = user.proxy_url ? normalizeProxyServer(decrypt(user.proxy_url)) : null;
        const decryptedProxyUsername = user.proxy_username ? decrypt(user.proxy_username) : null;
        const decryptedProxyPassword = user.proxy_password ? decrypt(user.proxy_password) : null;

        if (!decryptedProxyUrl) {
            return res.status(400).send({ success: false, error: 'No proxy configured' });
        }

        const proxyOptions: { server: string; username?: string; password?: string } = {
            server: decryptedProxyUrl,
            ...(decryptedProxyUsername && decryptedProxyPassword && {
                username: decryptedProxyUsername,
                password: decryptedProxyPassword,
            }),
        };

        browser = await connectToRemoteBrowser(undefined, { proxy: proxyOptions, headless: true });
        const page = await browser.newPage();
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await browser.close();
        browser = null;

        res.status(200).send({ success: true });
    } catch (error: any) {
        logger.log('warn', `Proxy test failed: ${error.message}`);
        res.status(500).send({ success: false, error: 'Proxy connection failed' });
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch {
                // best effort cleanup
            }
        }
    }
});

router.get('/config', requireSignIn, async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    try {
        if (!authenticatedReq.user) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        const user = await User.findById(authenticatedReq.user.id)
            .select('proxy_url proxy_username proxy_password')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const normalizedProxyUrl = user.proxy_url ? normalizeProxyServer(decrypt(user.proxy_url)) : null;
        const maskedProxyUrl = normalizedProxyUrl ? maskProxyUrl(normalizedProxyUrl) : null;
        const auth = user.proxy_username && user.proxy_password ? true : false;

        res.status(200).json({
            proxy_url: maskedProxyUrl,
            auth: auth,
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Could not retrieve proxy configuration' });
    }
});

router.delete('/config', requireSignIn, async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (!authenticatedReq.user) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const user = await User.findById(authenticatedReq.user.id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.proxy_url = null;
    user.proxy_username = null;
    user.proxy_password = null;
    await user.save();

    res.status(200).json({ ok: true });
});

export { getDecryptedProxyConfig } from '../services/proxyConfig';
