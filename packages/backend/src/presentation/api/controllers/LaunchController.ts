import { Request, Response } from 'express';
import { CreateLaunch } from '../../../application/use-cases/launches/CreateLaunch.js';
import { CreateGlobals } from '../../../application/use-cases/launches/CreateGlobals.js';
import { CreateVariables } from '../../../application/use-cases/launches/CreateVariables.js';
import { GetLaunch } from '../../../application/use-cases/launches/GetLaunch.js';
import { GetLaunchCi } from '../../../application/use-cases/launches/GetLaunchCi.js';
import { GetLaunchEnvironments } from '../../../application/use-cases/launches/GetLaunchEnvironments.js';
import { ListLaunches } from '../../../application/use-cases/launches/ListLaunches.js';
import { CompleteLaunch } from '../../../application/use-cases/launches/CompleteLaunch.js';
import { DeleteLaunch } from '../../../application/use-cases/launches/DeleteLaunch.js';
import { CreateLaunchRequest } from '../../../application/dto/requests/CreateLaunchRequest.js';
import { CreateGlobalsRequest } from '../../../application/dto/requests/CreateGlobalsRequest.js';
import type { CreateVariablesRequest } from '../../../application/dto/requests/CreateVariablesRequest.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { createSuccessResponse } from '../types/responses.js';
import { getAppLogger } from '../../../infrastructure/external/logger/appLogger.js';

export class LaunchController {
  constructor(
    private readonly createLaunch: CreateLaunch,
    private readonly createGlobalsUseCase: CreateGlobals,
    private readonly createVariablesUseCase: CreateVariables,
    private readonly getLaunch: GetLaunch,
    private readonly getLaunchCi: GetLaunchCi,
    private readonly getLaunchEnvironments: GetLaunchEnvironments,
    private readonly listLaunches: ListLaunches,
    private readonly completeLaunch: CompleteLaunch,
    private readonly deleteLaunch: DeleteLaunch
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const request: CreateLaunchRequest = req.body;
    getAppLogger().debug('LaunchController.create', { name: request.name });
    const launch = await this.createLaunch.execute(request);
    res.status(201).json(createSuccessResponse(launch));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    getAppLogger().debug('LaunchController.getById', { launch_id });
    const launch = await this.getLaunch.execute(launch_id);

    if (!launch) {
      throw new NotFoundError('Launch', launch_id);
    }

    res.json(createSuccessResponse(launch));
  }

  async getCi(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    getAppLogger().debug('LaunchController.getCi', { launch_id });
    const ci = await this.getLaunchCi.execute(launch_id);
    if (ci === null) {
      throw new NotFoundError('Launch', launch_id);
    }
    res.json(createSuccessResponse(ci));
  }

  async getEnvironments(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    getAppLogger().debug('LaunchController.getEnvironments', { launch_id });
    const environments = await this.getLaunchEnvironments.execute(launch_id);
    if (environments === null) {
      throw new NotFoundError('Launch', launch_id);
    }
    res.json(createSuccessResponse(environments));
  }

  async list(req: Request, res: Response): Promise<void> {
    const pagination = req.pagination || { page: 1, limit: 20, offset: 0 };
    const { startDate, endDate } = req.query;
    getAppLogger().debug('LaunchController.list', {
      page: pagination.page,
      limit: pagination.limit,
      startDate: startDate ?? null,
      endDate: endDate ?? null
    });

    const options = {
      page: pagination.page,
      limit: pagination.limit,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };

    const result = await this.listLaunches.execute(options);
    res.json(result);
  }

  async complete(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    getAppLogger().debug('LaunchController.complete', { launch_id });
    const launch = await this.completeLaunch.execute(launch_id);
    res.json(createSuccessResponse(launch));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    getAppLogger().debug('LaunchController.delete', { launch_id });
    await this.deleteLaunch.execute(launch_id);
    res.status(204).send();
  }

  async createGlobals(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    const request = req.body as CreateGlobalsRequest;
    getAppLogger().debug('LaunchController.createGlobals', { launch_id });
    await this.createGlobalsUseCase.execute(launch_id, request);
    res.status(200).json(createSuccessResponse({ success: true }));
  }

  async createVariables(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    const request = req.body as CreateVariablesRequest;
    getAppLogger().debug('LaunchController.createVariables', { launch_id });
    await this.createVariablesUseCase.execute(launch_id, request);
    res.status(200).json(createSuccessResponse({ success: true }));
  }
}
