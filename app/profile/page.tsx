import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SignOutButton } from '@/components/auth/SignOutButton';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPhoneForDisplay } from '@/lib/phone';
import type { SessionUser } from '@/services/auth.service';
import { requireLearner } from '@/services/learner.service';
import { requireUserProfile } from '@/services/user.service';

/**
 * `GET /profile` — the signed-in person's own profile.
 *
 * A Server Component: the session and the profile are read here, so the form
 * arrives filled in. Only the form is client code. A signed-out visitor goes
 * to sign-in and comes back here afterwards.
 *
 * The session check comes first, outside any Suspense boundary, so a
 * signed-out visitor gets a real 307. It also reads the learner's progress,
 * which the shell's streak and XP need. The profile read streams in behind a
 * skeleton in the page's shape while the shell is already on screen.
 *
 * Do not add a `loading.tsx` here. It wraps the whole page in Suspense, so
 * the response starts before `redirect()` runs. The redirect then becomes a
 * 200 with a client-side redirect, and the signed-out visitor sees a spinner
 * first.
 */

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your name, date of birth and gender, and the way you sign in.',
  robots: { index: false, follow: false },
};

// Reads the session cookie, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const { user, name, summary } = await requireLearner('/profile');

  return (
    <AppShell learnerName={name} summary={summary}>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-8 md:pt-8">
        <PageHeading eyebrow="Account" title="Profile">
          Level {summary.level.number} · {summary.level.title} · {summary.xp} XP
        </PageHeading>
      </div>

      {/*
        One column on a phone. From lg, the page frame splits: the identity
        card stays in view on the left while the details scroll on the right.
      */}
      <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-6 sm:px-8 md:py-8 lg:grid-cols-3 lg:items-start lg:gap-12">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileDetails user={user} />
        </Suspense>
      </main>
    </AppShell>
  );
}

/** The page's shape while the profile loads. Decoration, plus one status line. */
function ProfileSkeleton(): React.JSX.Element {
  return (
    <>
      <p role="status" className="sr-only">
        Loading your profile
      </p>
      <Card
        peek={<Skeleton shape="circle" className="size-16" />}
        className="flex flex-col gap-2 lg:row-span-2"
      >
        <Skeleton className="h-6 w-40" />
        <Skeleton className="w-52" />
      </Card>
      <div className="flex max-w-xl flex-col gap-5 lg:col-span-2">
        <Skeleton className="h-8 w-44" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex flex-col gap-1.5">
            <Skeleton className="w-24" />
            <Skeleton shape="block" className="w-full" />
          </div>
        ))}
      </div>
    </>
  );
}

/** The part of the page that needs Firestore. It streams in after the app bar. */
async function ProfileDetails({ user }: { user: SessionUser }): Promise<React.JSX.Element> {
  const profile = await requireUserProfile(user);

  const contact: ReadonlyArray<{ label: string; value: string }> = [
    ...(profile.phoneNumber !== null
      ? [{ label: 'Phone', value: formatPhoneForDisplay(profile.phoneNumber) }]
      : []),
    ...(profile.email !== null ? [{ label: 'Email', value: profile.email }] : []),
  ];

  return (
    <>
      <Card
        peek={<Avatar name={user.uid} size="lg" />}
        className="flex flex-col gap-1 lg:sticky lg:top-24 lg:row-span-2"
      >
        <p className="text-heading font-display break-words">{profile.displayName}</p>
        {contact.length > 0 && (
          <dl className="text-small text-ink-soft flex flex-col gap-0.5">
            {contact.map((item) => (
              <div key={item.label} className="flex gap-2">
                <dt>{item.label}</dt>
                <dd className="text-ink font-medium break-all">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <section
        className="flex max-w-xl flex-col gap-4 lg:col-span-2"
        aria-labelledby="details-heading"
      >
        <h2 id="details-heading" className="text-title">
          Your details
        </h2>
        <ProfileForm
          initial={{
            displayName: profile.displayName,
            dateOfBirth: profile.dateOfBirth ?? null,
            gender: profile.gender ?? null,
          }}
        />
      </section>

      <section
        className="flex max-w-xl flex-col gap-3 lg:col-span-2"
        aria-labelledby="account-heading"
      >
        <h2 id="account-heading" className="text-title">
          Account
        </h2>
        <p className="text-small text-ink-soft">
          Your phone number and email come from how you sign in, so they are not edited here.
        </p>
        <SignOutButton redirectTo="/" variant="secondary" block />
      </section>
    </>
  );
}
