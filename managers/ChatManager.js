import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { httpsCodes } from '../config/constants.js';
import { logger } from '../config/winstonLogger.js';
import LLMService from '../services/LLMService.js';

class ChatManager {

    static serializeChat(chatDoc) {
        if (!chatDoc) return null;
        return {
            id: chatDoc._id.toString(),
            title: chatDoc.title,
            user: chatDoc.user?.toString?.() || chatDoc.user,
            lastMessageAt: chatDoc.lastMessageAt,
            createdAt: chatDoc.createdAt,
            updatedAt: chatDoc.updatedAt
        };
    }

    static serializeMessage(messageDoc) {
        if (!messageDoc) return null;
        return {
            id: messageDoc._id.toString(),
            chat: messageDoc.chat?.toString?.() || messageDoc.chat,
            role: messageDoc.role,
            content: messageDoc.content,
            createdAt: messageDoc.createdAt
        };
    }

    static async createChat({ userId, email, title, message }) {
        const chat = await Chat.create({
            user: userId,
            title: title?.trim() || 'New Chat'
        });

        let messages = [];
        let metadata;

        if (message) {
            const exchange = await this.executeExchange({
                chat,
                userId,
                email,
                content: message
            });
            messages = exchange.messages;
            metadata = exchange.metadata;
        }

        return {
            status: httpsCodes.RECORD_CREATED,
            message: 'Chat created',
            chat: this.serializeChat(chat),
            messages,
            metadata
        };
    }

    static async listChats(userId) {
        const chats = await Chat.find({ user: userId })
            .sort({ updatedAt: -1 })
            .lean();

        return {
            status: httpsCodes.SUCCESS_CODE,
            chats: chats.map((chat) => this.serializeChat(chat))
        };
    }

    static async getChatMessages({ userId, chatId }) {
        const chat = await this.findOwnedChat({ userId, chatId });
        if (!chat) {
            return {
                status: httpsCodes.NOT_FOUND,
                message: 'Chat not found'
            };
        }

        const messages = await Message.find({ chat: chatId, user: userId })
            .sort({ createdAt: 1 })
            .lean();

        return {
            status: httpsCodes.SUCCESS_CODE,
            chat: this.serializeChat(chat),
            messages: messages.map((message) => this.serializeMessage(message))
        };
    }

    static async postMessage({ userId, email, chatId, content, skipOwnershipCheck = false }) {
        const chat = skipOwnershipCheck
            ? await Chat.findById(chatId)
            : await this.findOwnedChat({ userId, chatId });

        if (!chat) {
            return {
                status: httpsCodes.NOT_FOUND,
                message: 'Chat not found'
            };
        }

        const exchange = await this.executeExchange({
            chat,
            userId,
            email,
            content
        });

        return {
            status: httpsCodes.SUCCESS_CODE,
            message: 'Reply generated',
            chat: this.serializeChat(chat),
            ...exchange
        };
    }

    static async findOwnedChat({ userId, chatId }) {
        const chat = await Chat.findOne({
            _id: chatId,
            user: userId
        });

        if (!chat) {
            logger.warn(`User ${userId} attempted to access chat ${chatId} they do not own`);
        }

        return chat;
    }

    static async executeExchange({ chat, userId, email, content }) {
        const userMessageDoc = await Message.create({
            chat: chat._id,
            user: userId,
            role: 'user',
            content
        });

        const llmResponse = await LLMService.generateReply({
            prompt: content,
            conversationId: chat._id.toString(),
            email
        });

        const assistantMessageDoc = await Message.create({
            chat: chat._id,
            user: userId,
            role: 'assistant',
            content: llmResponse.message
        });

        chat.lastMessageAt = assistantMessageDoc.createdAt;
        await chat.save();

        return {
            messages: [
                this.serializeMessage(userMessageDoc),
                this.serializeMessage(assistantMessageDoc)
            ],
            metadata: {
                delayMs: llmResponse.delayMs
            }
        };
    }
}

export default ChatManager;

