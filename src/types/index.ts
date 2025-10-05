export interface User {
  id: string;
  username: string;
  password: string;
  realName: string;
  role: 'admin' | 'operator' | 'liaison';
  departmentId?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  level: number;
  path: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: Department[];
  parent?: Department;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  departmentId?: string;
  personType?: 'employee' | 'intern' | 'manager';
  annualLeaveTotal: number;
  annualLeaveUsed: number;
  annualLeaveTimes: number;
  notes?: string;
  lastContactDate?: string;
  lastContactBy?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  currentLeave?: Leave;
  lastContact?: Contact;
  currentReminder?: Reminder;
  status?: PersonStatus;
  departmentInfo?: Department;
  // Department info returned from API
  department?: {
    id: string;
    name: string;
    code: string;
  };
  // Creator info returned from API
  creator?: {
    id: string;
    username: string;
    realName: string;
  };
}

export interface Leave {
  id: string;
  personId: string;
  leaveType: 'vacation' | 'business' | 'study' | 'hospitalization' | 'care';
  location?: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'active' | 'completed' | 'cancelled';
  createdBy?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  personId: string;
  leaveId?: string;
  contactDate: string;
  contactBy: string;
  contactMethod: 'phone' | 'message' | 'visit';
  notes?: string;
  createdAt: string;
  contactUser?: User;
}

export interface Reminder {
  id: string;
  personId: string;
  leaveId?: string;
  reminderType: 'before' | 'during' | 'ending' | 'overdue';
  reminderDate: string;
  priority: 'high' | 'medium' | 'low';
  isHandled: boolean;
  handledBy?: string;
  handledAt?: string;
  createdAt: string;
  person?: Person;
  leave?: Leave;
}

// 客户端私有备注类型（存储在本地）
export interface PersonalNote {
  personId: string;
  note: string;
  updatedAt: string;
}

export type PersonStatus = 'urgent' | 'suggest' | 'normal' | 'inactive';
