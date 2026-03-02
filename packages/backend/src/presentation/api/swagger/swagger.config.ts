import swaggerJsdoc from 'swagger-jsdoc';
import { appConfig } from '../../../config/app.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../../');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Allure 3 Backend API',
      version: '1.0.0',
      description: 'REST API for Allure 3 test results management and reporting',
      contact: {
        name: 'API Support',
        email: 'support@allure.example.com'
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
      }
    },
    servers: [
      {
        url: `http://localhost:${appConfig.port}`,
        description: 'Development server'
      },
      {
        url: 'https://api.allure.example.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      { name: 'Launches', description: 'Launch management endpoints' },
      { name: 'Test Results', description: 'Test result endpoints' },
      { name: 'Attachments', description: 'Attachment endpoints' },
      { name: 'Widgets', description: 'Widget data endpoints' },
      { name: 'Trees', description: 'Tree data endpoints' },
      { name: 'Reports', description: 'Report generation endpoints' }
    ]
  },
  apis: [
    join(projectRoot, 'src/presentation/api/routes/**/*.ts'),
    join(projectRoot, 'src/presentation/api/controllers/**/*.ts')
  ]
};

export const swaggerSpec = swaggerJsdoc(options);
