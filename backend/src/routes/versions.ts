import { Hono } from 'hono';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { appVersions } from '../db/schema.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { z } from 'zod';

const app = new Hono();

// 版本信息验证schema
const versionSchema = z.object({
  version: z.string().min(1).max(20),
  versionCode: z.number().int().positive(),
  releaseNotes: z.string().min(1),
  downloadUrl: z.string().url().optional(),
  isPrerelease: z.boolean().optional(),
});

const updateVersionSchema = z.object({
  releaseNotes: z.string().min(1).optional(),
  downloadUrl: z.string().url().optional(),
  isPrerelease: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// 获取最新版本信息（公开接口，无需认证）
app.get('/latest', async c => {
  try {
    const latestVersion = await db
      .select()
      .from(appVersions)
      .where(
        and(
          eq(appVersions.isActive, true),
          eq(appVersions.isPrerelease, false),
        ),
      )
      .orderBy(desc(appVersions.versionCode))
      .limit(1);

    if (latestVersion.length === 0) {
      return errorResponse(c, '暂无可用版本', 404);
    }

    return successResponse(c, latestVersion[0]);
  } catch (error) {
    console.error('获取最新版本失败:', error);
    return errorResponse(c, '获取最新版本失败', 500);
  }
});

// 获取版本历史（公开接口，无需认证）
app.get('/history', async c => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const includePrerelease = c.req.query('includePrerelease') === 'true';

    const offset = (page - 1) * limit;

    const baseCondition = eq(appVersions.isActive, true);
    const whereCondition = includePrerelease
      ? baseCondition
      : and(baseCondition, eq(appVersions.isPrerelease, false));

    const versions = await db
      .select()
      .from(appVersions)
      .where(whereCondition)
      .orderBy(desc(appVersions.versionCode))
      .limit(limit)
      .offset(offset);

    // 获取总数
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(appVersions)
      .where(whereCondition);

    const total = Number(totalResult[0]?.count) || 0;
    const totalPages = Math.ceil(total / limit);

    return successResponse(c, {
      versions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取版本历史失败:', error);
    return errorResponse(c, '获取版本历史失败', 500);
  }
});

// 检查版本更新（公开接口，无需认证）
app.get('/check', async c => {
  try {
    const currentVersion = c.req.query('version');
    const currentVersionCode = parseInt(c.req.query('versionCode') || '0');

    if (!currentVersion || !currentVersionCode) {
      return errorResponse(c, '缺少当前版本信息', 400);
    }

    const latestVersion = await db
      .select()
      .from(appVersions)
      .where(
        and(
          eq(appVersions.isActive, true),
          eq(appVersions.isPrerelease, false),
        ),
      )
      .orderBy(desc(appVersions.versionCode))
      .limit(1);

    if (latestVersion.length === 0) {
      return successResponse(c, {
        hasUpdate: false,
        message: '暂无可用版本',
      });
    }

    const latest = latestVersion[0];
    const hasUpdate = latest.versionCode > currentVersionCode;

    return successResponse(c, {
      hasUpdate,
      currentVersion,
      currentVersionCode,
      latestVersion: hasUpdate ? latest : null,
      message: hasUpdate ? '发现新版本' : '已是最新版本',
    });
  } catch (error) {
    console.error('检查版本更新失败:', error);
    return errorResponse(c, '检查版本更新失败', 500);
  }
});

// 以下接口需要管理员权限

// 创建新版本（需要管理员权限）
app.post('/', authMiddleware, async c => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return errorResponse(c, '权限不足', 403);
    }

    const body = await c.req.json();
    const validatedData = versionSchema.parse(body);

    // 检查版本号是否已存在
    const existingVersion = await db
      .select()
      .from(appVersions)
      .where(eq(appVersions.version, validatedData.version))
      .limit(1);

    if (existingVersion.length > 0) {
      return errorResponse(c, '版本号已存在', 400);
    }

    // 检查版本代码是否已存在
    const existingVersionCode = await db
      .select()
      .from(appVersions)
      .where(eq(appVersions.versionCode, validatedData.versionCode))
      .limit(1);

    if (existingVersionCode.length > 0) {
      return errorResponse(c, '版本代码已存在', 400);
    }

    const newVersion = await db
      .insert(appVersions)
      .values({
        ...validatedData,
        releaseDate: new Date(),
      })
      .returning();

    return successResponse(c, newVersion[0], '版本创建成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        c,
        '数据验证失败: ' + error.errors.map(e => e.message).join(', '),
        400,
      );
    }
    console.error('创建版本失败:', error);
    return errorResponse(c, '创建版本失败', 500);
  }
});

// 更新版本信息（需要管理员权限）
app.put('/:id', authMiddleware, async c => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return errorResponse(c, '权限不足', 403);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const validatedData = updateVersionSchema.parse(body);

    const updatedVersion = await db
      .update(appVersions)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(appVersions.id, id))
      .returning();

    if (updatedVersion.length === 0) {
      return errorResponse(c, '版本不存在', 404);
    }

    return successResponse(c, updatedVersion[0], '版本更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        c,
        '数据验证失败: ' + error.errors.map(e => e.message).join(', '),
        400,
      );
    }
    console.error('更新版本失败:', error);
    return errorResponse(c, '更新版本失败', 500);
  }
});

// 删除版本（软删除，需要管理员权限）
app.delete('/:id', authMiddleware, async c => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return errorResponse(c, '权限不足', 403);
    }

    const id = c.req.param('id');

    const deletedVersion = await db
      .update(appVersions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(appVersions.id, id))
      .returning();

    if (deletedVersion.length === 0) {
      return errorResponse(c, '版本不存在', 404);
    }

    return successResponse(c, null, '版本删除成功');
  } catch (error) {
    console.error('删除版本失败:', error);
    return errorResponse(c, '删除版本失败', 500);
  }
});

// 获取所有版本（包括已删除的，需要管理员权限）
app.get('/admin/all', authMiddleware, async c => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return errorResponse(c, '权限不足', 403);
    }

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const versions = await db
      .select()
      .from(appVersions)
      .orderBy(desc(appVersions.versionCode))
      .limit(limit)
      .offset(offset);

    // 获取总数
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(appVersions);

    const total = Number(totalResult[0]?.count) || 0;
    const totalPages = Math.ceil(total / limit);

    return successResponse(c, {
      versions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取所有版本失败:', error);
    return errorResponse(c, '获取所有版本失败', 500);
  }
});

export default app;
