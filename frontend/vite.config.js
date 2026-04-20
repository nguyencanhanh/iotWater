import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Cho phép truy cập từ domain khác
    fs: {
      allow: ['./'],
    },
    hmr: {
      protocol: 'wss', // dùng 'wss' nếu bạn dùng HTTPS
      host: 'khca-s.static.good-dns.net',
      port: 5173, // cổng mà Vite dev server đang chạy
    },
  },
});