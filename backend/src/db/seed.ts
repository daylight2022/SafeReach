import { db, testConnection, closeConnection } from './connection.js';
import {
  users,
  persons,
  leaves,
  contacts,
  reminders,
  departments,
} from './schema.js';
import { eq } from 'drizzle-orm';

async function seedDatabase() {
  console.log('🌱 开始数据库种子数据插入...');

  try {
    // 测试连接
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    // 清空现有数据（按依赖关系倒序）
    console.log('🧹 清空现有数据...');
    await db.delete(reminders);
    await db.delete(contacts);
    await db.delete(leaves);
    await db.delete(persons);
    await db.delete(users);
    await db.delete(departments);

    // 插入部门数据
    console.log('🏢 插入部门数据...');
    const insertedDepartments = await db
      .insert(departments)
      .values([
        {
          name: '2队',
          code: '2TEAM',
          description: '二队',
          parentId: null,
          level: 1,
          path: '/2TEAM',
          isActive: true,
          sortOrder: 1,
        },
        {
          name: '2部',
          code: '2BU',
          description: '二部',
          parentId: null, // 将在下面更新
          level: 2,
          path: '/2TEAM/2BU',
          isActive: true,
          sortOrder: 1,
        },
        {
          name: '5组',
          code: '5GROUP',
          description: '五组',
          parentId: null, // 将在下面更新
          level: 2,
          path: '/2TEAM/5GROUP',
          isActive: true,
          sortOrder: 2,
        },
        {
          name: '6组',
          code: '6GROUP',
          description: '六组',
          parentId: null, // 将在下面更新
          level: 2,
          path: '/2TEAM/6GROUP',
          isActive: true,
          sortOrder: 3,
        },
        {
          name: '7组',
          code: '7GROUP',
          description: '七组',
          parentId: null, // 将在下面更新
          level: 2,
          path: '/2TEAM/7GROUP',
          isActive: true,
          sortOrder: 4,
        },
        {
          name: '8组',
          code: '8GROUP',
          description: '八组',
          parentId: null, // 将在下面更新
          level: 2,
          path: '/2TEAM/8GROUP',
          isActive: true,
          sortOrder: 5,
        },
      ])
      .returning();

    // 更新部门的父子关系
    const team2Dept = insertedDepartments.find(d => d.code === '2TEAM')!;
    const bu2Dept = insertedDepartments.find(d => d.code === '2BU')!;
    const group5Dept = insertedDepartments.find(d => d.code === '5GROUP')!;
    const group6Dept = insertedDepartments.find(d => d.code === '6GROUP')!;
    const group7Dept = insertedDepartments.find(d => d.code === '7GROUP')!;
    const group8Dept = insertedDepartments.find(d => d.code === '8GROUP')!;

    // 更新父部门关系
    await db
      .update(departments)
      .set({ parentId: team2Dept.id })
      .where(eq(departments.id, bu2Dept.id));
    await db
      .update(departments)
      .set({ parentId: team2Dept.id })
      .where(eq(departments.id, group5Dept.id));
    await db
      .update(departments)
      .set({ parentId: team2Dept.id })
      .where(eq(departments.id, group6Dept.id));
    await db
      .update(departments)
      .set({ parentId: team2Dept.id })
      .where(eq(departments.id, group7Dept.id));
    await db
      .update(departments)
      .set({ parentId: team2Dept.id })
      .where(eq(departments.id, group8Dept.id));

    console.log(`✅ 插入了 ${insertedDepartments.length} 个部门`);

    // 插入用户数据
    console.log('👥 插入用户数据...');
    // 明文123的MD5密文
    const hashedPassword123 = '202cb962ac59075b964b07152d234b70';

    const insertedUsers = await db
      .insert(users)
      .values([
        // 2队管理员
        {
          username: '队长2',
          password: hashedPassword123,
          realName: '队长2',
          role: 'admin',
          departmentId: team2Dept.id,
          phone: '13800138000',
        },
        // 2部用户
        {
          username: '操作员2-1',
          password: hashedPassword123,
          realName: '操作员2-1',
          role: 'operator',
          departmentId: bu2Dept.id,
          phone: '13800138001',
        },
        {
          username: '操作员2-2',
          password: hashedPassword123,
          realName: '操作员2-2',
          role: 'operator',
          departmentId: bu2Dept.id,
          phone: '13800138002',
        },
        {
          username: '联络员2-1',
          password: hashedPassword123,
          realName: '联络员2-1',
          role: 'liaison',
          departmentId: bu2Dept.id,
          phone: '13800138003',
        },
        {
          username: '联络员2-2',
          password: hashedPassword123,
          realName: '联络员2-2',
          role: 'liaison',
          departmentId: bu2Dept.id,
          phone: '13800138004',
        },
        // 5组用户
        {
          username: '操作员5-1',
          password: hashedPassword123,
          realName: '操作员5-1',
          role: 'operator',
          departmentId: group5Dept.id,
          phone: '13800138005',
        },
        {
          username: '操作员5-2',
          password: hashedPassword123,
          realName: '操作员5-2',
          role: 'operator',
          departmentId: group5Dept.id,
          phone: '13800138006',
        },
        {
          username: '联络员5-1',
          password: hashedPassword123,
          realName: '联络员5-1',
          role: 'liaison',
          departmentId: group5Dept.id,
          phone: '13800138007',
        },
        {
          username: '联络员5-2',
          password: hashedPassword123,
          realName: '联络员5-2',
          role: 'liaison',
          departmentId: group5Dept.id,
          phone: '13800138008',
        },
        // 6组用户
        {
          username: '操作员6-1',
          password: hashedPassword123,
          realName: '操作员6-1',
          role: 'operator',
          departmentId: group6Dept.id,
          phone: '13800138009',
        },
        {
          username: '操作员6-2',
          password: hashedPassword123,
          realName: '操作员6-2',
          role: 'operator',
          departmentId: group6Dept.id,
          phone: '13800138010',
        },
        {
          username: '联络员6-1',
          password: hashedPassword123,
          realName: '联络员6-1',
          role: 'liaison',
          departmentId: group6Dept.id,
          phone: '13800138011',
        },
        {
          username: '联络员6-2',
          password: hashedPassword123,
          realName: '联络员6-2',
          role: 'liaison',
          departmentId: group6Dept.id,
          phone: '13800138012',
        },
        // 7组用户
        {
          username: '操作员7-1',
          password: hashedPassword123,
          realName: '操作员7-1',
          role: 'operator',
          departmentId: group7Dept.id,
          phone: '13800138013',
        },
        {
          username: '操作员7-2',
          password: hashedPassword123,
          realName: '操作员7-2',
          role: 'operator',
          departmentId: group7Dept.id,
          phone: '13800138014',
        },
        {
          username: '联络员7-1',
          password: hashedPassword123,
          realName: '联络员7-1',
          role: 'liaison',
          departmentId: group7Dept.id,
          phone: '13800138015',
        },
        {
          username: '联络员7-2',
          password: hashedPassword123,
          realName: '联络员7-2',
          role: 'liaison',
          departmentId: group7Dept.id,
          phone: '13800138016',
        },
        // 8组用户
        {
          username: '操作员8-1',
          password: hashedPassword123,
          realName: '操作员8-1',
          role: 'operator',
          departmentId: group8Dept.id,
          phone: '13800138017',
        },
        {
          username: '操作员8-2',
          password: hashedPassword123,
          realName: '操作员8-2',
          role: 'operator',
          departmentId: group8Dept.id,
          phone: '13800138018',
        },
        {
          username: '联络员8-1',
          password: hashedPassword123,
          realName: '联络员8-1',
          role: 'liaison',
          departmentId: group8Dept.id,
          phone: '13800138019',
        },
        {
          username: '联络员8-2',
          password: hashedPassword123,
          realName: '联络员8-2',
          role: 'liaison',
          departmentId: group8Dept.id,
          phone: '13800138020',
        },
      ])
      .returning();

    console.log(`✅ 插入了 ${insertedUsers.length} 个用户`);

    // 插入人员数据
    console.log('👤 插入人员数据...');
    const insertedPersons = await db
      .insert(persons)
      .values([
        // 2部人员
        {
          name: '张三',
          phone: '18126001324',
          emergencyContact: '张三父亲',
          emergencyPhone: '15838113122',
          departmentId: bu2Dept.id,
          personType: 'employee',
          annualLeaveTotal: 40,
          annualLeaveUsed: 15,
          annualLeaveTimes: 2,
          notes: '2部员工，即将休假',
          lastContactDate: '2025-10-04',
          lastContactBy: insertedUsers[3].id, // 联络员2-1
          createdBy: insertedUsers[1].id, // 操作员2-1
        },
        {
          name: '李四',
          phone: '13900139003',
          emergencyContact: '李四母亲',
          emergencyPhone: '13900139004',
          departmentId: bu2Dept.id,
          personType: 'employee',
          annualLeaveTotal: 40,
          annualLeaveUsed: 8,
          annualLeaveTimes: 1,
          notes: '2部员工，正在休假中',
          lastContactDate: '2025-10-03',
          lastContactBy: insertedUsers[4].id, // 联络员2-2
          createdBy: insertedUsers[2].id, // 操作员2-2
        },
        // 5组人员
        {
          name: '王五',
          phone: '13900139005',
          emergencyContact: '王五配偶',
          emergencyPhone: '13900139006',
          departmentId: group5Dept.id,
          personType: 'employee',
          annualLeaveTotal: 40,
          annualLeaveUsed: 12,
          annualLeaveTimes: 2,
          notes: '5组员工，即将结束休假',
          lastContactDate: '2025-10-04',
          lastContactBy: insertedUsers[7].id, // 联络员5-1
          createdBy: insertedUsers[5].id, // 操作员5-1
        },
        {
          name: '赵六',
          phone: '13900139007',
          emergencyContact: '赵六父亲',
          emergencyPhone: '13900139008',
          departmentId: group5Dept.id,
          personType: 'manager',
          annualLeaveTotal: 45,
          annualLeaveUsed: 20,
          annualLeaveTimes: 3,
          notes: '5组组长，长期休假中',
          lastContactDate: '2025-09-28',
          lastContactBy: insertedUsers[8].id, // 联络员5-2
          createdBy: insertedUsers[6].id, // 操作员5-2
        },
        // 6组人员
        {
          name: '孙七',
          phone: '13900139009',
          emergencyContact: '孙七妻子',
          emergencyPhone: '13900139010',
          departmentId: group6Dept.id,
          personType: 'employee',
          annualLeaveTotal: 40,
          annualLeaveUsed: 3,
          annualLeaveTimes: 1,
          notes: '6组员工，短期休假',
          lastContactDate: '2025-10-05',
          lastContactBy: insertedUsers[11].id, // 联络员6-1
          createdBy: insertedUsers[9].id, // 操作员6-1
        },
        {
          name: '周八',
          phone: '13900139011',
          emergencyContact: '周八父亲',
          emergencyPhone: '13900139012',
          departmentId: group6Dept.id,
          personType: 'intern',
          annualLeaveTotal: 20,
          annualLeaveUsed: 0,
          annualLeaveTimes: 0,
          notes: '6组实习生，准备休假',
          lastContactDate: '2025-10-04',
          lastContactBy: insertedUsers[12].id, // 联络员6-2
          createdBy: insertedUsers[10].id, // 操作员6-2
        },
        // 7组人员
        {
          name: '吴九',
          phone: '13900139013',
          emergencyContact: '吴九母亲',
          emergencyPhone: '13900139014',
          departmentId: group7Dept.id,
          personType: 'employee',
          annualLeaveTotal: 40,
          annualLeaveUsed: 25,
          annualLeaveTimes: 4,
          notes: '7组员工，休假频繁',
          lastContactDate: '2025-09-28',
          lastContactBy: insertedUsers[15].id, // 联络员7-1
          createdBy: insertedUsers[13].id, // 操作员7-1
        },
        // 8组人员
        {
          name: '郑十',
          phone: '13900139015',
          emergencyContact: '郑十配偶',
          emergencyPhone: '13900139016',
          departmentId: group8Dept.id,
          personType: 'manager',
          annualLeaveTotal: 45,
          annualLeaveUsed: 18,
          annualLeaveTimes: 2,
          notes: '8组组长，管理规范',
          lastContactDate: '2025-10-03',
          lastContactBy: insertedUsers[19].id, // 联络员8-1
          createdBy: insertedUsers[17].id, // 操作员8-1
        },
      ])
      .returning();

    console.log(`✅ 插入了 ${insertedPersons.length} 个人员`);

    // 插入休假记录
    console.log('🏖️ 插入休假记录...');
    const insertedLeaves = await db
      .insert(leaves)
      .values([
        // 张三 - 即将休假（明天开始）
        {
          personId: insertedPersons[0].id,
          leaveType: 'vacation',
          location: '河南省郑州市二七区郑密路黄岗寺小区',
          startDate: '2025-10-06',
          endDate: '2025-10-26',
          days: 21,
          status: 'active',
          createdBy: insertedUsers[1].id, // 操作员2-1
        },
        // 李四 - 正在休假中（短期）
        {
          personId: insertedPersons[1].id,
          leaveType: 'vacation',
          location: '湖南长沙',
          startDate: '2025-10-01',
          endDate: '2025-10-10',
          days: 10,
          status: 'active',
          createdBy: insertedUsers[2].id, // 操作员2-2
        },
        // 王五 - 即将结束休假（明天结束）
        {
          personId: insertedPersons[2].id,
          leaveType: 'vacation',
          location: '广东深圳',
          startDate: '2025-10-01',
          endDate: '2025-10-06',
          days: 6,
          status: 'active',
          createdBy: insertedUsers[5].id, // 操作员5-1
        },
        // 赵六 - 长期休假中
        {
          personId: insertedPersons[3].id,
          leaveType: 'vacation',
          location: '北京市朝阳区',
          startDate: '2025-09-25',
          endDate: '2025-10-25',
          days: 31,
          status: 'active',
          createdBy: insertedUsers[6].id, // 操作员5-2
        },
        // 孙七 - 短期休假（今天开始）
        {
          personId: insertedPersons[4].id,
          leaveType: 'vacation',
          location: '江苏南京',
          startDate: '2025-10-05',
          endDate: '2025-10-07',
          days: 3,
          status: 'active',
          createdBy: insertedUsers[9].id, // 操作员6-1
        },
        // 周八 - 准备休假（后天开始）
        {
          personId: insertedPersons[5].id,
          leaveType: 'vacation',
          location: '四川成都',
          startDate: '2025-10-07',
          endDate: '2025-10-14',
          days: 8,
          status: 'active',
          createdBy: insertedUsers[10].id, // 操作员6-2
        },
        // 吴九 - 已完成的休假
        {
          personId: insertedPersons[6].id,
          leaveType: 'vacation',
          location: '浙江杭州',
          startDate: '2025-09-20',
          endDate: '2025-09-27',
          days: 8,
          status: 'completed',
          createdBy: insertedUsers[13].id, // 操作员7-1
        },
        // 郑十 - 出差
        {
          personId: insertedPersons[7].id,
          leaveType: 'business',
          location: '上海市浦东新区',
          startDate: '2025-10-03',
          endDate: '2025-10-07',
          days: 5,
          status: 'active',
          createdBy: insertedUsers[17].id, // 操作员8-1
        },
        // 张三的历史休假记录
        {
          personId: insertedPersons[0].id,
          leaveType: 'vacation',
          location: '海南三亚',
          startDate: '2025-08-01',
          endDate: '2025-08-15',
          days: 15,
          status: 'completed',
          createdBy: insertedUsers[1].id, // 操作员2-1
        },
      ])
      .returning();

    console.log(`✅ 插入了 ${insertedLeaves.length} 个休假记录`);

    // 插入联系记录
    console.log('📞 插入联系记录...');
    const insertedContacts = await db
      .insert(contacts)
      .values([
        {
          personId: insertedPersons[0].id, // 张三
          leaveId: insertedLeaves[0].id,
          contactDate: new Date('2025-10-04T10:00:00'),
          contactBy: insertedUsers[3].id, // 联络员2-1
          contactMethod: 'phone',
          notes: '确认明日休假安排，已联系第三方联系人',
        },
        {
          personId: insertedPersons[1].id, // 李四
          leaveId: insertedLeaves[1].id,
          contactDate: new Date('2025-10-03T14:30:00'),
          contactBy: insertedUsers[4].id, // 联络员2-2
          contactMethod: 'message',
          notes: '休假期间短信联系，一切正常',
        },
        {
          personId: insertedPersons[2].id, // 王五
          leaveId: insertedLeaves[2].id,
          contactDate: new Date('2025-10-04T09:15:00'),
          contactBy: insertedUsers[7].id, // 联络员5-1
          contactMethod: 'phone',
          notes: '确认明日返程安排',
        },
        {
          personId: insertedPersons[3].id, // 赵六
          leaveId: insertedLeaves[3].id,
          contactDate: new Date('2025-09-28T16:20:00'),
          contactBy: insertedUsers[8].id, // 联络员5-2
          contactMethod: 'visit',
          notes: '长期休假期间实地探访',
        },
        {
          personId: insertedPersons[4].id, // 孙七
          leaveId: insertedLeaves[4].id,
          contactDate: new Date('2025-10-05T08:00:00'),
          contactBy: insertedUsers[11].id, // 联络员6-1
          contactMethod: 'phone',
          notes: '今日开始休假，电话确认安全到达',
        },
        {
          personId: insertedPersons[7].id, // 郑十
          leaveId: insertedLeaves[7].id,
          contactDate: new Date('2025-10-03T11:30:00'),
          contactBy: insertedUsers[19].id, // 联络员8-1
          contactMethod: 'phone',
          notes: '出差期间工作汇报',
        },
      ])
      .returning();

    console.log(`✅ 插入了 ${insertedContacts.length} 个联系记录`);

    // 插入提醒记录
    console.log('⏰ 插入提醒记录...');
    const insertedReminders = await db
      .insert(reminders)
      .values([
        // 张三 - 休假前提醒（今日）
        {
          personId: insertedPersons[0].id,
          leaveId: insertedLeaves[0].id,
          reminderType: 'before',
          reminderDate: '2025-10-05',
          priority: 'medium',
          isHandled: false,
        },
        // 李四 - 休假中提醒
        {
          personId: insertedPersons[1].id,
          leaveId: insertedLeaves[1].id,
          reminderType: 'during',
          reminderDate: '2025-10-05',
          priority: 'medium',
          isHandled: false,
        },
        // 王五 - 休假结束前提醒（今日）
        {
          personId: insertedPersons[2].id,
          leaveId: insertedLeaves[2].id,
          reminderType: 'ending',
          reminderDate: '2025-10-05',
          priority: 'medium',
          isHandled: false,
        },
        // 赵六 - 长期休假超期提醒（7天未联系）
        {
          personId: insertedPersons[3].id,
          leaveId: insertedLeaves[3].id,
          reminderType: 'overdue',
          reminderDate: '2025-10-05',
          priority: 'high',
          isHandled: false,
        },
        // 孙七 - 今日开始休假提醒（已处理）
        {
          personId: insertedPersons[4].id,
          leaveId: insertedLeaves[4].id,
          reminderType: 'before',
          reminderDate: '2025-10-05',
          priority: 'medium',
          isHandled: true,
          handledBy: insertedUsers[11].id, // 联络员6-1
          handledAt: new Date('2025-10-05T08:00:00'),
        },
        // 周八 - 即将休假提醒（明日）
        {
          personId: insertedPersons[5].id,
          leaveId: insertedLeaves[5].id,
          reminderType: 'before',
          reminderDate: '2025-10-06',
          priority: 'medium',
          isHandled: false,
        },
        // 郑十 - 出差中提醒
        {
          personId: insertedPersons[7].id,
          leaveId: insertedLeaves[7].id,
          reminderType: 'during',
          reminderDate: '2025-10-05',
          priority: 'low',
          isHandled: false,
        },
      ])
      .returning();

    console.log(`✅ 插入了 ${insertedReminders.length} 个提醒记录`);

    console.log('🎉 数据库种子数据插入完成！');
    console.log('\n📋 测试账号信息（用户名/密码）：');
    console.log('队长2: 队长2 / 123 (2队管理员)');
    console.log('\n2部用户：');
    console.log('操作员2-1: 操作员2-1 / 123 (2部操作员)');
    console.log('操作员2-2: 操作员2-2 / 123 (2部操作员)');
    console.log('联络员2-1: 联络员2-1 / 123 (2部联络员)');
    console.log('联络员2-2: 联络员2-2 / 123 (2部联络员)');
    console.log('\n5组用户：');
    console.log('操作员5-1: 操作员5-1 / 123 (5组操作员)');
    console.log('操作员5-2: 操作员5-2 / 123 (5组操作员)');
    console.log('联络员5-1: 联络员5-1 / 123 (5组联络员)');
    console.log('联络员5-2: 联络员5-2 / 123 (5组联络员)');
    console.log('\n6组用户：');
    console.log('操作员6-1: 操作员6-1 / 123 (6组操作员)');
    console.log('操作员6-2: 操作员6-2 / 123 (6组操作员)');
    console.log('联络员6-1: 联络员6-1 / 123 (6组联络员)');
    console.log('联络员6-2: 联络员6-2 / 123 (6组联络员)');
    console.log('\n7组用户：');
    console.log('操作员7-1: 操作员7-1 / 123 (7组操作员)');
    console.log('操作员7-2: 操作员7-2 / 123 (7组操作员)');
    console.log('联络员7-1: 联络员7-1 / 123 (7组联络员)');
    console.log('联络员7-2: 联络员7-2 / 123 (7组联络员)');
    console.log('\n8组用户：');
    console.log('操作员8-1: 操作员8-1 / 123 (8组操作员)');
    console.log('操作员8-2: 操作员8-2 / 123 (8组操作员)');
    console.log('联络员8-1: 联络员8-1 / 123 (8组联络员)');
    console.log('联络员8-2: 联络员8-2 / 123 (8组联络员)');
    console.log('\n🏢 部门层级结构：');
    console.log('2队 (2TEAM)');
    console.log('├── 2部 (2BU)');
    console.log('├── 5组 (5GROUP)');
    console.log('├── 6组 (6GROUP)');
    console.log('├── 7组 (7GROUP)');
    console.log('└── 8组 (8GROUP)');
    console.log('\n🔐 权限说明：');
    console.log('- 队长2（管理员）：可以访问所有部门数据，管理部门结构');
    console.log('- 操作员（各部门）：可以访问本部门的数据，进行操作');
    console.log('- 联络员（各部门）：可以访问本部门的数据，负责联络工作');
  } catch (error) {
    console.error('❌ 数据库种子数据插入失败:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// 直接执行种子数据插入
seedDatabase();
