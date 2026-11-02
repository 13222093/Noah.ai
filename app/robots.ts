import type { MetadataRoute } from 'next';

// The trial is not public (08_ROLES_AND_ACCESS.md): ask every crawler to stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
