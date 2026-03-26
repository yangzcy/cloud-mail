import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', {
    state: () => ({
        // 当前站点允许使用的邮箱域名列表，写信和创建账号时都会依赖它。
        domainList: [],
        settings: {
            // R2 公开访问域名，用于把邮件正文中的占位图片地址还原成真实 URL。
            r2Domain: '',
            loginOpacity: 1.00,
        },
        // 当前界面语言，供全局切换和初始化使用。
        lang: '',
    }),
    actions: {

    }
})
