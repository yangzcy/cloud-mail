export const SQLITE_CHUNK_SIZE = 50;
export const SQLITE_BATCH_STATEMENT_CHUNK_SIZE = 40;

export function chunkArray(items, size = SQLITE_CHUNK_SIZE) {
	// Cloudflare D1/SQLite 对变量数量比较敏感，批量操作统一走分块，避免 IN (...) 或 db.batch(...) 超限。
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}

	const chunkSize = Math.max(1, Number(size) || SQLITE_CHUNK_SIZE);
	const result = [];

	for (let index = 0; index < items.length; index += chunkSize) {
		result.push(items.slice(index, index + chunkSize));
	}

	return result;
}
