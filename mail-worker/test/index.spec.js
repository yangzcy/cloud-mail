import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('worker auth guards', () => {
	it('rejects protected api requests without login token (unit style)', async () => {
		const request = new Request('http://example.com/api/my/loginUserInfo');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ code: 401 });
	});

	it('rejects protected api requests without login token (integration style)', async () => {
		const response = await SELF.fetch('http://example.com/api/my/loginUserInfo');
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ code: 401 });
	});
});
