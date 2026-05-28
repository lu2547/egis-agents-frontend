import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiHost = env.API_HOST && env.API_HOST !== '0.0.0.0' ? env.API_HOST : 'localhost';
  const apiPort = env.API_PORT || '38081';

  return {
    plugins: [vue()],
    server: {
      port: 5177,
      proxy: {
        '/api/chat': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
