/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from '@/navigation/AppNavigator';
import UpdateModal from '@/components/UpdateModal';
import useVersionCheck from '@/hooks/useVersionCheck';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const {
    hasUpdate,
    latestVersion,
    currentVersion,
    showUpdateModal,
    dismissUpdate,
  } = useVersionCheck();

  return (
    <View style={styles.container}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>

      {/* 版本更新弹框 */}
      <UpdateModal
        visible={showUpdateModal}
        onClose={dismissUpdate}
        latestVersion={latestVersion || undefined}
        currentVersion={currentVersion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
