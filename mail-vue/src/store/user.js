import { defineStore } from 'pinia'
import {loginUserInfo} from "@/request/my.js";

export const useUserStore = defineStore('user', {
    state: () => ({
        // 当前登录用户的完整资料，包含权限、角色和主账号信息。
        user: {},
        // 作为轻量级刷新信号使用，依赖它的组件会在值变化时重新拉取数据。
        refreshList: 0,
    }),
    actions: {
        refreshUserList() {
            // 仅广播“用户列表相关数据已变化”，避免为刷新信号额外请求用户详情。
            this.refreshList ++
        },
        refreshUserInfo() {
            loginUserInfo().then(user => {
                // 需要立即拿到最新用户资料时，直接覆盖 user 状态。
                this.user = user
            })
        }
    }
})
