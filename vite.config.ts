import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 專案站位在 /<repo>/ 子路徑下。用相對路徑（'./'）而不用寫死的
  // '/subscription-ops/'，這樣 repo 日後再改名也不必回來改這裡。
  base: './',
  server: {
    port: 5173,
    // playwright-cli 會把下載檔寫進專案目錄，Windows 上被檔案監看鎖住會讓 dev server 崩潰
    watch: { ignored: ['**/.playwright-cli/**', '**/.shots/**'] },
  },
  build: {
    // recharts 本身約 570 kB，獨立成 vendor chunk 方便快取
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
