import http from '@/axios/index.js';

export function regKeyList(params) {
    return http.get('/regKey/list', {params:{...params}})
}

export function regKeyAdd(form) {
    return http.post('/regKey/add',form)
}

export function regKeyDelete(regKeyIds) {
    // 注册码管理页的批量删除入口。
    return http.delete('/regKey/delete?regKeyIds='+ regKeyIds)
}

export function regKeyClearNotUse() {
    // 清理已过期或已用尽注册码。
    return http.delete('/regKey/clearNotUse')
}

export function regKeyHistory(regKeyId) {
    return http.get('/regKey/history', {params:{regKeyId}})
}
