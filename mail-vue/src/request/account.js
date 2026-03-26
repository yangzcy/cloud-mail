import http from '@/axios/index.js'

export function accountList(accountId, size, lastSort) {
    return http.get('/account/list', {params: {accountId, size, lastSort}});
}

export function accountSelectableIds() {
    // 账号列表“全选全部结果”时使用，避免只选中当前已加载列表。
    return http.get('/account/selectableIds');
}

export function accountAdd(email,token) {
    return http.post('/account/add', {email,token})
}

export function accountSetName(accountId,name) {
    return http.put('/account/setName', {name,accountId})
}

export function accountDelete(accountIds) {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds
    // 当前用户账号页的批量删除入口。
    return http.delete('/account/delete', {params: {accountIds: ids}})
}

export function accountSetAllReceive(accountId) {
    return http.put('/account/setAllReceive', {accountId})
}

export function accountSetAsTop(accountId) {
    return http.put('/account/setAsTop', {accountId})
}
