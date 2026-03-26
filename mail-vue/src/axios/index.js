import axios from "axios";
import router from "@/router";
import i18n from "@/i18n/index.js";
import {useSettingStore} from "@/store/setting.js";

let http = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL
});

http.interceptors.request.use(config => {
    const { lang } = useSettingStore();
    // 所有请求统一带上登录 token 和语言头，后端据此做鉴权和多语言返回。
    config.headers.Authorization = `${localStorage.getItem('token')}`
    config.headers['accept-language'] = lang
    return config
})

http.interceptors.response.use((res) => {

        return new Promise((resolve, reject) => {

            const noMsg = res.config.noMsg;
            const data = res.data

            if (noMsg) {

                // noMsg 模式下由调用方自己处理错误提示，这里只负责透传结果。
                data.code === 200 ? resolve(data.data) : reject(data)

            } else if (data.code === 401) {
                ElMessage({
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                localStorage.removeItem('token')
                router.replace('/login')
                reject(data)
            } else if (data.code === 403) {
                ElMessage({
                    message: data.message,
                    type: 'warning',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                reject(data)

            } else if (data.code === 502) {
                ElMessage({
                    dangerouslyUseHTMLString: true,
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                reject(data)
            } else if (data.code !== 200) {
                ElMessage({
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                reject(data)
            }
            resolve(data.data)
        })
    },
    (error) => {

        if (error.status === 403) {
            // 某些极端情况下前端状态与权限状态脱节，直接整页刷新重新初始化。
            location.reload();
            return;
        }

        const noMsg = error.config.noMsg;

        if (noMsg) {
            return Promise.reject(error)
        } else if (error.message.includes('Network Error')) {
            ElMessage({
                message: i18n.global.t('networkErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
        } else if (error.code === 'ECONNABORTED') {
            ElMessage({
                message: i18n.global.t('timeoutErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true
            })
            ElMessage.error('')
        } else if (error.response) {
            ElMessage({
                message: i18n.global.t('serverBusyErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
        } else {
            ElMessage({
                message: i18n.global.t('reqFailErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
        }
        return Promise.reject(error)
    })

export default http

