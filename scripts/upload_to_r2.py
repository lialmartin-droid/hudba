#!/usr/bin/env python3
"""Upload a local music folder to your own Cloudflare R2 bucket.

Produces library.json automatically. No manual tracks.json required.
Requires: pip install -r scripts/requirements.txt
Example:
  export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
  python scripts/upload_to_r2.py "/Users/me/Music" --bucket moje-hudba

Do not put credentials in GitHub Pages or frontend files.
"""
import argparse
import base64
import hashlib
import io
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import quote

FORMATS={'.mp3','.m4a','.aac','.flac','.ogg','.opus','.wav'}

def metadata(path):
    from mutagen import File
    try:
        f=File(str(path),easy=True)
        if f is None:return (path.stem,'Neznámý interpret','Neznámé album')
        get=lambda name,alt: str((f.get(name) or [alt])[0])
        return get('title',path.stem), get('artist','Neznámý interpret'),get('album','Neznámé album')
    except Exception as exc:
        print('Tag warning:',path.name,exc)
        return path.stem,'Neznámý interpret','Neznámé album'

def picture(path):
    from mutagen import File
    try:
        obj=File(str(path),easy=False)
        if not obj:return None
        if path.suffix.lower()=='.mp3':
            tags=obj.tags
            if tags:
                covers=tags.getall('APIC')
                if covers:return covers[0].data, covers[0].mime or 'image/jpeg'
        if path.suffix.lower()=='.m4a':
            covers=obj.tags.get('covr') if obj.tags else None
            if covers:return bytes(covers[0]),'image/png' if int(covers[0].imageformat)==14 else 'image/jpeg'
        if path.suffix.lower()=='.flac' and obj.pictures:
            return obj.pictures[0].data,obj.pictures[0].mime
    except Exception as exc:print('Cover warning:',path.name,exc)
    return None

def main():
    p=argparse.ArgumentParser(description='Nahrát MP3/M4A hudbu do Cloudflare R2 a automaticky vytvořit knihovnu.')
    p.add_argument('folder',type=Path,help='Složka se skladbami (včetně podsložek)')
    p.add_argument('--bucket',required=True,help='Název R2 bucketu')
    p.add_argument('--prefix',default='',help='Volitelný prefix v bucketu, např. hudba')
    p.add_argument('--manifest-only',action='store_true',help='Jen vypsat manifest bez uploadu (pro kontrolu)')
    args=p.parse_args();folder=args.folder.expanduser().resolve()
    if not folder.is_dir():p.error('Složka neexistuje')
    prefix=args.prefix.strip('/')
    def key(s):return prefix+'/'+s if prefix else s
    client=None
    if not args.manifest_only:
        import boto3
        required=['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']
        missing=[x for x in required if not os.environ.get(x)]
        if missing:p.error('Chybí proměnné prostředí: '+', '.join(missing))
        client=boto3.client('s3',endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",region_name='auto',aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])
    out=[];uploaded_covers=set();paths=sorted(f for f in folder.rglob('*') if f.is_file() and f.suffix.lower() in FORMATS)
    print('Nalezeno',len(paths),'skladeb')
    for i,path in enumerate(paths,1):
        title,artist,album=metadata(path)
        rel=path.relative_to(folder).as_posix()
        stableid=hashlib.sha256(rel.encode('utf8')).hexdigest()[:20]
        objname=f'audio/{stableid}{path.suffix.lower()}'
        media_key=key(objname)
        cover_key=None
        pic=picture(path)
        if pic:
            payload,mime=pic
            h=hashlib.sha256(payload).hexdigest()[:20]
            ext='.png' if mime=='image/png' else '.jpg'
            cover_key=key('covers/'+h+ext)
            if client and cover_key not in uploaded_covers:
                client.put_object(Bucket=args.bucket,Key=cover_key,Body=payload,ContentType=mime,CacheControl='public, max-age=86400')
            uploaded_covers.add(cover_key)
        if client:
            mt=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
            client.upload_file(str(path),args.bucket,media_key,ExtraArgs={'ContentType':mt,'CacheControl':'public, max-age=86400'})
        # Relative URLs work whether library.json is in the bucket root or inside --prefix.
        relative_audio=objname
        relative_cover=('covers/'+cover_key.rsplit('/',1)[-1]) if cover_key else None
        out.append({'id':stableid,'title':title,'artist':artist,'album':album,'src':quote(relative_audio,safe='/'),'cover':quote(relative_cover,safe='/') if relative_cover else None})
        print(f'[{i}/{len(paths)}] {artist} — {title}')
    data=json.dumps({'version':1,'tracks':out},ensure_ascii=False,indent=2).encode('utf8')
    output=folder/'library.json';output.write_bytes(data)
    if client:client.put_object(Bucket=args.bucket,Key=key('library.json'),Body=data,ContentType='application/json; charset=utf-8',CacheControl='no-cache')
    print('Hotovo:',len(out),'skladeb; manifest:',output)
    if args.manifest_only:print('Pouze test – soubory nebyly nahrány do R2.')
    else:print('V aplikaci zadej veřejnou URL bucketu'+('/'+prefix if prefix else '')+'/')

if __name__=='__main__':main()
