# Client Portal & Playground—Build Plan

Drafted 2026-10-19. Three phases, in this order: backend, OSU portal, Playground. Each phase ships on its own and leaves the site working.

---

## What's true today

- The site is plain static Astro. Nothing runs on a server.
- There's no Worker for alanjust.com in your Cloudflare account, so the site is almost certainly deployed by a **Cloudflare Pages git connection** (push to GitHub → Pages builds it).
- The menu is defined in `src/lib/nav.ts` as groups. A third group added at the end of that list lands at the bottom of both the desktop side menu and the phone menu, so the menu change itself is small.
- Colors and type settings already live as tokens at the top of `global.css`. New screens will use those.

---

## Phase 1—Backend (the foundation)

**Goal:** the same site, served a new way, with the plumbing ready for the portal. Visitors shouldn't notice anything.

1. **Switch deploys from Pages to a Worker.** Add a `wrangler.jsonc` and an `npm run deploy` script. Astro still builds static pages exactly as now; the Worker serves them and handles the few routes that need a server (`/portal/*` and `/api/*`). Everything else goes straight to the static files, at the same speed as today.
   - No Astro server adapter is needed. The portal screens are ordinary Astro pages that load their data from `/api`.
   - New dev dependency: `wrangler` (and its TypeScript types). That's it.
2. **Create the storage:**
   - **R2 bucket `alanjust-portal`** for uploaded files and proofs.
   - **D1 database `alanjust-portal`** for the file list, proofs, versions and comments.
3. **Test on the Worker's temporary `workers.dev` address first.** Once every page checks out, move the `alanjust.com` domain from the Pages project to the Worker. Then turn off the Pages git auto-build so the two don't fight. Keep the Pages project around (inactive) for a week as a fallback.
4. **Update this project's CLAUDE.md** so it stops saying "static, no API endpoints" and points to `src/lib/nav.ts` for the menu.

**Done when:** alanjust.com serves from the Worker, every existing page and redirect still works, and `npm run deploy` is the one way to publish.

---

## Phase 2—OSU Client Portal

### Who gets in

- **Cloudflare Access** guards `/portal` and `/api/portal`. Anyone with an **@oregonstate.edu** email (plus you) types their address, gets a six-digit code, and is in for 30 days on that device.
- The Worker also double-checks Access's signed pass on every request and reads the person's email from it. That's how comments get names and how it knows you're the admin.
- **Assumption to confirm:** everyone at OSU sees both groups (Packaging and Web). Splitting them by person is possible later, but you'd have to maintain a list.

### Layout

```
/portal                     → Oregon State landing (two group cards)
/portal/osu/packaging       → Files | Reviews tabs
/portal/osu/web             → Files | Reviews tabs
```

### Files (the transfer area)

- Anyone logged in can upload or download any file type: .ai, .zip, .docx, fonts and so on.
- **Big files:** uploads go in 10 MB chunks straight into R2, so a 500 MB Illustrator file works and the Worker's size limit never comes into play. A progress bar shows how far along it is. Starting cap is 2 GB per file.
- **Downloads only:** files always download and never open on the site. That keeps an uploaded HTML or SVG file from running code on alanjust.com.
- Each file shows its name, size, who uploaded it and when.
- **Auto-cleanup:** files older than **90 days** are deleted automatically. Proofs in Reviews are never auto-deleted.
- You can delete any file, and people can delete their own.

### Reviews (proofs + shared comments)

- **Only you post proofs:** PDF, JPEG or PNG. Each proof has a title and a version number.
- **Display:** PDFs open in the browser's own viewer, and images show at full width. Both work on iPhone and iPad.
- **One thread per version:** each version gets one comment thread that everyone sees, with names and dates, so people can see what's already been said.
- **New versions:** posting v2 starts a fresh thread. Earlier versions and their threads stay below it, collapsed but readable.
- **Addressed:** you can mark a comment "addressed." It stays visible but dims.
- **Your copy:** a "download original" link sits next to every proof.

### Keeping it private

- `/portal` is left out of the sitemap, blocked in `robots.txt`, and sends a no-index header.
- The menu label is generic ("Client Portal"). Oregon State's name only appears after login.

### Open question for Phase 2

- **New-comment emails to you:** Cloudflare can send these, but only if the alanjust.com domain uses Cloudflare Email Routing. I need to check where your alanjust.com email is hosted before promising this. If it isn't on Cloudflare, the fallback is a "new since your last visit" badge in the portal.

**Done when:** an @oregonstate.edu address can log in on desktop, iPad and iPhone; upload and download a large .ai file; and read and comment on a proof. You can post a v2, and nothing in `/portal` appears on Google.

---

## Phase 3—Playground (public)

### Pages

- **`/playground`:** a card grid, one card per project, newest first. Each card has a cover image, title, one-line summary and a type label (*Experiment*, *Component* or *Work in Progress*).
- **`/playground/[project]`:** an open-ended page. Your write-up, and then whatever the project needs:
  - **Experiment / Component:** the live demo in a frame, with a "open full screen" link for phones.
  - **Work in Progress:** a dated timeline of iterations, newest on top, each with an image and a short note.
- Fully public, in the sitemap, with proper titles, descriptions and share images, so links look good when texted.

### Adding a project (no server involved)

```
src/content/playground/my-project/
  index.md        ← title, date, type, cover, summary, then your write-up
  cover.jpg
  iterations/     ← (Work in Progress only) dated images
demos/my-project/ ← (Experiment/Component only) the HTML/JS files
```

Then `npm run deploy`.

- **Demos live apart:** demos are served from a separate address, **`demos.alanjust.com`**, and shown inside a sealed frame. A broken or misbehaving experiment can't touch the main site.
- **React components:** these get built into a plain bundle and dropped in the demo folder, the same as any HTML experiment. The main site doesn't take on React.

### Invite-link comments

- Each project can have an invite link (`/playground/my-project?invite=…`) that you copy from the page and text to friends.
- Opening it lets that browser comment. They type a name, with no account. Everyone else only reads the comments.
- You can reset a project's link if it travels too far, and delete any comment.
- This uses the same comment system built in Phase 2, pointed at a different shelf.

**Done when:** you can add a project by making a folder, see it on your iPhone, text an invite link to a friend, and read their comment.

---

## Menu (lands in Phase 2, gains Playground in Phase 3)

A third group at the bottom of `src/lib/nav.ts`:

```
Work
Design Services
About
Contact

WRITING
…

Client Portal
Playground
```

No group heading. The extra space above it is enough of a break. I'll confirm the look with you before changing it.

---

## Needs your OK before Phase 1

1. **New dev dependency:** adding `wrangler` (this project's CLAUDE.md says to ask).
2. **Moving the domain:** moving `alanjust.com` from Pages to the Worker, which is a brief cutover. I'll test fully on the temporary address first.
3. **Email check:** looking up where alanjust.com email is hosted, for the comment-email question.
