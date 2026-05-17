"""
update_vm_mayo2026.py
Asigna los hermanos del programa de Vida y Ministerio de Mayo 2026
a las semanas correspondientes en Firestore.

Requiere que las semanas ya existan en Firestore (creadas por importación WOL).
Solo actualiza los campos pubId / ayudante — no toca títulos ni duraciones.

Uso:
    pip install firebase-admin
    cd tools && python update_vm_mayo2026.py
"""

import io
import sys
import unicodedata

import firebase_admin
from firebase_admin import credentials, firestore

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ─── Config ───────────────────────────────────────────────────────────────────

CONGRE_ID = "sur"
KEY_FILE  = "serviceAccountKey.json"

# ─── Datos del programa de Mayo 2026 ─────────────────────────────────────────
#
# Estructura por semana:
#   presidente / oracionApertura / oracionCierre : nombre del hermano
#   tesoros_discurso / tesoros_joyas             : nombre del hermano
#   tesoros_lectura_sp / tesoros_lectura_sa      : Sala Principal / Sala Auxiliar
#   ministerio[]: { sp, sp_ay, sa, sa_ay }  (sp_ay/sa_ay None si es discurso)
#   vidaCristiana[]: { pub }  (el estudio bíblico es el último)

SEMANAS = {
    # ── Semana del 4 al 10 de Mayo ────────────────────────────────────────────
    "2026-05-04": {
        "presidente":      "Diego Reynoso",
        "oracionApertura": "Jonatán Zurita",
        "oracionCierre":   "Diego Reynoso",
        "tesoros_discurso": "Carlos Rodriguez",
        "tesoros_joyas":    "Jorge Bravo",
        "tesoros_lectura_sp": "Pablo Zurita",
        "tesoros_lectura_sa": "Norberto Alday",
        "ministerio": [
            # 1 – Empiece conversaciones. DE CASA EN CASA (3 min)
            {"sp": "Maria Gutierrez",  "sp_ay": "Pamela Bueno",
             "sa": "Andrea Campos",   "sa_ay": "Marcela Sanchez"},
            # 2 – Empiece conversaciones. PREDICACION INFORMAL (4 min)
            {"sp": "Abigail Manso",   "sp_ay": "Nelida Rodriguez",
             "sa": "Marcela Scalese", "sa_ay": "Nilda Flores"},
            # 3 – Discurso (5 min) — sin ayudante
            {"sp": "Ruben Reyes",     "sp_ay": None,
             "sa": "Oscar Busto",     "sa_ay": None},
        ],
        "vidaCristiana": [
            {"pub": "Jose Reynoso"},   # 15 min – "Sean siempre hospitalarios"
            {"pub": "Luis Zorrilla"},  # 30 min – Estudio bíblico
        ],
    },

    # ── Semana del 11 al 17 de Mayo ───────────────────────────────────────────
    "2026-05-11": {
        "presidente":      "Emmanuel Espinal",
        "oracionApertura": "Mario Farias",
        "oracionCierre":   "Emmanuel Espinal",
        "tesoros_discurso": "Jonatan Zurita",
        "tesoros_joyas":    "Oscar Briguez",
        "tesoros_lectura_sp": "Lucas Navarro",
        "tesoros_lectura_sa": "Ignacio Busto",
        "ministerio": [
            # 1 – Empiece conversaciones PREDICACION INFORMAL (3 min)
            {"sp": "Rocio Lucero",    "sp_ay": "Carolina Avila",
             "sa": "Mirta Soto",      "sa_ay": "Marcela Arias"},
            # 2 – Haga revisitas PREDICACIÓN INFORMAL (4 min)
            {"sp": "Ana Llanos",      "sp_ay": "Carolina Zamudio",
             "sa": "Macarena Campos", "sa_ay": "Elsa Reynoso"},
            # 3 – Haga discípulos (5 min)
            {"sp": "Benjamin Oberts", "sp_ay": "Fernando Oberts",
             "sa": "Stephenie Soto",  "sa_ay": "Viviana Loisa"},
        ],
        "vidaCristiana": [
            {"pub": "Emmanuel Espinal"},  # 15 min – Informe N°3 del CG
            {"pub": "Mariano Soto"},      # 30 min – Estudio bíblico
        ],
    },

    # ── Semana del 18 al 24 de Mayo ───────────────────────────────────────────
    "2026-05-18": {
        "presidente":      "Mauro Tobares",
        "oracionApertura": "Oscar Briguez",
        "oracionCierre":   "Mauro Tobares",
        "tesoros_discurso": "Natanael Araque",
        "tesoros_joyas":    "Andres Sanchez",
        "tesoros_lectura_sp": "Benjamin Busto",
        "tesoros_lectura_sa": "Bruno Lucero",
        "ministerio": [
            # 1 – Empiece conversaciones. PREDICACIÓN PÚBLICA (3 min)
            {"sp": "Dora Lucero",       "sp_ay": "Isabela Caro",
             "sa": "Isabela Camarata",  "sa_ay": "Macarena Campos"},
            # 2 – Haga revisitas DE CASA EN CASA (4 min)
            {"sp": "Celia Perez",       "sp_ay": "Rocío Lucero",
             "sa": "Belén Reyes",       "sa_ay": "Verónica Sanchez"},
            # 3 – Haga discípulos (5 min)
            {"sp": "Alicia Fraga",      "sp_ay": "Alejandra Rodriguez",
             "sa": "Mirta Briguez",     "sa_ay": "Abigail Araque"},
        ],
        "vidaCristiana": [
            {"pub": "Diego Reynoso"},   # 15 min – Preparados para emergencias
            {"pub": "Enzo Acosta"},     # 30 min – Estudio bíblico
        ],
    },

    # ── Semana del 25 de Mayo al 1 de Junio ───────────────────────────────────
    # (El programa dice "26 de Mayo" — la semanaId en Firestore es el lunes 25/05)
    "2026-05-25": {
        "presidente":      "Mariano Soto",
        "oracionApertura": "Oscar Briguez",
        "oracionCierre":   "Mariano Soto",
        "tesoros_discurso": "Jorge Bravo",
        "tesoros_joyas":    "Manuel Lopez",
        "tesoros_lectura_sp": "Nazareno Manso",
        "tesoros_lectura_sa": "Hugo Unaiche",
        "ministerio": [
            # 1 – Empiece conversaciones. PREDICACIÓN INFORMAL (3 min)
            {"sp": "Eliana Zorrilla", "sp_ay": "Marcela Lopez",
             "sa": "Celeste Gil",     "sa_ay": "Susana Ferrer"},
            # 2 – Empiece conversaciones PREDICACIÓN PUBLICA (2 min)
            {"sp": "Marcela Flores",  "sp_ay": "Mirta Nuñez",
             "sa": "Marcela Avila",   "sa_ay": "Nelida Reyes"},
            # 3 – Empiece conversaciones. DE CASA EN CASA (3 min)
            {"sp": "Mirta Navarro",   "sp_ay": "Rut Carra",
             "sa": "Ignacio Busto",   "sa_ay": "Jasiel Rodriguez"},
            # 4 – Explique sus creencias. Escenificación (3 min)
            {"sp": "Romina Fernández", "sp_ay": "Norma Schneider",
             "sa": "Eduardo Scalese", "sa_ay": "Malco Scalese"},
        ],
        "vidaCristiana": [
            {"pub": "Emmanuel Espinal"},  # 15 min – ¿Tendrás vida llena de cosas buenas?
            {"pub": "Jose Reynoso"},      # 30 min – Estudio bíblico
        ],
    },
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalizar(s):
    """Lowercase + sin tildes para comparación fuzzy."""
    if not s:
        return ""
    s = s.lower().strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def build_name_map(pubs_snap):
    name_to_id = {}
    id_to_name = {}
    for p in pubs_snap:
        d = p.to_dict()
        nombre = d.get("nombre", "").strip()
        if nombre:
            name_to_id[normalizar(nombre)] = p.id
            id_to_name[p.id] = nombre
    return name_to_id, id_to_name


def find_id(name, name_to_id, id_to_name, unmatched):
    if not name:
        return None
    norm = normalizar(name)
    if norm in name_to_id:
        pid = name_to_id[norm]
        print(f"    ✓ {name} → {pid} ({id_to_name[pid]})")
        return pid
    # Fallback: todos los tokens presentes en la clave
    tokens = norm.split()
    candidates = [k for k in name_to_id if all(t in k for t in tokens)]
    if len(candidates) == 1:
        pid = name_to_id[candidates[0]]
        print(f"    ~ {name} → {pid} ({id_to_name[pid]})  [fuzzy]")
        return pid
    if len(candidates) > 1:
        names = [id_to_name[name_to_id[c]] for c in candidates]
        print(f"    ⚠ Ambiguo '{name}': {names}")
    else:
        print(f"    ✗ No encontrado: '{name}'")
        unmatched.append(name)
    return None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    cred = credentials.Certificate(KEY_FILE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Cargar publicadores
    print("Cargando publicadores…")
    pubs_snap = (
        db.collection("congregaciones")
        .document(CONGRE_ID)
        .collection("publicadores")
        .get()
    )
    name_to_id, id_to_name = build_name_map(pubs_snap)
    print(f"  {len(name_to_id)} publicadores cargados.\n")

    vm_col = (
        db.collection("congregaciones")
        .document(CONGRE_ID)
        .collection("vidaministerio")
    )

    unmatched = []

    for semana_id, data in SEMANAS.items():
        print(f"── {semana_id} ──────────────────────────────────────────")
        doc_ref = vm_col.document(semana_id)
        doc = doc_ref.get()

        if not doc.exists:
            print(f"  ⚠  Doc {semana_id} no existe en Firestore — saltando.\n")
            continue

        existing = doc.to_dict()

        def pid(name):
            return find_id(name, name_to_id, id_to_name, unmatched)

        updates = {
            "presidente":      pid(data["presidente"]),
            "oracionApertura": pid(data["oracionApertura"]),
            "oracionCierre":   pid(data["oracionCierre"]),
        }

        # ── Tesoros ──────────────────────────────────────────────────────────
        t = existing.get("tesoros", {})
        if "discurso" in t:
            t["discurso"]["pubId"] = pid(data["tesoros_discurso"])
        if "joyas" in t:
            t["joyas"]["pubId"] = pid(data["tesoros_joyas"])
        if "lecturaBiblica" in t:
            t["lecturaBiblica"]["pubId"]     = pid(data["tesoros_lectura_sp"])
            t["lecturaBiblica"]["ayudante"]  = None
            sa = t["lecturaBiblica"].get("salaAux")
            if sa is not None:
                t["lecturaBiblica"]["salaAux"]["pubId"]    = pid(data["tesoros_lectura_sa"])
                t["lecturaBiblica"]["salaAux"]["ayudante"] = None
        updates["tesoros"] = t

        # ── Ministerio ───────────────────────────────────────────────────────
        min_ex   = existing.get("ministerio", [])
        min_data = data["ministerio"]
        for i, slot in enumerate(min_data):
            if i >= len(min_ex):
                print(f"    ⚠ ministerio[{i}] no existe en el doc — saltando slot")
                continue
            min_ex[i]["pubId"]    = pid(slot["sp"])
            min_ex[i]["ayudante"] = pid(slot.get("sp_ay"))
            sa = min_ex[i].get("salaAux")
            if sa is not None:
                min_ex[i]["salaAux"]["pubId"]    = pid(slot.get("sa"))
                min_ex[i]["salaAux"]["ayudante"] = pid(slot.get("sa_ay"))
        updates["ministerio"] = min_ex

        # ── Vida Cristiana ────────────────────────────────────────────────────
        vc_ex   = existing.get("vidaCristiana", [])
        vc_data = data["vidaCristiana"]
        for i, slot in enumerate(vc_data):
            if i >= len(vc_ex):
                print(f"    ⚠ vidaCristiana[{i}] no existe en el doc — saltando slot")
                continue
            vc_ex[i]["pubId"] = pid(slot["pub"])
        updates["vidaCristiana"] = vc_ex

        doc_ref.update(updates)
        print(f"  ✓ Semana {semana_id} actualizada.\n")

    # ── Resumen final ─────────────────────────────────────────────────────────
    if unmatched:
        print(f"\n{'='*60}")
        print(f"⚠  Hermanos no encontrados en Firestore ({len(unmatched)}):")
        for n in sorted(set(unmatched)):
            print(f"   - {n}")
        print("  Verificá nombres en Administrador → Lista de Hermanos")
    else:
        print("✓ Todos los hermanos fueron encontrados y asignados.")


if __name__ == "__main__":
    main()
