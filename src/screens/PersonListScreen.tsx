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

const PersonListScreen: React.FC<Props> = ({ navigation }) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [filteredPersons, setFilteredPersons] = useState<Person[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<PersonStatus | 'all'>('all');
  const [filterPersonType, setFilterPersonType] = useState<
    'employee' | 'intern' | 'manager' | 'all'
  >('all');
  const [filterDepartment, setFilterDepartment] = useState<string | 'all'>(
    'all',
  );
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

        if (Array.isArray(result.data)) {
          // 直接是数组格式
          departmentList = result.data;
        } else if (
          result.data.departments &&
          Array.isArray(result.data.departments)
        ) {
          // 分页格式 {departments: [...], pagination: {...}}
          departmentList = result.data.departments;
        } else if (result.data.data && Array.isArray(result.data.data)) {
          // 嵌套格式 {data: [...]}
          departmentList = result.data.data;
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
        // 处理数据以匹配现有的数据结构
        const processedPersons = personsData.map(person => ({
          ...person,
          currentLeave: person.currentLeave,
          lastContact: person.lastContact,
          status: calculatePersonStatus(person),
        }));
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

  const calculatePersonStatus = (person: any): PersonStatus => {
    // 检查是否有活跃的假期
    const activeLeave = person.currentLeave;

    if (!activeLeave) {
      return 'inactive';
    }

    // 优先使用关联的联系记录，其次使用直接字段
    const lastContactDate =
      person.lastContact?.contactDate || person.lastContactDate;
    if (!lastContactDate) return 'urgent';

    const daysSinceContact = Math.floor(
      (new Date().getTime() - new Date(lastContactDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysSinceContact > 7) return 'urgent';
    if (daysSinceContact > 3) return 'suggest';
    return 'normal';
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
    let filtered = [...persons];

    // 搜索过滤
    if (searchText) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(
        person =>
          person.name.toLowerCase().includes(searchLower) ||
          person.emergencyContact?.toLowerCase().includes(searchLower) ||
          person.phone?.toLowerCase().includes(searchLower) ||
          person.department?.name.toLowerCase().includes(searchLower) ||
          person.currentLeave?.location?.toLowerCase().includes(searchLower),
      );
    }

    // 状态过滤
    if (filterStatus !== 'all') {
      filtered = filtered.filter(person => person.status === filterStatus);
    }

    // 人员类型过滤
    if (filterPersonType !== 'all') {
      filtered = filtered.filter(
        person => person.personType === filterPersonType,
      );
    }

    // 部门过滤
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(
        person =>
          person.departmentId === filterDepartment ||
          person.department?.id === filterDepartment ||
          person.departmentInfo?.id === filterDepartment,
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

  const renderPerson = ({ item }: { item: Person }) => (
    <PersonCard
      person={item}
      onPress={() => handlePersonPress(item)}
      onContact={() => handlePersonPress(item)}
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
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilter(true)}
            >
              <Icon name="filter" size={14} color="#374151" />
              <Text style={styles.filterText}>筛选</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortButton} onPress={handleSort}>
              <Icon name={getSortIcon()} size={14} color="#374151" />
              <Text style={styles.sortText}>{getSortText()}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        departments={departments}
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
});

export default PersonListScreen;
