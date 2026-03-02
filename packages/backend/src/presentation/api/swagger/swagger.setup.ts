import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { swaggerSpec } from './swagger.config.js';

export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Allure 3 API Documentation',
    explorer: true
  }));
}
