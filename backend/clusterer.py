# ============================================
# CLUSTERER.PY
# Two-stage face matching + clustering.
# Stage 1: Match against known people
# Stage 2: Cluster remaining unknowns
# ============================================

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import normalize
from tqdm import tqdm
import json

from config import (
    CLUSTER_EPS, CLUSTER_MIN_SAMPLES,
    FACE_MATCH_THRESHOLD
)
from database import (
    get_connection, assign_face_to_cluster,
    create_cluster,
)
from progress import (
    start_progress, update_progress,
    update_stats, finish_progress
)


def cosine_similarity(a, b):
    a = a / (np.linalg.norm(a) + 1e-10)
    b = b / (np.linalg.norm(b) + 1e-10)
    return float(np.dot(a, b))


def get_known_people_embeddings():
    conn = get_connection()
    people = conn.execute(
        "SELECT id, name FROM persons"
    ).fetchall()

    result = []
    for person in people:
        faces = conn.execute("""
            SELECT embedding FROM faces
            WHERE person_id = ?
            AND embedding IS NOT NULL
        """, (person['id'],)).fetchall()

        if not faces:
            continue

        embeddings = []
        for face in faces:
            try:
                emb = json.loads(face['embedding'])
                embeddings.append(np.array(emb))
            except Exception:
                continue

        if not embeddings:
            continue

        result.append({
            'person_id':   person['id'],
            'person_name': person['name'],
            'embedding':   np.mean(embeddings, axis=0),
            'face_count':  len(embeddings),
        })

    conn.close()
    return result


def get_unassigned_embeddings():
    conn = get_connection()
    rows = conn.execute("""
        SELECT id, embedding FROM faces
        WHERE person_id IS NULL
        AND embedding IS NOT NULL
    """).fetchall()
    conn.close()

    result = []
    for row in rows:
        try:
            emb = json.loads(row['embedding'])
            result.append({
                'face_id':   row['id'],
                'embedding': np.array(emb),
            })
        except Exception:
            continue
    return result


def stage1_match_known(unassigned, known_people):
    if not known_people:
        return unassigned, 0

    print(f"\n🔍 Stage 1: Matching against {len(known_people)} people...")

    start_progress(
        'clustering', len(unassigned),
        f'Matching against {len(known_people)} known people...'
    )

    still_unassigned = []
    auto_tagged      = 0
    processed        = 0
    conn             = get_connection()

    for face in tqdm(unassigned, desc="Matching"):
        processed       += 1
        best_person      = None
        best_score       = 0.0

        for person in known_people:
            score = cosine_similarity(
                face['embedding'], person['embedding']
            )
            if score > best_score:
                best_score  = score
                best_person = person

        if best_score >= FACE_MATCH_THRESHOLD and best_person:
            conn.execute("""
                UPDATE faces
                SET person_id = ?, cluster_id = NULL
                WHERE id = ?
            """, (best_person['person_id'], face['face_id']))
            auto_tagged += 1
        else:
            still_unassigned.append(face)

        update_progress(processed, '', f'{auto_tagged} auto-tagged')
        update_stats(auto_tagged=auto_tagged)

    conn.execute("""
        UPDATE photos SET has_faces = TRUE
        WHERE id IN (
            SELECT DISTINCT photo_id FROM faces
            WHERE person_id IS NOT NULL
        )
    """)
    conn.commit()
    conn.close()

    print(f"   ✅ Auto-tagged: {auto_tagged}")
    print(f"   ❓ Unknown:     {len(still_unassigned)}")

    return still_unassigned, auto_tagged


def stage2_cluster(unassigned):
    if not unassigned:
        print("\n✅ No unknowns to cluster")
        return 0

    print(f"\n🧮 Stage 2: Clustering {len(unassigned)} faces...")

    conn = get_connection()
    conn.execute("DELETE FROM clusters WHERE named = FALSE")
    conn.execute("""
        UPDATE faces SET cluster_id = NULL
        WHERE cluster_id IS NOT NULL AND person_id IS NULL
    """)
    conn.commit()
    conn.close()

    clusters_created = 0

    if len(unassigned) >= CLUSTER_MIN_SAMPLES:
        face_ids   = [f['face_id']   for f in unassigned]
        embeddings = [f['embedding'] for f in unassigned]

        X = normalize(np.array(embeddings), norm='l2')

        clustering = DBSCAN(
            eps=CLUSTER_EPS,
            min_samples=CLUSTER_MIN_SAMPLES,
            metric='cosine',
            n_jobs=-1
        ).fit(X)

        labels          = clustering.labels_
        unique_clusters = set(labels)
        unique_clusters.discard(-1)
        noise_count     = list(labels).count(-1)

        print(f"   ✅ {len(unique_clusters)} groups found")
        print(f"   ⚠️  {noise_count} unique faces")

        for label in tqdm(unique_clusters, desc="Saving"):
            db_id = create_cluster()

            cluster_faces = [
                face_ids[i]
                for i, l in enumerate(labels)
                if l == label
            ]

            for fid in cluster_faces:
                assign_face_to_cluster(fid, db_id)

            conn = get_connection()
            conn.execute("""
                UPDATE clusters SET face_count = ?
                WHERE id = ?
            """, (len(cluster_faces), db_id))
            conn.commit()
            conn.close()

            clusters_created += 1
    else:
        print(f"   ⚠️  Only {len(unassigned)} faces, need {CLUSTER_MIN_SAMPLES}")

    return clusters_created


def update_person_counts():
    conn = get_connection()
    conn.execute("""
        UPDATE persons
        SET photo_count = (
            SELECT COUNT(DISTINCT photo_id)
            FROM faces WHERE person_id = persons.id
        )
    """)
    conn.commit()
    conn.close()


def run_clustering():
    print("\n🧮 Smart face matching + clustering...")
    print("=" * 50)

    unassigned = get_unassigned_embeddings()

    if not unassigned:
        print("✅ All faces identified!")
        finish_progress("All faces identified.")
        return

    print(f"📊 Unassigned: {len(unassigned)}")

    known = get_known_people_embeddings()

    if known:
        print(f"👥 Known people: {len(known)}")
        for p in known:
            print(f"   - {p['person_name']} ({p['face_count']} refs)")

    still_unknown, auto_tagged = stage1_match_known(unassigned, known)
    clusters_created           = stage2_cluster(still_unknown)

    update_person_counts()

    update_stats(
        auto_tagged=auto_tagged,
        clusters_found=clusters_created
    )
    finish_progress(
        f'{auto_tagged} auto-tagged, '
        f'{clusters_created} new groups.'
    )

    print("\n" + "=" * 50)
    print("✅ COMPLETE")
    print(f"   🎯 Auto-tagged:  {auto_tagged}")
    print(f"   👥 New groups:   {clusters_created}")
    print("=" * 50)


if __name__ == "__main__":
    run_clustering()