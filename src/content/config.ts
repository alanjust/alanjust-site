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

export const collections = { portfolio };
