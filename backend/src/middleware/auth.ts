import { Context, Next } from 'hono';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../utils/jwt.js';
import { unauthorizedResponse, forbiddenResponse } from '../utils/response.js';

// 扩展 Context 类型以包含用户信息
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

/**
 * JWT 认证中间件
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return unauthorizedResponse(c, '缺少认证令牌');
  }

  const payload = verifyToken(token);
  if (!payload) {
    return unauthorizedResponse(c, '无效的认证令牌');
  }

  // 将用户信息存储到上下文中
  c.set('user', payload);
  await next();
}

/**
 * 角色权限中间件
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return unauthorizedResponse(c, '用户信息不存在');
    }

    if (!allowedRoles.includes(user.role)) {
      return forbiddenResponse(c, `需要以下角色之一: ${allowedRoles.join(', ')}`);
    }

    await next();
  };
}

/**
 * 管理员权限中间件
 */
export const requireAdmin = requireRole('admin');

/**
 * 管理员或操作员权限中间件
 */
export const requireAdminOrOperator = requireRole('admin', 'operator');

/**
 * 可选认证中间件（不强制要求认证）
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      c.set('user', payload);
    }
  }

  await next();
}
