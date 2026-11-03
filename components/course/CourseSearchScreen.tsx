import { CourseSearch } from '@/components/course/CourseSearch';
import { PageHeading } from '@/components/layout/PageHeading';
import { type CourseSlug, getCourse } from '@/lib/course/courses';
import { MAX_QUERY_LENGTH } from '@/lib/course/search';
import {
  browseEntries,
  SEARCH_EXAMPLES,
  SEARCH_SCOPE,
  searchIndex,
} from '@/lib/course/search-index';

export interface CourseSearchScreenProps {
  course: CourseSlug;
  /** The raw `?q=` value. */
  query?: string | string[] | undefined;
}

/**
 * The search page of a course, inside the page frame. The same screen serves
 * every course: it reads the course's index from `search-index.ts`. A Server
 * Component; only the search box and the results ship as JavaScript.
 */
export function CourseSearchScreen({ course, query }: CourseSearchScreenProps) {
  const info = getCourse(course);
  const initialQuery = (Array.isArray(query) ? query[0] : query)?.slice(0, MAX_QUERY_LENGTH) ?? '';
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
      <PageHeading eyebrow={info.short} title="Search">
        Find any {SEARCH_SCOPE[course]} in {info.title}, and jump straight to it.
      </PageHeading>
      <CourseSearch
        // A new `?q=` from the top bar starts a fresh search.
        key={initialQuery}
        entries={searchIndex(course)}
        browse={browseEntries(course)}
        examples={SEARCH_EXAMPLES[course]}
        courseShort={info.short}
        scope={SEARCH_SCOPE[course]}
        initialQuery={initialQuery}
      />
    </main>
  );
}
