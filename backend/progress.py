# ============================================
# PROGRESS.PY
# Tracks live processing progress.
# React polls this to show progress bars.
# ============================================

import time
import threading

_progress = {
    'running':        False,
    'stage':          '',
    'current':        0,
    'total':          0,
    'percent':        0,
    'current_file':   '',
    'message':        '',
    'started_at':     None,
    'eta_seconds':    None,
    'faces_found':    0,
    'auto_tagged':    0,
    'clusters_found': 0,
    'errors':         0,
    'complete':       False,
}

_lock = threading.Lock()


def start_progress(stage: str, total: int, message: str = ''):
    with _lock:
        _progress['running']      = True
        _progress['stage']        = stage
        _progress['current']      = 0
        _progress['total']        = total
        _progress['percent']      = 0
        _progress['current_file'] = ''
        _progress['message']      = message
        _progress['started_at']   = time.time()
        _progress['eta_seconds']  = None
        _progress['complete']     = False


def update_progress(current: int, current_file: str = '', message: str = ''):
    with _lock:
        _progress['current']      = current
        _progress['current_file'] = current_file
        if message:
            _progress['message'] = message
        if _progress['total'] > 0:
            _progress['percent'] = round(
                (current / _progress['total']) * 100, 1
            )
        if _progress['started_at'] and current > 0:
            elapsed   = time.time() - _progress['started_at']
            per_item  = elapsed / current
            remaining = _progress['total'] - current
            _progress['eta_seconds'] = int(per_item * remaining)


def update_stats(
    faces_found: int = None,
    auto_tagged: int = None,
    clusters_found: int = None,
    errors: int = None
):
    with _lock:
        if faces_found is not None:
            _progress['faces_found'] = faces_found
        if auto_tagged is not None:
            _progress['auto_tagged'] = auto_tagged
        if clusters_found is not None:
            _progress['clusters_found'] = clusters_found
        if errors is not None:
            _progress['errors'] = errors


def finish_progress(message: str = 'Complete'):
    with _lock:
        _progress['running']     = False
        _progress['complete']    = True
        _progress['percent']     = 100
        _progress['message']     = message
        _progress['eta_seconds'] = 0


def get_progress() -> dict:
    with _lock:
        return dict(_progress)


def reset_progress():
    with _lock:
        _progress['running']        = False
        _progress['stage']          = ''
        _progress['current']        = 0
        _progress['total']          = 0
        _progress['percent']        = 0
        _progress['current_file']   = ''
        _progress['message']        = ''
        _progress['started_at']     = None
        _progress['eta_seconds']    = None
        _progress['faces_found']    = 0
        _progress['auto_tagged']    = 0
        _progress['clusters_found'] = 0
        _progress['errors']         = 0
        _progress['complete']       = False