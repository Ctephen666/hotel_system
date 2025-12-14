import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 替换为您的后端服务器地址和端口
        changeOrigin: true,
      },
    },
    host: '10.29.238.57',
    port: 5173,
  },
})
