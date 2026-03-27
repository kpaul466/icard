import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {defineConfig, loadEnv} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Load from firebase-applet-config.json if it exists (for AI Studio preview)
  let firebaseEnv: Record<string, string> = {};
  const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
      firebaseEnv = {
        VITE_FIREBASE_API_KEY: config.apiKey,
        VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
        VITE_FIREBASE_PROJECT_ID: config.projectId,
        VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
        VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
        VITE_FIREBASE_APP_ID: config.appId,
        VITE_FIREBASE_FIRESTORE_DATABASE_ID: config.firestoreDatabaseId,
      };
    } catch (e) {
      console.error('Failed to parse firebase-applet-config.json', e);
    }
  }

  // Merge environment variables: process.env > firebase-applet-config.json > .env files
  const finalEnv = { ...firebaseEnv, ...env };

  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['mask-icon.svg'],
        devOptions: {
          enabled: true,
          type: 'module',
        },
        manifest: {
          name: 'Falakata CCC ID Management',
          short_name: 'Falakata CCC',
          description: 'Employee ID Management Portal for Falakata Customer Care Center',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'mask-icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'mask-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'mask-icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'maskable'
            },
            {
              src: 'mask-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(finalEnv.GEMINI_API_KEY),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(finalEnv.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(finalEnv.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(finalEnv.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(finalEnv.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(finalEnv.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(finalEnv.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID': JSON.stringify(finalEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
