import { Context, Next } from 'hono';
import { z } from 'zod';
import { validationErrorResponse } from '../utils/response.js';

/**
 * 请求体验证中间件
 */
export function validateBody(schema: z.ZodTypeAny) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);

      // 将验证后的数据存储到上下文中
      c.set('validatedBody', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(c, error.errors);
      }
      return validationErrorResponse(c, '请求体格式错误');
    }
  };
}

/**
 * 查询参数验证中间件
 */
export function validateQuery(schema: z.ZodTypeAny) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validatedData = schema.parse(query);

      // 将验证后的数据存储到上下文中
      c.set('validatedQuery', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(c, error.errors);
      }
      return validationErrorResponse(c, '查询参数格式错误');
    }
  };
}

/**
 * 路径参数验证中间件
 */
export function validateParams(schema: z.ZodTypeAny) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validatedData = schema.parse(params);

      // 将验证后的数据存储到上下文中
      c.set('validatedParams', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(c, error.errors);
      }
      return validationErrorResponse(c, '路径参数格式错误');
    }
  };
}

// 扩展 Context 类型
declare module 'hono' {
  interface ContextVariableMap {
    validatedBody: any;
    validatedQuery: any;
    validatedParams: any;
  }
}
