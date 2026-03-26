import http from '@/axios/index.js';

export function allEmailList(params) {
    return http.get('/allEmail/list', {params: {...params}})
}

export function allEmailDelete(emailIds) {
    // 管理员后台对指定邮件做硬删除。
    return http.delete('/allEmail/delete?emailIds=' + emailIds)
}

export function allEmailBatchDelete(params) {
    // 管理员按筛选条件批量清理邮件。
    return http.delete('/allEmail/batchDelete', {params: params} )
}

export function allEmailDeleteAll() {
    // 管理员一键清理全部邮件。
    return http.delete('/allEmail/deleteAll')
}

export function allEmailLatest(emailId) {
    return http.get('/allEmail/latest', {params: {emailId}, noMsg: true, timeout: 35 * 1000})
}
