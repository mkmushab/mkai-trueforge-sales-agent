const { spawn } = require('child_process');
const { createServer } = require('vite');
const electron = require('electron');
const path = require('path');

async function startApp() {
  //   Vite  
  const server = await createServer();
  await server.listen();

  console.log('Vite server started');

  //   Electron  
  require('child_process').execSync('tsc --project electron-tsconfig.json', {
    stdio: 'inherit',
  });

  console.log('Electron main process code compiled');

  //   Electron
  const proc = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  proc.on('close', () => {
    server.close();
    process.exit();
  });

  //  
  process.on('SIGTERM', () => {
    proc.kill();
    server.close();
    process.exit();
  });
}

startApp().catch((err) => {
  console.error('Error starting app:', err);
  process.exit(1);
}); 