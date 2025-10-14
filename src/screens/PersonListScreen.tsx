import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { Person, PersonStatus, User, Department } from '@/types';
import PersonCard from '@/components/PersonCard';
import FilterModal from '@/components/FilterModal';
import { userStorage } from '@/utils/storage';
import { apiServices } from '@/services/apiServices';

interface Props {
  navigation: NavigationProp<any>;
}

type SortOrder = 'default' | 'asc' | 'desc';

interface FilteredPerson extends Person {
  matchedField?: string; // 搜索匹配的字段
}

const PersonListScreen: React.FC<Props> = ({ navigation }) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [filteredPersons, setFilteredPersons] = useState<FilteredPerson[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<PersonStatus[]>([]);
  const [filterPersonType, setFilterPersonType] = useState<
    ('employee' | 'intern' | 'manager')[]
  >([]);
  const [filterDepartment, setFilterDepartment] = useState<string[]>([]);
  const [filterLeaveType, setFilterLeaveType] = useState<
    ('vacation' | 'business' | 'study' | 'hospitalization' | 'care')[]
  >([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadCurrentUser();
    loadPersons();
    loadDepartments();
  }, []);

  useEffect(() => {
    filterPersons();
  }, [
    searchText,
    filterStatus,
    filterPersonType,
    filterDepartment,
    filterLeaveType,
    sortOrder,
    persons,
  ]);

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
      loadPersons();
      loadDepartments();
    }, []),
  );

  const loadCurrentUser = async () => {
    try {
      const user = await userStorage.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('获取当前用户信息失败:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      console.log('🏢 PersonListScreen开始加载部门列表...');
      const result = await apiServices.department.getDepartments();

      console.log('🏢 PersonListScreen部门API响应:', result);

      if (result.success && result.data) {
        // 处理不同的响应格式
        let departmentList: Department[] = [];
        const data: any = result.data;

        if (Array.isArray(data)) {
          // 直接是数组格式
          departmentList = data;
        } else if (
          data.departments &&
          Array.isArray(data.departments)
        ) {
          // 分页格式 {departments: [...], pagination: {...}}
          departmentList = data.departments;
        } else if (data.data && Array.isArray(data.data)) {
          // 嵌套格式 {data: [...]}
          departmentList = data.data;
        }

        console.log(
          '🏢 PersonListScreen加载部门列表成功，共',
          departmentList.length,
          '个部门',
          departmentList,
        );
        setDepartments(departmentList);
      } else {
        console.error(
          '🏢 PersonListScreen部门API返回失败:',
          result.message || result,
        );
        setDepartments([]);
      }
    } catch (error) {
      console.error('PersonListScreen Load departments error:', error);
      setDepartments([]);
    }
  };

  const loadPersons = async () => {
    setLoading(true);
    try {
      const result = await apiServices.person.getPersons({
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (result.success) {
        const personsData = result.data?.persons || [];
        // 后端已经返回了包含状态的完整数据，直接使用
        const processedPersons = personsData.map((person: any) => ({
          ...person,
          currentLeave: person.currentLeave,
          lastContact: person.lastContact,
          currentReminder: person.currentReminder,
          // 使用后端返回的状态，如果没有则默认为 inactive
          status: person.status || 'inactive',
        })) as Person[];
        setPersons(processedPersons);
      } else {
        console.error('获取人员列表失败:', result.message);
        setPersons([]);
      }
    } catch (error) {
      console.error('Load persons error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusPriority = (status: PersonStatus | undefined): number => {
    switch (status) {
      case 'urgent':
        return 4;
      case 'suggest':
        return 3;
      case 'normal':
        return 2;
      case 'inactive':
        return 1;
      default:
        return 0;
    }
  };

  const filterPersons = () => {
    let filtered: FilteredPerson[] = [...persons];

    // 搜索过滤
    if (searchText) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(person => {
        // 检查每个字段并记录匹配的字段
        if (person.name.toLowerCase().includes(searchLower)) {
          (person as FilteredPerson).matchedField = '姓名';
          return true;
        }
        if (person.emergencyContact?.toLowerCase().includes(searchLower)) {
          (person as FilteredPerson).matchedField = '紧急联系人';
          return true;
        }
        if (person.phone?.toLowerCase().includes(searchLower)) {
          (person as FilteredPerson).matchedField = '电话';
          return true;
        }
        if (person.department?.name.toLowerCase().includes(searchLower)) {
          (person as FilteredPerson).matchedField = '部门';
          return true;
        }
        if (person.currentLeave?.location?.toLowerCase().includes(searchLower)) {
          (person as FilteredPerson).matchedField = '所在地';
          return true;
        }
        return false;
      });
    } else {
      // 清除搜索时，移除匹配字段信息
      filtered = filtered.map(person => {
        const { matchedField, ...rest } = person as FilteredPerson;
        return rest;
      });
    }

    // 状态过滤（多选）
    if (filterStatus.length > 0) {
      filtered = filtered.filter(person => 
        person.status && filterStatus.includes(person.status)
      );
    }

    // 人员类型过滤（多选）
    if (filterPersonType.length > 0) {
      filtered = filtered.filter(person =>
        person.personType && filterPersonType.includes(person.personType),
      );
    }

    // 部门过滤（多选）
    if (filterDepartment.length > 0) {
      filtered = filtered.filter(person =>
        filterDepartment.includes(person.departmentId || '') ||
        filterDepartment.includes(person.department?.id || '') ||
        filterDepartment.includes(person.departmentInfo?.id || ''),
      );
    }

    // 在外类别过滤（多选）
    if (filterLeaveType.length > 0) {
      filtered = filtered.filter(person =>
        person.currentLeave && 
        filterLeaveType.includes(person.currentLeave.leaveType),
      );
    }

    // 排序
    if (sortOrder === 'asc') {
      // 按联系紧急状态正序排序
      filtered.sort(
        (a, b) => getStatusPriority(a.status) - getStatusPriority(b.status),
      );
    } else if (sortOrder === 'desc') {
      // 按联系紧急状态逆序排序
      filtered.sort(
        (a, b) => getStatusPriority(b.status) - getStatusPriority(a.status),
      );
    } else {
      // 默认按更新时间排序
      filtered.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    setFilteredPersons(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPersons();
    setRefreshing(false);
  };

  const handlePersonPress = (person: Person) => {
    navigation.navigate('PersonDetail', { personId: person.id });
  };

  const handleAddPerson = () => {
    navigation.navigate('AddPerson');
  };

  const handleResetFilters = () => {
    setFilterStatus([]);
    setFilterPersonType([]);
    setFilterDepartment([]);
    setFilterLeaveType([]);
  };

  const handleSort = () => {
    const nextOrder: SortOrder =
      sortOrder === 'default'
        ? 'asc'
        : sortOrder === 'asc'
        ? 'desc'
        : 'default';
    setSortOrder(nextOrder);
  };

  const getSortIcon = () => {
    switch (sortOrder) {
      case 'asc':
        return 'sort-amount-asc';
      case 'desc':
        return 'sort-amount-desc';
      default:
        return 'sort';
    }
  };

  const getSortText = () => {
    switch (sortOrder) {
      case 'asc':
        return '正序';
      case 'desc':
        return '逆序';
      default:
        return '排序';
    }
  };

  const renderPerson = ({ item }: { item: FilteredPerson }) => (
    <PersonCard
      person={item}
      onPress={() => handlePersonPress(item)}
      onContact={loadPersons}
      matchedField={item.matchedField}
      searchText={searchText}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>人员管理</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPerson}>
            <LinearGradient
              colors={COLORS.primaryGradient}
              style={styles.addButtonGradient}
            >
              <Icon name="plus" size={16} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icon
              name="search"
              size={16}
              color="#9CA3AF"
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="搜索姓名、地址、联系人..."
              value={searchText}
              onChangeText={setSearchText}
              style={styles.searchInput}
              placeholderTextColor="#9CA3AF"
              underlineColorAndroid="transparent" // 顺便去掉 Android 下的默认下划线
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                style={styles.clearButton}
              >
                <Icon name="times-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilter(true)}
            >
              <Icon name="filter" size={14} color="#374151" />
              <Text style={styles.filterText}>筛选</Text>
              {(filterStatus.length > 0 ||
                filterPersonType.length > 0 ||
                filterDepartment.length > 0 ||
                filterLeaveType.length > 0) && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {filterStatus.length +
                      filterPersonType.length +
                      filterDepartment.length +
                      filterLeaveType.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortButton} onPress={handleSort}>
              <Icon name={getSortIcon()} size={14} color="#374151" />
              <Text style={styles.sortText}>{getSortText()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 筛选标签栏 */}
        {(filterStatus.length > 0 ||
          filterPersonType.length > 0 ||
          filterDepartment.length > 0 ||
          filterLeaveType.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterTagsContainer}
            contentContainerStyle={styles.filterTagsContent}
          >
            {filterStatus.map(status => {
              const statusMap = {
                urgent: '紧急',
                suggest: '建议',
                normal: '正常',
              };
              return (
                <TouchableOpacity
                  key={status}
                  style={styles.filterTag}
                  onPress={() => {
                    setFilterStatus(filterStatus.filter(s => s !== status));
                  }}
                >
                  <Text style={styles.filterTagText}>
                    状态: {statusMap[status]}
                  </Text>
                  <Icon name="times" size={12} color="#6B7280" />
                </TouchableOpacity>
              );
            })}
            
            {filterPersonType.map(type => {
              const typeMap = {
                employee: '员工',
                manager: '小组长',
                intern: '实习生',
              };
              return (
                <TouchableOpacity
                  key={type}
                  style={styles.filterTag}
                  onPress={() => {
                    setFilterPersonType(filterPersonType.filter(t => t !== type));
                  }}
                >
                  <Text style={styles.filterTagText}>
                    类型: {typeMap[type]}
                  </Text>
                  <Icon name="times" size={12} color="#6B7280" />
                </TouchableOpacity>
              );
            })}
            
            {filterDepartment.map(deptId => {
              const dept = departments.find(d => d.id === deptId);
              return (
                <TouchableOpacity
                  key={deptId}
                  style={styles.filterTag}
                  onPress={() => {
                    setFilterDepartment(filterDepartment.filter(d => d !== deptId));
                  }}
                >
                  <Text style={styles.filterTagText}>
                    部门: {dept?.name || deptId}
                  </Text>
                  <Icon name="times" size={12} color="#6B7280" />
                </TouchableOpacity>
              );
            })}
            
            {filterLeaveType.map(type => {
              const typeMap = {
                vacation: '休假',
                business: '出差',
                study: '学习',
                hospitalization: '住院',
                care: '陪护',
              };
              return (
                <TouchableOpacity
                  key={type}
                  style={styles.filterTag}
                  onPress={() => {
                    setFilterLeaveType(filterLeaveType.filter(t => t !== type));
                  }}
                >
                  <Text style={styles.filterTagText}>
                    在外: {typeMap[type]}
                  </Text>
                  <Icon name="times" size={12} color="#6B7280" />
                </TouchableOpacity>
              );
            })}
            
            <TouchableOpacity
              style={styles.clearAllTag}
              onPress={handleResetFilters}
            >
              <Text style={styles.clearAllText}>清除全部</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredPersons}
          renderItem={renderPerson}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="users" size={48} color={COLORS.darkGray} />
              <Text style={styles.emptyText}>暂无人员数据</Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        currentStatus={filterStatus}
        onStatusChange={setFilterStatus}
        currentPersonType={filterPersonType}
        onPersonTypeChange={setFilterPersonType}
        currentDepartment={filterDepartment}
        onDepartmentChange={setFilterDepartment}
        currentLeaveType={filterLeaveType}
        onLeaveTypeChange={setFilterLeaveType}
        departments={departments}
        onReset={handleResetFilters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    width: 32,
    height: 32,
  },
  addButtonGradient: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray || '#F3F4F6',
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
    textAlignVertical: 'center',
    paddingTop: 4,
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  filterText: {
    fontSize: 14,
    color: '#374151',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  sortText: {
    fontSize: 14,
    color: '#374151',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.darkGray,
    marginTop: 12,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  filterTagsContainer: {
    marginTop: 12,
    maxHeight: 36,
  },
  filterTagsContent: {
    paddingRight: 16,
    gap: 8,
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
  },
  filterTagText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  clearAllTag: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '500',
  },
});

export default PersonListScreen;
