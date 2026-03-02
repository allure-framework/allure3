import { Request, Response } from 'express';
import { GetWidgetData } from '../../../application/use-cases/widgets/GetWidgetData.js';
import { GenerateWidgets } from '../../../application/use-cases/widgets/GenerateWidgets.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { createSuccessResponse } from '../types/responses.js';

export class WidgetController {
  constructor(
    private readonly getWidgetData: GetWidgetData,
    private readonly generateWidgets: GenerateWidgets
  ) {}

  async get(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const { launch_id, environment } = req.query;
    
    const widget = await this.getWidgetData.execute(
      name,
      launch_id as string | undefined,
      environment as string | undefined
    );
    
    if (!widget) {
      throw new NotFoundError('Widget', name);
    }
    
    res.json(createSuccessResponse(widget));
  }

  async generate(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    await this.generateWidgets.execute(launch_id);
    res.json(createSuccessResponse({ success: true }));
  }
}
