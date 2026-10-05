import { strings } from '../strings/pt-BR';
import { Icon } from './Icon';

/** A pill that opens the place's own website, showing just the host name. */
export function WebsiteLink({ url }: { url: string | undefined }) {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  return (
    <a className="button-tonal" href={url} target="_blank" rel="noopener noreferrer" aria-label={`${strings.wiki.website}: ${host}`}>
      <Icon name="website" size={20} />
      {host}
    </a>
  );
}
