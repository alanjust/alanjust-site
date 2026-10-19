// Site navigation—one list shared by the desktop side menu (SideNav.astro)
// and the mobile overlay (BaseLayout.astro).

import { hasPublishedPlayground } from './playground';

export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface NavGroup {
  heading?: string;
  /** Folded shut under its heading unless you're on one of its pages. */
  collapsible?: boolean;
  links: NavLink[];
}

export const navGroups: NavGroup[] = [
  {
    links: [
      { href: '/',                label: 'Work' },  // the gallery
      { href: '/design-services', label: 'Design Services' },
      { href: '/about',           label: 'About' },
      { href: '/contact',         label: 'Contact' },
    ],
  },
  // Client Portal (and Playground, when it arrives) sit above Writing,
  // which always stays last.
  {
    links: [
      { href: '/portal', label: 'Client Portal' },
      // Appears once the first Playground project is published.
      ...(hasPublishedPlayground ? [{ href: '/playground', label: 'Playground' }] : []),
    ],
  },
  {
    heading: 'Writing',
    collapsible: true,
    links: [
      { href: '/im-on-a-quest',                         label: "I'm on a quest" },
      { href: '/what-is-art',                           label: 'What is Art?' },
      { href: '/what-is-design',                        label: 'What is Design?' },
      { href: '/what-is-decorative-art',                label: 'What is Decorative Art?' },
      { href: '/the-difference-between-art-and-design', label: 'Art & Design Difference' },
    ],
  },
];

export function groupIsCurrent(group: NavGroup, currentPath: string) {
  return group.links.some(link => isCurrent(link.href, currentPath));
}

export function isCurrent(href: string, currentPath: string) {
  if (href.startsWith('http')) return false;
  if (href === '/') return currentPath === '/';
  return currentPath.startsWith(href);
}
