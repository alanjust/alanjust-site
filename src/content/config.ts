import { defineCollection, z } from 'astro:content';

const portfolio = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    projectSlug: z.string(),
    category: z.string().default(''),
    sortOrder: z.number().default(999),
    featured: z.boolean().default(false),
    showProject: z.boolean().default(true),
    heroImage: z.string().default(''),
    additionalImages: z.array(z.string()).default([]),
  }),
});

// Playground: experiments, components and works in progress. One Markdown
// file per project in src/content/playground/; the file name is its address.
const playground = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    type: z.enum(['experiment', 'component', 'wip']),
    /** Card picture, a path under public/, e.g. /playground/my-project/cover.jpg */
    cover: z.string().default(''),
    /** True when demos/site/<file name>/index.html holds a live demo. */
    demo: z.boolean().default(false),
    /** Height of the demo frame on desktop, in pixels. */
    demoHeight: z.number().default(640),
    /** Works in progress: newest first or any order—the page sorts them. */
    iterations: z.array(z.object({
      date: z.coerce.date(),
      image: z.string(),
      note: z.string().default(''),
    })).default([]),
    /** Drafts show only on Alan's machine, never on the live site. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { portfolio, playground };
