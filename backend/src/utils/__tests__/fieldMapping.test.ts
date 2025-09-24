import {
  toCamelCase,
  toSnakeCase,
  convertToCamelCase,
  convertToSnakeCase,
  convertDbToApi,
  convertApiToDb,
} from '../fieldMapping';

describe('fieldMapping', () => {
  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('real_name')).toBe('realName');
      expect(toCamelCase('department_id')).toBe('departmentId');
      expect(toCamelCase('created_at')).toBe('createdAt');
      expect(toCamelCase('annual_leave_total')).toBe('annualLeaveTotal');
    });

    it('should handle single words', () => {
      expect(toCamelCase('name')).toBe('name');
      expect(toCamelCase('id')).toBe('id');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('realName')).toBe('real_name');
      expect(toSnakeCase('departmentId')).toBe('department_id');
      expect(toSnakeCase('createdAt')).toBe('created_at');
      expect(toSnakeCase('annualLeaveTotal')).toBe('annual_leave_total');
    });

    it('should handle single words', () => {
      expect(toSnakeCase('name')).toBe('name');
      expect(toSnakeCase('id')).toBe('id');
    });
  });

  describe('convertToCamelCase', () => {
    it('should convert object keys to camelCase', () => {
      const input = {
        real_name: 'John Doe',
        department_id: '123',
        created_at: '2023-01-01',
        nested_object: {
          emergency_contact: 'Jane Doe',
          emergency_phone: '123456789'
        }
      };

      const expected = {
        realName: 'John Doe',
        departmentId: '123',
        createdAt: '2023-01-01',
        nestedObject: {
          emergencyContact: 'Jane Doe',
          emergencyPhone: '123456789'
        }
      };

      expect(convertToCamelCase(input)).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = [
        { real_name: 'John', department_id: '1' },
        { real_name: 'Jane', department_id: '2' }
      ];

      const expected = [
        { realName: 'John', departmentId: '1' },
        { realName: 'Jane', departmentId: '2' }
      ];

      expect(convertToCamelCase(input)).toEqual(expected);
    });
  });

  describe('convertToSnakeCase', () => {
    it('should convert object keys to snake_case', () => {
      const input = {
        realName: 'John Doe',
        departmentId: '123',
        createdAt: '2023-01-01',
        nestedObject: {
          emergencyContact: 'Jane Doe',
          emergencyPhone: '123456789'
        }
      };

      const expected = {
        real_name: 'John Doe',
        department_id: '123',
        created_at: '2023-01-01',
        nested_object: {
          emergency_contact: 'Jane Doe',
          emergency_phone: '123456789'
        }
      };

      expect(convertToSnakeCase(input)).toEqual(expected);
    });
  });

  describe('convertDbToApi', () => {
    it('should use field mapping for known fields', () => {
      const input = {
        real_name: 'John Doe',
        department_id: '123',
        person_type: 'employee',
        annual_leave_total: 30
      };

      const expected = {
        realName: 'John Doe',
        departmentId: '123',
        personType: 'employee',
        annualLeaveTotal: 30
      };

      expect(convertDbToApi(input)).toEqual(expected);
    });

    it('should fallback to camelCase for unknown fields', () => {
      const input = {
        custom_field: 'value',
        another_custom_field: 'value2'
      };

      const expected = {
        customField: 'value',
        anotherCustomField: 'value2'
      };

      expect(convertDbToApi(input)).toEqual(expected);
    });
  });

  describe('convertApiToDb', () => {
    it('should use field mapping for known fields', () => {
      const input = {
        realName: 'John Doe',
        departmentId: '123',
        personType: 'employee',
        annualLeaveTotal: 30
      };

      const expected = {
        real_name: 'John Doe',
        department_id: '123',
        person_type: 'employee',
        annual_leave_total: 30
      };

      expect(convertApiToDb(input)).toEqual(expected);
    });

    it('should fallback to snake_case for unknown fields', () => {
      const input = {
        customField: 'value',
        anotherCustomField: 'value2'
      };

      const expected = {
        custom_field: 'value',
        another_custom_field: 'value2'
      };

      expect(convertApiToDb(input)).toEqual(expected);
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined', () => {
      expect(convertDbToApi(null)).toBe(null);
      expect(convertDbToApi(undefined)).toBe(undefined);
      expect(convertApiToDb(null)).toBe(null);
      expect(convertApiToDb(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(convertDbToApi('string')).toBe('string');
      expect(convertDbToApi(123)).toBe(123);
      expect(convertDbToApi(true)).toBe(true);
    });
  });
});
