// @ts-check

import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import astroReader from 'astro-reader';
import { defineConfig, fontProviders } from 'astro/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://astro.build/config
export default defineConfig({
	site: 'https://sgalcheung.github.io',
	base: '/astro-reader',
	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: 'Noto Sans SC',
			cssVariable: '--font-noto-sans-sc',
			subsets: ['chinese-simplified'],
			formats: ['ttf'],
		},
	],
	integrations: [
		astroReader({
			// enableProxy:true // SSR required
		}),
		starlight({
			title: 'Starlight PDF Viewer',
			routeMiddleware: './src/routeMiddleware.ts',
			pagefind: false,
			social: [
				{
					icon: 'github',
					label: 'GitLab',
					href: 'https://github.com/sgalcheung/astro-reader',
				},
			],
		}),
		react(),
	],

	vite: {
		plugins: [
			viteStaticCopy({
				targets: [
					{
						src: 'node_modules/pdfjs-dist/cmaps/**/*',
						dest: 'cmaps',
						rename: { stripBase: 3 },
					},
				],
			}),
			tailwindcss(),
		],
		optimizeDeps: {
			include: ['react-resizable-panels'],
		},
		build: {
			commonjsOptions: {
				include: [/react-resizable-panels/, /node_modules/],
			},
		},
	},
});
