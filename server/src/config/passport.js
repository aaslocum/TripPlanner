import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from './env.js';
import { getDb, get, run } from '../db/connection.js';

export function configurePassport() {
  if (!config.googleClientId || !config.googleClientSecret) {
    console.warn('Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    return;
  }

  passport.use(new GoogleStrategy({
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: config.baseUrl ? `${config.baseUrl}/api/auth/google/callback` : '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const db = await getDb();
      const email = profile.emails?.[0]?.value;
      const googleId = profile.id;
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';
      const avatarUrl = profile.photos?.[0]?.value || null;

      // Check if user exists by google_id or email
      let user = get(db, 'SELECT * FROM users WHERE google_id = ?', [googleId]);
      if (!user && email) {
        user = get(db, 'SELECT * FROM users WHERE email = ?', [email]);
      }

      if (user) {
        // Update existing user with Google info
        run(db, `UPDATE users SET google_id = ?, avatar_url = ?, updated_at = datetime('now') WHERE user_id = ?`,
          [googleId, avatarUrl, user.user_id]);
        user = get(db, 'SELECT * FROM users WHERE user_id = ?', [user.user_id]);
      } else {
        // Reject — only existing users can log in
        return done(null, false, { message: 'not_registered' });
      }

      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.user_id));
  passport.deserializeUser(async (id, done) => {
    const db = await getDb();
    const user = get(db, 'SELECT * FROM users WHERE user_id = ?', [id]);
    done(null, user);
  });
}
