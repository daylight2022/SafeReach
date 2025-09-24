/**
 * 字段映射工具
 * 用于在数据库字段（下划线）和API字段（驼峰）之间进行转换
 */

/**
 * 将下划线命名转换为驼峰命名
 * @param str 下划线字符串
 * @returns 驼峰字符串
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 将驼峰命名转换为下划线命名
 * @param str 驼峰字符串
 * @returns 下划线字符串
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * 递归转换对象的所有键名
 * @param obj 要转换的对象
 * @param converter 转换函数
 * @returns 转换后的对象
 */
function convertObjectKeys(obj: any, converter: (key: string) => string): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertObjectKeys(item, converter));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = converter(key);
      converted[newKey] = convertObjectKeys(value, converter);
    }
    return converted;
  }

  return obj;
}

/**
 * 将对象的键名从下划线转换为驼峰
 * @param obj 要转换的对象
 * @returns 转换后的对象
 */
export function convertToCamelCase<T = any>(obj: any): T {
  return convertObjectKeys(obj, toCamelCase);
}

/**
 * 将对象的键名从驼峰转换为下划线
 * @param obj 要转换的对象
 * @returns 转换后的对象
 */
export function convertToSnakeCase<T = any>(obj: any): T {
  return convertObjectKeys(obj, toSnakeCase);
}

/**
 * 数据库字段到API字段的映射表
 * 用于处理特殊情况或不规则的字段名
 */
export const DB_TO_API_FIELD_MAP: Record<string, string> = {
  // 用户相关
  real_name: 'realName',
  department_id: 'departmentId',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  created_by: 'createdBy',
  
  // 部门相关
  parent_id: 'parentId',
  is_active: 'isActive',
  sort_order: 'sortOrder',
  
  // 人员相关
  emergency_contact: 'emergencyContact',
  emergency_phone: 'emergencyPhone',
  person_type: 'personType',
  annual_leave_total: 'annualLeaveTotal',
  annual_leave_used: 'annualLeaveUsed',
  annual_leave_times: 'annualLeaveTimes',
  last_contact_date: 'lastContactDate',
  last_contact_by: 'lastContactBy',
  
  // 休假相关
  person_id: 'personId',
  leave_type: 'leaveType',
  start_date: 'startDate',
  end_date: 'endDate',
  
  // 联系记录相关
  leave_id: 'leaveId',
  contact_date: 'contactDate',
  contact_by: 'contactBy',
  contact_method: 'contactMethod',
  
  // 提醒相关
  reminder_type: 'reminderType',
  reminder_date: 'reminderDate',
  is_handled: 'isHandled',
  handled_by: 'handledBy',
  handled_at: 'handledAt',
  
  // 提醒设置相关
  user_id: 'userId',
  urgent_threshold: 'urgentThreshold',
  suggest_threshold: 'suggestThreshold',
  push_enabled: 'pushEnabled',
  urgent_reminder: 'urgentReminder',
  daily_report: 'dailyReport',
  weekly_report: 'weeklyReport',
  vibration_enabled: 'vibrationEnabled',
  reminder_time: 'reminderTime',
};

/**
 * API字段到数据库字段的映射表
 */
export const API_TO_DB_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(DB_TO_API_FIELD_MAP).map(([db, api]) => [api, db])
);

/**
 * 使用映射表转换对象键名（数据库 -> API）
 * @param obj 要转换的对象
 * @returns 转换后的对象
 */
export function convertDbToApi<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertDbToApi(item)) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = DB_TO_API_FIELD_MAP[key] || toCamelCase(key);
      converted[newKey] = convertDbToApi(value);
    }
    return converted;
  }

  return obj;
}

/**
 * 使用映射表转换对象键名（API -> 数据库）
 * @param obj 要转换的对象
 * @returns 转换后的对象
 */
export function convertApiToDb<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertApiToDb(item)) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = API_TO_DB_FIELD_MAP[key] || toSnakeCase(key);
      converted[newKey] = convertApiToDb(value);
    }
    return converted;
  }

  return obj;
}

/**
 * 中间件：转换请求体中的字段名（API -> 数据库）
 */
export function convertRequestBody(body: any) {
  return convertApiToDb(body);
}

/**
 * 中间件：转换响应数据中的字段名（数据库 -> API）
 */
export function convertResponseData(data: any) {
  return convertDbToApi(data);
}
