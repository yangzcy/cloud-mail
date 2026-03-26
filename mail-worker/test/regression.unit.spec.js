import { beforeEach, describe, expect, it, vi } from 'vitest';

const ormMock = vi.fn();
const settingQueryMock = vi.fn();
const turnstileVerifyMock = vi.fn();
const roleSelectByIdMock = vi.fn();
const roleSelectUseMock = vi.fn();
const roleHasAvailDomainPermMock = vi.fn();
const verifyIsEmailMock = vi.fn();
const verifyIsOpenAddMock = vi.fn();
const verifyIncreaseAddCountMock = vi.fn();
const reqGetIpMock = vi.fn();
const reqGetUserAgentMock = vi.fn();
const hashPasswordMock = vi.fn();
const tMock = vi.fn((key) => key);

vi.mock('drizzle-orm', () => ({
	eq: (...args) => ({ op: 'eq', args }),
	sql: (...args) => ({ op: 'sql', args }),
	and: (...args) => ({ op: 'and', args }),
	asc: (...args) => ({ op: 'asc', args }),
	desc: (...args) => ({ op: 'desc', args }),
	gt: (...args) => ({ op: 'gt', args }),
	inArray: (...args) => ({ op: 'inArray', args }),
	count: (...args) => ({ op: 'count', args }),
	ne: (...args) => ({ op: 'ne', args }),
	or: (...args) => ({ op: 'or', args }),
	lt: (...args) => ({ op: 'lt', args })
}));

vi.mock('../src/entity/orm', () => ({ default: ormMock }));
vi.mock('../src/service/setting-service', () => ({
	default: { query: settingQueryMock }
}));
vi.mock('../src/service/turnstile-service', () => ({
	default: { verify: turnstileVerifyMock }
}));
vi.mock('../src/service/role-service', () => ({
	default: {
		selectById: roleSelectByIdMock,
		roleSelectUse: roleSelectUseMock,
		hasAvailDomainPerm: roleHasAvailDomainPermMock
	}
}));
vi.mock('../src/utils/verify-utils', () => ({
	default: { isEmail: verifyIsEmailMock }
}));
vi.mock('../src/utils/email-utils', () => ({
	default: {
		getDomain: (email) => email.split('@')[1],
		getName: (email) => email.split('@')[0]
	}
}));
vi.mock('../src/i18n/i18n', () => ({
	t: tMock
}));
vi.mock('../src/service/verify-record-service', () => ({
	default: {
		isOpenAddVerify: verifyIsOpenAddMock,
		increaseAddCount: verifyIncreaseAddCountMock
	}
}));
vi.mock('../src/utils/req-utils', () => ({
	default: {
		getIp: reqGetIpMock,
		getUserAgent: reqGetUserAgentMock
	}
}));
vi.mock('../src/utils/crypto-utils', () => ({
	default: {
		hashPassword: hashPasswordMock,
		genRandomPwd: vi.fn(() => 'random-password')
	}
}));
vi.mock('../src/service/email-service', () => ({
	default: {
		physicsDeleteUserIds: vi.fn(),
		restoreByUserId: vi.fn()
	}
}));
vi.mock('../src/service/oauth-service', () => ({
	default: {
		deleteByUserIds: vi.fn()
	}
}));
vi.mock('../src/service/perm-service', () => ({
	default: {
		userPermKeys: vi.fn()
	}
}));
vi.mock('../src/const/constant', () => ({
	default: {
		ADMIN_ROLE: {}
	}
}));
vi.mock('../src/entity/account', () => ({
	default: { accountId: 'accountId' }
}));
vi.mock('../src/entity/user', () => ({
	default: { userId: 'userId' }
}));
vi.mock('../src/entity/oauth', () => ({
	oauth: {}
}));

const { isDel, settingConst, roleConst } = await import('../src/const/entity-const');
const { default: accountService } = await import('../src/service/account-service');
const { default: userService } = await import('../src/service/user-service');
const { default: publicService } = await import('../src/service/public-service');

function createOrmApi({ selectGet, updateRun, insertGet, insertRun } = {}) {
	return {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					get: selectGet || vi.fn(),
					all: vi.fn()
				})),
				get: selectGet || vi.fn(),
				all: vi.fn()
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					run: updateRun || vi.fn()
				}))
			}))
		})),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn(() => ({
					get: insertGet || vi.fn()
				})),
				run: insertRun || vi.fn()
			}))
		})),
		delete: vi.fn(() => ({
			where: vi.fn(() => ({
				run: vi.fn()
			}))
		}))
	};
}

