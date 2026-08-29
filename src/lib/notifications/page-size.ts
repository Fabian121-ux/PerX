/**
 * Notification list page size.
 *
 * Shared so the route, its unit test and the acceptance test cannot drift apart
 * - the pagination acceptance test previously hard-coded the boundary row,
 * which made a page-size change look like a product regression.
 *
 * 20 matches every other cursor-paginated list in the app (opportunities,
 * deals, proposals). The previous value of 50 was an outlier on a
 * mobile-heavy surface: notification rows are only ~9 KB of data, but each is
 * serialised twice (server HTML plus the RSC flight payload), so page size,
 * not the database projection, is what actually drives the response size.
 */
export const NOTIFICATION_PAGE_SIZE = 20;
