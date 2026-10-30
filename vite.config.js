import {defineConfig} from 'vite';
import {writeServiceWorker} from './scripts/service-worker.mjs';
export default defineConfig({
  base: './',
  plugins:[{name:'offline-shell',apply:'build',closeBundle(){writeServiceWorker();}}],
  test:{include:['tests/**/*.test.js'],testTimeout:30000},
  build:{target:'es2022',sourcemap:false}
});
