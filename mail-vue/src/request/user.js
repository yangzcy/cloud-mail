import http from '@/axios/index.js'


export function userList(params) {
    return http.get('/user/list', {params: {...params}})
}

export function userSetPwd(params) {
    return http.put('/user/setPwd', params)
}

export function userSetStatus(params) {
    return http.put('/user/setStatus', params)
}

export function userSetType(params) {
    return http.put('/user/setType', params)
}


export function userDelete(userIds) {
    // 用户页批量删除入口，后端会继续级联清理账号、邮件、附件和 OAuth。
    return http.delete('/user/delete', {params:{userIds: userIds + ''}})
}

export function userDeleteAll() {
    // 管理后台“一键清理用户”入口，只清理普通用户。
    return http.delete('/user/deleteAll')
}

export function userAdd(form) {
    return http.post('/user/add', form)
}

export function userRestSendCount(userId) {
    return http.put('/user/resetSendCount', {userId})
}

export function userRestore(userId,type) {
    return http.put('/user/restore', {userId,type})
}

export function userAllAccount(userId, num, size) {
    // 用户详情弹窗中的账号分页列表。
    return http.get('/user/allAccount', {params:{userId,num,size}})
}

export function userAllAccountIds(userId) {
    // 给“全选该用户全部账号”使用，返回完整 ID 列表而不是当前页数据。
    return http.get('/user/allAccountIds', {params:{userId}})
}

export function userDeleteAccount(accountIds) {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds
    // 管理员在用户详情弹窗内批量删除账号。
    return http.delete('/user/deleteAccount', {params:{accountIds: ids}})
}
