import orm from '../entity/orm';
import { star } from '../entity/star';
import emailService from './email-service';
import BizError from '../error/biz-error';
import { and, desc, eq, lt, sql, inArray } from 'drizzle-orm';
import email from '../entity/email';
import { isDel } from '../const/entity-const';
import attService from "./att-service";
import { t } from '../i18n/i18n'
import { chunkArray } from '../utils/batch-utils';
const starService = {

	async add(c, params, userId) {
		const { emailId } = params;
		const email = await emailService.selectById(c, emailId);
		if (!email) {
			throw new BizError(t('starNotExistEmail'));
		}
		if (!email.userId === userId) {
			throw new BizError(t('starNotExistEmail'));
		}
		const exist = await orm(c).select().from(star).where(
			and(
				eq(star.userId, userId),
				eq(star.emailId, emailId)))
			.get()

		if (exist) {
			return
		}

		await orm(c).insert(star).values({ userId, emailId }).run();
	},

	async cancel(c, params, userId) {
		const { emailId } = params;
		await orm(c).delete(star).where(
			and(
				eq(star.userId, userId),
				eq(star.emailId, emailId)))
			.run();
	},

	async list(c, params, userId) {
		let { emailId, size } = params;
		emailId = Number(emailId);
		size = Number(size);

		if (!emailId) {
			emailId = 9999999999;
		}

		const list = await orm(c).select({
			isStar: sql`1`.as('isStar'),
			starId: star.starId
			, ...email
		}).from(star)
			.leftJoin(email, eq(email.emailId, star.emailId))
			.where(
				and(
					eq(star.userId, userId),
					eq(email.isDel, isDel.NORMAL),
					lt(star.emailId, emailId)))
			.orderBy(desc(star.emailId))
			.limit(size)
			.all();

		const emailIds = list.map(item => item.emailId);

		const attsList = await attService.selectByEmailIds(c, emailIds);

		list.forEach(emailRow => {
			const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
			emailRow.attList = atts;
		});

		return { list };
	},
	async removeByEmailIds(c, emailIds) {
		if (!emailIds || emailIds.length === 0) {
			return;
		}

		// 星标会在邮件硬删除前一并清理，按邮件 ID 分块删除可以避免批量操作超限。
		for (const batch of chunkArray(emailIds)) {
			await orm(c).delete(star).where(inArray(star.emailId, batch)).run();
		}
	},

	async removeByUserIds(c, userIds) {
		if (!userIds || userIds.length === 0) {
			return;
		}

		// 一键清理用户时，用户关联的星标也要同步回收。
		for (const batch of chunkArray(userIds)) {
			await orm(c).delete(star).where(inArray(star.userId, batch)).run();
		}
	},

	async clearAll(c) {
		await orm(c).delete(star).run();
	}
};

export default starService;
