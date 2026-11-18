import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error.js';


export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
