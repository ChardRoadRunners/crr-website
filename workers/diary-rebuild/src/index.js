/**
 * Nightly rebuild for the race diary and the club calendars.
 *
 * The diary is worked out at build time from `new Date()`, so without a
 * rebuild it freezes: past races stop dropping off and the twelve-month window
 * stops rolling. The Google calendars are read at build time too, so an event
 * added in Google would never appear. That is exactly how the old
 * hand-maintained calendar died, so this removes the person from the loop.
 *
 * A deploy hook is a URL that starts a build when it receives a POST. Nothing
 * here knows anything about the site — it just rings the bell.
 */
export default {
	async scheduled(event, env, ctx) {
		if (!env.DEPLOY_HOOK_URL) {
			// Thrown rather than logged: a silent no-op here would look like a
			// working cron for months while the diary quietly went stale.
			throw new Error('DEPLOY_HOOK_URL is not set — see workers/diary-rebuild/README.md');
		}

		const response = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });

		if (!response.ok) {
			throw new Error(`Deploy hook returned ${response.status} ${response.statusText}`);
		}

		console.log(`Rebuild requested at ${new Date(event.scheduledTime).toISOString()}`);
	},
};
