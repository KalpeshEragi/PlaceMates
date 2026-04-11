import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../lib/prisma";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: "http://localhost:5000/api/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const googleId = profile.id;
                const email = profile.emails?.[0]?.value!;
                const name = profile.displayName;
                const avatar = profile.photos?.[0]?.value;

                // 1️⃣ check existing oauth
                const existingOAuth = await prisma.oAuthAccount.findUnique({
                    where: {
                        provider_providerUserId: {
                            provider: "google",
                            providerUserId: googleId,
                        },
                    },
                    include: { user: true },
                });

                if (existingOAuth) return done(null, existingOAuth.user);

                // 2️⃣ check email user exists
                let user = await prisma.userAuth.findUnique({
                    where: { email },
                });

                // 3️⃣ create user if not exists
                if (!user) {
                    user = await prisma.userAuth.create({
                        data: {
                            email,
                            profile: {
                                create: {
                                    name,
                                    avatarUrl: avatar,
                                },
                            },
                        },
                    });
                }

                // 4️⃣ link oauth
                await prisma.oAuthAccount.create({
                    data: {
                        provider: "google",
                        providerUserId: googleId,
                        userId: user.id,
                    },
                });

                return done(null, user);
            } catch (err) {
                // #region agent log
                const msg = err instanceof Error ? err.message : String(err);
                fetch("http://127.0.0.1:7372/ingest/208aecbf-33e3-48e5-a39c-cca6cae8bcad", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "e6603f",
                    },
                    body: JSON.stringify({
                        sessionId: "e6603f",
                        location: "passport.ts:googleStrategy:catch",
                        message: "Google OAuth strategy error",
                        data: {
                            hypothesisId: "H1",
                            errSnippet: msg.slice(0, 280),
                            columnMissing: /does not exist/i.test(msg),
                        },
                        timestamp: Date.now(),
                        runId: "pre-migrate",
                    }),
                }).catch(() => {});
                // #endregion
                return done(err as Error);
            }
        }
    )
);

export default passport;