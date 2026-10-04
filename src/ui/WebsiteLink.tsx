import { strings } from '../strings/pt-BR';

/** A link to the place's own website, showing just the host name. */
export function WebsiteLink({ url }: { url: string | undefined }) {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  return (
    <a className="external-link" href={url} target="_blank" rel="noopener noreferrer">
      {strings.wiki.website}: {host}
    </a>
  );
}