describe('soft-delete regression fixes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		settingQueryMock.mockResolvedValue({
			addEmailVerify: settingConst.addEmailVerify.CLOSE,
			addEmail: settingConst.addEmail.OPEN,
			manyEmail: settingConst.manyEmail.OPEN,
			addVerifyCount: 0,
			minEmailPrefix: 1,
			emailPrefixFilter: []
		});
		roleSelectByIdMock.mockResolvedValue({ roleId: 2, accountCount: 0, availDomain: '' });
		roleSelectUseMock.mockResolvedValue([{ roleId: 2, isDefault: roleConst.isDefault.OPEN, name: 'default' }]);
		roleHasAvailDomainPermMock.mockReturnValue(true);
		verifyIsEmailMock.mockReturnValue(true);
		verifyIsOpenAddMock.mockResolvedValue(false);
		verifyIncreaseAddCountMock.mockResolvedValue({ count: 0 });
		reqGetIpMock.mockReturnValue('127.0.0.1');
		reqGetUserAgentMock.mockReturnValue({ os: 'Linux', browser: 'Chrome', device: 'Desktop' });
		hashPasswordMock.mockResolvedValue({ salt: 'salt', hash: 'hash' });
	});

	it('restores a deleted account instead of rejecting account/add', async () => {
		const updateRun = vi.fn().mockResolvedValue(undefined);
		ormMock.mockReturnValue(createOrmApi({ updateRun }));

		const deletedAccount = { accountId: 5, email: 'reuse@example.com', isDel: isDel.DELETE };
		const restoredAccount = { accountId: 5, email: 'reuse@example.com', isDel: isDel.NORMAL };
		vi.spyOn(accountService, 'selectByEmailIncludeDel')
			.mockResolvedValueOnce(deletedAccount)
			.mockResolvedValueOnce(restoredAccount);

		const result = await accountService.add(
			{ env: { domain: ['example.com'], admin: 'admin@example.com' } },
			{ email: 'reuse@example.com' },
			7
		);

		expect(updateRun).toHaveBeenCalledOnce();
		expect(result).toEqual(restoredAccount);
	});

	it('marks linked accounts as deleted when my/delete removes a user', async () => {
		const updateRun = vi.fn().mockResolvedValue(undefined);
		ormMock.mockReturnValue(createOrmApi({ updateRun }));

		const env = { kv: { delete: vi.fn().mockResolvedValue(undefined) } };

		await userService.delete({ env }, 9);

		expect(updateRun).toHaveBeenCalledTimes(2);
		expect(env.kv.delete).toHaveBeenCalledOnce();
	});

	it('restores deleted user/account rows in user/add', async () => {
		const updateRun = vi.fn().mockResolvedValue(undefined);
		ormMock.mockReturnValue(createOrmApi({ updateRun }));

		vi.spyOn(userService, 'selectByEmailIncludeDel').mockResolvedValue({
			userId: 9,
			email: 'restore@example.com',
			isDel: isDel.DELETE
		});
		vi.spyOn(accountService, 'selectByEmailIncludeDel').mockResolvedValue({
			accountId: 4,
			email: 'restore@example.com',
			isDel: isDel.DELETE
		});
		vi.spyOn(userService, 'updateUserInfo').mockResolvedValue(undefined);
		const insertSpy = vi.spyOn(accountService, 'insert');

		await userService.add(
			{ env: { domain: ['example.com'] } },
			{ email: 'restore@example.com', type: 2, password: 'abcdef' }
		);

		expect(updateRun).toHaveBeenCalledTimes(2);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it('restores deleted user/account rows in public/addUser', async () => {
		const selectGet = vi.fn().mockResolvedValue({
			accountId: 12,
			email: 'public@example.com',
			isDel: isDel.DELETE
		});
		const updateRun = vi.fn().mockResolvedValue(undefined);
		ormMock.mockReturnValue(createOrmApi({ selectGet, updateRun }));

		vi.spyOn(userService, 'selectByEmailIncludeDel').mockResolvedValue({
			userId: 11,
			email: 'public@example.com',
			isDel: isDel.DELETE
		});
		const insertSpy = vi.spyOn(userService, 'insert');

		await publicService.addUser(
			{ env: { domain: ['example.com'], db: {} } },
			{ list: [{ email: 'public@example.com', password: 'abcdef' }] }
		);

		expect(updateRun).toHaveBeenCalledTimes(2);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});
