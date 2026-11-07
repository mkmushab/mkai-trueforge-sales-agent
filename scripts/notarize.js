const { notarize } = require('@electron/notarize');
const path = require('path');

// Load .env when dotenv is available, but do not require it for packaging.
try {
  require('dotenv').config();
} catch (error) {
  if (!error || error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn('⚠️   :   APPLE_ID   APPLE_APP_SPECIFIC_PASSWORD');
    console.warn('     .env   Apple Developer  ');
    console.warn('     .env.example  ');
    return;
  }

  if (!process.env.APPLE_TEAM_ID) {
    console.warn('⚠️   :   APPLE_TEAM_ID');
    console.warn('     APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`🔐   ${appName}...`);
  console.log(`    : ${appPath}`);
  console.log(`   Apple ID: ${process.env.APPLE_ID}`);
  console.log(`   Team ID: ${process.env.APPLE_TEAM_ID}`);

  try {
    await notarize({
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });

    console.log('✅  ');
    console.log('    ');
  } catch (error) {
    console.error('❌  :', error.message);
    console.error('     Apple Developer  ');
    console.error('     https://appstoreconnect.apple.com/notarization-history  ');
    throw error;
  }
};
