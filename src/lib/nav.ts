// Site navigation—one list shared by the desktop side menu (SideNav.astro)
// and the mobile overlay (BaseLayout.astro).

export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface NavGroup {
  heading?: string;
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
  {
    heading: 'Writing',
    links: [
      { href: '/im-on-a-quest',                         label: "I'm on a quest" },
      { href: '/what-is-art',                           label: 'What is Art?' },
      { href: '/what-is-design',                        label: 'What is Design?' },
      { href: '/what-is-decorative-art',                label: 'What is Decorative Art?' },
      { href: '/the-difference-between-art-and-design', label: 'Art & Design Difference' },
    ],
  },
];

export function isCurrent(href: string, currentPath: string) {
  if (href.startsWith('http')) return false;
  if (href === '/') return currentPath === '/';
  return currentPath.startsWith(href);
}
