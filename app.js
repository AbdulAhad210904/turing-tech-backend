import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './config/routes.js';
import Base from './middlewares/Base.js'; 
import { errorHandler } from './utils/helpers.js';
import { logger } from './config/winstonLogger.js';
import { connectMongo } from './utils/mongoose.js';
const app = express();

app.use(helmet());
app.use(cors({
  origin: "http://localhost:3000", // your frontend
  credentials: true,               // allow cookies / sessions / JWT
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


await connectMongo();  

Base.init(app);
routes(app);
app.use(errorHandler);

process.on('uncaughtException', (err) => { logger.error(err); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error(err); process.exit(1); });

export default app;
