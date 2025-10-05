/**
 * 统计API测试脚本
 * 用于测试统计接口是否正常返回数据
 * 
 * 使用方法：
 * node test-statistics-api.js <token>
 */

const API_BASE = 'http://1.12.60.17:3000/api';

async function testStatisticsAPI(token) {
  console.log('🔍 开始测试统计API...\n');
  
  try {
    // 计算时间范围（本月）
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = now;
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 查询时间范围: ${startDateStr} 至 ${endDateStr}\n`);
    
    // 调用统计接口
    const url = `${API_BASE}/statistics?startDate=${startDateStr}&endDate=${endDateStr}`;
    console.log(`🌐 请求URL: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP错误: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('响应内容:', text);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ API调用成功！\n');
    console.log('📊 返回数据结构:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n\n=== 数据验证 ===\n');
    
    const data = result.data || {};
    
    // 验证基础数据
    console.log('📈 基础统计:');
    console.log(`  - 总人数: ${data.totalPersons || 0}`);
    console.log(`  - 在假人数: ${data.activePersons || 0}`);
    console.log(`  - 联系次数: ${data.totalContacts || 0}`);
    
    // 验证新增指标
    console.log('\n🏥 健康度评分:');
    console.log(`  - 分数: ${data.healthScore !== undefined ? data.healthScore : '❌ 缺失'}`);
    
    console.log('\n📈 趋势数据:');
    if (data.trends) {
      console.log(`  - 及时处理率趋势: ${JSON.stringify(data.trends.onTimeRate || '❌ 缺失')}`);
      console.log(`  - 紧急人数趋势: ${JSON.stringify(data.trends.urgentCount || '❌ 缺失')}`);
      console.log(`  - 未处理提醒趋势: ${JSON.stringify(data.trends.unhandledReminders || '❌ 缺失')}`);
    } else {
      console.log('  ❌ trends 字段缺失');
    }
    
    console.log('\n🏆 部门排名:');
    if (data.departmentRanking && data.departmentRanking.length > 0) {
      console.log(`  - 部门数量: ${data.departmentRanking.length}`);
      data.departmentRanking.forEach((dept, index) => {
        console.log(`  ${index + 1}. ${dept.name || '未知'}`);
        console.log(`     - 及时处理率: ${dept.onTimeRate}%`);
        console.log(`     - 提醒处理率: ${dept.reminderProcessRate}%`);
        console.log(`     - 紧急人数: ${dept.urgentCount}人`);
      });
    } else {
      console.log('  ⚠️  departmentRanking 为空或缺失');
    }
    
    console.log('\n📊 人员状态分布:');
    if (data.statusDistribution) {
      console.log(`  - 正常: ${data.statusDistribution.normal?.count || 0}人 (${data.statusDistribution.normal?.percentage || 0}%)`);
      console.log(`  - 建议: ${data.statusDistribution.suggest?.count || 0}人 (${data.statusDistribution.suggest?.percentage || 0}%)`);
      console.log(`  - 紧急: ${data.statusDistribution.urgent?.count || 0}人 (${data.statusDistribution.urgent?.percentage || 0}%)`);
      console.log(`  - 在岗: ${data.statusDistribution.inactive?.count || 0}人 (${data.statusDistribution.inactive?.percentage || 0}%)`);
    } else {
      console.log('  ❌ statusDistribution 字段缺失');
    }
    
    console.log('\n\n=== 问题诊断 ===\n');
    
    let hasIssues = false;
    
    if (!data.healthScore && data.healthScore !== 0) {
      console.log('⚠️  问题1: healthScore 缺失 - 检查后端是否正确计算');
      hasIssues = true;
    }
    
    if (!data.trends) {
      console.log('⚠️  问题2: trends 缺失 - 检查上期数据查询是否正常');
      hasIssues = true;
    }
    
    if (!data.departmentRanking || data.departmentRanking.length === 0) {
      console.log('⚠️  问题3: departmentRanking 为空 - 检查departments表是否有数据');
      hasIssues = true;
    }
    
    if (!data.statusDistribution || 
        !data.statusDistribution.normal || 
        !data.statusDistribution.suggest || 
        !data.statusDistribution.urgent || 
        !data.statusDistribution.inactive) {
      console.log('⚠️  问题4: statusDistribution 结构不完整 - 检查后端状态计算逻辑');
      hasIssues = true;
    }
    
    if (!hasIssues) {
      console.log('✅ 所有数据字段都正常！');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 从命令行参数获取token
const token = process.argv[2];

if (!token) {
  console.log('❌ 缺少认证token');
  console.log('\n使用方法:');
  console.log('  node test-statistics-api.js <your-auth-token>\n');
  console.log('获取token的方法:');
  console.log('  1. 在App中登录');
  console.log('  2. 打开React Native Debugger');
  console.log('  3. 在Console中执行: await AsyncStorage.getItem("token")');
  process.exit(1);
}

testStatisticsAPI(token);

