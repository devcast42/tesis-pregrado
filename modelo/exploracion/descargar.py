"""Descarga el diario OLBI (Mendeley Data vwp3xvp2x8, CC BY 4.0) y verifica su hash."""
import hashlib, urllib.request, pathlib

URL = ('https://data.mendeley.com/public-files/datasets/vwp3xvp2x8/files/'
       '60e73d9b-9d20-471e-af51-fd270dbc68fe/file_downloaded')
SHA256 = '9ce7244dd6173c5256c52a4db6c16aa08a1c25087b6d00e9fe82d07f8e02dc48'
DESTINO = pathlib.Path(__file__).with_name('olbi_diario.sav')

datos = urllib.request.urlopen(URL).read()
if hashlib.sha256(datos).hexdigest() != SHA256:
    raise SystemExit('El archivo descargado no coincide con el hash publicado')
DESTINO.write_bytes(datos)
print(f'{DESTINO.name}: {len(datos)} bytes, hash verificado')
