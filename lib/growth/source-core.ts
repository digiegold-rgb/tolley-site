type ChangedFile={filename:string;status:string};
/** Prefer a changed feature page over its broad landing page; article indexes are never build evidence. */
export function selectPublicFeature(files:ChangedFile[],publicPaths:string[]) {
 return [...files].sort((a,b)=>b.filename.split('/').length-a.filename.split('/').length || a.filename.localeCompare(b.filename)).find(f=>
  f.status!=='removed' && !/^app\/blog(?:\/|$)/.test(f.filename) && !/admin|\[|private/.test(f.filename) &&
  publicPaths.some(p=>f.filename===`app/${p}/page.tsx` || f.filename.startsWith(`app/${p}/`) && /page\.tsx$/.test(f.filename))
 );
}
