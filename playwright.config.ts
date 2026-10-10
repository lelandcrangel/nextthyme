import { defineConfig } from 'playwright/test';

// Two builds of the same app, because VITE_RECIPES_API is fixed at build time:
//   local  no API configured; recipes live in localStorage and can be edited
//   api    reads /api/recipes.php, read-only. The tests answer that request
//          themselves with page.route, so neither PHP nor a database is needed.
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: './tests',
  projects: [
    { name: 'local', testIgnore: /api-.*\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:5173' } },
    { name: 'api', testMatch: /api-.*\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:5175' } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer,
    },
    {
      command: 'VITE_RECIPES_API=/api/recipes.php npx vite --host 127.0.0.1 --port 5175',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer,
    },
  ],
});
