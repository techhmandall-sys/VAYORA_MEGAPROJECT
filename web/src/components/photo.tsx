import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button, ConfirmButton, Notice } from './ui';
import { api, fetchFile } from '../lib/api';
import { useT } from '../lib/i18n';

const ACCEPTED = 'image/jpeg,image/png';

/** "Asha Patil" becomes "AP". */
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('');

/** The photo at this path, fetched with the session token, or null while there is none. */
export function usePhotoUrl(path: string, enabled = true): { url: string | null; isPending: boolean } {
  const photo = useQuery({ queryKey: ['photo', path], queryFn: () => fetchFile(path), enabled });
  const [url, setUrl] = useState<string | null>(null);
  // Made and revoked by the same effect, so a remount (StrictMode does one in development)
  // makes a fresh address instead of keeping one already revoked.
  useEffect(() => {
    if (!photo.data) {
      setUrl(null);
      return;
    }
    const made = URL.createObjectURL(photo.data);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [photo.data]);
  return { url, isPending: photo.isPending };
}

/** A photo, or the initials of what it shows when there is none. */
export function Photo({ path, alt, initials, size = 'h-20 w-20' }: { path: string; alt: string; initials: string; size?: string }) {
  const { url } = usePhotoUrl(path);
  return url ? (
    <img src={url} alt={alt} className={`${size} rounded-2xl object-cover`} />
  ) : (
    <div aria-hidden="true" className={`${size} flex items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-500`}>
      {initials}
    </div>
  );
}

/**
 * Shows a photo with buttons to replace or remove it.
 *
 * @param viewPath   where the photo is read from
 * @param changePath where it is sent and removed
 */
export function PhotoEditor({ viewPath, changePath, alt, initials }: { viewPath: string; changePath: string; alt: string; initials: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['photo', viewPath] });
  const upload = useMutation({ mutationFn: (file: File) => api<void>(changePath, { method: 'PUT', body: file }), onSettled: refresh });
  const remove = useMutation({ mutationFn: () => api<void>(changePath, { method: 'DELETE' }), onSettled: refresh });
  const { url } = usePhotoUrl(viewPath);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Photo path={viewPath} alt={alt} initials={initials} />
      <div className="space-y-2 text-sm">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          aria-label={t('Choose a photo')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button tone="secondary" disabled={upload.isPending} onClick={() => input.current?.click()}>
            {upload.isPending ? t('Uploading…') : url ? t('Replace photo') : t('Add a photo')}
          </Button>
          {url && <ConfirmButton label={t('Remove photo')} confirmLabel={t('Yes, remove it')} disabled={remove.isPending} onConfirm={() => remove.mutate()} />}
        </div>
        <p className="text-slate-500">{t('JPEG or PNG, up to 5 MB. It is stored resized, without the location or other details the file may carry.')}</p>
        {(upload.error ?? remove.error) && <Notice tone="error">{(upload.error ?? remove.error)!.message}</Notice>}
      </div>
    </div>
  );
}
