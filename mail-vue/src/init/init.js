import {useUserStore} from "@/store/user.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import router from "@/router";
import {websiteConfig} from "@/request/setting.js";
import i18n from "@/i18n/index.js";

export async function init() {
    document.title = '\u200B'

    const settingStore = useSettingStore();
    const userStore = useUserStore();
    const accountStore = useAccountStore();

    const token = localStorage.getItem('token');
    if (!settingStore.lang) {
        settingStore.lang = 'zh'
    }

    i18n.global.locale.value = settingStore.lang

    let setting = null;

    try {
        if (token) {
            // 已登录时并行拉取站点配置和当前用户信息，减少首屏等待。
            const userPromise = loginUserInfo().catch(e => {
                console.error(e);
                return null;
            });

            const [s, user] = await Promise.all([websiteConfig(), userPromise]);
            setting = s;
            settingStore.settings = setting;
            settingStore.domainList = setting.domainList;
            document.title = setting.title;

            if (user) {
                accountStore.currentAccountId = user.account.accountId;
                accountStore.currentAccount = user.account;
                userStore.user = user;

                // 管理后台路由不是静态写死的，而是按当前用户权限动态挂载。
                const routers = permsToRouter(user.permKeys);
                routers.forEach(routerData => {
                    router.addRoute('layout', routerData);
                });
            }

        } else {
            setting = await websiteConfig();
            settingStore.settings = setting;
            settingStore.domainList = setting.domainList;
            document.title = setting.title;
        }
    } finally {
        removeLoading();
    }
}

function removeLoading() {
    if (window.innerWidth < 1025) {
        // 移动端去掉过渡，避免首屏 loading 遮罩淡出拖慢观感。
        document.documentElement.style.setProperty('--loading-hide-transition', 'none')
    }
    const doc = document.getElementById('loading-first');
    if (!doc) {
        return
    }
    doc.classList.add('loading-hide')
    setTimeout(() => {
        doc.remove()
    },1000)
}
