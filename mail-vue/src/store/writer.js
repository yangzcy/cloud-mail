import { defineStore } from 'pinia'

export const useWriterStore = defineStore('writer', {
    state: () => ({
        // 写信时的收件人历史记录，用于输入建议和联系人弹窗。
        sendRecipientRecord: []
    }),
    persist: {
        // 收件人历史需要跨刷新保留，否则自动补全体验会中断。
        pick: ['sendRecipientRecord'],
    },
})
