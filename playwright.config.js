import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:false,timeout:60000,
  globalSetup:'./tests/e2e/global-setup.js',
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173/finance-plan-beta/',trace:'retain-on-failure'},
  projects:[{name:'phone',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]
});
