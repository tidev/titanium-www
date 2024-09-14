import { PGlite } from '@electric-sql/pglite';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';

let cachedDb: PgliteDatabase;

export function getDb(forceNew = false) {
    if (!forceNew && cachedDb) {
        return cachedDb;
    }

    const client = new PGlite();
    cachedDb = drizzle(client, {
        // logger: true
    });

    return cachedDb;
}
