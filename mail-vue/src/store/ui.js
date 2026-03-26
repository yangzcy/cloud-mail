import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
    state: () => ({
        // 桌面端默认展开侧边栏，移动端默认收起。
        asideShow: window.innerWidth > 1024,
        // 是否在邮件列表里额外显示账号列/账号切换区。
        accountShow: false,
        backgroundLoading: true,
        // 以下两个字段作为全局消息/预览的刷新信号使用。
        changeNotice: 0,
        writerRef: null,
        changePreview: 0,
        previewData: {},
        // 某些需要强制重建的组件会监听 key。
        key: 0,
        dark: false,
        // 左侧导航上的计数汇总，供不同列表组件回填。
        asideCount: {
            email: 0,
            send: 0,
            sysEmail: 0
        }
    }),
    actions: {
        showNotice() {
            this.changeNotice ++
        },
        previewNotice(data) {
            // 预览内容通过 store 广播，避免多层组件手动透传。
            this.previewData = data
            this.changePreview ++
        }
    },
    persist: {
        // 这里只持久化纯 UI 偏好，不存临时运行态引用。
        pick: ['accountShow','dark'],
    },
})
