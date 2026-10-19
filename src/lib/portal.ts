// Client portal configuration—shared by the Astro pages and the Worker.
// To add a client or a group, add it here; pages and permissions follow.

export interface PortalSpace {
  id: string;
  name: string;
  blurb: string;
}

export interface PortalClient {
  id: string;
  name: string;
  /** People whose email ends in @<domain> can see this client. */
  emailDomains: string[];
  spaces: PortalSpace[];
}

export const portalClients: PortalClient[] = [
  {
    id: 'osu',
    name: 'Oregon State University',
    emailDomains: ['oregonstate.edu'],
    spaces: [
      { id: 'packaging', name: 'Packaging',     blurb: 'Packaging for product development.' },
      { id: 'web',       name: 'Web (Drupal)',  blurb: 'Updates and additions to the Drupal site.' },
    ],
  },
];

/** Proofs can only be these types, because browsers can show them safely. */
export const proofTypes: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
};

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;   // 2 GB
export const UPLOAD_PART_BYTES = 10 * 1024 ** 2; // 10 MB chunks
export const FILE_RETENTION_DAYS = 90;

export function findClient(id: string) {
  return portalClients.find(c => c.id === id);
}

export function findSpace(clientId: string, spaceId: string) {
  return findClient(clientId)?.spaces.find(s => s.id === spaceId);
}
