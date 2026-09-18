import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiHost = env.API_HOST && env.API_HOST !== '0.0.0.0' ? env.API_HOST : 'localhost';
  const apiPort = env.API_PORT || '38081';
  const knowledgePort = env.EK_API_PORT || '48082';
  const codingPort = env.CODING_API_PORT || '38083';

  return {
    plugins: [vue()],
    optimizeDeps: {
      // pdfjs-dist 走原始 ESM 模块，避免预打包缓存与类实例问题
      exclude: ['pdfjs-dist']
    },
    server: {
      port: 5177,
      proxy: {
        '/api/chat': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true
        },
        '/api/playground': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true
        },
        '/api/meeting': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true
        },
        '/api/notifications': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true
        },
        '/api/knowledge': {
          target: `http://${apiHost}:${knowledgePort}`,
          changeOrigin: true
        },
        '/api/coding': {
          target: `http://${apiHost}:${codingPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
