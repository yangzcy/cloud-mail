import BizError from '../error/biz-error';
import settingService from './setting-service';
import { t } from '../i18n/i18n'

const turnstileService = {

	async verify(c, token) {

		if (!token) {
			throw new BizError(t('emptyBotToken'),400);
		}

		const settingRow = await settingService.query(c)

		// Turnstile 校验完全交给 Cloudflare 官方接口，后端只负责透传 token 和当前请求 IP。
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				secret: settingRow.secretKey,
				response: token,
				remoteip: c.req.header('cf-connecting-ip')
			})
		});

		const result = await res.json();

		if (!result.success) {
			// 只要校验未通过，就统一按机器人验证失败处理，不向前端暴露更细粒度细节。
			throw new BizError(t('botVerifyFail'),400)
		}
	}
};

export default turnstileService;
