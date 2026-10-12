import type { CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'portfolio'>;

// Gallery order, shared by the home page and the project pages' Previous/Next links:
// commercial work first, Fine Art after it, sortOrder within each.
export function sortProjects(projects: Project[]) {
  const isFineArt = (p: Project) => (p.data.category === 'Fine Art' ? 1 : 0);
  return [...projects].sort(
    (a, b) => isFineArt(a) - isFineArt(b) || a.data.sortOrder - b.data.sortOrder
  );
}
