import { apiClient, ApiResponse } from './api';
import { User, Person, Leave, Contact, Reminder, Department } from '@/types';
import versionService from './versionService';

// 用户服务
export const userService = {
  // 获取当前用户信息
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const result = await apiClient.get<{ user: User }>('/auth/verify');
      return result.success ? result.data?.user || null : null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  },

  // 更新用户信息
  updateUser: async (
    id: string,
    data: {
      username?: string;
      realName?: string;
      phone?: string;
      departmentId?: string;
    },
  ): Promise<ApiResponse<User>> => {
    return apiClient.put(`/users/${id}`, data);
  },

  // 用户登出
  logout: async (): Promise<ApiResponse<null>> => {
    return apiClient.post('/auth/logout');
  },
};

// 人员服务
export const personService = {
  // 获取人员列表
  getPersons: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    personType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<{ persons: Person[]; pagination: any }>> => {
    return apiClient.get('/persons', params);
  },

  // 获取单个人员信息
  getPerson: async (id: string): Promise<ApiResponse<Person>> => {
    return apiClient.get(`/persons/${id}`);
  },

  // 创建人员
  createPerson: async (data: Partial<Person>): Promise<ApiResponse<Person>> => {
    return apiClient.post('/persons', data);
  },

  // 更新人员信息
  updatePerson: async (
    id: string,
    data: Partial<Person>,
  ): Promise<ApiResponse<Person>> => {
    return apiClient.put(`/persons/${id}`, data);
  },

  // 删除人员
  deletePerson: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/persons/${id}`);
  },

  // 更新人员联系信息
  updateContact: async (id: string): Promise<ApiResponse<Person>> => {
    return apiClient.post(`/persons/${id}/contact`);
  },
};

// 假期服务
export const leaveService = {
  // 获取人员假期列表
  getLeaves: async (personId?: string): Promise<ApiResponse<Leave[]>> => {
    const endpoint = personId ? `/leaves?personId=${personId}` : '/leaves';
    return apiClient.get(endpoint);
  },

  // 创建假期
  createLeave: async (data: Partial<Leave>): Promise<ApiResponse<Leave>> => {
    return apiClient.post('/leaves', data);
  },

  // 更新假期
  updateLeave: async (
    id: string,
    data: Partial<Leave>,
  ): Promise<ApiResponse<Leave>> => {
    return apiClient.put(`/leaves/${id}`, data);
  },

  // 删除假期
  deleteLeave: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/leaves/${id}`);
  },
};

