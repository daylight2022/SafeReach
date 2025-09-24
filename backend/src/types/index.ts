import { z } from 'zod';

// 用户相关类型
export const UserRole = z.enum(['admin', 'operator', 'liaison']);
export const PersonType = z.enum(['employee', 'intern', 'manager']);
export const LeaveType = z.enum([
  'vacation',
  'business',
  'study',
  'hospitalization',
]);
export const LeaveStatus = z.enum(['active', 'completed', 'cancelled']);
export const ContactMethod = z.enum(['phone', 'message', 'visit']);
export const ReminderType = z.enum([
  'before',
  'during',
  'ending',
  'overdue',
  'system',
]);
export const Priority = z.enum(['high', 'medium', 'low']);

// 登录请求
export const LoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

// 部门创建/更新
export const CreateDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, '部门名称不能为空')
    .max(100, '部门名称不能超过100个字符'),
  code: z
    .string()
    .min(1, '部门编码不能为空')
    .max(50, '部门编码不能超过50个字符')
    .regex(/^[A-Z0-9_]+$/, '部门编码只能包含大写字母、数字和下划线'),
  description: z.string().max(500, '部门描述不能超过500个字符').optional(),
  parentId: z.string().uuid('无效的父部门ID').optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

// 用户创建/更新
export const CreateUserSchema = z.object({
  username: z
    .string()
    .min(1, '用户名不能为空')
    .max(50, '用户名不能超过50个字符'),
  password: z.string().min(6, '密码至少6个字符'),
  realName: z
    .string()
    .min(1, '真实姓名不能为空')
    .max(50, '真实姓名不能超过50个字符'),
  role: UserRole,
  departmentId: z.string().uuid('无效的部门ID').optional(),
  phone: z.string().max(20, '电话号码不能超过20个字符').optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({
  password: true,
});

// 人员创建/更新
export const CreatePersonSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),
  phone: z.string().max(20, '电话号码不能超过20个字符').optional(),
  emergencyContact: z
    .string()
    .max(50, '紧急联系人姓名不能超过50个字符')
    .optional(),
  emergencyPhone: z
    .string()
    .max(20, '紧急联系人电话不能超过20个字符')
    .optional(),
  departmentId: z.string().uuid('无效的部门ID').optional(),
  personType: PersonType.default('employee'),
  annualLeaveTotal: z.number().int().min(0, '年假总天数不能为负数').default(40),
  annualLeaveUsed: z.number().int().min(0, '已用年假天数不能为负数').default(0),
  annualLeaveTimes: z.number().int().min(0, '年假次数不能为负数').default(0),
  notes: z.string().optional(),
});

export const UpdatePersonSchema = CreatePersonSchema.partial();

// 休假记录创建/更新
export const CreateLeaveSchema = z.object({
  personId: z.string().uuid('无效的人员ID'),
  leaveType: LeaveType,
  location: z.string().max(200, '地点不能超过200个字符').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式错误'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式错误'),
  days: z.number().int().min(1, '休假天数至少为1天'),
  status: LeaveStatus.default('active'),
});

export const UpdateLeaveSchema = CreateLeaveSchema.partial().omit({
  personId: true,
});

// 联系记录创建/更新
export const CreateContactSchema = z.object({
  personId: z.string().uuid('无效的人员ID'),
  leaveId: z.string().uuid('无效的休假记录ID').optional(),
  contactDate: z.string().datetime('联系时间格式错误'),
  contactMethod: ContactMethod.optional(),
  notes: z.string().optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial().omit({
  personId: true,
});

// 提醒记录创建/更新
export const CreateReminderSchema = z.object({
  personId: z.string().uuid('无效的人员ID').optional(),
  leaveId: z.string().uuid('无效的休假记录ID').optional(),
  reminderType: ReminderType.optional(),
  reminderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '提醒日期格式错误'),
  priority: Priority.optional(),
});

export const UpdateReminderSchema = CreateReminderSchema.partial();

// 查询参数
export const PaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(val => parseInt(val) || 1),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform(val => Math.min(parseInt(val) || 10, 100)),
});

export const PersonQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  department: z.string().optional(),
  personType: PersonType.optional(),
  sortBy: z.enum(['name', 'createdAt', 'lastContactDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const LeaveQuerySchema = PaginationSchema.extend({
  personId: z.string().uuid().optional(),
  leaveType: LeaveType.optional(),
  status: LeaveStatus.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const ContactQuerySchema = PaginationSchema.extend({
  personId: z.string().uuid().optional(),
  leaveId: z.string().uuid().optional(),
  contactBy: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const ReminderQuerySchema = PaginationSchema.extend({
  personId: z.string().uuid().optional(),
  reminderType: ReminderType.optional(),
  priority: Priority.optional(),
  isHandled: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  reminderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// 统计查询参数
export const StatisticsQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  department: z.string().optional(),
});

// 导出类型
export type LoginRequest = z.infer<typeof LoginSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type CreatePersonRequest = z.infer<typeof CreatePersonSchema>;
export type UpdatePersonRequest = z.infer<typeof UpdatePersonSchema>;
export type CreateLeaveRequest = z.infer<typeof CreateLeaveSchema>;
export type UpdateLeaveRequest = z.infer<typeof UpdateLeaveSchema>;
export type CreateContactRequest = z.infer<typeof CreateContactSchema>;
export type UpdateContactRequest = z.infer<typeof UpdateContactSchema>;
export type CreateReminderRequest = z.infer<typeof CreateReminderSchema>;
export type UpdateReminderRequest = z.infer<typeof UpdateReminderSchema>;
export type PersonQuery = z.infer<typeof PersonQuerySchema>;
export type LeaveQuery = z.infer<typeof LeaveQuerySchema>;
export type ContactQuery = z.infer<typeof ContactQuerySchema>;
export type ReminderQuery = z.infer<typeof ReminderQuerySchema>;
export type StatisticsQuery = z.infer<typeof StatisticsQuerySchema>;
