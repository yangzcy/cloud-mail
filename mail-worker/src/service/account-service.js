import BizError from '../error/biz-error';
import verifyUtils from '../utils/verify-utils';
import emailUtils from '../utils/email-utils';
import userService from './user-service';
import emailService from './email-service';
import orm from '../entity/orm';
import account from '../entity/account';
import { and, asc, eq, gt, inArray, count, sql, ne, or, lt, desc } from 'drizzle-orm';
import {accountConst, isDel, settingConst} from '../const/entity-const';
import settingService from './setting-service';
import turnstileService from './turnstile-service';
import roleService from './role-service';
import { t } from '../i18n/i18n';
import verifyRecordService from './verify-record-service';
import { chunkArray } from '../utils/batch-utils';

const accountService = {

	parseAccountIds(params) {
		const rawIds = params.accountIds ?? params.accountId;
		if (!rawIds && rawIds !== 0) {
			return [];
		}

		const ids = `${rawIds}`
			.split(',')
			.map(id => Number(id))
			.filter(id => Number.isInteger(id) && id > 0);

		return [...new Set(ids)];
	},

	async add(c, params, userId) {

		const { addEmailVerify , addEmail, manyEmail, addVerifyCount, minEmailPrefix, emailPrefixFilter } = await settingService.query(c);

		let { email, token } = params;


		if (!(addEmail === settingConst.addEmail.OPEN && manyEmail === settingConst.manyEmail.OPEN)) {
			throw new BizError(t('addAccountDisabled'));
		}


		if (!email) {
			throw new BizError(t('emptyEmail'));
		}

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		if (!c.env.domain.includes(emailUtils.getDomain(email))) {
			throw new BizError(t('notExistDomain'));
		}

		if (emailUtils.getName(email).length < minEmailPrefix) {
			throw new BizError(t('minEmailPrefix', { msg: minEmailPrefix } ));
		}

		if (emailPrefixFilter.some(content => emailUtils.getName(email).includes(content))) {
			throw new BizError(t('banEmailPrefix'));
		}

		let accountRow = await this.selectByEmailIncludeDel(c, email);

		if (accountRow && accountRow.isDel === isDel.DELETE) {
			await orm(c)
				.update(account)
				.set({
					email,
					userId,
					name: emailUtils.getName(email),
					status: 0,
					isDel: isDel.NORMAL
				})
				.where(eq(account.accountId, accountRow.accountId))
				.run();

			return this.selectByEmailIncludeDel(c, email);
		}

		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		const userRow = await userService.selectById(c, userId);
		const roleRow = await roleService.selectById(c, userRow.type);

		if (userRow.email !== c.env.admin) {

			if (roleRow.accountCount > 0) {
				const userAccountCount = await accountService.countUserAccount(c, userId)
				if(userAccountCount >= roleRow.accountCount) throw new BizError(t('accountLimit'), 403);
			}

			if(!roleService.hasAvailDomainPerm(roleRow.availDomain, email)) {
				throw new BizError(t('noDomainPermAdd'),403)
			}

		}

		let addVerifyOpen = false

		if (addEmailVerify === settingConst.addEmailVerify.OPEN) {
			addVerifyOpen = true
			await turnstileService.verify(c, token);
		}

		if (addEmailVerify === settingConst.addEmailVerify.COUNT) {
			addVerifyOpen = await verifyRecordService.isOpenAddVerify(c, addVerifyCount);
			if (addVerifyOpen) {
				await turnstileService.verify(c,token)
			}
		}


		accountRow = await orm(c).insert(account).values({ email: email, userId: userId, name: emailUtils.getName(email) }).returning().get();

		if (addEmailVerify === settingConst.addEmailVerify.COUNT && !addVerifyOpen) {
			const row = await verifyRecordService.increaseAddCount(c);
			addVerifyOpen = row.count >= addVerifyCount
		}

		accountRow.addVerifyOpen = addVerifyOpen
		return accountRow;
	},

	selectByEmailIncludeDel(c, email) {
		return orm(c).select().from(account).where(sql`${account.email} COLLATE NOCASE = ${email}`).get();
	},

	list(c, params, userId) {

		let { accountId, size, lastSort } = params;

		accountId = Number(accountId);
		size = Number(size);
		lastSort = Number(lastSort);

		if (size > 30) {
			size = 30;
		}

		if (!accountId) {
			accountId = 0;
		}

		if(Number.isNaN(lastSort)) {
			lastSort = 9999999999;
		}

		return orm(c).select().from(account).where(
			and(
				eq(account.userId, userId),
				eq(account.isDel, isDel.NORMAL),
					or(
						lt(account.sort, lastSort),
						and(
							eq(account.sort, lastSort),
							gt(account.accountId, accountId)
						)
					))
				)
			.orderBy(desc(account.sort), asc(account.accountId))
			.limit(size)
			.all();
	},

	async delete(c, params, userId) {

		const user = await userService.selectById(c, userId);
		const accountIds = this.parseAccountIds(params);
		if (accountIds.length === 0) {
			return;
		}

		// 先把要删除的账号分块查出来做权限校验，避免一次性传入过多 accountId。
		const accountList = [];
		for (const batch of chunkArray(accountIds)) {
			const rows = await orm(c)
				.select()
				.from(account)
				.where(and(
					inArray(account.accountId, batch),
					eq(account.isDel, isDel.NORMAL)
				))
				.all();
			accountList.push(...rows);
		}

		if (accountList.length !== accountIds.length) {
			throw new BizError(t('noUserAccount'));
		}

		if (accountList.some(accountRow => accountRow.email === user.email)) {
			throw new BizError(t('delMyAccount'));
		}

		if (accountList.some(accountRow => accountRow.userId !== user.userId)) {
			throw new BizError(t('noUserAccount'));
		}

		// 账号下可能有大量邮件和附件，先级联清理，再删除账号本身。
		await emailService.physicsDeleteByAccountIds(c, accountIds);
		for (const batch of chunkArray(accountIds)) {
			await orm(c).delete(account).where(
				and(
					eq(account.userId, userId),
					inArray(account.accountId, batch)
				))
				.run();
		}
	},

	selectById(c, accountId) {
		return orm(c).select().from(account).where(
			and(eq(account.accountId, accountId),
				eq(account.isDel, isDel.NORMAL)))
			.get();
	},

	async insert(c, params) {
		await orm(c).insert(account).values({ ...params }).returning();
	},

	async insertList(c, list) {
		await orm(c).insert(account).values(list).run();
	},

	async physicsDeleteByUserIds(c, userIds) {
		await emailService.physicsDeleteUserIds(c, userIds);
		if (!userIds || userIds.length === 0) {
			return;
		}

		// 按用户批量删除账号时也要分块，避免“清理用户”类操作再次撞上 D1 限制。
		for (const batch of chunkArray(userIds)) {
			await orm(c).delete(account).where(inArray(account.userId, batch)).run();
		}
	},

	async selectUserAccountCountList(c, userIds, del = isDel.NORMAL) {
		if (!userIds || userIds.length === 0) {
			return [];
		}

		const countMap = new Map();

		// 用户列表页会同时统计很多用户的账号数，这里按块查询后在内存里合并。
		for (const batch of chunkArray([...new Set(userIds)])) {
			const result = await orm(c)
				.select({
					userId: account.userId,
					count: count(account.accountId)
				})
				.from(account)
				.where(and(
					inArray(account.userId, batch),
					eq(account.isDel, del)
				))
				.groupBy(account.userId);

			result.forEach(item => {
				countMap.set(item.userId, (countMap.get(item.userId) || 0) + item.count);
			});
		}

		return [...countMap.entries()].map(([userId, count]) => ({ userId, count }));
	},

	async countUserAccount(c, userId) {
		const { num } = await orm(c).select({num: count()}).from(account).where(and(eq(account.userId, userId),eq(account.isDel, isDel.NORMAL))).get();
		return num;
	},

	async restoreByEmail(c, email) {
		await orm(c).update(account).set({isDel: isDel.NORMAL}).where(eq(account.email, email)).run();
	},

	async restoreByUserId(c, userId) {
		await orm(c).update(account).set({isDel: isDel.NORMAL}).where(eq(account.userId, userId)).run();
	},

	async deleteByUserId(c, userId) {
		await orm(c).update(account).set({ isDel: isDel.DELETE }).where(eq(account.userId, userId)).run();
	},

	async setName(c, params, userId) {
		const { name, accountId } = params
		if (name.length > 30) {
			throw new BizError(t('usernameLengthLimit'));
		}
		await orm(c).update(account).set({name}).where(and(eq(account.userId, userId),eq(account.accountId, accountId))).run();
	},

	async allAccount(c, params) {

		let { userId, num, size } = params

		userId = Number(userId)

		num = Number(num)
		size = Number(size)

		if (size > 30) {
			size = 30;
		}

		num = (num - 1) * size;

		const userRow = await userService.selectByIdIncludeDel(c, userId);

		const list = await orm(c).select().from(account).where(and(eq(account.userId, userId),ne(account.email,userRow.email))).limit(size).offset(num);
		const { total } = await orm(c).select({ total: count() }).from(account).where(eq(account.userId, userId)).get();

		return { list, total }
	},

	async allAccountIds(c, userId) {
		const userRow = await userService.selectByIdIncludeDel(c, userId);
		const list = await orm(c)
			.select({ accountId: account.accountId })
			.from(account)
			.where(and(
				eq(account.userId, userId),
				ne(account.email, userRow.email)
			))
			.all();
		return list.map(item => item.accountId);
	},

	async physicsDelete(c, params) {
		const accountIds = this.parseAccountIds(params);
		if (accountIds.length === 0) {
			return;
		}
		await emailService.physicsDeleteByAccountIds(c, accountIds)
		for (const batch of chunkArray(accountIds)) {
			await orm(c).delete(account).where(inArray(account.accountId, batch)).run();
		}
	},

	async setAllReceive(c, params, userId) {
		let a = null
		const { accountId } = params;
		const accountRow = await this.selectById(c, accountId);
		if (accountRow.userId !== userId) {
			return;
		}
		await orm(c).update(account).set({ allReceive: accountConst.allReceive.CLOSE }).where(eq(account.userId, userId)).run();
		await orm(c).update(account).set({ allReceive: accountRow.allReceive ? 0 : 1 }).where(eq(account.accountId, accountId)).run();
	},

	async setAsTop(c, params, userId) {
		const { accountId } = params;
		console.log(accountId);
		const userRow = await userService.selectById(c, userId);
		const mainAccountRow = await accountService.selectByEmailIncludeDel(c, userRow.email);
		let mainSort = mainAccountRow.sort === 0 ? 2 : mainAccountRow.sort + 1;
		await orm(c).update(account).set({ sort: mainSort }).where(eq(account.email, userRow.email )).run();
		await orm(c).update(account).set({ sort: mainSort - 1 }).where(and(eq(account.accountId, accountId),eq(account.userId,userId))).run();
	}
};

export default accountService;
