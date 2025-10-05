import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  date,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// 部门表
export const departments: any = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 50 }).unique().notNull(), // 部门编码，用于唯一标识
    description: text('description'), // 部门描述
    parentId: uuid('parent_id').references((): any => departments.id), // 父部门ID，支持层级结构
    level: integer('level').default(1).notNull(), // 部门层级，1为顶级部门
    path: text('path').notNull(), // 部门路径，如 "/1/2/3"，便于查询所有下属部门
    isActive: boolean('is_active').default(true).notNull(), // 是否启用
    sortOrder: integer('sort_order').default(0), // 排序字段
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => ({
    // 确保部门编码唯一
    codeUnique: check(
      'code_unique',
      sql`${table.code} IS NOT NULL AND LENGTH(${table.code}) > 0`,
    ),
    // 确保层级合理
    levelCheck: check(
      'level_check',
      sql`${table.level} >= 1 AND ${table.level} <= 10`,
    ),
  }),
);

// 用户表
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    realName: varchar('real_name', { length: 50 }).notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    departmentId: uuid('department_id').references(() => departments.id), // 关联部门表
    phone: varchar('phone', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => ({
    roleCheck: check(
      'role_check',
      sql`${table.role} IN ('admin', 'operator', 'liaison')`,
    ),
  }),
);

// 人员表
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    emergencyContact: varchar('emergency_contact', { length: 50 }),
    emergencyPhone: varchar('emergency_phone', { length: 20 }),
    departmentId: uuid('department_id').references(() => departments.id), // 关联部门表
    personType: varchar('person_type', { length: 20 }).default('employee'),
    annualLeaveTotal: integer('annual_leave_total').default(40),
    annualLeaveUsed: integer('annual_leave_used').default(0),
    annualLeaveTimes: integer('annual_leave_times').default(0),
    notes: text('notes'),
    lastContactDate: date('last_contact_date'),
    lastContactBy: uuid('last_contact_by').references(() => users.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => ({
    personTypeCheck: check(
      'person_type_check',
      sql`${table.personType} IN ('employee', 'intern', 'manager')`,
    ),
  }),
);

// 休假记录表
export const leaves = pgTable(
  'leaves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    leaveType: varchar('leave_type', { length: 20 }).notNull(),
    location: varchar('location', { length: 200 }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    days: integer('days').notNull(),
    status: varchar('status', { length: 20 }).default('active'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    leaveTypeCheck: check(
      'leave_type_check',
      sql`${table.leaveType} IN ('vacation', 'business', 'study', 'hospitalization', 'care')`,
    ),
    statusCheck: check(
      'status_check',
      sql`${table.status} IN ('active', 'completed', 'cancelled')`,
    ),
  }),
);

// 联系记录表
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    leaveId: uuid('leave_id').references(() => leaves.id, {
      onDelete: 'set null',
    }),
    contactDate: timestamp('contact_date').notNull(),
    contactBy: uuid('contact_by').references(() => users.id),
    contactMethod: varchar('contact_method', { length: 20 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    contactMethodCheck: check(
      'contact_method_check',
      sql`${table.contactMethod} IN ('phone', 'message', 'visit')`,
    ),
  }),
);

// 提醒记录表
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id').references(() => persons.id, {
      onDelete: 'cascade',
    }),
    leaveId: uuid('leave_id').references(() => leaves.id, {
      onDelete: 'set null',
    }),
    reminderType: varchar('reminder_type', { length: 20 }),
    reminderDate: date('reminder_date').notNull(),
    priority: varchar('priority', { length: 10 }),
    isHandled: boolean('is_handled').default(false),
    handledBy: uuid('handled_by').references(() => users.id),
    handledAt: timestamp('handled_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    reminderTypeCheck: check(
      'reminder_type_check',
      sql`${table.reminderType} IN ('before', 'during', 'ending', 'overdue', 'system')`,
    ),
    priorityCheck: check(
      'priority_check',
      sql`${table.priority} IN ('high', 'medium', 'low')`,
    ),
  }),
);

// 提醒设置配置表
export const reminderSettings = pgTable('reminder_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  urgentThreshold: integer('urgent_threshold').default(10).notNull(),
  suggestThreshold: integer('suggest_threshold').default(7).notNull(),
  pushEnabled: boolean('push_enabled').default(true),
  urgentReminder: boolean('urgent_reminder').default(true),
  dailyReport: boolean('daily_report').default(false),
  weeklyReport: boolean('weekly_report').default(true),
  vibrationEnabled: boolean('vibration_enabled').default(true),
  reminderTime: varchar('reminder_time', { length: 5 }).default('09:00'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 版本管理表
export const appVersions = pgTable('app_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: varchar('version', { length: 20 }).unique().notNull(), // 版本号，如 "1.2.3"
  versionCode: integer('version_code').unique().notNull(), // 版本代码，用于比较版本大小
  releaseNotes: text('release_notes').notNull(), // 更新日志
  downloadUrl: varchar('download_url', { length: 500 }), // 下载链接
  isPrerelease: boolean('is_prerelease').default(false), // 是否为预发布版本
  isActive: boolean('is_active').default(true), // 是否激活
  releaseDate: timestamp('release_date').defaultNow(), // 发布时间
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 关系定义
export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'parent',
  }),
  children: many(departments, { relationName: 'parent' }),
  users: many(users),
  persons: many(persons),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  createdPersons: many(persons, { relationName: 'createdBy' }),
  lastContactPersons: many(persons, { relationName: 'lastContactBy' }),
  createdLeaves: many(leaves),
  contacts: many(contacts),
  handledReminders: many(reminders),
  reminderSettings: many(reminderSettings),
}));

export const personsRelations = relations(persons, ({ one, many }) => ({
  department: one(departments, {
    fields: [persons.departmentId],
    references: [departments.id],
  }),
  creator: one(users, {
    fields: [persons.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  lastContactUser: one(users, {
    fields: [persons.lastContactBy],
    references: [users.id],
    relationName: 'lastContactBy',
  }),
  leaves: many(leaves),
  contacts: many(contacts),
  reminders: many(reminders),
}));

export const leavesRelations = relations(leaves, ({ one, many }) => ({
  person: one(persons, {
    fields: [leaves.personId],
    references: [persons.id],
  }),
  creator: one(users, {
    fields: [leaves.createdBy],
    references: [users.id],
  }),
  contacts: many(contacts),
  reminders: many(reminders),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  person: one(persons, {
    fields: [contacts.personId],
    references: [persons.id],
  }),
  leave: one(leaves, {
    fields: [contacts.leaveId],
    references: [leaves.id],
  }),
  contactUser: one(users, {
    fields: [contacts.contactBy],
    references: [users.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  person: one(persons, {
    fields: [reminders.personId],
    references: [persons.id],
  }),
  leave: one(leaves, {
    fields: [reminders.leaveId],
    references: [leaves.id],
  }),
  handler: one(users, {
    fields: [reminders.handledBy],
    references: [users.id],
  }),
}));

// 导出类型
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
export type Leave = typeof leaves.$inferSelect;
export type NewLeave = typeof leaves.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type ReminderSetting = typeof reminderSettings.$inferSelect;
export type NewReminderSetting = typeof reminderSettings.$inferInsert;
export type AppVersion = typeof appVersions.$inferSelect;
export type NewAppVersion = typeof appVersions.$inferInsert;

export const reminderSettingsRelations = relations(
  reminderSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [reminderSettings.userId],
      references: [users.id],
    }),
  }),
);
