import { defineStore } from 'pinia'

export const useEmailStore = defineStore('email', {
    state: () => ({
        // 删除邮件后通过这个字段触发相关列表组件联动刷新。
        deleteIds: 0,
        // 下面几个 scroll 引用用于不同邮件列表组件之间的主动刷新。
        starScroll: null,
        emailScroll: null,
        cancelStarEmailId: 0,
        addStarEmailId: 0,
        contentData: {
            // 当前右侧阅读区展示的邮件数据，跨列表/详情组件共享。
            email: null,
            delType: null,
            showStar: true,
            showReply: true,
            showUnread: false
        },
        sendScroll: null,
    }),
    persist: {
        // 保留阅读区状态，页面刷新后仍能恢复当前查看邮件。
        pick: ['contentData'],
    },
})
