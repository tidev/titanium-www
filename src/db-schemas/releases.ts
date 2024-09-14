import { integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const releasesTable = pgTable(
	'releases',
	{
		id: serial('id').primaryKey(),
		name: varchar('name', { length: 64 }).notNull(),
		version: varchar('version', { length: 64 }).notNull(),
		publishDate: timestamp('published_at').notNull(),
		type: varchar('type', { length: 16 }).notNull(), // beta, rc, ga, branch
		branch: varchar('branch', { length: 16 }),
		expiresAt: timestamp('expires_at'),
		url: varchar('url', { length: 256 }).notNull()
	}
);

export const releaseAssetsTable = pgTable(
	'release_assets',
	{
		assetId: serial('asset_id').primaryKey(),
		releaseId: integer('release_id').notNull(),
		os: varchar('os', { length: 8 }).notNull(),
		size: integer('size').notNull(),
		url: varchar('url', { length: 256 }).notNull()
	}
);