// 联系记录服务
export const contactService = {
  // 获取联系记录列表
  getContacts: async (personId?: string): Promise<ApiResponse<Contact[]>> => {
    const endpoint = personId ? `/contacts?personId=${personId}` : '/contacts';
    return apiClient.get(endpoint);
  },

  // 创建联系记录
  createContact: async (
    data: Partial<Contact>,
  ): Promise<ApiResponse<Contact>> => {
    return apiClient.post('/contacts', data);
  },

  // 更新联系记录
  updateContact: async (
    id: string,
    data: Partial<Contact>,
  ): Promise<ApiResponse<Contact>> => {
    return apiClient.put(`/contacts/${id}`, data);
  },

  // 删除联系记录
  deleteContact: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/contacts/${id}`);
  },
};

// 提醒服务
export const reminderService = {
  // 获取提醒列表
  getReminders: async (params?: {
    page?: number;
    limit?: number;
    personId?: string;
    reminderType?: string;
    priority?: string;
    isHandled?: boolean;
    reminderDate?: string;
  }): Promise<ApiResponse<{ reminders: Reminder[]; pagination: any }>> => {
    return apiClient.get('/reminders', params);
  },

  // 创建提醒
  createReminder: async (
    data: Partial<Reminder>,
  ): Promise<ApiResponse<Reminder>> => {
    return apiClient.post('/reminders', data);
  },

  // 更新提醒
  updateReminder: async (
    id: string,
    data: Partial<Reminder>,
  ): Promise<ApiResponse<Reminder>> => {
    return apiClient.put(`/reminders/${id}`, data);
  },

  // 删除提醒
  deleteReminder: async (id: string): Promise<ApiResponse> => {
    return apiClient.delete(`/reminders/${id}`);
  },

  // 删除指定人员当日的未处理提醒记录
  deletePersonTodayReminders: async (
    personId: string,
  ): Promise<ApiResponse<{ deletedCount: number }>> => {
    return apiClient.delete(`/reminders/person/${personId}/today`);
  },

  // 标记提醒为已处理（使用 handle 接口）
  handleReminder: async (id: string): Promise<ApiResponse<Reminder>> => {
    return apiClient.post(`/reminders/${id}/handle`);
  },

  // 标记某人的所有未处理提醒为已处理
  handlePersonReminders: async (
    personId: string,
  ): Promise<ApiResponse<{ handledCount: number }>> => {
    // 先获取该人员的未处理提醒列表
    const remindersResult = await apiClient.get<{
      reminders: Reminder[];
      pagination: any;
    }>('/reminders', {
      personId,
      isHandled: false,
      limit: 100,
    });

    if (!remindersResult.success || !remindersResult.data?.reminders) {
      return {
        success: false,
        message: '获取提醒记录失败',
        data: { handledCount: 0 },
      };
    }

    // 批量标记为已处理
    let handledCount = 0;
    for (const reminder of remindersResult.data.reminders) {
      try {
        await apiClient.post(`/reminders/${reminder.id}/handle`);
        handledCount++;
      } catch (error) {
        console.warn(`标记提醒 ${reminder.id} 失败:`, error);
      }
    }

    return {
      success: true,
      message: `已标记 ${handledCount} 条提醒为已处理`,
      data: { handledCount },
    };
  },
};

// 提醒设置服务
export const reminderSettingsService = {
  // 获取提醒设置
  getReminderSettings: async (): Promise<
    ApiResponse<{
      urgentThreshold: number;
      suggestThreshold: number;
      pushEnabled: boolean;
      urgentReminder: boolean;
      dailyReport: boolean;
      weeklyReport: boolean;
      vibrationEnabled: boolean;
      reminderTime: string;
    }>
  > => {
    return apiClient.get('/reminder-settings');
  },

  // 更新提醒设置
  updateReminderSettings: async (data: {
    urgentThreshold?: number;
    suggestThreshold?: number;
    pushEnabled?: boolean;
    urgentReminder?: boolean;
    dailyReport?: boolean;
    weeklyReport?: boolean;
    vibrationEnabled?: boolean;
    reminderTime?: string;
  }): Promise<
    ApiResponse<{
      urgentThreshold: number;
      suggestThreshold: number;
      pushEnabled: boolean;
      urgentReminder: boolean;
      dailyReport: boolean;
      weeklyReport: boolean;
      vibrationEnabled: boolean;
      reminderTime: string;
    }>
  > => {
    return apiClient.put('/reminder-settings', data);
  },

  // 手动触发提醒更新（管理员）
  triggerReminderUpdate: async (): Promise<
    ApiResponse<{
      message: string;
      executedAt: string;
    }>
  > => {
    return apiClient.post('/reminder-settings/trigger-update');
  },
};

// 统计服务
export const statisticsService = {
  // 获取统计数据
  getStatistics: async (
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = queryString ? `/statistics?${queryString}` : '/statistics';

    return apiClient.get(url);
  },

  // 获取提醒设置（用于统计页面展示）
  getReminderSettings: async (): Promise<ApiResponse<{
    urgentThreshold: number;
    suggestThreshold: number;
  }>> => {
    return apiClient.get('/reminder-settings');
  },

  // 获取部门统计
  getDepartmentStats: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/statistics/departments');
  },

  // 获取人员类型统计
  getPersonTypeStats: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/statistics/person-types');
  },

  // 获取假期统计
  getLeaveStats: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/statistics/leaves');
  },

  // 获取联系统计
  getContactStats: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/statistics/contacts');
  },
};

// 部门服务
export const departmentService = {
  // 获取部门列表
  getDepartments: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    parentId?: string;
    level?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<Department[]>> => {
    return apiClient.get('/departments', params);
  },

  // 获取部门树形结构
  getDepartmentTree: async (): Promise<ApiResponse<Department[]>> => {
    return apiClient.get('/departments/tree');
  },

  // 获取指定部门信息
  getDepartment: async (id: string): Promise<ApiResponse<Department>> => {
    return apiClient.get(`/departments/${id}`);
  },

  // 创建部门
  createDepartment: async (data: {
    name: string;
    code: string;
    description?: string;
    parentId?: string;
    sortOrder?: number;
  }): Promise<ApiResponse<Department>> => {
    return apiClient.post('/departments', data);
  },

  // 更新部门信息
  updateDepartment: async (
    id: string,
    data: {
      name?: string;
      code?: string;
      description?: string;
      parentId?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<ApiResponse<Department>> => {
    return apiClient.put(`/departments/${id}`, data);
  },

  // 删除部门
  deleteDepartment: async (id: string): Promise<ApiResponse<null>> => {
    return apiClient.delete(`/departments/${id}`);
  },
};

// 导出所有服务
export const apiServices = {
  user: userService,
  person: personService,
  leave: leaveService,
  contact: contactService,
  reminder: reminderService,
  statistics: statisticsService,
  department: departmentService,
  version: versionService,
};
