import orm from '../entity/orm';
import verifyRecord from '../entity/verify-record';
import { eq, sql, and } from 'drizzle-orm';
import dayjs from 'dayjs';
import reqUtils from '../utils/req-utils';
import { verifyRecordType } from '../const/entity-const';

const verifyRecordService = {

	async selectListByIP(c) {
		// 验证记录按 IP 维度统计，供注册/加号流程动态决定是否开启人机验证。
		const ip = reqUtils.getIp(c)
		return orm(c).select().from(verifyRecord).where(eq(verifyRecord.ip, ip)).all();
	},

	async clearRecord(c) {
		await orm(c).delete(verifyRecord).run();
	},

	async isOpenRegVerify(c, regVerifyCount) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.REG))).get();

		if (row) {
			if (row.count >= regVerifyCount){
				// 只有达到阈值后，当前 IP 的后续注册才强制要求 Turnstile。
				return true
			}

		}

		return false

	},

	async isOpenAddVerify(c, addVerifyCount) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.ADD))).get();

		if (row) {

			if (row.count >= addVerifyCount){
				// 新增账号流程与注册流程分别统计，避免互相影响阈值。
				return true
			}

		}

		return false

	},

	async increaseRegCount(c) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.REG))).get();
		const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

		if (row) {
			// 已有记录则原子自增，否则创建一条新的 IP 统计记录。
			return  orm(c).update(verifyRecord).set({
				count: sql`${verifyRecord.count}
		+ 1`, updateTime: now
			}).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.REG))).returning().get();
		} else {
			return  orm(c).insert(verifyRecord).values({ip, type: verifyRecordType.REG}).returning().run();
		}
	},

	async increaseAddCount(c) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.ADD))).get();
		const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

		if (row) {
			return orm(c).update(verifyRecord).set({
				count: sql`${verifyRecord.count}
		+ 1`, updateTime: now
			}).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.ADD))).returning().get();
		} else {
			return orm(c).insert(verifyRecord).values({ip, type: verifyRecordType.ADD}).returning().get();
		}
	}

};

export default verifyRecordService;
