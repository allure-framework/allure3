import 'reflect-metadata';
import express, { type Express } from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { AppDataSource } from './config/database.js';
import { appConfig } from './config/app.js';
import { setupMiddleware } from './presentation/api/middleware/index.js';
import { errorHandler } from './presentation/api/middleware/errorHandler.js';
import { jsonErrorHandler } from './presentation/api/middleware/bodyParser.js';
import { createApiRoutes } from './presentation/api/routes/index.js';
import { setupSwagger } from './presentation/api/swagger/swagger.setup.js';
import { RealtimeHandler } from './presentation/websocket/RealtimeHandler.js';

// Repositories
import { LaunchRepository } from './infrastructure/persistence/postgres/LaunchRepository.js';
import { LaunchGlobalsRepository } from './infrastructure/persistence/postgres/LaunchGlobalsRepository.js';
import { LaunchVariablesRepository } from './infrastructure/persistence/postgres/LaunchVariablesRepository.js';
import { TestResultRepository } from './infrastructure/persistence/postgres/TestResultRepository.js';
import { AttachmentRepository } from './infrastructure/persistence/postgres/AttachmentRepository.js';
import { HistoryRepository } from './infrastructure/persistence/postgres/HistoryRepository.js';

// Services
import { FileSystemStorage } from './infrastructure/external/storage/FileSystemStorage.js';
import { EventEmitterBus } from './infrastructure/messaging/EventEmitterBus.js';
import { PluginService } from './application/services/PluginService.js';
import { LaunchResolutionService } from './application/services/LaunchResolutionService.js';
import { ChartsService } from './application/services/ChartsService.js';
import { DatabaseAllureStore } from './infrastructure/adapters/DatabaseAllureStore.js';

// Use Cases
import { CreateLaunch } from './application/use-cases/launches/CreateLaunch.js';
import { GetLaunch } from './application/use-cases/launches/GetLaunch.js';
import { GetLaunchCi } from './application/use-cases/launches/GetLaunchCi.js';
import { GetLaunchEnvironments } from './application/use-cases/launches/GetLaunchEnvironments.js';
import { ListLaunches } from './application/use-cases/launches/ListLaunches.js';
import { CompleteLaunch } from './application/use-cases/launches/CompleteLaunch.js';
import { CreateGlobals } from './application/use-cases/launches/CreateGlobals.js';
import { CreateVariables } from './application/use-cases/launches/CreateVariables.js';
import { DeleteLaunch } from './application/use-cases/launches/DeleteLaunch.js';
import { UploadLaunchResults } from './application/use-cases/test-results/UploadLaunchResults.js';
import { GetTestResult } from './application/use-cases/test-results/GetTestResult.js';
import { ListTestResults } from './application/use-cases/test-results/ListTestResults.js';
import { GetTestResultHistory } from './application/use-cases/test-results/GetTestResultHistory.js';
import { GetTestEnvGroup } from './application/use-cases/test-results/GetTestEnvGroup.js';
import { SearchTestResults } from './application/use-cases/test-results/SearchTestResults.js';
import { UploadAttachment } from './application/use-cases/attachments/UploadAttachment.js';
import { GetAttachment } from './application/use-cases/attachments/GetAttachment.js';
import { DeleteAttachment } from './application/use-cases/attachments/DeleteAttachment.js';
import { GetWidgetData } from './application/use-cases/widgets/GetWidgetData.js';
import { GenerateWidgets } from './application/use-cases/widgets/GenerateWidgets.js';
import { GetTreeData } from './application/use-cases/trees/GetTreeData.js';
import { GenerateReport } from './application/use-cases/reports/GenerateReport.js';

// Controllers
import { LaunchController } from './presentation/api/controllers/LaunchController.js';
import { TestResultController } from './presentation/api/controllers/TestResultController.js';
import { AttachmentController } from './presentation/api/controllers/AttachmentController.js';
import { WidgetController } from './presentation/api/controllers/WidgetController.js';
import { TreeController } from './presentation/api/controllers/TreeController.js';
import { ReportController } from './presentation/api/controllers/ReportController.js';

