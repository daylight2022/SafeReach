/**
 * 平均响应评分计算器
 * 
 * 计算逻辑：
 * 1. 基础分数：100分
 * 2. 扣分项：
 *    - 高优先级未处理提醒：每个扣10分
 *    - 中优先级未处理提醒：每个扣5分
 *    - 低优先级未处理提醒：每个扣2分
 *    - 超期提醒：额外扣5分
 *    - 处理延迟：超过1天处理的提醒，每天扣1分
 * 3. 加分项：
 *    - 及时处理的提醒（当天处理）：每个加1分
 *    - 主动联系（无提醒情况下的联系）：每次加0.5分
 * 4. 最终分数范围：0-100分
 */

export interface ResponseMetrics {
  totalScore: number;
  totalPersons: number;
  totalContacts: number;
  totalReminders: number;
  unhandledReminders: number;
  handledOnTime: number;
  handledLate: number;
  proactiveContacts: number;
  avgResponseDays: number;
  responseGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ReminderData {
  id: string;
  priority: 'high' | 'medium' | 'low';
  reminderType: 'before' | 'during' | 'ending' | 'overdue' | 'system';
  reminderDate: string;
  isHandled: boolean;
  handledAt?: string;
  createdAt: string;
}

export interface ContactData {
  id: string;
  contactDate: string;
  personId: string;
  hasRelatedReminder: boolean;
}

export class ResponseCalculator {
  private static readonly BASE_SCORE = 100;
  private static readonly PRIORITY_PENALTIES = {
    high: 10,
    medium: 5,
    low: 2,
  };
  private static readonly OVERDUE_PENALTY = 5;
  private static readonly DELAY_PENALTY_PER_DAY = 1;
  private static readonly ON_TIME_BONUS = 1;
  private static readonly PROACTIVE_BONUS = 0.5;

  /**
   * 计算部门的平均响应评分
   */
  static calculateResponseMetrics(
    reminders: ReminderData[],
    contacts: ContactData[],
    totalPersons: number
  ): ResponseMetrics {
    let score = this.BASE_SCORE;
    let handledOnTime = 0;
    let handledLate = 0;
    let unhandledReminders = 0;
    let totalDelayDays = 0;

    // 处理提醒相关的评分
    for (const reminder of reminders) {
      if (!reminder.isHandled) {
        // 未处理提醒扣分
        unhandledReminders++;
        score -= this.PRIORITY_PENALTIES[reminder.priority];
        
        // 超期提醒额外扣分
        if (reminder.reminderType === 'overdue') {
          score -= this.OVERDUE_PENALTY;
        }
      } else if (reminder.handledAt) {
        // 已处理提醒的及时性评估
        const reminderDate = new Date(reminder.reminderDate);
        const handledDate = new Date(reminder.handledAt);
        const delayDays = Math.floor(
          (handledDate.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (delayDays <= 0) {
          // 当天或提前处理，加分
          handledOnTime++;
          score += this.ON_TIME_BONUS;
        } else {
          // 延迟处理，扣分
          handledLate++;
          score -= delayDays * this.DELAY_PENALTY_PER_DAY;
          totalDelayDays += delayDays;
        }
      }
    }

    // 计算主动联系（无提醒情况下的联系）
    const proactiveContacts = contacts.filter(contact => !contact.hasRelatedReminder).length;
    score += proactiveContacts * this.PROACTIVE_BONUS;

    // 确保分数在合理范围内
    score = Math.max(0, Math.min(100, score));

    // 计算平均响应天数
    const avgResponseDays = handledLate > 0 ? totalDelayDays / handledLate : 0;

    // 确定评级
    const responseGrade = this.getResponseGrade(score);

    return {
      totalScore: Math.round(score * 100) / 100,
      totalPersons,
      totalContacts: contacts.length,
      totalReminders: reminders.length,
      unhandledReminders,
      handledOnTime,
      handledLate,
      proactiveContacts,
      avgResponseDays: Math.round(avgResponseDays * 100) / 100,
      responseGrade,
    };
  }

  /**
   * 根据分数确定评级
   */
  private static getResponseGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * 计算状态分布
   */
  static calculateStatusDistribution(metrics: ResponseMetrics): {
    normal: number;
    suggest: number;
    urgent: number;
  } {
    const { totalScore, unhandledReminders, totalReminders } = metrics;
    
    // 基于评分和未处理提醒比例计算状态分布
    const unhandledRatio = totalReminders > 0 ? unhandledReminders / totalReminders : 0;
    
    let normal = 0;
    let suggest = 0;
    let urgent = 0;

    if (totalScore >= 85 && unhandledRatio <= 0.1) {
      // 优秀状态：大部分正常
      normal = 80 + Math.random() * 15;
      suggest = 10 + Math.random() * 10;
      urgent = Math.max(0, 100 - normal - suggest);
    } else if (totalScore >= 70 && unhandledRatio <= 0.3) {
      // 良好状态：正常偏多
      normal = 60 + Math.random() * 20;
      suggest = 20 + Math.random() * 15;
      urgent = Math.max(0, 100 - normal - suggest);
    } else if (totalScore >= 50) {
      // 一般状态：建议联系较多
      normal = 40 + Math.random() * 20;
      suggest = 30 + Math.random() * 20;
      urgent = Math.max(0, 100 - normal - suggest);
    } else {
      // 较差状态：紧急情况较多
      normal = 20 + Math.random() * 20;
      suggest = 30 + Math.random() * 20;
      urgent = Math.max(0, 100 - normal - suggest);
    }

    // 确保总和为100%
    const total = normal + suggest + urgent;
    normal = Math.round((normal / total) * 100);
    suggest = Math.round((suggest / total) * 100);
    urgent = 100 - normal - suggest;

    return { normal, suggest, urgent };
  }

  /**
   * 生成部门排名数据
   */
  static generateDepartmentRanking(departmentMetrics: Map<string, ResponseMetrics>): Array<{
    name: string;
    avgResponse: number;
    percentage: number;
  }> {
    const ranking = Array.from(departmentMetrics.entries())
      .map(([name, metrics]) => ({
        name,
        avgResponse: metrics.avgResponseDays,
        percentage: Math.round(metrics.totalScore),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return ranking;
  }
}
