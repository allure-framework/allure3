export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface FilterParams {
  status?: string;
  labelName?: string;
  labelValue?: string;
  search?: string;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface QueryParams {
  page?: number;
  limit?: number;
  size?: number;
  status?: string;
  label?: string;
  search?: string;
  q?: string;
  sort?: string;
  launch_id?: string;
  format?: string;
}

export interface PathParams {
  launch_id?: string;
  id?: string;
  uid?: string;
  name?: string;
  type?: string;
  report_uuid?: string;
}
