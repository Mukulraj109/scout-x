import { Request, Response } from "express";
import { verify, JwtPayload } from "jsonwebtoken";
import User from "../models/User";

interface UserRequest extends Request {
    user?: JwtPayload | string | { id: number };
}

export const requireSignIn = (req: UserRequest, res: Response, next: any) => {
    const token = req.cookies && req.cookies.token ? req.cookies.token : null;

    if (token === null) return res.sendStatus(401);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.sendStatus(500); // Internal Server Error if secret is not defined
    }

    verify(token, secret, (err: any, user: any) => {
        if (err) {
            console.log('JWT verification error:', err);
            return res.sendStatus(403);
        }
        // Normalize payload key
        if (user.userId && !user.id) {
            user.id = user.userId;
            delete user.userId; // temporary: del the old key for clarity
        }
        req.user = user;
        next();
    });
};

/**
 * For routes used by the browser app (JWT cookie) and the Chrome extension (`x-api-key`).
 * API key is checked first when the header is present; otherwise session cookie auth runs.
 */
export const requireSignInOrApiKey = async (req: UserRequest, res: Response, next: any) => {
    const rawKey = req.headers["x-api-key"];
    const apiKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (apiKey && String(apiKey).trim()) {
        try {
            const user = await User.findOne({ api_key: String(apiKey).trim() });
            if (!user) {
                return res.status(403).json({ error: "Invalid API key" });
            }
            req.user = { id: user.id };
            return next();
        } catch (error) {
            console.error("API key authentication failed:", error);
            return res.status(503).json({ error: "Authentication service temporarily unavailable" });
        }
    }

    return requireSignIn(req, res, next);
};
