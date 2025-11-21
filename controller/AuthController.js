'use-strict'
import { Router } from 'express';
import Joi from 'joi';
import { httpsCodes } from '../config/constants.js';
import authManager from '../managers/AuthManager.js';
import { logger } from '../config/winstonLogger.js';

const router = Router();

const credentialSchema = Joi.object({
    email: Joi.string().email().min(5).max(254).required(),
    password: Joi.string().min(6).max(128).required()
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Create a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Passw0rd!
 *     responses:
 *       201:
 *         description: Account created
 *       409:
 *         description: Username already exists
 */
router.post('/register', async (req, res) => {
    const { error, value } = credentialSchema.validate(req.body || {});
    if (error) {
        return res.status(httpsCodes.BAD_REQUEST).json({ message: error.message });
    }

    try {
        const result = await authManager.registerUser(value);
        return res.status(result.status).json(result);
    } catch (err) {
        logger.error(err);
        return res.status(httpsCodes.SERVER_ERROR_CODE).json({ message: 'Unable to register' });
    }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: Passw0rd!
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 message: { type: string, example: "Logged in" }
 *                 token: { type: string, example: "eyJhbGciOi..." }
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
    const { error, value } = credentialSchema.validate(req.body || {});
    if (error) {
        return res.status(httpsCodes.BAD_REQUEST).json({ message: error.message });
    }

    try {
        const result = await authManager.authenticateUser(value);
        logger.info(result.message);
        return res.status(result.status ?? httpsCodes.SUCCESS_CODE).json(result);
    } catch (err) {
        logger.error(err);
        return res
        .status(httpsCodes.SERVER_ERROR_CODE)
        .json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Return the authenticated user's profile
 *     security:
 *       - Bearer: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       401:
 *         description: Unauthorized
 */
router.get('/me', async (req, res) => {
    const user = res.locals?.decoded;
    if (!user?.id) {
        return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: 'Unauthorized' });
    }
    try {
        const result = await authManager.getProfile(user.id);
        return res.status(result.status).json(result);
    } catch (err) {
        logger.error(err);
        return res.status(httpsCodes.SERVER_ERROR_CODE).json({ message: 'Unable to fetch profile' });
    }
});

export default router;
