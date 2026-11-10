import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { TabBar } from '@/components/layout/TabBar';
import { env } from '@/lib/env';
import { THEME_COLORS, THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: env.appName,
    template: `%s | ${env.appName}`,
  },
  description:
    'Senior data engineer interview prep: lessons, problems and loop guides for nine companies.',
  applicationName: env.appName,
  // iOS reads these, not the manifest, when the user adds the app to the home
  // screen. The manifest in app/manifest.ts serves every other browser.
  appleWebApp: { capable: true, title: env.appName, statusBarStyle: 'default' },
  robots: {
    // Deployed previews should not be indexed. Flip this on for the real site.
    index: env.isProduction,
    follow: env.isProduction,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the page draw under a phone's notch and home indicator, so TabBar can
  // pad itself with env(safe-area-inset-bottom) like a native nav bar.
  viewportFit: 'cover',
  // Matches --color-paper for the device's mode. The head script corrects it
  // when the learner picked a mode by hand. See lib/theme.ts.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

/**
 * Loop Ready typefaces, self-hosted from public/fonts (Latin subsets, ~180 KB
 * total, each weight loaded only when a page uses it). Space Grotesk sets the
 * headings, Inter the text, JetBrains Mono the code. Self-hosting means the
 * build never calls Google Fonts, so the Docker build works offline. All three
 * are under the SIL Open Font License. See design-language.md, "Type".
 */
const spaceGrotesk = localFont({
  src: [
    { path: '../public/fonts/space-grotesk-500.woff2', weight: '500' },
    { path: '../public/fonts/space-grotesk-600.woff2', weight: '600' },
    { path: '../public/fonts/space-grotesk-700.woff2', weight: '700' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const inter = localFont({
  src: [
    { path: '../public/fonts/inter-400.woff2', weight: '400' },
    { path: '../public/fonts/inter-500.woff2', weight: '500' },
    { path: '../public/fonts/inter-600.woff2', weight: '600' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: [
    { path: '../public/fonts/jetbrains-mono-400.woff2', weight: '400' },
    { path: '../public/fonts/jetbrains-mono-500.woff2', weight: '500' },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

/**
 * The product theme. 'playroom' is the default token set; 'calm' and 'night'
 * re-assign tokens in styles/globals.css. Set once per product, here only.
 */
const THEME: 'playroom' | 'calm' | 'night' = 'playroom';

/**
 * Root layout — a Server Component, and it must stay one.
 *
 * Adding `'use client'` here would turn the entire application into a client
 * bundle. Providers that need client state belong in their own
 * `'use client'` component rendered from here as a child.
 *
 * It holds the two postures of the shell. A phone gets an app: the `TabBar`
 * at the bottom. From `md` up the same destinations move to the `SiteHeader`
 * at the top, and the page reads as a website. Both are CSS breakpoints, so
 * the server sends one HTML for every screen and nothing guesses the device.
 * See design-language.md > Responsive: an app on a phone, a website on a desktop.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme={THEME}
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      // The head script sets data-mode before React hydrates, so the server's
      // <html> attributes differ from the browser's on purpose.
      suppressHydrationWarning
    >
      <head>
        {/*
          Light or dark, before the first paint: the stored choice, else the
          device setting. Inline and blocking on purpose, because a deferred
          script would paint the light page first and then flash. It reads
          localStorage only. See lib/theme.ts.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/*
        pb-28 keeps the last line of every page clear of the floating TabBar,
        on a phone only: from md up the TabBar hides. The flex column lets a
        short page push the footer to the bottom of the screen. SiteHeader and
        TabBar are client components rendered from this Server Component, so
        the layout itself stays server-only.
      */}
      <body className="flex min-h-dvh flex-col pb-28 antialiased md:pb-0">
        <SiteHeader appName={env.appName} />
        {children}
        {/* Hidden while a signed-in page renders AppShell, which has its own footer. */}
        <div data-site-chrome className="contents">
          <Footer
            owner={env.appName}
            links={[
              { href: '/de/companies/uber', label: 'Uber loop guide' },
              { href: '/de/companies/google', label: 'Google loop guide' },
              { href: '/design', label: 'Design system' },
            ]}
          />
        </div>
        <TabBar />
      </body>
    </html>
  );
}
