import { defineStore } from 'pinia'

export const useSendStore = defineStore('send', {
    state: () => ({
        // 作为发件列表刷新信号使用，发件成功或删除后由相关组件监听。
        deleteId: 0
    })
})
