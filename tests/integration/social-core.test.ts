import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as databaseModule from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { setCachedDataModeForTest } from "@/lib/env";
import * as actions from "@/features/social/actions";
import { getSocialFeed, getSocialPost } from "@/lib/data/social-posts";
import {
  authorizationFixtures,
  createAuthorizationDatabase,
  withAuthorizationTransaction,
  type AuthorizationFixtures,
} from "../utils/authorization-fixtures";
import { getIsolatedTestDatabaseUrl } from "../e2e/utils/db-guard";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined),
    has: (n: string) => jar.has(n),
    set: (n: string, v: string) => jar.set(n, v),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const url = getIsolatedTestDatabaseUrl();
const suite = url ? describe : describe.skip;
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const idle = { status: "idle" as const };
suite("social core production authorization and PostgreSQL persistence", () => {
  let database: ReturnType<typeof createAuthorizationDatabase>;
  beforeAll(() => {
    database = createAuthorizationDatabase();
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("DIRECT_URL", process.env.TEST_DIRECT_URL || url!);
    setCachedDataModeForTest("database");
  });
  afterAll(async () => {
    await database?.$disconnect();
    setCachedDataModeForTest(undefined);
    vi.unstubAllEnvs();
  });
  function dbTest(
    name: string,
    run: (f: AuthorizationFixtures) => Promise<void>,
  ) {
    it(
      name,
      async () => {
        jar.clear();
        await withAuthorizationTransaction(database, async (prisma) => {
          const spy = vi
            .spyOn(databaseModule, "getPrisma")
            .mockReturnValue(prisma);
          try {
            await run(authorizationFixtures(prisma));
          } finally {
            spy.mockRestore();
            jar.clear();
          }
        });
      },
      20000,
    );
  }
  async function login(id: string) {
    jar.clear();
    await createSession(id);
  }
  async function post(f: AuthorizationFixtures, authorId: string) {
    return f.prisma.post.create({
      data: {
        authorId,
        body: "Founder progress update",
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        publishedAt: new Date(),
      },
    });
  }
  dbTest(
    "member creates a trimmed post using session author, ignoring submitted identity and moderation",
    async (f) => {
      const a = await f.user(),
        b = await f.user();
      await login(a.id);
      const result = await actions.createPostAction(
        idle,
        form({
          body: "  A useful update  ",
          userId: b.id,
          authorId: b.id,
          moderationStatus: "REJECTED",
        }),
      );
      expect(result.status).toBe("success");
      expect(
        await f.prisma.post.findUnique({ where: { id: result.id! } }),
      ).toMatchObject({
        authorId: a.id,
        body: "A useful update",
        moderationStatus: "APPROVED",
      });
      expect(
        await f.prisma.auditLog.count({
          where: { entityId: result.id, action: "social.post.created" },
        }),
      ).toBe(1);
    },
  );
  dbTest("guest cannot create a post", async (f) => {
    const before = await f.prisma.post.count();
    await expect(
      actions.createPostAction(idle, form({ body: "Attempt" })),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("/sign-in?next="),
    });
    expect(await f.prisma.post.count()).toBe(before);
  });
  for (const body of [" \n ", "x".repeat(5001)])
    dbTest(`rejects invalid post length ${body.length}`, async (f) => {
      const a = await f.user();
      await login(a.id);
      expect(
        (await actions.createPostAction(idle, form({ body }))).status,
      ).toBe("error");
      expect(await f.prisma.post.count({ where: { authorId: a.id } })).toBe(0);
    });
  for (const operation of ["edit", "delete"] as const)
    for (const own of [true, false])
      dbTest(`${own ? "owner" : "non-owner"} ${operation} post`, async (f) => {
        const a = await f.user(),
          b = await f.user();
        const p = await post(f, a.id);
        await login(own ? a.id : b.id);
        const action =
          operation === "edit"
            ? actions.editPostAction
            : actions.deletePostAction;
        expect(
          (await action(idle, form({ postId: p.id, body: "Edited update" })))
            .status,
        ).toBe(own ? "success" : "error");
        const row = await f.prisma.post.findUniqueOrThrow({
          where: { id: p.id },
        });
        expect(row.body).toBe(
          own && operation === "edit" ? "Edited update" : p.body,
        );
        expect(Boolean(row.deletedAt)).toBe(own && operation === "delete");
      });
  dbTest(
    "feed and direct detail use the same public filters without viewer state",
    async (f) => {
      const a = await f.user();
      const p = await post(f, a.id);
      const result = await getSocialFeed();
      expect(result.items.map((x) => x.id)).toContain(p.id);
      expect(result.items.find((x) => x.id === p.id)).not.toHaveProperty(
        "viewerReaction",
      );
      for (const data of [
        { status: "DRAFT" as const },
        { moderationStatus: "REJECTED" as const },
        { deletedAt: new Date() },
      ]) {
        const hidden = await f.prisma.post.create({
          data: {
            authorId: a.id,
            body: "Hidden control",
            status: "PUBLISHED",
            moderationStatus: "APPROVED",
            publishedAt: new Date(),
            ...data,
          },
        });
        expect(await getSocialPost(hidden.id)).toBeNull();
        expect((await getSocialFeed()).items.map((x) => x.id)).not.toContain(
          hidden.id,
        );
      }
    },
  );
  for (const reverse of [false, true])
    dbTest(
      `bidirectional blocks exclude post, comment, counts and mutations (${reverse})`,
      async (f) => {
        const a = await f.user(),
          b = await f.user(),
          c = await f.user();
        const p = await post(f, a.id),
          other = await post(f, c.id);
        await f.prisma.postComment.create({
          data: { postId: other.id, authorId: a.id, body: "Blocked comment" },
        });
        await f.prisma.postReaction.create({
          data: { postId: other.id, userId: a.id, kind: "LIKE" },
        });
        await f.prisma.blockedUser.create({
          data: {
            blockerUserId: reverse ? b.id : a.id,
            blockedUserId: reverse ? a.id : b.id,
          },
        });
        expect(await getSocialPost(p.id, b.id)).toBeNull();
        expect(
          (await getSocialFeed(b.id)).items.map((x) => x.id),
        ).not.toContain(p.id);
        const detail = await getSocialPost(other.id, b.id);
        expect(detail?.post.commentCount).toBe(0);
        expect(detail?.post.reactionCount).toBe(0);
        expect(detail?.comments).toHaveLength(0);
        await login(b.id);
        expect(
          (
            await actions.setPostReactionAction(
              idle,
              form({ postId: p.id, kind: "LIKE" }),
            )
          ).status,
        ).toBe("error");
        expect(
          (
            await actions.createCommentAction(
              idle,
              form({ postId: p.id, body: "Blocked" }),
            )
          ).status,
        ).toBe("error");
      },
    );
  dbTest(
    "reactions are idempotent desired state, replace atomically, clear and count on the server",
    async (f) => {
      const a = await f.user(),
        b = await f.user();
      const p = await post(f, a.id);
      await login(b.id);
      for (let i = 0; i < 2; i++)
        expect(
          (
            await actions.setPostReactionAction(
              idle,
              form({ postId: p.id, kind: "LIKE", userId: a.id }),
            )
          ).status,
        ).toBe("success");
      expect(
        await f.prisma.postReaction.count({ where: { postId: p.id } }),
      ).toBe(1);
      expect(
        await f.prisma.postReaction.findFirst({ where: { postId: p.id } }),
      ).toMatchObject({ userId: b.id, kind: "LIKE" });
      await actions.setPostReactionAction(
        idle,
        form({ postId: p.id, kind: "SUPPORT" }),
      );
      expect((await getSocialPost(p.id, b.id))?.post).toMatchObject({
        reactionCount: 1,
        viewerReaction: "SUPPORT",
      });
      await actions.setPostReactionAction(
        idle,
        form({ postId: p.id, kind: "" }),
      );
      expect((await getSocialPost(p.id))?.post.reactionCount).toBe(0);
    },
  );
  dbTest(
    "PostgreSQL enforces unique reaction and foreign keys; cascades only to children",
    async (f) => {
      const a = await f.user();
      const p = await post(f, a.id);
      await f.prisma.postReaction.create({
        data: { postId: p.id, userId: a.id, kind: "LIKE" },
      });
      await expect(
        f.prisma.$transaction((tx) =>
          tx.postReaction.create({
            data: { postId: p.id, userId: a.id, kind: "SUPPORT" },
          }),
        ),
      ).rejects.toMatchObject({ code: "P2002" });
      await expect(
        f.prisma.$transaction((tx) =>
          tx.postComment.create({
            data: { postId: "missing", authorId: a.id, body: "Orphan" },
          }),
        ),
      ).rejects.toMatchObject({ code: "P2003" });
      await f.prisma.postComment.create({
        data: { postId: p.id, authorId: a.id, body: "Child" },
      });
      await f.prisma.post.delete({ where: { id: p.id } });
      expect(
        await f.prisma.postReaction.count({ where: { postId: p.id } }),
      ).toBe(0);
      expect(
        await f.prisma.postComment.count({ where: { postId: p.id } }),
      ).toBe(0);
      expect(
        await f.prisma.user.findUnique({ where: { id: a.id } }),
      ).not.toBeNull();
    },
  );
  for (const action of ["reaction", "comment"] as const)
    dbTest(`guest ${action} redirects safely to the same post`, async (f) => {
      const a = await f.user();
      const p = await post(f, a.id);
      const call =
        action === "reaction"
          ? actions.setPostReactionAction
          : actions.createCommentAction;
      await expect(
        call(
          idle,
          form({
            postId: p.id,
            body: "Guest",
            kind: "LIKE",
            next: "https://evil.example",
          }),
        ),
      ).rejects.toMatchObject({
        digest: `NEXT_REDIRECT;replace;/sign-in?next=${encodeURIComponent(`/posts/${p.id}`)};307;`,
      });
      expect(
        await f.prisma.postReaction.count({ where: { postId: p.id } }),
      ).toBe(0);
      expect(
        await f.prisma.postComment.count({ where: { postId: p.id } }),
      ).toBe(0);
    });
  dbTest(
    "member comments using session author and counts exclude soft-deleted comments",
    async (f) => {
      const a = await f.user(),
        b = await f.user();
      const p = await post(f, a.id);
      await login(b.id);
      const r = await actions.createCommentAction(
        idle,
        form({
          postId: p.id,
          body: "  Great progress  ",
          authorId: a.id,
          userId: a.id,
        }),
      );
      expect(r.status).toBe("success");
      expect(
        await f.prisma.postComment.findUnique({ where: { id: r.id! } }),
      ).toMatchObject({ authorId: b.id, body: "Great progress" });
      expect((await getSocialPost(p.id))?.post.commentCount).toBe(1);
      await actions.deleteCommentAction(
        idle,
        form({ postId: p.id, commentId: r.id! }),
      );
      expect((await getSocialPost(p.id))?.post.commentCount).toBe(0);
      expect((await getSocialPost(p.id))?.comments).toHaveLength(0);
    },
  );
  for (const body of [" \n ", "x".repeat(2001)])
    dbTest(`rejects invalid comment length ${body.length}`, async (f) => {
      const a = await f.user();
      const p = await post(f, a.id);
      await login(a.id);
      expect(
        (await actions.createCommentAction(idle, form({ postId: p.id, body })))
          .status,
      ).toBe("error");
      expect(
        await f.prisma.postComment.count({ where: { postId: p.id } }),
      ).toBe(0);
    });
  for (const operation of ["edit", "delete"] as const)
    for (const own of [true, false])
      dbTest(
        `${own ? "owner" : "other user (including post author)"} ${operation} comment`,
        async (f) => {
          const a = await f.user(),
            b = await f.user();
          const p = await post(f, a.id);
          const c = await f.prisma.postComment.create({
            data: { postId: p.id, authorId: b.id, body: "Original" },
          });
          await login(own ? b.id : a.id);
          const call =
            operation === "edit"
              ? actions.editCommentAction
              : actions.deleteCommentAction;
          expect(
            (
              await call(
                idle,
                form({ postId: p.id, commentId: c.id, body: "Edited" }),
              )
            ).status,
          ).toBe(own ? "success" : "error");
          const row = await f.prisma.postComment.findUniqueOrThrow({
            where: { id: c.id },
          });
          expect(row.body).toBe(
            own && operation === "edit" ? "Edited" : "Original",
          );
          expect(Boolean(row.deletedAt)).toBe(own && operation === "delete");
        },
      );
  dbTest(
    "moderators hide posts/comments with atomic audit; hidden content rejects engagement",
    async (f) => {
      const a = await f.user(),
        admin = await f.user(["ADMIN"]);
      const p = await post(f, a.id);
      const c = await f.prisma.postComment.create({
        data: { postId: p.id, authorId: a.id, body: "Review this" },
      });
      await login(a.id);
      expect(
        (
          await actions.moderateSocialAction(
            idle,
            form({
              targetType: "post",
              targetId: p.id,
              reason: "Safety review",
            }),
          )
        ).status,
      ).toBe("error");
      await login(admin.id);
      expect(
        (
          await actions.moderateSocialAction(
            idle,
            form({
              targetType: "comment",
              targetId: c.id,
              reason: "Safety review",
            }),
          )
        ).status,
      ).toBe("success");
      expect((await getSocialPost(p.id))?.comments).toHaveLength(0);
      expect(
        (
          await actions.moderateSocialAction(
            idle,
            form({
              targetType: "post",
              targetId: p.id,
              reason: "Safety review",
            }),
          )
        ).status,
      ).toBe("success");
      expect(await getSocialPost(p.id)).toBeNull();
      expect(
        await f.prisma.moderationAction.count({ where: { entityId: p.id } }),
      ).toBe(1);
      expect(
        await f.prisma.auditLog.count({
          where: { entityId: p.id, action: "social.post.hidden" },
        }),
      ).toBe(1);
      await login(a.id);
      for (const call of [
        actions.setPostReactionAction,
        actions.createCommentAction,
      ])
        expect(
          (
            await call(
              idle,
              form({ postId: p.id, kind: "LIKE", body: "Unavailable" }),
            )
          ).status,
        ).toBe("error");
      expect(
        (
          await actions.editPostAction(
            idle,
            form({ postId: p.id, body: "Bypass rejection" }),
          )
        ).status,
      ).toBe("error");
    },
  );
  dbTest(
    "session revocation and publishing restriction prevent mutations",
    async (f) => {
      const a = await f.user();
      const p = await post(f, a.id);
      await login(a.id);
      await f.prisma.user.update({
        where: { id: a.id },
        data: { publishingRestrictedUntil: new Date(Date.now() + 60000) },
      });
      expect(
        (await actions.createPostAction(idle, form({ body: "Restricted" })))
          .status,
      ).toBe("error");
      expect(
        (
          await actions.createCommentAction(
            idle,
            form({ postId: p.id, body: "Restricted" }),
          )
        ).status,
      ).toBe("error");
      await f.prisma.session.deleteMany({ where: { userId: a.id } });
      await expect(
        actions.setPostReactionAction(
          idle,
          form({ postId: p.id, kind: "LIKE" }),
        ),
      ).rejects.toMatchObject({
        digest: expect.stringContaining("/sign-in?next="),
      });
    },
  );
  dbTest("audit failure rolls back visible mutation", async (f) => {
    const a = await f.user();
    await login(a.id);
    const spy = vi
      .spyOn(f.prisma.auditLog, "create")
      .mockRejectedValueOnce(new Error("Audit unavailable"));
    try {
      expect(
        (await actions.createPostAction(idle, form({ body: "Must roll back" })))
          .status,
      ).toBe("error");
      expect(await f.prisma.post.count({ where: { authorId: a.id } })).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
  for (const state of [
    "inactive",
    "banned",
    "suspended",
    "private",
    "internal",
  ] as const)
    dbTest(
      `ineligible ${state} author is absent from public feed and direct detail`,
      async (f) => {
        const a = await f.user();
        const p = await post(f, a.id);
        if (state === "private")
          await f.prisma.profile.update({
            where: { userId: a.id },
            data: { isDiscoverable: false },
          });
        else
          await f.prisma.user.update({
            where: { id: a.id },
            data:
              state === "inactive"
                ? { isActive: false }
                : state === "banned"
                  ? { bannedAt: new Date() }
                  : state === "suspended"
                    ? { suspendedUntil: new Date(Date.now() + 60000) }
                    : { accountClassification: "INTERNAL_TEST_USER" },
          });
        expect(await getSocialPost(p.id)).toBeNull();
        expect((await getSocialFeed()).items.map((x) => x.id)).not.toContain(
          p.id,
        );
      },
    );
  dbTest(
    "soft-deleting a post prevents publicly visible children and further engagement",
    async (f) => {
      const a = await f.user(),
        b = await f.user();
      const p = await post(f, a.id);
      await f.prisma.postComment.create({
        data: { postId: p.id, authorId: b.id, body: "A child comment" },
      });
      await login(a.id);
      expect(
        (await actions.deletePostAction(idle, form({ postId: p.id }))).status,
      ).toBe("success");
      expect(await getSocialPost(p.id)).toBeNull();
      await login(b.id);
      for (const call of [
        actions.setPostReactionAction,
        actions.createCommentAction,
      ])
        expect(
          (
            await call(
              idle,
              form({ postId: p.id, kind: "LIKE", body: "New comment" }),
            )
          ).status,
        ).toBe("error");
    },
  );
});
