import { eq, like, or, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { departments } from '../db/schema.js';

/**
 * 获取用户可访问的部门列表
 * 管理员可以看到所有部门
 * 其他角色只能看到自己部门及其下属部门
 */
export async function getUserAccessibleDepartments(
  _userId: string,
  userRole: string,
  userDepartmentId?: string,
) {
  // 管理员可以访问所有部门
  if (userRole === 'admin') {
    return await db
      .select()
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(departments.level, departments.sortOrder);
  }

  // 如果用户没有分配部门，返回空数组
  if (!userDepartmentId) {
    return [];
  }

  // 获取用户的部门信息
  const userDepartment = await db
    .select()
    .from(departments)
    .where(
      and(eq(departments.id, userDepartmentId), eq(departments.isActive, true)),
    )
    .limit(1);

  if (userDepartment.length === 0) {
    return [];
  }

  const dept = userDepartment[0];

  // 获取当前部门及其所有下属部门
  // 使用path字段来查找所有下属部门
  const accessibleDepartments = await db
    .select()
    .from(departments)
    .where(
      and(
        eq(departments.isActive, true),
        or(
          eq(departments.id, userDepartmentId), // 当前部门
          like(departments.path, `${dept.path}/%`), // 所有下属部门
        ),
      ),
    )
    .orderBy(departments.level, departments.sortOrder);

  return accessibleDepartments;
}

/**
 * 获取用户可访问的部门ID列表
 */
export async function getUserAccessibleDepartmentIds(
  userId: string,
  userRole: string,
  userDepartmentId?: string,
): Promise<string[]> {
  const departments = await getUserAccessibleDepartments(
    userId,
    userRole,
    userDepartmentId,
  );
  return departments.map(dept => dept.id);
}

/**
 * 检查用户是否可以访问指定部门
 */
export async function canUserAccessDepartment(
  userId: string,
  userRole: string,
  userDepartmentId: string | undefined,
  targetDepartmentId: string,
): Promise<boolean> {
  const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
    userId,
    userRole,
    userDepartmentId,
  );
  return accessibleDepartmentIds.includes(targetDepartmentId);
}

/**
 * 获取部门的完整层级路径（用于显示）
 */
export async function getDepartmentHierarchyPath(
  departmentId: string,
): Promise<string> {
  const department = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  if (department.length === 0) {
    return '';
  }

  const dept = department[0];

  // 如果是根部门，直接返回名称
  if (!dept.parentId) {
    return dept.name;
  }

  // 递归获取父部门路径
  const parentPath = await getDepartmentHierarchyPath(dept.parentId);
  return `${parentPath} > ${dept.name}`;
}

/**
 * 更新部门的path字段（在创建或移动部门时调用）
 */
export async function updateDepartmentPath(
  departmentId: string,
): Promise<void> {
  const department = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  if (department.length === 0) {
    return;
  }

  const dept = department[0];
  let newPath: string;
  let newLevel: number;

  if (!dept.parentId) {
    // 根部门
    newPath = `/${dept.code}`;
    newLevel = 1;
  } else {
    // 获取父部门信息
    const parentDept = await db
      .select()
      .from(departments)
      .where(eq(departments.id, dept.parentId))
      .limit(1);

    if (parentDept.length === 0) {
      throw new Error('父部门不存在');
    }

    newPath = `${parentDept[0].path}/${dept.code}`;
    newLevel = parentDept[0].level + 1;
  }

  // 更新当前部门的path和level
  await db
    .update(departments)
    .set({
      path: newPath,
      level: newLevel,
      updatedAt: new Date(),
    })
    .where(eq(departments.id, departmentId));

  // 递归更新所有子部门的path和level
  const childDepartments = await db
    .select()
    .from(departments)
    .where(eq(departments.parentId, departmentId));

  for (const child of childDepartments) {
    await updateDepartmentPath(child.id);
  }
}

/**
 * 验证部门层级关系（防止循环引用）
 */
export async function validateDepartmentHierarchy(
  departmentId: string,
  parentId: string,
): Promise<boolean> {
  if (departmentId === parentId) {
    return false; // 不能将自己设为父部门
  }

  // 检查是否会形成循环引用
  let currentParentId = parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return false; // 检测到循环
    }

    if (currentParentId === departmentId) {
      return false; // 会形成循环引用
    }

    visited.add(currentParentId);

    const parent = await db
      .select({ parentId: departments.parentId })
      .from(departments)
      .where(eq(departments.id, currentParentId))
      .limit(1);

    if (parent.length === 0) {
      break;
    }

    currentParentId = parent[0].parentId || '';
  }

  return true;
}
