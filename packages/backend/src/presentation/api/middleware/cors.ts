import cors from 'cors';
import { appConfig } from '../../../config/app.js';

export const corsMiddleware = cors({
  origin: appConfig.cors.origin === '*' 
    ? true 
    : appConfig.cors.origin.split(',').map(origin => origin.trim()),
  credentials: appConfig.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit']
});
