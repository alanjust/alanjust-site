// Playground helpers shared by the Playground pages, the menu and the
// portal's Playground admin page.

import { getCollection, type CollectionEntry } from 'astro:content';

export type PlaygroundProject = CollectionEntry<'playground'>;

export const playgroundTypes: Record<PlaygroundProject['data']['type'], string> = {
  experiment: 'Experiment',
  component: 'Component',
  wip: 'Work in Progress',
};

/** Where demos live. A separate address, so experimental code can't touch the main site. */
export const DEMOS_ORIGIN = import.meta.env.PUBLIC_DEMOS_ORIGIN || 'https://demos.alanjust.com';

/**
 * Drafts appear only with `npm run dev`, or a build run with
 * PLAYGROUND_DRAFTS=1 for local testing. `npm run deploy` never includes them.
 */
const showDrafts = import.meta.env.DEV || process.env.PLAYGROUND_DRAFTS === '1';

export async function playgroundProjects({ includeDrafts = showDrafts } = {}) {
  const all = await getCollection('playground', entry => includeDrafts || !entry.data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const hasPublishedPlayground = (await playgroundProjects()).length > 0;
