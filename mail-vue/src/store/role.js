import { defineStore } from 'pinia'

export const useRoleStore = defineStore('role', {
    state: () => ({
        // 角色配置变更后的轻量刷新信号，供下拉框和权限页面重新拉取数据。
        refresh: 0,
    }),
    actions: {
        refreshSelect() {
            this.refresh ++
        }
    }
})
