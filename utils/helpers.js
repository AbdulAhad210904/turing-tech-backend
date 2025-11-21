'use strict'
import { logger } from '../config/winstonLogger.js';
import { verify as _verify, hash } from 'argon2';
import jwt from 'jsonwebtoken';

export function errorHandler(err, req, res, next) {
    res.status(err.status).json(err.message)
}

export async function verifyJWTToken(token) {
    
    return jwt.verify(token, process.env.JWT_SECRETE_KEY, (err, decoded) => {
        return { err: err, decoded: decoded };
    })
}



/* Argon2 Hash Verification */
export async function verifyHashParams(hashedParams, plainParams ) {
    try {
        const match = await _verify(hashedParams, plainParams);
        const result = (match) ?  true :  false;   
        return result;       
        
    } catch (error) {
        logger.info('Error comparing parameters:', error);
        console.error('Error comparing parameters:', error);
    }
}

/* Argon2 Converting to Hash */
export async function convertToHash( plainParams ) {
    try {
        return await hash(plainParams);
    } catch (error) {
        logger.info('Error converting to hash:', error);
        console.error('Error converting to hash:', error);
    }
}


export function generateJWTToken(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('generateJWTToken requires a payload object');
    }
    return jwt.sign(payload, process.env.JWT_SECRETE_KEY, { expiresIn: '10h' });
}

