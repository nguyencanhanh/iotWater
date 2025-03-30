import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // server: {
  //   host: true, // Lắng nghe trên địa chỉ IP cục bộ
  //   port: 5173, // Cổng mà bạn muốn sử dụng
  // },
});