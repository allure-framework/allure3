export const swaggerSchemas = {
  ErrorResponse: {
    type: 'object',
    properties: {
      error: {
        type: 'string',
        description: 'Error message'
      },
      code: {
        type: 'string',
        description: 'Error code'
      },
      details: {
        type: 'object',
        description: 'Additional error details'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Error timestamp'
      }
    },
    required: ['error', 'timestamp']
  },
  PaginatedResponse: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: {}
      },
      total: {
        type: 'integer',
        description: 'Total number of items'
      },
      page: {
        type: 'integer',
        description: 'Current page number'
      },
      limit: {
        type: 'integer',
        description: 'Items per page'
      },
      totalPages: {
        type: 'integer',
        description: 'Total number of pages'
      }
    },
    required: ['data', 'total', 'page', 'limit', 'totalPages']
  },
  LaunchResponse: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      startTime: { type: 'string', format: 'date-time' },
      stopTime: { type: 'string', format: 'date-time', nullable: true },
      executor: { type: 'object', nullable: true },
      environment: { type: 'string', nullable: true },
      reportUuid: { type: 'string', nullable: true },
      statistic: { type: 'object' },
      testResultsCount: { type: 'integer' },
      duration: { type: 'integer', nullable: true }
    }
  },
  TestResultResponse: {
    type: 'object',
    description: 'Test result from @allurereport/core-api'
  },
  AttachmentResponse: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      uid: { type: 'string' },
      name: { type: 'string', nullable: true },
      contentType: { type: 'string', nullable: true },
      contentLength: { type: 'integer', nullable: true },
      url: { type: 'string' }
    }
  },
  WidgetResponse: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      data: { type: 'object' }
    }
  },
  TreeResponse: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['suites', 'packages', 'behaviors']
      },
      root: { type: 'object' }
    }
  },
  ReportResponse: {
    type: 'object',
    properties: {
      launchId: { type: 'string' },
      reportUuid: { type: 'string' },
      format: { type: 'string', enum: ['html', 'json'] },
      url: { type: 'string' },
      generatedAt: { type: 'string', format: 'date-time' }
    }
  }
};
