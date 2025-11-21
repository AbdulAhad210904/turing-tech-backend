'use-strict'
import { Router } from 'express';
import Joi from 'joi';
import ChatManager from '../managers/ChatManager.js';
import { httpsCodes } from '../config/constants.js';
import { logger } from '../config/winstonLogger.js';

const router = Router();

const createChatSchema = Joi.object({
    title: Joi.string().max(120).allow('', null),
    message: Joi.string().max(4000).allow('', null)
});

const messageSchema = Joi.object({
    content: Joi.string().min(1).max(4000).required()
});

const chatIdParamSchema = Joi.object({
    chatId: Joi.string().hex().length(24).required()
});

function getUserFromContext(res) {
    return res.locals?.decoded;
}

/**
 * @openapi
 * /chats:
 *   post:
 *     tags:
 *       - Chats
 *     summary: Create a new chat thread
 *     security:
 *       - Bearer: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Product ideas
 *               message:
 *                 type: string
 *                 description: Optional first message that will trigger an LLM reply
 *                 example: "Help me brainstorm product ideas for a budgeting app."
 *     responses:
 *       201:
 *         description: Chat created
 *       400:
 *         description: Validation error
 */
router.post('/', async (req, res) => {
    const user = getUserFromContext(res);
    if (!user?.id) {
        return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: 'Unauthorized' });
    }
    const { error, value } = createChatSchema.validate(req.body || {});
    if (error) {
        return res.status(httpsCodes.BAD_REQUEST).json({ message: error.message });
    }

    try {
        const result = await ChatManager.createChat({
            userId: user.id,
            email: user.email,
            title: value.title,
            message: value.message
        });
        return res.status(result.status).json(result);
    } catch (err) {
        logger.error(err);
        return res.status(httpsCodes.SERVER_ERROR_CODE).json({ message: 'Unable to create chat' });
    }
});

/**
 * @openapi
 * /chats:
 *   get:
 *     tags:
 *       - Chats
 *     summary: List chats that belong to the authenticated user
 *     security:
 *       - Bearer: []
 *     responses:
 *       200:
 *         description: List of chats
 */
router.get('/', async (req, res) => {
    const user = getUserFromContext(res);
    if (!user?.id) {
        return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: 'Unauthorized' });
    }
    try {
        const result = await ChatManager.listChats(user.id);
        return res.status(result.status).json(result);
    } catch (err) {
        logger.error(err);
        return res.status(httpsCodes.SERVER_ERROR_CODE).json({ message: 'Unable to fetch chats' });
    }
});

/**
 * @openapi
 * /chats/{chatId}/messages:
 *   get:
 *     tags:
 *       - Chats
 *     summary: Retrieve messages for a chat owned by the user
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *           example: 665a4d99285fddae50a0d5b1
 *     responses:
 *       200:
 *         description: Messages returned
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId/messages', async (req, res) => {
    const user = getUserFromContext(res);
    if (!user?.id) {
        return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: 'Unauthorized' });
    }
    const { error } = chatIdParamSchema.validate(req.params);
    if (error) {
        return res.status(httpsCodes.BAD_REQUEST).json({ message: error.message });
    }

    try {
        const result = await ChatManager.getChatMessages({
            userId: user.id,
            chatId: req.params.chatId
        });
        return res.status(result.status).json(result);
    } catch (err) {
        logger.error(err);
        return res.status(httpsCodes.SERVER_ERROR_CODE).json({ message: 'Unable to load messages' });
    }
});

/**
 * @openapi
 * /chats/{chatId}/messages:
 *   post:
 *     tags:
 *       - Chats
 *     summary: Send a message and receive a simulated LLM reply
 *     security:
 *       - Bearer: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Can you summarize my last meeting notes?"
 *     responses:
 *       200:
 *         description: Messages stored and LLM reply returned
 *       404:
 *         description: Chat not found
 */
router.post('/:chatId/messages', async (req, res) => {
    const user = getUserFromContext(res);
    if (!user?.id) {
        return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: 'Unauthorized' });
    }
    const paramsValidation = chatIdParamSchema.validate(req.params);
    if (paramsValidation.error) {
        return res.status(httpsCodes.BAD_REQUEST).json({ message: paramsValidation.error.message });
    }

    const { error, value } = messageSchema.validate(req.body || {});
    if (error) {
        return res.status(httpsCodes.BAD_REQUEST).json({ message: error.message });
    }

    try {
        const result = await ChatManager.postMessage({
            userId: user.id,
            email: user.email,
            chatId: req.params.chatId,
            content: value.content
        });
        return res.status(result.status).json(result);
    } catch (err) {
        logger.error(err);
        return res.status(httpsCodes.SERVER_ERROR_CODE).json({ message: 'Unable to send message' });
    }
});

export default router;

