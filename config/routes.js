'use-strict'
import authRouter from '../controller/AuthController.js'
import chatRouter from '../controller/ChatController.js'
export default (app) => {
    try {
        app.use('/auth', authRouter);
        app.use('/chats', chatRouter);
    } catch (error) {
        // console.log('in routes ---> ',error)
        throw error
    }
}

