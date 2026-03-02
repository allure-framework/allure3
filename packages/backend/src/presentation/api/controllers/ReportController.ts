import { Request, Response } from 'express';
import { GenerateReport, GenerateReportOptions } from '../../../application/use-cases/reports/GenerateReport.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { createSuccessResponse } from '../types/responses.js';

export class ReportController {
  constructor(private readonly generateReport: GenerateReport) {}

  async generate(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    const { format } = req.body;
    const environment = req.query.environment as string | undefined;
    
    const options: GenerateReportOptions = {
      format: format === 'json' ? 'json' : 'html',
      environment
    };
    
    const report = await this.generateReport.execute(launch_id, options);
    res.json(createSuccessResponse(report));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { report_uuid } = req.params;
    
    // TODO: Implement report retrieval from storage
    // For now, return 404
    throw new NotFoundError('Report', report_uuid);
  }

  async download(req: Request, res: Response): Promise<void> {
    const { report_uuid } = req.params;
    
    // TODO: Implement report download from storage
    // For now, return 404
    throw new NotFoundError('Report', report_uuid);
  }
}
