"""
update_poligonos.py
Actualiza SOLO los polígonos (y punto central) de territorios específicos
leídos desde un KML. NO toca grupoId, tipo, notas ni ningún otro campo.

Uso:
    python update_poligonos.py --congre sur --ids 121 --kml nuevo_121.kml
    python update_poligonos.py --congre sur --ids 121 45 67 --kml parche.kml
    python update_poligonos.py --congre sur --ids all --kml ciudad.kml

Argumentos:
    --congre   ID de congregación en Firestore  (ej: sur, norte)
    --kml      Ruta al archivo KML
    --ids      Lista de IDs a actualizar, o "all" para todos los del KML

Archivos necesarios:
    - serviceAccountKey.json  (en la misma carpeta, nunca committear)

Instalar dependencias:
    pip install firebase-admin
"""

import argparse
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import xml.etree.ElementTree as ET
import firebase_admin
from firebase_admin import credentials, firestore

# ─── KML PARSER ──────────────────────────────────────────────────────────────

def parse_kml(path):
    """
    Parsea un KML y devuelve dict: { base_id_int -> { id, poligonos, punto } }
    Soporta nombres: "121", "121a", "Territorio 121", "Territorio 121a", etc.
    """
    tree = ET.parse(path)
    root = tree.getroot()

    # Namespace de KML (Google My Maps usa el estándar)
    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'

    def tag(t):
        return f'{ns}{t}'

    territories = {}

    for pm in root.iter(tag('Placemark')):
        name_el = pm.find(tag('name'))
        name = name_el.text.strip() if name_el is not None and name_el.text else ''

        # Extrae número base: "121a" → 121, "Territorio 121b" → 121
        match = re.search(r'(\d+)[a-zA-Z]*$', name)
        if not match:
            continue
        base_id = int(match.group(1))

        if base_id not in territories:
            territories[base_id] = {
                'id':        base_id,
                'nombre':    f'Territorio {base_id}',
                'punto':     None,
                'poligonos': [],
            }

        # Punto central
        point_el = pm.find(f'.//{tag("Point")}/{tag("coordinates")}')
        if point_el is not None and point_el.text:
            parts = point_el.text.strip().split(',')
            if len(parts) >= 2:
                try:
                    lng, lat = float(parts[0]), float(parts[1])
                    territories[base_id]['punto'] = {'lat': lat, 'lng': lng}
                except ValueError:
                    pass

        # Polígonos
        for poly in pm.iter(tag('Polygon')):
            outer = poly.find(f'{tag("outerBoundaryIs")}/{tag("LinearRing")}/{tag("coordinates")}')
            if outer is None or not outer.text:
                continue
            coords = []
            for token in outer.text.strip().split():
                parts = token.split(',')
                if len(parts) >= 2:
                    try:
                        coords.append({'lat': float(parts[1]), 'lng': float(parts[0])})
                    except ValueError:
                        pass
            if coords:
                territories[base_id]['poligonos'].append({'coords': coords})

    return {k: v for k, v in territories.items() if v['poligonos']}

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Actualiza polígonos de territorios en Firestore sin tocar otros campos.')
    parser.add_argument('--congre', required=True, help='ID de congregación (ej: sur)')
    parser.add_argument('--kml',    required=True, help='Ruta al archivo KML')
    parser.add_argument('--ids',    nargs='+',     required=True,
                        help='IDs de territorios a actualizar, o "all" para todos los del KML')
    args = parser.parse_args()

    # Parsear KML
    print(f'📂 Leyendo {args.kml}...')
    try:
        kml_data = parse_kml(args.kml)
    except FileNotFoundError:
        print(f'❌ No se encontró el archivo: {args.kml}')
        sys.exit(1)
    except ET.ParseError as e:
        print(f'❌ Error parseando el KML: {e}')
        sys.exit(1)

    print(f'   ✓ {len(kml_data)} territorios encontrados en el KML: {sorted(kml_data.keys())}')

    # Filtrar IDs a actualizar
    if args.ids == ['all']:
        targets = kml_data
    else:
        targets = {}
        for raw_id in args.ids:
            try:
                tid = int(raw_id)
            except ValueError:
                print(f'⚠️  ID inválido ignorado: {raw_id}')
                continue
            if tid not in kml_data:
                print(f'⚠️  Territorio {tid} no encontrado en el KML — se omite')
            else:
                targets[tid] = kml_data[tid]

    if not targets:
        print('❌ Ningún territorio válido para actualizar.')
        sys.exit(1)

    print(f'\n🎯 Territorios a actualizar: {sorted(targets.keys())}')
    for tid, t in sorted(targets.items()):
        n_polys = len(t['poligonos'])
        punto = t['punto']
        print(f'   • {tid}: {n_polys} polígono(s), punto={punto}')

    # Confirmar
    resp = input('\n¿Continuar? (s/n): ').strip().lower()
    if resp not in ('s', 'si', 'sí', 'y', 'yes'):
        print('Cancelado.')
        sys.exit(0)

    # Firebase
    print('\n🔥 Conectando a Firebase...')
    try:
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f'❌ Error con serviceAccountKey.json: {e}')
        sys.exit(1)

    db = firestore.client()
    congre_ref = db.collection('congregaciones').document(args.congre)
    terr_col   = congre_ref.collection('territorios')
    mapa_col   = congre_ref.collection('mapa_territorios')

    # Actualizar — SOLO poligonos y punto, nada más
    ok = 0
    for tid, t in sorted(targets.items()):
        doc_ref = terr_col.document(str(tid))
        existing = doc_ref.get()
        if not existing.exists:
            print(f'⚠️  Territorio {tid} no existe en Firestore para congre "{args.congre}" — se omite')
            continue

        update_data = {'poligonos': t['poligonos']}
        if t['punto']:
            update_data['punto'] = t['punto']

        doc_ref.update(update_data)
        n_polys = len(t['poligonos'])
        print(f'   ✅ Territorio {tid}: {n_polys} polígono(s) actualizados en territorios')

        # Espejo en mapa_territorios (usado por Ver Mapa público)
        mapa_ref = mapa_col.document(str(tid))
        if mapa_ref.get().exists:
            mapa_ref.update(update_data)
            print(f'   ✅ Territorio {tid}: espejo mapa_territorios actualizado')

        ok += 1

    print(f'\n{"="*50}')
    print(f'✅ {ok}/{len(targets)} territorios actualizados')
    print(f'   Congregación : {args.congre}')
    print(f'   Campos tocados: poligonos, punto')
    print(f'   Intactos      : grupoId, tipo, notas, nombre, ciudad')
    print(f'{"="*50}')

if __name__ == '__main__':
    main()
