import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { HOME_PATH } from '../navigation/routes.ts';

// Another operator's lot lands here too, worded so it never confirms that the lot exists.
export function NotFoundPage() {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.notFound.eyebrow} title={text.notFound.title} />
      <p className="lead">{text.notFound.message}</p>
      <AppLink href={HOME_PATH} className="text-link">
        {text.notFound.back}
      </AppLink>
    </>
  );
}
