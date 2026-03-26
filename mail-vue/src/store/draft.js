import { defineStore } from 'pinia'

export const userDraftStore = defineStore('draft', {
    state: () => ({
        // 草稿列表刷新信号，新增/删除草稿后通过它通知列表组件重载。
        refreshList: 0,
        // 当前正在编辑或刚保存的草稿内容，用于草稿页和写信窗口之间同步。
        setDraft: {},
    })
})
