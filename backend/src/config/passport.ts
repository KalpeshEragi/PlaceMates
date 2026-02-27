import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
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
                return done(err as Error);
            }
        }
    )
);
passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: "http://localhost:5000/api/auth/github/callback",
            scope: ["user", "repo"],
            passReqToCallback: true, // ⭐ IMPORTANT
        },
        async (req: any, accessToken: string, _refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
            try {
                const githubId = profile.id;

                // ⭐ get logged-in user from JWT middleware
                const userId = req.userId;

                if (!userId) {
                    return done(new Error("User not authenticated before GitHub connect"));
                }

                // upsert oauth link — always store latest accessToken
                await prisma.oAuthAccount.upsert({
                    where: {
                        provider_providerUserId: {
                            provider: "github",
                            providerUserId: githubId,
                        },
                    },
                    update: { accessToken },
                    create: {
                        provider: "github",
                        providerUserId: githubId,
                        userId,
                        accessToken,
                    },
                });

                // fetch repos
                const reposRes = await fetch("https://api.github.com/user/repos", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/vnd.github+json",
                    },
                });

                const repos = await reposRes.json();

                // store repos in profile JSON
                await prisma.userProfile.update({
                    where: { userId },
                    data: {
                        importedData: {
                            githubRepos: repos,
                        },
                    },
                });

                const user = await prisma.userAuth.findUnique({
                    where: { id: userId },
                });

                return done(null, user);
            } catch (err) {
                return done(err as Error);
            }
        }
    )
);

export default passport;