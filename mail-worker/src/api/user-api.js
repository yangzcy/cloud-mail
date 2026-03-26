import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import accountService from '../service/account-service';

app.delete('/user/delete', async (c) => {
	// 后台按勾选用户执行硬删除入口。
	await userService.physicsDelete(c, c.req.query());
	return c.json(result.ok());
});

app.delete('/user/deleteAll', async (c) => {
	// “一键清理用户”入口，只清理普通用户，保留管理员相关账号。
	const data = await userService.physicsDeleteAllExcludeAdmin(c);
	return c.json(result.ok(data));
});

app.put('/user/setPwd', async (c) => {
	await userService.setPwd(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/setStatus', async (c) => {
	await userService.setStatus(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/setType', async (c) => {
	await userService.setType(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/user/list', async (c) => {
	const data = await userService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/user/add', async (c) => {
	await userService.add(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/resetSendCount', async (c) => {
	await userService.resetSendCount(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/restore', async (c) => {
	await userService.restore(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/user/allAccount', async (c) => {
	const data = await accountService.allAccount(c, c.req.query());
	return c.json(result.ok(data));
});

app.get('/user/allAccountIds', async (c) => {
	// 给前端“全选该用户全部账号”使用，只返回 ID 列表。
	const userId = Number(c.req.query('userId'));
	const data = await accountService.allAccountIds(c, userId);
	return c.json(result.ok(data));
});

app.delete('/user/deleteAccount', async (c) => {
	// 用户详情弹窗里批量删除账号的管理员入口。
	await accountService.physicsDelete(c, c.req.query());
	return c.json(result.ok());
});
