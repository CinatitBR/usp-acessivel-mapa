import type { WikiRef } from '../../domain/types';
import { strings } from '../../strings/pt-BR';
import { Carousel } from '../../ui/Carousel';
import type { WikiPhoto } from './providers/wikipedia';
import { useWikiArticle } from './useWikiArticle';

function credit(photo: WikiPhoto) {
  return (
    <>
      {strings.wiki.photoBy(photo.author)}
      {photo.license && ` · ${photo.license}`}
      {' · '}
      <a href={photo.page} target="_blank" rel="noopener noreferrer">
        {strings.wiki.commons}
      </a>
    </>
  );
}

type Props = {
  wiki: WikiRef | undefined;
  /** Set when the article is about something larger than what is selected, e.g. the building's institute. */
  about?: string;
};

/**
 * Photos and a short description from Wikipedia. It never holds the panel
 * back: nothing is rendered when there is no article, the request fails or the
 * device is offline with nothing cached.
 */
export function WikiSection({ wiki, about }: Props) {
  const { data, isPending } = useWikiArticle(wiki);
  if (!wiki) return null;
  if (isPending) return <div className="wiki wiki-loading" aria-busy="true" aria-label={strings.loading} />;
  if (!data) return null;

  const { summary, photos } = data;
  return (
    <section className="wiki" aria-label={about ? strings.wiki.about(about) : summary.title}>
      {about && <h3 className="list-title">{strings.wiki.about(about)}</h3>}
      <Carousel
        label={strings.wiki.photos(summary.title)}
        images={photos.map((photo, index) => ({
          src: photo.src,
          alt: strings.wiki.photoAlt(summary.title, index + 1),
          caption: credit(photo),
        }))}
      />
      <p className="wiki-extract">{summary.extract}</p>
      <p className="wiki-source">
        <a href={summary.url} target="_blank" rel="noopener noreferrer">
          {strings.wiki.readMore}
        </a>
        {` · ${strings.wiki.license}`}
      </p>
    </section>
  );
}
