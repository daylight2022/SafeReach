import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { validateBody } from '../middleware/validation.js';
import { LoginSchema } from '../types/index.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword } from '../utils/password.js';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '../utils/response.js';

const auth = new Hono();

/**
 * 用户登录
 * POST /auth/login
 */
auth.post('/login', validateBody(LoginSchema), async c => {
  try {
    const { username, password } = c.get('validatedBody');

    // 查找用户
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (user.length === 0) {
      return unauthorizedResponse(c, '用户名或密码错误');
    }

    const foundUser = user[0];

    // 验证密码
    const hashedPassword = hashPassword(password);
    if (foundUser.password !== hashedPassword) {
      return unauthorizedResponse(c, '用户名或密码错误');
    }

    // 生成 JWT Token
    const token = generateToken({
      userId: foundUser.id,
      username: foundUser.username,
      role: foundUser.role,
      departmentId: foundUser.departmentId || undefined,
    });

    // 返回用户信息和 token
    return successResponse(
      c,
      {
        token,
        user: {
          id: foundUser.id,
          username: foundUser.username,
          realName: foundUser.realName,
          role: foundUser.role,
          departmentId: foundUser.departmentId,
          phone: foundUser.phone,
          createdAt: foundUser.createdAt,
          updatedAt: foundUser.updatedAt,
        },
      },
      '登录成功',
    );
  } catch (error) {
    console.error('登录失败:', error);
    return errorResponse(c, '登录失败', 500);
  }
});

/**
 * 验证 Token (GET方法)
 * GET /auth/verify
 */
auth.get('/verify', async c => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(c, '缺少认证令牌');
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../utils/jwt.js');
    const payload = verifyToken(token);

    if (!payload) {
      return unauthorizedResponse(c, '无效的认证令牌');
    }

    // 查询最新的用户信息
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return unauthorizedResponse(c, '用户不存在');
    }

    const foundUser = user[0];

    return successResponse(c, {
      user: {
        id: foundUser.id,
        username: foundUser.username,
        realName: foundUser.realName,
        role: foundUser.role,
        departmentId: foundUser.departmentId,
        phone: foundUser.phone,
        createdAt: foundUser.createdAt,
        updatedAt: foundUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Token验证失败:', error);
    return unauthorizedResponse(c, '认证失败');
  }
});

/**
 * 验证 Token (POST方法，保持兼容性)
 * POST /auth/verify
 */
auth.post('/verify', async c => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(c, '缺少认证令牌');
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../utils/jwt.js');
    const payload = verifyToken(token);

    if (!payload) {
      return unauthorizedResponse(c, '无效的认证令牌');
    }

    // 查询最新的用户信息
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return unauthorizedResponse(c, '用户不存在');
    }

    const foundUser = user[0];

    return successResponse(
      c,
      {
        user: {
          id: foundUser.id,
          username: foundUser.username,
          realName: foundUser.realName,
          role: foundUser.role,
          departmentId: foundUser.departmentId,
          phone: foundUser.phone,
          createdAt: foundUser.createdAt,
          updatedAt: foundUser.updatedAt,
        },
      },
      'Token 验证成功',
    );
  } catch (error) {
    console.error('Token 验证失败:', error);
    return errorResponse(c, 'Token 验证失败', 500);
  }
});

/**
 * 刷新 Token
 * POST /auth/refresh
 */
auth.post('/refresh', async c => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(c, '缺少认证令牌');
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../utils/jwt.js');
    const payload = verifyToken(token);

    if (!payload) {
      return unauthorizedResponse(c, '无效的认证令牌');
    }

    // 查询最新的用户信息
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return unauthorizedResponse(c, '用户不存在');
    }

    const foundUser = user[0];

    // 生成新的 Token
    const newToken = generateToken({
      userId: foundUser.id,
      username: foundUser.username,
      role: foundUser.role,
      departmentId: foundUser.departmentId || undefined,
    });

    return successResponse(
      c,
      {
        token: newToken,
        user: {
          id: foundUser.id,
          username: foundUser.username,
          realName: foundUser.realName,
          role: foundUser.role,
          departmentId: foundUser.departmentId,
          phone: foundUser.phone,
          createdAt: foundUser.createdAt,
          updatedAt: foundUser.updatedAt,
        },
      },
      'Token 刷新成功',
    );
  } catch (error) {
    console.error('Token 刷新失败:', error);
    return errorResponse(c, 'Token 刷新失败', 500);
  }
});

/**
 * 用户登出
 * POST /auth/logout
 */
auth.post('/logout', async c => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(c, '缺少认证令牌');
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../utils/jwt.js');
    const payload = verifyToken(token);

    if (!payload) {
      return unauthorizedResponse(c, '无效的认证令牌');
    }

    // 验证用户是否存在
    const user = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return unauthorizedResponse(c, '用户不存在');
    }

    // 注意：在实际生产环境中，这里应该将token加入黑名单
    // 或者使用Redis等缓存系统来管理token的有效性
    // 目前只是简单地返回成功响应，让前端删除本地存储的token

    console.log(`用户 ${user[0].username} 已登出`);

    return successResponse(c, null, '登出成功');
  } catch (error) {
    console.error('登出失败:', error);
    return errorResponse(c, '登出失败', 500);
  }
});

export default auth;
