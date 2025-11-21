'use-strict'
import { convertToHash, generateJWTToken, verifyHashParams } from '../utils/helpers.js';
import { logger } from '../config/winstonLogger.js';
import { httpsCodes } from '../config/constants.js';
import User  from '../models/User.js';

class AuthManager {

    static sanitizeUserDoc(userDoc) {
        if (!userDoc) return null;
        return {
            id: userDoc._id.toString(),
            email: userDoc.email,
            createdAt: userDoc.createdAt,
            updatedAt: userDoc.updatedAt
        };
    }

    static async registerUser(reqObj) {
        try {
            const { email, password } = reqObj;
            const normalizedEmail = String(email).toLowerCase().trim();

            const userExists = await User.exists({ email: normalizedEmail });
            if (userExists) {
                return {
                    status: httpsCodes.CONFLICT,
                    message: 'Email already registered'
                };
            }

            const hashedPassword = await convertToHash(password);
            const user = await User.create({
                email: normalizedEmail,
                password: hashedPassword
            });

            const sanitizedUser = AuthManager.sanitizeUserDoc(user);
            const token = generateJWTToken({
                id: sanitizedUser.id,
                email: sanitizedUser.email
            });

            logger.info(`User ${sanitizedUser.email} registered`);

            return {
                status: httpsCodes.RECORD_CREATED,
                message: 'Account created',
                token,
                user: sanitizedUser
            };

        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    /**
   * Authenticate user and return { status, message, token, user }
   * @param {{email?: string, password: string}} reqObj
   */
    static async authenticateUser(reqObj) {
      
    try {
      const { email, password } = reqObj;
      const lookup = { email: String(email).toLowerCase().trim() };

      const user = await User.findOne(lookup).select('+password'); // returns a Mongoose doc
      if (!user || !user.password) {
        return { status: httpsCodes.UNAUTHORIZE_CODE, message: 'Invalid credentials' };
      }

      // 3) Verify password with argon2
      const ok = await verifyHashParams(user.password, password);
      if (!ok) {
        return { status: httpsCodes.UNAUTHORIZE_CODE, message: 'Invalid credentials' };
      }
       
       const sanitizedUser = AuthManager.sanitizeUserDoc(user);
       const token  =  generateJWTToken({
            id: sanitizedUser.id,
            email: sanitizedUser.email
       });
       (logger?.info || console.log)(`User ${sanitizedUser.email} authenticated`);
       return {
            status: httpsCodes.SUCCESS_CODE,
            message: 'Logged in',
            token,
            user: sanitizedUser
      };
        }
        catch (error) {
            (logger?.error || console.error)(error);
            console.error(error);
            throw error;
        }
    

    }

    static async getProfile(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return {
                    status: httpsCodes.NOT_FOUND,
                    message: 'User not found'
                };
            }
            return {
                status: httpsCodes.SUCCESS_CODE,
                user: AuthManager.sanitizeUserDoc(user)
            };
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }
}   
export default AuthManager;