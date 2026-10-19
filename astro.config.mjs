import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alanjust.com',
  server: { port: 4322 },
  integrations: [sitemap({ filter: page => !page.includes('/portal') })],
});
