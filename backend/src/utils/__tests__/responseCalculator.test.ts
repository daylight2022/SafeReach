import { ResponseCalculator, type ReminderData, type ContactData } from '../responseCalculator';

describe('ResponseCalculator', () => {
  const mockReminders: ReminderData[] = [
    {
      id: '1',
      priority: 'high',
      reminderType: 'overdue',
      reminderDate: '2024-01-01',
      isHandled: false,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      priority: 'medium',
      reminderType: 'before',
      reminderDate: '2024-01-02',
      isHandled: true,
      handledAt: '2024-01-02T10:00:00Z',
      createdAt: '2024-01-02T00:00:00Z',
    },
    {
      id: '3',
      priority: 'low',
      reminderType: 'during',
      reminderDate: '2024-01-03',
      isHandled: true,
      handledAt: '2024-01-05T10:00:00Z', // 2 days late
      createdAt: '2024-01-03T00:00:00Z',
    },
  ];

  const mockContacts: ContactData[] = [
    {
      id: '1',
      contactDate: '2024-01-01T10:00:00Z',
      personId: 'person1',
      hasRelatedReminder: true,
    },
    {
      id: '2',
      contactDate: '2024-01-02T10:00:00Z',
      personId: 'person2',
      hasRelatedReminder: false, // proactive contact
    },
  ];

  test('should calculate response metrics correctly', () => {
    const metrics = ResponseCalculator.calculateResponseMetrics(
      mockReminders,
      mockContacts,
      10 // totalPersons
    );

    expect(metrics.totalPersons).toBe(10);
    expect(metrics.totalContacts).toBe(2);
    expect(metrics.totalReminders).toBe(3);
    expect(metrics.unhandledReminders).toBe(1);
    expect(metrics.handledOnTime).toBe(1);
    expect(metrics.handledLate).toBe(1);
    expect(metrics.proactiveContacts).toBe(1);
    
    // Score calculation:
    // Base: 100
    // -10 for high priority unhandled
    // -5 for overdue penalty
    // +1 for on-time handling
    // -2 for 2-day delay
    // +0.5 for proactive contact
    // Expected: 100 - 10 - 5 + 1 - 2 + 0.5 = 84.5
    expect(metrics.totalScore).toBeCloseTo(84.5, 1);
    expect(metrics.responseGrade).toBe('B');
  });

  test('should calculate status distribution correctly', () => {
    const metrics = ResponseCalculator.calculateResponseMetrics(
      mockReminders,
      mockContacts,
      10
    );

    const distribution = ResponseCalculator.calculateStatusDistribution(metrics);
    
    expect(distribution.normal + distribution.suggest + distribution.urgent).toBe(100);
    expect(distribution.normal).toBeGreaterThan(0);
    expect(distribution.suggest).toBeGreaterThan(0);
    expect(distribution.urgent).toBeGreaterThan(0);
  });

  test('should generate department ranking correctly', () => {
    const departmentMetrics = new Map();
    departmentMetrics.set('技术部', {
      totalScore: 95,
      avgResponseDays: 0.5,
    } as any);
    departmentMetrics.set('市场部', {
      totalScore: 85,
      avgResponseDays: 1.2,
    } as any);

    const ranking = ResponseCalculator.generateDepartmentRanking(departmentMetrics);
    
    expect(ranking).toHaveLength(2);
    expect(ranking[0].name).toBe('技术部');
    expect(ranking[0].percentage).toBe(95);
    expect(ranking[1].name).toBe('市场部');
    expect(ranking[1].percentage).toBe(85);
  });

  test('should handle empty data gracefully', () => {
    const metrics = ResponseCalculator.calculateResponseMetrics([], [], 0);
    
    expect(metrics.totalScore).toBe(100); // Base score when no penalties
    expect(metrics.totalPersons).toBe(0);
    expect(metrics.totalContacts).toBe(0);
    expect(metrics.totalReminders).toBe(0);
    expect(metrics.responseGrade).toBe('A');
  });
});
