"""
Starts TWO tunnels (API + React).
Updates api.js with API URL so React knows where to fetch.
Updates GitHub Pages with React URL for family bookmark.
"""

import subprocess
import re
import sys
import os
import time
from pathlib import Path

# ─── Get the directory where THIS script lives ───
SCRIPT_DIR = Path(__file__).parent.resolve()

# ─── CONFIGURE ───────────────────────────────
GITHUB_USERNAME = "YOUR_GITHUB_USERNAME"
REPO_NAME = "family-gallery-redirect"
REPO_PATH = SCRIPT_DIR / "family-gallery-redirect"
PROJECT_PATH = SCRIPT_DIR
API_JS_PATH = PROJECT_PATH / "src" / "services" / "api.js"
# ─────────────────────────────────────────────


def start_tunnel(port, name):
    """Start a tunnel and grab the URL"""
    print(f"🚀 Starting tunnel for {name} (port {port})...")
    
    proc = subprocess.Popen(
        ['cloudflared', 'tunnel', '--url', f'http://localhost:{port}'],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    url = None
    for line in proc.stdout:
        print(f"  [{name}] {line.strip()}")
        match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
        if match:
            url = match.group(0)
            print(f"\n✅ {name} URL: {url}\n")
            break
    
    return proc, url


def update_api_js(api_url):
    """Update the API URL in api.js"""
    content = API_JS_PATH.read_text()
    
    new_content = re.sub(
        r"(: ')https://[a-zA-Z0-9-]+\.trycloudflare\.com(')",
        f"\\1{api_url}\\2",
        content
    )
    
    API_JS_PATH.write_text(new_content)
    print(f"✅ api.js updated with API URL")


def update_html(react_url):
    """Update GitHub Pages HTML with smart redirect"""
    cache_bust = int(time.time())
    
    # Write URL to JSON so React can fetch it fresh
    json_data = f'{{"url":"{react_url}","time":{cache_bust}}}'
    (REPO_PATH / "url.json").write_text(json_data, encoding='utf-8')
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Family Gallery</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
        body {{
            background: #0a0a0a;
            color: #fff;
            font-family: -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            flex-direction: column;
        }}
        a {{ color: #6366f1; text-decoration: none; padding: 12px 24px; 
             background: #1e1e1e; border-radius: 8px; margin-top: 12px; }}
    </style>
</head>
<body>
    <h2>📸 Loading Family Gallery...</h2>
    <p id="status">Fetching latest URL...</p>
    <a href="#" id="fallback" style="display:none">Click to continue</a>
    
    <script>
        const bustCache = Date.now();
        fetch('url.json?t=' + bustCache, {{
            cache: 'no-store',
        }})
        .then(r => r.json())
        .then(data => {{
            document.getElementById('status').textContent = 'Redirecting...';
            const link = document.getElementById('fallback');
            link.href = data.url;
            link.style.display = 'inline-block';
            window.location.replace(data.url);
        }})
        .catch(err => {{
            document.getElementById('status').textContent = 
                'Error loading gallery. Please refresh.';
        }});
    </script>
</body>
</html>
"""
    index_file = REPO_PATH / "index.html"
    index_file.write_text(html, encoding='utf-8')
    print("✅ GitHub Pages HTML + URL data updated")


def push_to_github():
    """Push updates to GitHub"""
    original_dir = os.getcwd()
    try:
        os.chdir(str(REPO_PATH))
        subprocess.run(["git", "add", "index.html", "url.json"], check=True)
        
        result = subprocess.run(
            ["git", "diff", "--cached", "--exit-code"],
            capture_output=True
        )
        if result.returncode == 0:
            print("ℹ️  No changes to push")
            return True
        
        subprocess.run(["git", "commit", "-m", "Update tunnel URL"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("✅ Pushed to GitHub")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Git error: {e}")
        return False
    finally:
        os.chdir(original_dir)


if __name__ == "__main__":
    # ─── Step 1: Start API tunnel ───
    api_proc, api_url = start_tunnel(8000, "API")
    if not api_url:
        print("❌ Failed to get API tunnel URL")
        sys.exit(1)
    
    # ─── Step 2: Update api.js with new API URL ───
    update_api_js(api_url)
    
    # ─── Step 3: Wait for React to hot-reload ───
    print("⏳ Waiting 5 seconds for React to pick up new API URL...\n")
    time.sleep(5)
    
    # ─── Step 4: Start React tunnel ───
    react_proc, react_url = start_tunnel(3000, "React")
    if not react_url:
        print("❌ Failed to get React tunnel URL")
        api_proc.terminate()
        sys.exit(1)
    
    # ─── Step 5: Update GitHub Pages ───
    update_html(react_url)
    push_to_github()
    
    # ─── Step 6: Show family URL ───
    permanent_url = f"https://{GITHUB_USERNAME}.github.io/{REPO_NAME}"
    
    # Copy to clipboard
    try:
        subprocess.run(
            'clip',
            input=permanent_url,
            text=True,
            check=True,
            shell=True
        )
        clipboard_msg = "  📋 Copied to clipboard"
    except Exception:
        clipboard_msg = ""
    
    print()
    print("=" * 60)
    print(f"  📱 SHARE THIS URL WITH FAMILY:")
    print(f"  {permanent_url}")
    if clipboard_msg:
        print(clipboard_msg)
    print("=" * 60)
    print()
    print(f"  🔧 Direct React URL: {react_url}")
    print(f"  🔧 Direct API URL:   {api_url}")
    print()
    print("Press Ctrl+C to stop tunnels")
    print()
    
    try:
        react_proc.wait()
    except KeyboardInterrupt:
        print("\n\nStopping tunnels...")
        api_proc.terminate()
        react_proc.terminate()