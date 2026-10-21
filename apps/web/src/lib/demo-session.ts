// Fake sign-in (approved mock): a cookie marks the browser as the seeded demo persona.
// There is no real authentication. Server code reads the persona id from this cookie.
export const DEMO_COOKIE = "demo_user";
export const DEMO_USER_ID = "sofie";
export const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
