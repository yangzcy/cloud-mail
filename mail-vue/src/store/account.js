    import { defineStore } from 'pinia'

export const useAccountStore = defineStore('account', {
    state: () => ({
        // 当前正在查看的账号 ID，邮件列表和写信面板都会依赖它。
        currentAccountId: 0,
        // 当前账号的完整对象缓存，减少组件之间重复查询。
        currentAccount: {},
        // 账号名编辑后的临时同步字段，用于跨组件刷新显示名称。
        changeUserAccountName: ''
    })
})
