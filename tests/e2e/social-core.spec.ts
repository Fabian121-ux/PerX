import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { enforceTestDatabaseIsolation } from "./utils/db-guard";

test("real social persistence, guest return, ownership, moderation and narrow layout", async ({page, browser}, testInfo) => {
  test.setTimeout(300_000);
  enforceTestDatabaseIsolation();
  const db = new Pool({connectionString:process.env.TEST_DATABASE_URL!,ssl:false});
  const password = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(password,10);
  const users = ["A","B","C","Moderator"].map(name=>({id:randomUUID(),name:`Social ${name}`}));
  const contexts=[];
  async function signIn(target:Page,index:number,path:string) {
    await target.goto(`/sign-in?next=${encodeURIComponent(path)}`);
    await submitSignIn(target,index,path);
  }
  async function submitSignIn(target:Page,index:number,path:string) {
    await target.getByLabel("Email address").fill(`social-${users[index].id}@ptahx.test`);
    await target.getByLabel("Password",{exact:true}).fill(password);
    await target.getByRole("button",{name:"Sign in",exact:true}).click();
    await expect(target).toHaveURL(url=>url.pathname===path,{timeout:60_000});
  }
  async function noOverflow(target:Page) {expect(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  try {
    for(const [index,user] of users.entries()) {
      await db.query(`INSERT INTO "User" (id,email,username,name,"passwordHash","accountClassification","updatedAt") VALUES ($1,$2,$3,$4,$5,'PUBLIC_BETA_USER',NOW())`,[user.id,`social-${user.id}@ptahx.test`,`social_${user.id.replaceAll('-','').slice(0,20)}`,user.name,hash]);
      await db.query(`INSERT INTO "Profile" (id,"userId",headline,biography,location,"isDiscoverable","updatedAt") VALUES ($1,$2,'Social fixture','Browser acceptance','Lagos',true,NOW())`,[randomUUID(),user.id]);
      if(index===3) {
        await db.query(`INSERT INTO "Role" (id,name,label,description) VALUES ($1,'ADMIN','Administrator','Fixture role') ON CONFLICT (name) DO NOTHING`,[randomUUID()]);
        await db.query(`INSERT INTO "UserRole" (id,"userId","roleId") SELECT $1,$2,id FROM "Role" WHERE name='ADMIN'`,[randomUUID(),user.id]);
      }
    }
    if(testInfo.project.name==="mobile-chrome") await page.setViewportSize({width:320,height:740});
    await signIn(page,0,"/app/posts/new");
    const body=`Social acceptance ${randomUUID()} ${"longword".repeat(40)}`;
    await page.getByLabel("Post text").fill(body);
    await page.getByRole("button",{name:"Publish post",exact:true}).click();
    await expect(page).toHaveURL(/\/posts\/[^/]+$/,{timeout:60_000});
    const path=new URL(page.url()).pathname;
    const postId=path.split('/').at(-1)!;
    const card=page.locator(`[data-social-post-id="${postId}"]`);
    await expect(card.getByText(body,{exact:true})).toBeVisible();
    expect((await db.query(`SELECT "authorId",body FROM "Post" WHERE id=$1`,[postId])).rows).toEqual([{authorId:users[0].id,body}]);
    await noOverflow(page);
    await page.goto('/app'); await expect(card).toBeVisible();
    const guestContext=await browser.newContext({viewport:{width:testInfo.project.name==="mobile-chrome"?320:1280,height:800}});contexts.push(guestContext);
    const guest=await guestContext.newPage();
    await guest.goto('/');await expect(guest.locator(`[data-social-post-id="${postId}"]`)).toBeVisible();await noOverflow(guest);
    await guest.locator(`[data-social-post-id="${postId}"]`).getByRole('link',{name:'Open post',exact:true}).click();
    await guest.getByRole('link',{name:'Like',exact:true}).click();
    expect(new URL(guest.url()).searchParams.get('next')).toBe(path);
    await submitSignIn(guest,1,path);
    await guest.getByRole('button',{name:'Like',exact:true}).click();
    await expect(guest.getByTestId('reaction-count')).toHaveText('1 reactions');
    await expect(guest.getByRole('button',{name:'Like',exact:true})).toHaveAttribute('aria-pressed','true');
    await guest.getByRole('button',{name:'Like',exact:true}).click();
    await expect(guest.getByTestId('reaction-count')).toHaveText('0 reactions');
    await guest.getByRole('button',{name:'Support',exact:true}).click();
    await expect(guest.getByTestId('reaction-count')).toHaveText('1 reactions');
    await guest.getByLabel('Your comment').fill('Useful community insight');
    await guest.getByRole('button',{name:'Post comment',exact:true}).click();
    await expect(guest.getByTestId('comment-count')).toHaveText('1 comments');
    const comment=guest.locator('[data-comment-id]').first();
    await comment.getByText('Edit comment',{exact:true}).click();
    await comment.getByLabel('Comment text').fill('Edited community insight');
    await comment.getByRole('button',{name:'Save comment',exact:true}).click();
    await expect(comment.getByText('Edited community insight',{exact:true})).toBeVisible();
    expect((await db.query(`SELECT "authorId",body FROM "PostComment" WHERE "postId"=$1`,[postId])).rows).toEqual([{authorId:users[1].id,body:'Edited community insight'}]);
    await noOverflow(guest);
    await guest.screenshot({path:testInfo.outputPath('social-detail.png'),fullPage:true});
    await page.goto(path);await expect(page.getByText('Edited community insight',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Delete comment',exact:true})).toHaveCount(0);
    const cContext=await browser.newContext();contexts.push(cContext);const c=await cContext.newPage();
    await c.goto(path);await c.getByRole('link',{name:'Sign in to write a comment',exact:true}).click();expect(new URL(c.url()).searchParams.get('next')).toBe(path);await submitSignIn(c,2,path);
    for(const name of ['Delete post','Delete comment']) await expect(c.getByRole('button',{name,exact:true})).toHaveCount(0);
    await expect(c.getByText('Edit post',{exact:true})).toHaveCount(0);await expect(c.getByText('Edit comment',{exact:true})).toHaveCount(0);
    const adminContext=await browser.newContext();contexts.push(adminContext);const admin=await adminContext.newPage();await signIn(admin,3,'/admin/social');
    await admin.goto(`/admin/social?id=${postId}`);await admin.getByLabel('Moderation reason').fill('Browser acceptance safety review');await admin.getByRole('button',{name:'Hide post',exact:true}).click();
    await expect.poll(async()=> (await db.query(`SELECT "moderationStatus" FROM "Post" WHERE id=$1`,[postId])).rows[0].moderationStatus).toBe('REJECTED');
    await guestContext.clearCookies();await guest.goto('/');await expect(guest.locator(`[data-social-post-id="${postId}"]`)).toHaveCount(0);
    expect((await guest.goto(path))?.status()).toBe(404);
  } finally {
    for(const context of contexts) await context.close();
    enforceTestDatabaseIsolation();
    try{await db.query('DELETE FROM "User" WHERE id=ANY($1::text[])',[users.map(u=>u.id)]);}finally{await db.end();}
  }
});
