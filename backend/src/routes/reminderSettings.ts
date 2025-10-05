import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { reminderSettings } from '../db/schema.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '../utils/response.js';
import { convertDbToApi } from '../utils/fieldMapping.js';
import { z } from 'zod';

const reminderSettingsRouter = new Hono();

// 所有路由都需要认证
reminderSettingsRouter.use('*', authMiddleware);

// 提醒设置验证schema
const ReminderSettingsSchema = z.object({
  urgentThreshold: z.number().int().min(3).max(30).optional(),
  suggestThreshold: z.number().int().min(1).max(14).optional(),
  pushEnabled: z.boolean().optional(),
  urgentReminder: z.boolean().optional(),
  dailyReport: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
});

/**
 * 获取用户的提醒设置
 * GET /reminder-settings
 */
reminderSettingsRouter.get('/', async c => {
  try {
    const currentUser = c.get('user');

    // 查找用户的提醒设置
    const [userSettings] = await db
      .select()
      .from(reminderSettings)
      .where(eq(reminderSettings.userId, currentUser.userId));

    if (!userSettings) {
      // 如果没有设置，返回默认值
      const defaultSettings = {
        urgentThreshold: 10,
        suggestThreshold: 7,
        pushEnabled: true,
        urgentReminder: true,
        dailyReport: false,
        weeklyReport: true,
        vibrationEnabled: true,
        reminderTime: '09:00',
      };
      return successResponse(c, defaultSettings);
    }

    // 转换字段名为驼峰命名
    const convertedSettings = convertDbToApi(userSettings);
    return successResponse(c, convertedSettings);
  } catch (error) {
    console.error('获取提醒设置失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 更新用户的提醒设置
 * PUT /reminder-settings
 * 需要管理员权限
 */
reminderSettingsRouter.put(
  '/',
  requireAdmin,
  validateBody(ReminderSettingsSchema),
  async c => {
    try {
      const currentUser = c.get('user');
      const updateData = c.get('validatedBody');

      // 检查是否已存在设置
      const [existingSettings] = await db
        .select()
        .from(reminderSettings)
        .where(eq(reminderSettings.userId, currentUser.userId));

      if (existingSettings) {
        // 更新现有设置
        const [updatedSettings] = await db
          .update(reminderSettings)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(reminderSettings.userId, currentUser.userId))
          .returning();

        // 转换返回数据为API格式
        const convertedSettings = convertDbToApi(updatedSettings);
        return successResponse(c, convertedSettings);
      } else {
        // 创建新设置
        const [newSettings] = await db
          .insert(reminderSettings)
          .values({
            userId: currentUser.userId,
            ...updateData,
          })
          .returning();

        // 转换返回数据为API格式
        const convertedNewSettings = convertDbToApi(newSettings);
        return successResponse(c, convertedNewSettings);
      }
    } catch (error) {
      console.error('更新提醒设置失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 获取系统默认的提醒阈值（用于定时任务）
 * GET /reminder-settings/system-defaults
 */
reminderSettingsRouter.get('/system-defaults', async c => {
  try {
    const currentUser = c.get('user');

    // 只有管理员可以访问系统默认设置
    if (currentUser.role !== 'admin') {
      return errorResponse(c, '权限不足', 403);
    }

    // 获取所有用户的设置，计算平均值作为系统默认值
    const allSettings = await db.select().from(reminderSettings);

    if (allSettings.length === 0) {
      return successResponse(c, {
        urgentThreshold: 5,
        suggestThreshold: 3,
      });
    }

    const avgUrgentThreshold = Math.round(
      allSettings.reduce((sum, s) => sum + s.urgentThreshold, 0) /
        allSettings.length,
    );
    const avgSuggestThreshold = Math.round(
      allSettings.reduce((sum, s) => sum + s.suggestThreshold, 0) /
        allSettings.length,
    );

    return successResponse(c, {
      urgentThreshold: avgUrgentThreshold,
      suggestThreshold: avgSuggestThreshold,
    });
  } catch (error) {
    console.error('获取系统默认设置失败:', error);
    return serverErrorResponse(c, error);
  }
});

export default reminderSettingsRouter;
