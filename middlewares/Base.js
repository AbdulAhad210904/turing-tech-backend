'use-strict'
import { static as serveStatic } from 'express';
import { unless } from 'express-unless';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { verifyJWTToken } from '../utils/helpers.js';
import { httpsCodes } from '../config/constants.js';
import { language } from '../language/en/language.js';
import rateLimit from "express-rate-limit";
import log from '../config/logger.js';
import swaggerJSDoc from 'swagger-jsdoc';
import { serve, setup } from 'swagger-ui-express';
import { join } from 'path';
import { globSync } from 'glob'; 
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// FIX #1: Configure rate limiter to work with nginx proxy
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // Maximum number of requests allowed in the time window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip the trust proxy validation since we're handling it manually
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    // Custom key generator that safely handles proxy headers
    keyGenerator: (req) => {
        // Use X-Forwarded-For header from nginx, fallback to req.ip
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            // Take the first IP in the chain (the original client IP)
            return forwarded.split(',')[0].trim();
        }
        return req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               req.ip;
    },
    // Handle the trust proxy issue
    handler: (req, res) => {
        res.status(429).json({
            message: 'Too many requests, please try again later.'
        });
    }
});

class Base {
     
    constructor() {}

    static init(app) {
        const isDocsEnabled = (process.env.SWAGGER_ENABLED || '').toLowerCase() === 'true';
        
        // FIX #2: Set trust proxy to 1 (trust first proxy only - nginx)
        app.set('trust proxy', 1);
       
        app.use(bodyParser.json({ limit: '5mb' }))
        app.use(bodyParser.urlencoded({ limit: '5mb', extended: false }))
        app.use(cookieParser())
        app.use(this.sessionHandler())
        app.use(serveStatic("public"))
        const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean);

        app.use((req, res, next) => {
            const requestOrigin = req.headers.origin;
            if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
                res.header("Access-Control-Allow-Origin", requestOrigin);
            }
            res.header("Access-Control-Allow-Credentials", "true");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, token");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        })
        
        // Apply rate limiter
        app.use(limiter);
        
        // FIX #3: Properly set up Swagger BEFORE authentication middleware
        if (isDocsEnabled) {
            this.swaggerBase(app);
        }
        
        // FIX #4: Configure authentication with proper exclusions
        Base.authenticate.unless = unless;
        app.use(Base.authenticate.unless({
            path: [
                { url: "/auth/login", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/register", methods: ['POST'] }
            ]
        }));
    }

    // FIX #5: Separate Swagger setup into its own method for clarity
    static swaggerBase(app) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const cwd = path.resolve(__dirname, '..');

        const apiFiles = globSync('controller/**/*.js', {
            cwd,
            absolute: true,
            windowsPathsNoEscape: true
        });

        const swaggerDefinition = {
            openapi: '3.0.0',
            info: {
                title: 'turingtest Server REST API',
                version: '1.0.0',
                description: 'A simple turingtest Server REST API with Swagger',
            },
            servers: [
                {
                    url: `${process.env.SWAGGER_HOST}`,
                    description: 'Development server'
                },
            ],
            components: {
                securitySchemes: {
                    Bearer: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            security: [
                {
                    Bearer: [],
                },
            ],
        };

        const options = {
            swaggerDefinition,
            apis: apiFiles
        };

        const swaggerSpec = swaggerJSDoc(options);
        
        // Serve swagger.json endpoint
        app.get('/api-docs/swagger.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });
        
        // Configure Swagger UI options
        const swaggerUiOptions = {
            explorer: false,
            swaggerOptions: {
                url: '/api-docs/swagger.json',
                validatorUrl: null,
                persistAuthorization: true,
            },
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: "turingtest API Documentation"
        };
        
        // Serve Swagger UI static files
        app.use('/api-docs', serve);
        
        // Set up the Swagger UI page
        app.get('/api-docs', setup(swaggerSpec, swaggerUiOptions));
        app.get('/api-docs/', setup(swaggerSpec, swaggerUiOptions));
        
        log(`Swagger is running on ${process.env.SWAGGER_HOST}/api-docs`, 'yellow');
    }

    static async authenticate(req, res, next) {
        let token = req?.headers?.access_token;
        if (token === undefined) {
            let { authorization } = req?.headers
            if (authorization) {
                token = authorization.split('Bearer ')[1].trim()
            }
        }
        if (token) {
            const result = await verifyJWTToken(token)
            if (result.err) {
                if (result.err.name === 'JsonWebTokenError') {
                    res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: language.INVALID_AUTH_TOKEN })
                }
                else if (result.err.name === 'TokenExpiredError') {
                    res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: language.EXPIRED_AUTH_TOKEN })
                }
                else {
                    res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: language.INVALID_AUTH_TOKEN })
                }
            }
            else {
                res.locals.decoded = result.decoded;
                next();
            }
        }
        else
            res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: language.NO_AUTH_GIVEN })
    }

    static sessionHandler(req, res, next) {
        return session({
            secret: process.env.SESSION_SECRETE_KEY,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false,
                httpOnly: false,
                maxAge: 1000 * 60 * 60 * 24
            }
        })
    }
}

export default Base;