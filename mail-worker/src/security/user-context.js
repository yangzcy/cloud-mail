import JwtUtils from '../utils/jwt-utils';
import constant from '../const/constant';

const userContext = {
	getUserId(c) {
		// user 对象由 security 中间件统一挂到上下文，这里只负责读取，不再重复验权。
		return c.get('user').userId;
	},

	getUser(c) {
		return c.get('user');
	},

	async getToken(c) {
		const jwt = c.req.header(constant.TOKEN_HEADER);
		// 某些场景需要拿到当前会话 token 本体，用于登录态管理或主动下线。
		const { token } = JwtUtils.verifyToken(c,jwt);
		return token;
	},
};
export default userContext;
