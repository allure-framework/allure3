import { Request, Response } from 'express';
import { GetTreeData, TreeType } from '../../../application/use-cases/trees/GetTreeData.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { createSuccessResponse } from '../types/responses.js';

const VALID_TREE_TYPES: TreeType[] = ['suites', 'packages', 'behaviors', 'categories'];

export class TreeController {
  constructor(private readonly getTreeData: GetTreeData) {}

  async get(req: Request, res: Response): Promise<void> {
    const { type } = req.params;
    const { launch_id, environment } = req.query;
    
    if (!VALID_TREE_TYPES.includes(type as TreeType)) {
      throw new ValidationError(`Invalid tree type: ${type}. Valid types are: ${VALID_TREE_TYPES.join(', ')}`);
    }
    
    const tree = await this.getTreeData.execute(
      type as TreeType,
      launch_id as string | undefined,
      environment as string | undefined
    );
    res.json(createSuccessResponse(tree));
  }
}
