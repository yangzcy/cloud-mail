import BizError from '../error/biz-error';
import userService from './user-service';
import emailUtils from '../utils/email-utils';
import { isDel, settingConst, userConst } from '../const/entity-const';
import JwtUtils from '../utils/jwt-utils';
import { v4 as uuidv4 } from 'uuid';
import KvConst from '../const/kv-const';
import constant from '../const/constant';
import userContext from '../security/user-context';
import verifyUtils from '../utils/verify-utils';
import accountService from './account-service';
import settingService from './setting-service';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import turnstileService from './turnstile-service';
import roleService from './role-service';
import regKeyService from './reg-key-service';
import dayjs from 'dayjs';
import { toUtc } from '../utils/date-uitil';
import { t } from '../i18n/i18n.js';
import verifyRecordService from './verify-record-service';

const loginService = {

	async register(c, params, oauth = false) {

		const { email, password, token, code } = params;

		let { regKey, register, registerVerify, regVerifyCount, minEmailPrefix, emailPrefixFilter } = await settingService.query(c)

		if (oauth) {
			// OAuth 补绑邮箱时绕过普通注册开关，但仍复用同一套用户创建逻辑。
			registerVerify = settingConst.registerVerify.CLOSE;
			register = settingConst.register.OPEN;
		}

		if (register === settingConst.register.CLOSE) {
			throw new BizError(t('regDisabled'));
		}

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		if (emailUtils.getName(email).length < minEmailPrefix) {
			throw new BizError(t('minEmailPrefix', { msg: minEmailPrefix } ));
		}

		if (emailPrefixFilter.some(content => emailUtils.getName(email).includes(content)))  {
			throw new BizError(t('banEmailPrefix'));
		}

		if (emailUtils.getName(email).length > 64) {
			throw new BizError(t('emailLengthLimit'));
		}

		if (password.length > 30) {
			throw new BizError(t('pwdLengthLimit'));
		}

		if (password.length < 6) {
			throw new BizError(t('pwdMinLength'));
		}

		if (!c.env.domain.includes(emailUtils.getDomain(email))) {
			throw new BizError(t('notEmailDomain'));
		}

		let type = null;
		let regKeyId = 0

		if (regKey === settingConst.regKey.OPEN) {
			// 强制注册码模式下，注册码决定新用户角色。
			const result = await this.handleOpenRegKey(c, regKey, code)
			type = result?.type
			regKeyId = result?.regKeyId
		}

		if (regKey === settingConst.regKey.OPTIONAL) {
			// 可选注册码模式下，有效注册码可覆盖默认角色。
			const result = await this.handleOpenOptional(c, regKey, code)
			type = result?.type
			regKeyId = result?.regKeyId
		}

		const accountRow = await accountService.selectByEmailIncludeDel(c, email);

		if (accountRow && accountRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelUser'));
		}

		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		let defType = null

		if (!type) {
			const roleRow = await roleService.selectDefaultRole(c);
			defType = roleRow.roleId
		}


		const roleRow = await roleService.selectById(c, type || defType);

		if(!roleService.hasAvailDomainPerm(roleRow.availDomain, email)) {

			if (type) {
				throw new BizError(t('noDomainPermRegKey'),403)
			}

			if (defType) {
				throw new BizError(t('noDomainPermReg'),403)
			}

		}

		let regVerifyOpen = false

		if (registerVerify === settingConst.registerVerify.OPEN) {
			// 全量开启人机验证时，每次注册都验证 Turnstile。
			regVerifyOpen = true
			await turnstileService.verify(c,token)
		}

		if (registerVerify === settingConst.registerVerify.COUNT) {
			// COUNT 模式只在达到阈值后才开启验证，降低首次使用门槛。
			regVerifyOpen = await verifyRecordService.isOpenRegVerify(c, regVerifyCount);
			if (regVerifyOpen) {
				await turnstileService.verify(c,token)
			}
		}

		const { salt, hash } = await saltHashUtils.hashPassword(password);

		const userId = await userService.insert(c, { email, regKeyId,password: hash, salt, type: type || defType });

		// 注册时同时创建同邮箱主账号，后续别名账号都围绕这个 userId 展开。
		await accountService.insert(c, { userId: userId, email, name: emailUtils.getName(email) });

		await userService.updateUserInfo(c, userId, true);

		if (regKey !== settingConst.regKey.CLOSE && type) {
			// 只有真正使用了注册码提升角色时才扣减次数。
			await regKeyService.reduceCount(c, code, 1);
		}

		if (registerVerify === settingConst.registerVerify.COUNT && !regVerifyOpen) {
			const row = await verifyRecordService.increaseRegCount(c);
			return {regVerifyOpen: row.count >= regVerifyCount}
		}

		return {regVerifyOpen}

	},

	async registerVerify() {

	},

	async handleOpenRegKey(c, regKey, code) {

		if (!code) {
			throw new BizError(t('emptyRegKey'));
		}

		const regKeyRow = await regKeyService.selectByCode(c, code);

		if (!regKeyRow) {
			throw new BizError(t('notExistRegKey'));
		}

		if (regKeyRow.count <= 0) {
			throw new BizError(t('noRegKeyCount'));
		}

		const today = toUtc().tz('Asia/Shanghai').startOf('day')
		const expireTime = toUtc(regKeyRow.expireTime).tz('Asia/Shanghai').startOf('day');

		if (expireTime.isBefore(today)) {
			throw new BizError(t('regKeyExpire'));
		}

		return { type: regKeyRow.roleId, regKeyId: regKeyRow.regKeyId };
	},

	async handleOpenOptional(c, regKey, code) {

		if (!code) {
			return null
		}

		const regKeyRow = await regKeyService.selectByCode(c, code);

		if (!regKeyRow) {
			return null
		}

		const today = toUtc().tz('Asia/Shanghai').startOf('day')
		const expireTime = toUtc(regKeyRow.expireTime).tz('Asia/Shanghai').startOf('day');

		if (regKeyRow.count <= 0 || expireTime.isBefore(today)) {
			return null
		}

		return { type: regKeyRow.roleId, regKeyId: regKeyRow.regKeyId };
	},

	async login(c, params, noVerifyPwd = false) {

		const { email, password } = params;

		if ((!email || !password) && !noVerifyPwd) {
			throw new BizError(t('emailAndPwdEmpty'));
		}

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (!userRow) {
			throw new BizError(t('notExistUser'));
		}

		if(userRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelUser'));
		}

		if(userRow.status === userConst.status.BAN) {
			throw new BizError(t('isBanUser'));
		}

		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password) && !noVerifyPwd) {
			throw new BizError(t('IncorrectPwd'));
		}

		const uuid = uuidv4();
		const jwt = await JwtUtils.generateToken(c,{ userId: userRow.userId, token: uuid });

		let authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userRow.userId, { type: 'json' });

		if (authInfo && (authInfo.user.email === userRow.email)) {

			// 同一用户保留最近 10 个会话 token，旧 token 会被挤掉，实现有限多端登录。
			if (authInfo.tokens.length > 10) {
				authInfo.tokens.shift();
			}

			authInfo.tokens.push(uuid);

		} else {

			// 首次登录时在 KV 中创建该用户的会话容器。
			authInfo = {
				tokens: [],
				user: userRow,
				refreshTime: dayjs().toISOString()
			};

			authInfo.tokens.push(uuid);

		}

		await userService.updateUserInfo(c, userRow.userId);

		// JWT 只放最小身份信息，真正的会话白名单放在 KV 中便于主动失效和多端控制。
		await c.env.kv.put(KvConst.AUTH_INFO + userRow.userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
		return jwt;
	},

	async logout(c, userId) {
		// 退出登录时只移除当前 token，不影响该用户其他设备上的会话。
		const token =userContext.getToken(c);
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		const index = authInfo.tokens.findIndex(item => item === token);
		authInfo.tokens.splice(index, 1);
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo));
	}

};

export default loginService;
