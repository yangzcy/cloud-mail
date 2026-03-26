import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';

app.get('/allEmail/list', async (c) => {
	const data = await emailService.allList(c, c.req.query());
	return c.json(result.ok(data));
})

app.delete('/allEmail/delete', async (c) => {
	// 管理员对指定邮件做硬删除，通常来自后台批量勾选操作。
	const list = await emailService.physicsDelete(c, c.req.query());
	return c.json(result.ok(list));
})

app.delete('/allEmail/batchDelete', async (c) => {
	// 管理员按条件批量清理邮件的入口。
	await emailService.batchDelete(c, c.req.query());
	return c.json(result.ok());
})

app.delete('/allEmail/deleteAll', async (c) => {
	// 管理后台“一键删除全部邮件”入口。
	await emailService.clearAll(c);
	return c.json(result.ok());
})

app.get('/allEmail/latest', async (c) => {
	const list = await emailService.allEmailLatest(c, c.req.query());
	return c.json(result.ok(list));
})
