#!/usr/bin/env node

/**
 * 版本更新脚本
 * 用于本地更新主版本号和次版本号
 *
 * 使用方法:
 * node scripts/version-update.js major   # 主版本更新 (1.0.0 -> 2.0.0)
 * node scripts/version-update.js minor   # 次版本更新 (1.0.0 -> 1.1.0)
 * node scripts/version-update.js patch   # 补丁更新 (1.0.0 -> 1.0.1)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取命令行参数
const versionType = process.argv[2];

// 验证版本类型
const validTypes = ['major', 'minor', 'patch'];
if (!validTypes.includes(versionType)) {
  console.error('❌ 错误: 无效的版本类型');
  console.log('✅ 使用方法:');
  console.log('  node scripts/version-update.js major   # 主版本更新');
  console.log('  node scripts/version-update.js minor   # 次版本更新');
  console.log('  node scripts/version-update.js patch   # 补丁更新');
  process.exit(1);
}

async function main() {
  try {
    // 获取当前版本
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    console.log(`📦 当前版本: ${currentVersion}`);
    console.log(`🔄 执行 ${versionType} 版本更新...`);

    // 检查是否有未提交的更改
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.warn('⚠️  警告: 检测到未提交的更改');
        console.log('建议先提交或暂存当前更改，然后再更新版本');

        // 询问是否继续
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise(resolve => {
          rl.question('是否继续? (y/N): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ 操作已取消');
          process.exit(0);
        }
      }
    } catch (error) {
      console.log('📝 注意: 无法检查Git状态，可能不在Git仓库中');
    }

    // 更新版本号
    const newVersionOutput = execSync(
      `npm version ${versionType} --no-git-tag-version`,
      { encoding: 'utf8' },
    );
    const newVersion = newVersionOutput.trim().replace('v', '');

    console.log(`✅ 版本已更新: ${currentVersion} -> ${newVersion}`);

    // 如果是主版本或次版本更新，使用react-native-version更新原生版本
    if (versionType === 'major' || versionType === 'minor') {
      console.log('🔄 更新原生应用版本...');
      try {
        // 检查是否安装了react-native-version
        execSync('npx react-native-version --help', { stdio: 'ignore' });

        // 更新原生版本
        execSync('npx react-native-version --never-amend', {
          stdio: 'inherit',
        });
        console.log('✅ 原生应用版本已更新');
      } catch (error) {
        console.warn(
          '⚠️  警告: 无法更新原生版本，请确保安装了react-native-version',
        );
        console.log('可以运行: npm install -g react-native-version');
      }
    }

    // 生成版本代码
    const versionParts = newVersion.split('.').map(Number);
    const versionCode =
      versionParts[0] * 10000 + versionParts[1] * 100 + versionParts[2];

    console.log(`📊 版本代码: ${versionCode}`);

    // 提示下一步操作
    console.log('\n🚀 下一步操作:');
    console.log('1. 检查更改是否正确');
    console.log(
      '2. 提交更改: git add . && git commit -m "chore: bump version to ' +
        newVersion +
        '"',
    );
    console.log('3. 推送到远程仓库: git push origin main');
    console.log('4. GitHub Actions 将自动处理剩余步骤');

    if (versionType === 'major' || versionType === 'minor') {
      console.log('\n📱 重要提示:');
      console.log('- 主版本或次版本更新可能需要重新构建应用');
      console.log('- 请确保测试新版本的兼容性');
      console.log('- 考虑更新应用商店的版本描述');
    }
  } catch (error) {
    console.error('❌ 版本更新失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 脚本执行失败:', error.message);
  process.exit(1);
});
