import { t as e } from './jsx-runtime-BkSabwWG.js';
import { n as t } from './appBoot-634c31a5ba.js';
import { aboutCards as n, contactInfo as r, teamMembers as i } from './siteData-C5f9a5aD.js';
import { t as a } from './Reveal-a4c48c8478.js';
var o = e();
function s({ aboutCards: e, contactInfo: t, logoSrc: n, teamMembers: r }) {
  const about=window.KotekaWorkspace.get('about',{}), ws=window.KotekaWorkspace, socials=ws.get('socialLinks',null);
  return (0, o.jsx)(a, {
    as: `section`,
    className: `about-section`,
    id: `about`,
    'aria-labelledby': `about-heading`,
    children: (0, o.jsxs)(`div`, {
      className: `container`,
      children: [
        (0, o.jsxs)(`div`, {
          className: `section-heading about-heading`,
          children: [
            (0, o.jsx)(`span`, { className: `eyebrow`, children: `About` }),
            (0, o.jsx)(`h2`, { id: `about-heading`, children: about.heading ?? `Tentang Kami` }),
            (0, o.jsx)(`p`, {
              className: `about-lead`,
              children: about.description ?? `Kenali tim, cara kerja, dan komitmen kami dalam membangun solusi digital yang membantu UMKM, bisnis, personal brand, dan instansi berkembang secara profesional.`,
            }),
          ],
        }),
        (0, o.jsxs)(`div`, {
          className: `about-layout`,
          children: [
            (0, o.jsxs)(`div`, {
              className: `about-logo-panel`,
              children: [
                (0, o.jsx)(`div`, {
                  className: `about-logo-frame`,
                  children: (0, o.jsx)(`img`, {
                    className: `about-logo`,
                    src: n,
                    alt: `Logo Koteka Digital`,
                    loading: `lazy`,
                    decoding: `async`,
                    sizes: `(max-width: 640px) 132px, (max-width: 900px) 250px, 360px`,
                    width: `512`,
                    height: `477`,
                  }),
                }),
                (0, o.jsxs)(`div`, {
                  className: `about-logo-contact`,
                  'aria-label': `Media sosial dan info Koteka Digital`,
                  children: [
                    (0, o.jsx)(`span`, {
                      className: `about-logo-socials-label`,
                      children: `Terhubung dengan Koteka Digital`,
                    }),
                    (0, o.jsxs)(`div`, {
                      className: `about-logo-social-links`,
                      children: (socials ? [(0,o.jsx)('a',{href:t.whatsappLink,target:'_blank',rel:'noopener noreferrer','aria-label':'WhatsApp '+t.whatsappLabel,children:(0,o.jsx)('i',{className:'fa-brands fa-whatsapp','aria-hidden':true})}),...ws.list(socials).map(x=>(0,o.jsx)('a',{href:ws.url(x.link),target:'_blank',rel:'noopener noreferrer','aria-label':x.title,children:(0,o.jsx)('i',{className:x.icon,'aria-hidden':true})},x._id))] : [
                        (0, o.jsx)(`a`, {
                          href: t.whatsappLink,
                          target: `_blank`,
                          rel: `noopener noreferrer`,
                          'aria-label': `WhatsApp ${t.whatsappLabel}`,
                          children: (0, o.jsx)(`i`, {
                            className: `fa-brands fa-whatsapp`,
                            'aria-hidden': `true`,
                          }),
                        }),
                        (0, o.jsx)(`span`, {
                          role: `img`,
                          className: `about-logo-social-link-static`,
                          'aria-label': `Lokasi ${t.location}`,
                          title: t.location,
                          children: (0, o.jsx)(`i`, {
                            className: `fa-solid fa-location-dot`,
                            'aria-hidden': `true`,
                          }),
                        }),
                        (0, o.jsx)(`a`, {
                          href: `https://www.instagram.com/kotekadigital/`,
                          target: `_blank`,
                          rel: `noopener noreferrer`,
                          'aria-label': `Instagram Koteka Digital`,
                          children: (0, o.jsx)(`i`, {
                            className: `fa-brands fa-instagram`,
                            'aria-hidden': `true`,
                          }),
                        }),
                        (0, o.jsx)(`a`, {
                          href: `https://web.facebook.com/profile.php?id=61573476356920`,
                          target: `_blank`,
                          rel: `noopener noreferrer`,
                          'aria-label': `Facebook Koteka Digital`,
                          children: (0, o.jsx)(`i`, {
                            className: `fa-brands fa-facebook-f`,
                            'aria-hidden': `true`,
                          }),
                        }),
                        (0, o.jsx)(`a`, {
                          href: `https://www.tiktok.com/@kotekadigitalstudio?_r=1&_t=ZS-97V638s9hhd`,
                          target: `_blank`,
                          rel: `noopener noreferrer`,
                          'aria-label': `TikTok Koteka Digital`,
                          children: (0, o.jsx)(`i`, {
                            className: `fa-brands fa-tiktok`,
                            'aria-hidden': `true`,
                          }),
                        }),
                        (0, o.jsx)(`a`, {
                          href: `/`,
                          target: `_blank`,
                          rel: `noopener noreferrer`,
                          'aria-label': `Website Koteka Digital`,
                          children: (0, o.jsx)(`i`, {
                            className: `fa-solid fa-globe`,
                            'aria-hidden': `true`,
                          }),
                        }),
                      ]),
                    }),
                  ],
                }),
              ],
            }),
            (0, o.jsx)(`div`, {
              className: `card-grid card-grid-three about-card-grid`,
              children: e.map((e) =>
                (0, o.jsxs)(
                  `article`,
                  {
                    className: `info-card about-info-card`,
                    children: [
                      (0, o.jsxs)(`div`, {
                        className: `about-card-head`,
                        children: [
                          (0, o.jsx)(`div`, {
                            className: `card-icon about-card-icon`,
                            children: (0, o.jsx)(`i`, { className: e.icon, 'aria-hidden': `true` }),
                          }),
                          (0, o.jsx)(`h3`, { children: e.title }),
                        ],
                      }),
                      (0, o.jsx)(`p`, { children: e.text }),
                    ],
                  },
                  e.title
                )
              ),
            }),
          ],
        }),
        (0, o.jsxs)(`div`, {
          className: `about-team`,
          children: [
            (0, o.jsxs)(`div`, {
              className: `section-heading about-team-heading`,
              children: [
                (0, o.jsx)(`span`, { className: `eyebrow about-eyebrow`, children: `Tim Kami` }),
                (0, o.jsxs)(`div`, {
                  className: `about-team-heading-copy`,
                  children: [
                    (0, o.jsx)(`h2`, { children: `Orang-Orang di Balik Koteka Digital` }),
                    (0, o.jsx)(`p`, {
                      children: `Tim kami bekerja untuk merancang website yang rapi, strategis, dan nyaman dipakai oleh bisnis, personal brand, maupun instansi.`,
                    }),
                  ],
                }),
              ],
            }),
            (0, o.jsx)(`div`, {
              className: `card-grid card-grid-three about-team-grid`,
              children: r.map((e) =>
                (0, o.jsxs)(
                  `article`,
                  {
                    className: `team-card`,
                    children: [
                      (0, o.jsxs)(`div`, {
                        className: `team-avatar-wrap`,
                        children: [
                          (0, o.jsx)(`span`, {
                            className: `team-avatar-ring team-avatar-ring-one`,
                            'aria-hidden': `true`,
                          }),
                          (0, o.jsx)(`span`, {
                            className: `team-avatar-ring team-avatar-ring-two`,
                            'aria-hidden': `true`,
                          }),
                          (0, o.jsx)(`img`, {
                            className: `team-avatar`,
                            src: e.image,
                            alt: e.name,
                            loading: `lazy`,
                            decoding: `async`,
                            sizes: `(max-width: 640px) 96px, (max-width: 900px) 120px, 200px`,
                            width: e.imageWidth,
                            height: e.imageHeight,
                          }),
                        ],
                      }),
                      (0, o.jsxs)(`div`, {
                        className: `team-card-copy`,
                        children: [
                          (0, o.jsx)(`h3`, { children: e.name }),
                          (0, o.jsx)(`p`, { className: `team-role`, children: e.role }),
                          (0, o.jsx)(`p`, {
                            className: `team-description`,
                            children: e.description,
                          }),
                        ],
                      }),
                      (0, o.jsx)(`div`, {
                        className: `team-socials`,
                        'aria-label': `Sosial media ${e.name}`,
                        children: e.socials.map((e) =>
                          (0, o.jsx)(
                            `a`,
                            {
                              className: `team-social-link`,
                              href: e.href,
                              target: `_blank`,
                              rel: `noopener noreferrer`,
                              'aria-label': e.label,
                              children: (0, o.jsx)(`i`, {
                                className: e.icon,
                                'aria-hidden': `true`,
                              }),
                            },
                            e.label
                          )
                        ),
                      }),
                    ],
                  },
                  e.name
                )
              ),
            }),
          ],
        }),
      ],
    }),
  });
}
function c() {
  return (0, o.jsx)(s, { aboutCards: n, contactInfo: r, logoSrc: t, teamMembers: i });
}
export { c as default };
