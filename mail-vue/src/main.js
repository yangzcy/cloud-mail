import {createApp} from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';
import { init } from '@/init/init.js';
import { createPinia } from 'pinia';
import piniaPersistedState from 'pinia-plugin-persistedstate';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import perm from "@/perm/perm.js";
const pinia = createPinia().use(piniaPersistedState)
import i18n from "@/i18n/index.js";
const app = createApp(App).use(pinia)

try {
    // 在挂载应用前先完成初始化，确保语言、配置、动态路由和用户信息都已就绪。
    await init()
} catch (error) {
    console.error('init failed', error)
    window.hideFirstLoading?.()
}

app.use(router).use(i18n).directive('perm',perm)
app.config.devtools = true;

app.mount('#app');
