import cors from 'cors';
import { config } from '../config/env.js';

export const configureCors = () => {
  return cors({
    origin: (origin, callback) => {
      // In development or if request is same-origin/no-origin (curl/Postman/browser local fetch), allow
      if (config.nodeEnv === 'development' || !origin) {
        return callback(null, true);
      }
      const allowedOrigins = [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS Policy Restriction'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};