// Factories
import { LaunchFactory } from './domain/factories/LaunchFactory.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: appConfig.cors.origin }
});

// Setup middleware
setupMiddleware(app);

// Initialize database and dependencies
let realtimeHandler: RealtimeHandler | null = null;

// Initialize database connection with retry logic
let dbConnected = false;
const maxRetries = 5;
let retries = 0;

async function initializeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    dbConnected = true;
    return;
  }
  try {
    await AppDataSource.initialize();
    console.log('Database connected');
    dbConnected = true;
  } catch (error) {
    retries++;
    if (retries < maxRetries) {
      console.log(`Database connection failed (attempt ${retries}/${maxRetries}), retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return initializeDatabase();
    } else {
      const err = error as Error & { cause?: unknown; fileName?: string; module?: string };
      console.warn('Warning: Could not connect to database. Some features may not work.');
      console.warn('Error:', err.message);
      if (err.cause) console.warn('Cause:', err.cause);
      if (err.fileName) console.warn('FileName:', err.fileName);
      if ((err as unknown as { module?: string }).module) console.warn('Module:', (err as unknown as { module: string }).module);
      dbConnected = false;
    }
  }
}

async function initializeApplication(appInstance: Express): Promise<void> {
  if (!dbConnected) {
    console.warn('Database not connected, application will not be fully initialized');
    return;
  }

  // Initialize repositories
  const launchRepository = new LaunchRepository(AppDataSource);
  const launchGlobalsRepository = new LaunchGlobalsRepository(AppDataSource);
  const launchVariablesRepository = new LaunchVariablesRepository(AppDataSource);
  const testResultRepository = new TestResultRepository(AppDataSource);
  const attachmentRepository = new AttachmentRepository(AppDataSource);
  const historyRepository = new HistoryRepository(AppDataSource);

  // Initialize external services
  const storageService = new FileSystemStorage({
    baseDirectory: process.env.ATTACHMENT_STORAGE_PATH || './storage/attachments',
    subdirectoryStructure: 'byDate'
  });

  const eventBus = new EventEmitterBus();
  const pluginService = new PluginService();
  const allureStore = new DatabaseAllureStore(
    testResultRepository,
    attachmentRepository,
    historyRepository
  );

  // Initialize factories
  const launchFactory = new LaunchFactory();

  // Initialize use cases
  const createLaunch = new CreateLaunch(launchRepository, launchFactory, launchVariablesRepository);
  const getLaunch = new GetLaunch(launchRepository);
  const getLaunchCi = new GetLaunchCi(launchRepository);
  const getLaunchEnvironments = new GetLaunchEnvironments(
    launchRepository,
    launchGlobalsRepository,
    launchVariablesRepository
  );
  const launchResolutionService = new LaunchResolutionService(launchRepository);
  const listLaunches = new ListLaunches(launchRepository, testResultRepository);
  const completeLaunch = new CompleteLaunch(launchRepository, eventBus);
  const createGlobals = new CreateGlobals(launchRepository, launchGlobalsRepository);
  const createVariables = new CreateVariables(launchRepository, launchVariablesRepository);
  const deleteLaunch = new DeleteLaunch(
    launchRepository,
    testResultRepository,
    attachmentRepository
  );

  const uploadLaunchResults = new UploadLaunchResults(
    launchRepository,
    testResultRepository,
    historyRepository,
    allureStore,
    eventBus
  );
  const getTestResult = new GetTestResult(testResultRepository);
  const listTestResults = new ListTestResults(testResultRepository, launchResolutionService);
  const getTestResultHistory = new GetTestResultHistory(historyRepository, testResultRepository);
  const searchTestResults = new SearchTestResults(testResultRepository);

  const uploadAttachment = new UploadAttachment(
    attachmentRepository,
    storageService,
    appConfig.apiPrefix
  );
  const getAttachment = new GetAttachment(attachmentRepository, storageService, appConfig.apiPrefix);
  const deleteAttachment = new DeleteAttachment(attachmentRepository, storageService);

  const chartsService = new ChartsService(testResultRepository, launchRepository);
  const getWidgetData = new GetWidgetData(
    testResultRepository,
    launchResolutionService,
    launchGlobalsRepository,
    launchVariablesRepository,
    attachmentRepository,
    chartsService
  );
  const generateWidgets = new GenerateWidgets(
    launchRepository,
    testResultRepository,
    pluginService
  );

  const getTreeData = new GetTreeData(testResultRepository, launchResolutionService);
  const getTestEnvGroup = new GetTestEnvGroup(testResultRepository, launchResolutionService);

  const generateReport = new GenerateReport(launchRepository, testResultRepository, launchResolutionService);

  // Initialize controllers
  const launchController = new LaunchController(
    createLaunch,
    createGlobals,
    createVariables,
    getLaunch,
    getLaunchCi,
    getLaunchEnvironments,
    listLaunches,
    completeLaunch,
    deleteLaunch
  );
  const testResultController = new TestResultController(
    uploadLaunchResults,
    getTestResult,
    listTestResults,
    getTestResultHistory,
    getTestEnvGroup,
    searchTestResults
  );
  const attachmentController = new AttachmentController(
    uploadAttachment,
    getAttachment,
    deleteAttachment
  );
  const widgetController = new WidgetController(getWidgetData, generateWidgets);
  const treeController = new TreeController(getTreeData);
  const reportController = new ReportController(generateReport);

  // Mount API routes
  const apiRoutes = createApiRoutes(
    launchController,
    testResultController,
    attachmentController,
    widgetController,
    treeController,
    reportController
  );
  appInstance.use(appConfig.apiPrefix, apiRoutes);
  console.log(`API routes mounted at ${appConfig.apiPrefix}`);
  
  // Update test route to indicate routes are registered
  appInstance.get('/test', (req, res) => {
    res.json({ message: 'Express is working', routesRegistered: true });
  });

  // Initialize WebSocket handler
  realtimeHandler = new RealtimeHandler(io, eventBus);

  console.log('Application initialized and routes registered');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), dbConnected });
});

// Test route to verify Express is working
app.get('/test', (req, res) => {
  res.json({ message: 'Express is working', routesRegistered: false });
});

// Setup Swagger
setupSwagger(app);

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Initialize application (controllers and routes)
    await initializeApplication(app);
    
    // Error handlers must be after all routes
    // JSON parsing errors should be handled first
    app.use(jsonErrorHandler);
    app.use(errorHandler);
    
    // Start server
    httpServer.listen(appConfig.port, () => {
      console.log(`Server running on port ${appConfig.port}`);
      console.log(`API documentation available at http://localhost:${appConfig.port}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Do not start HTTP server when running e2e tests (vitest)
if (process.env.VITEST !== 'true') {
  startServer();
}

/** Returns fully configured Express app for e2e tests (DB + routes + error handlers). */
export async function getAppForTest(): Promise<Express> {
  retries = 0;
  await initializeDatabase();
  if (!dbConnected) {
    const host = process.env.DB_HOST ?? 'localhost';
    const port = process.env.DB_PORT ?? '5432';
    throw new Error(
      `E2E getAppForTest: database not connected (tried ${host}:${port}). ` +
        'From backend package run: docker-compose up -d postgres && yarn migration:run. ' +
        'On WSL2 ensure Docker exposes port 5432 to localhost.'
    );
  }
  await initializeApplication(app);
  app.use(jsonErrorHandler);
  app.use(errorHandler);
  return app;
}

export { app };

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    AppDataSource.destroy()
      .then(() => {
        console.log('Database connection closed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error closing database connection:', error);
        process.exit(1);
      });
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    AppDataSource.destroy()
      .then(() => {
        console.log('Database connection closed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error closing database connection:', error);
        process.exit(1);
      });
  });
});
