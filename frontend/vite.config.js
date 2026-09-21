import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chi tach rieng cac thu vien nang va doc lap. Khong dung chunk "vendor" gom tat
// ca vi no tao phu thuoc vong nguoc lai antd/leaflet, khien trang login van phai
// tai het. Phan con lai de Rollup tu chia theo route lazy.
const HEAVY_CHUNKS = [
  ['react', ['/react/', '/react-dom/', '/scheduler/', '/react-router', '/react-router-dom/']],
  ['charts', ['/chart.js', '/react-chartjs-2', 'chartjs-']],
  ['maps', ['/leaflet', '/react-leaflet']],
  ['antd', ['/antd/', '/rc-', '@ant-design']],
  ['mqtt', ['/mqtt/', '/mqtt-packet']],
]

const manualChunks = (id) => {
  // Helper interop CommonJS phai nam o chunk nen, neu khong Rollup se nhet no vao
  // chunk antd roi bat react import nguoc lai -> trang login tai ca antd.
  if (id.includes('commonjsHelpers') || id.includes('commonjs-dynamic-modules')) return 'react'
  if (!id.includes('node_modules')) return undefined
  const hit = HEAVY_CHUNKS.find(([, patterns]) => patterns.some((pattern) => id.includes(pattern)))
  return hit?.[0]
}

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks,
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
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
