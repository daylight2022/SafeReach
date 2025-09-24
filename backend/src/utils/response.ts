import { Context } from 'hono';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

/**
 * 成功响应
 */
export function successResponse<T>(
  c: Context,
  data?: T,
  message?: string,
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };

  return c.json(response);
}

/**
 * 错误响应
 */
export function errorResponse(
  c: Context,
  error: string,
  code: number = 400,
  message?: string,
): Response {
  const response: ApiResponse = {
    success: false,
    error,
    message,
    code,
  };

  return c.json(response, code as any);
}

/**
 * 分页响应
 */
export function paginatedResponse<T>(
  c: Context,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string,
): Response {
  const response = {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    message,
  };

  return c.json(response);
}

/**
 * 验证错误响应
 */
export function validationErrorResponse(c: Context, errors: any): Response {
  return errorResponse(c, '数据验证失败', 422, JSON.stringify(errors));
}

/**
 * 未授权响应
 */
export function unauthorizedResponse(
  c: Context,
  message: string = '未授权访问',
): Response {
  return errorResponse(c, message, 401);
}

/**
 * 禁止访问响应
 */
export function forbiddenResponse(
  c: Context,
  message: string = '权限不足',
): Response {
  return errorResponse(c, message, 403);
}

/**
 * 资源未找到响应
 */
export function notFoundResponse(
  c: Context,
  message: string = '资源未找到',
): Response {
  return errorResponse(c, message, 404);
}

/**
 * 服务器错误响应
 */
export function serverErrorResponse(c: Context, error?: any): Response {
  console.error('服务器错误:', error);
  return errorResponse(c, '服务器内部错误', 500);
}
