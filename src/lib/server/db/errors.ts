/** Postgres SQLSTATE 23505 = unique_violation (postgres-js legt den Code auf `.code`). */
export function istUniqueViolation(e: unknown): boolean {
	return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505';
}
