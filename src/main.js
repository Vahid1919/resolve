/**
 * main.js — the entry point. This is the very first app code the browser runs.
 *
 * index.html loads this file, which:
 *   1. pulls in the global stylesheet (style.css),
 *   2. creates the Vue application from the root component (App.vue),
 *   3. and mounts it into the <div id="app"> element in index.html.
 */

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')
