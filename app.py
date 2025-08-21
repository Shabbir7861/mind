from flask import Flask, request, jsonify, send_file, send_from_directory
import os
import json
import requests
import yt_dlp
from werkzeug.utils import secure_filename
import shutil
import glob

# --- PATH Environment Variable Check (Optional, for debugging) ---
print("\n--- Flask App Environment PATH ---")
print(os.environ.get('PATH'))
print("----------------------------------\n")
# --- End PATH Check ---


app = Flask(__name__, static_folder='static', static_url_path='')
PLAYLISTS_FILE = "playlists.json"
PLAYLIST_IMAGES = "playlist_images"
SONGS_FOLDER = "songs"
LYRICS_FOLDER = "lyrics"

os.makedirs(PLAYLIST_IMAGES, exist_ok=True)
os.makedirs(SONGS_FOLDER, exist_ok=True)
os.makedirs(LYRICS_FOLDER, exist_ok=True)

# --- PLAYLIST MANAGEMENT ---

def load_playlists_data():
    if os.path.exists(PLAYLISTS_FILE):
        with open(PLAYLISTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_playlists_data(playlists_data):
    with open(PLAYLISTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(playlists_data, f, indent=4)

@app.route('/playlists', methods=['GET', 'POST'])
def playlists():
    playlists_data = load_playlists_data()
    if request.method == 'GET':
        return jsonify(playlists_data)
    elif request.method == 'POST':
        name = request.form.get('name')
        image = request.files.get('image')
        if not name or not image:
            return jsonify({"error": "Name and image required"}), 400

        filename = secure_filename(image.filename)
        image_path = os.path.join(PLAYLIST_IMAGES, filename)
        image.save(image_path)

        new_playlist = {"name": name, "image": filename, "songs": []}
        playlists_data.append(new_playlist)
        save_playlists_data(playlists_data)
        return jsonify(new_playlist)

@app.route('/playlist/<name>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def playlist(name):
    playlists_data = load_playlists_data()
    playlist_found = next((p for p in playlists_data if p['name'] == name), None)

    if not playlist_found:
        return jsonify({"error": "Playlist not found"}), 404

    if request.method == 'GET':
        return jsonify(playlist_found)
    elif request.method == 'POST': # Used for updating songs
        playlist_found['songs'] = request.json.get('songs', [])
        save_playlists_data(playlists_data)
        return jsonify(playlist_found)
    elif request.method == 'PUT': # Used for updating playlist name/image
        new_name = request.form.get('name')
        new_image = request.files.get('image')

        if new_name:
            playlist_found['name'] = new_name
        if new_image:
            old_image_path = os.path.join(PLAYLIST_IMAGES, playlist_found['image'])
            if os.path.exists(old_image_path):
                os.remove(old_image_path)
            
            new_image_filename = secure_filename(new_image.filename)
            new_image_path = os.path.join(PLAYLIST_IMAGES, new_image_filename)
            new_image.save(new_image_path)
            playlist_found['image'] = new_image_filename
        
        save_playlists_data(playlists_data)
        return jsonify(playlist_found)
    elif request.method == 'DELETE':
        # Delete associated image
        image_path = os.path.join(PLAYLIST_IMAGES, playlist_found['image'])
        if os.path.exists(image_path):
            os.remove(image_path)
        
        # Optionally delete associated song files (can be complex if songs are shared across playlists)
        # For simplicity, we'll leave song files for now.
        
        playlists_data.remove(playlist_found)
        save_playlists_data(playlists_data)
        return jsonify({"message": "Playlist deleted successfully"}), 200

@app.route('/playlist_images/<filename>')
def serve_playlist_image(filename):
    return send_from_directory(PLAYLIST_IMAGES, filename)

# --- SONG DOWNLOAD AND SERVE ---

@app.route('/download', methods=['POST'])
def download_general_url():
    url = request.json.get('url')
    title = request.json.get('title', 'downloaded_song')
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    try:
        filename = os.path.join(SONGS_FOLDER, f"{secure_filename(title)}.mp3")
        r = requests.get(url, stream=True)
        if r.status_code == 200:
            with open(filename, 'wb') as f:
                for chunk in r.iter_content(1024):
                    f.write(chunk)
            return jsonify({"url": f"/songs/{os.path.basename(filename)}", "title": title})
        else:
            return jsonify({"error": "Failed to download"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/songs/<filename>')
def serve_song(filename):
    return send_from_directory(SONGS_FOLDER, filename)

# --- Youtube & DOWNLOAD ---

@app.route('/search_online', methods=['POST'])
def search_online():
    data = request.get_json()
    query = data.get('query', '')
    count = data.get('count', 10)
    if not query:
        return jsonify([])
    
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,
        'skip_download': True,
        'noplaylist': True,
        'default_search': f'ytsearch{count}',
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            results = []
            if "youtube.com/watch?v=" in query or "youtu.be/" in query:
                info = ydl.extract_info(query, download=False)
                if info and info.get('id'):
                    results.append({
                        'title': info.get('title', 'Unknown Title'),
                        'url': f"https://www.youtube.com/watch?v={info['id']}"
                    })
            else:
                search_query_formatted = f"ytsearch{count}:{query}"
                entries = ydl.extract_info(search_query_formatted, download=False)['entries']
                for entry in entries:
                    if entry and entry.get('title') and entry.get('id'):
                        results.append({
                            'title': entry['title'],
                            'url': f"https://www.youtube.com/watch?v={entry['id']}"
                        })
        except Exception as e:
            print(f"Error during Youtube: {e}")
            return jsonify([]), 500
    return jsonify(results)

@app.route('/download_online', methods=['POST'])
def download_online():
    data = request.get_json()
    url = data.get('url')
    title = data.get('title', 'downloaded_song')
    if not url:
        return jsonify({"error": "No URL provided"}), 400

    song_filename_base = secure_filename(title)
    audio_full_path = os.path.join(SONGS_FOLDER, f"{song_filename_base}.mp3")
    # This is the path pattern we *want* the subtitles to be saved to
    lyrics_desired_output_template = os.path.join(LYRICS_FOLDER, f"{song_filename_base}.%(lang)s.%(ext)s")

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'writesubtitles': True,
        'allsubs': False, # Only download best available subtitle
        'subtitlesformat': 'vtt/best',
        'subtitleslangs': ['en', 'auto'], # Prioritize English, then auto-generated
        'skip_download': False,
        'outtmpl': {
            'default': os.path.join(SONGS_FOLDER, f"{song_filename_base}.%(ext)s"), # Audio output template
            'subtitle': lyrics_desired_output_template, # Explicitly tell yt-dlp where to put subtitles
        },
        'ffmpeg_location': r'C:\ffmpeg\ffmpeg-master-latest-win64-gpl-shared\bin'
    }

    print(f"\n--- Starting Download Attempt ---")
    print(f"Attempting to download: {url} with title: {title}")
    print(f"Audio will be saved to: {audio_full_path}")
    print(f"Lyrics desired path pattern: {os.path.join(LYRICS_FOLDER, f'{song_filename_base}.*.vtt')}")
    print(f"FFmpeg location set to: {ydl_opts['ffmpeg_location']}")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
        print(f"\nyt_dlp info_dict (partial, check full in code): {json.dumps(info_dict, indent=2, sort_keys=True)[:1000]}...")

        actual_lyrics_url = None
        lyrics_basename_pattern = f"{song_filename_base}.*.vtt" # Pattern to search for
        
        # Step 1: Check info_dict first, as it's the most direct report from yt-dlp
        if info_dict.get('requested_subtitles'):
            print("\n--- Subtitles Requested by yt_dlp (info_dict check) ---")
            for lang_code, sub_info in info_dict['requested_subtitles'].items():
                print(f"  Lang: {lang_code}, Ext: {sub_info.get('ext')}, Filepath: {sub_info.get('filepath')}")
                if sub_info.get('ext') == 'vtt' and sub_info.get('filepath'):
                    # yt_dlp's reported filepath could still be absolute or relative to execution dir
                    lyrics_filepath_reported = sub_info['filepath']
                    
                    # Try to find the file in LYRICS_FOLDER based on the reported name
                    potential_lyrics_path_in_lyrics_folder = os.path.join(LYRICS_FOLDER, os.path.basename(lyrics_filepath_reported))

                    if os.path.exists(potential_lyrics_path_in_lyrics_folder):
                        actual_lyrics_url = f"/lyrics/{os.path.basename(lyrics_filepath_reported)}"
                        print(f"  SUCCESS (info_dict): Found lyrics in LYRICS_FOLDER: {potential_lyrics_path_in_lyrics_folder}, URL: {actual_lyrics_url}")
                        break
                    else:
                        print(f"  WARNING (info_dict): Subtitle file not found in LYRICS_FOLDER at expected path: {potential_lyrics_path_in_lyrics_folder}")

            if not actual_lyrics_url: # If not found via info_dict, proceed to glob search
                print("  INFO: Trying glob search in case info_dict filepath was misleading.")

        # Step 2: Fallback to glob.glob search if not found directly via info_dict (or if info_dict was empty)
        if not actual_lyrics_url:
            print("\n--- Performing Glob Search for Subtitles ---")
            # Search in LYRICS_FOLDER first
            found_lyrics_files = glob.glob(os.path.join(LYRICS_FOLDER, lyrics_basename_pattern))
            
            # If not found in LYRICS_FOLDER, search in SONGS_FOLDER (where yt-dlp might mistakenly put it)
            if not found_lyrics_files:
                print(f"  INFO: No VTT found in {LYRICS_FOLDER}, checking {SONGS_FOLDER}.")
                found_lyrics_files = glob.glob(os.path.join(SONGS_FOLDER, lyrics_basename_pattern))

            if found_lyrics_files:
                # Pick the first matching file, typically the English one if available due to lang preference
                found_path = found_lyrics_files[0]
                lyrics_basename = os.path.basename(found_path)
                
                # If found in SONGS_FOLDER, move it to LYRICS_FOLDER
                if os.path.dirname(found_path) == SONGS_FOLDER:
                    target_path = os.path.join(LYRICS_FOLDER, lyrics_basename)
                    print(f"  INFO: Moving subtitle from {SONGS_FOLDER} to {LYRICS_FOLDER}: {found_path} -> {target_path}")
                    try:
                        shutil.move(found_path, target_path)
                        actual_lyrics_url = f"/lyrics/{lyrics_basename}"
                        print(f"  SUCCESS (Glob/Move): Found and moved lyrics: {target_path}, URL: {actual_lyrics_url}")
                    except Exception as move_error:
                        print(f"  ERROR: Failed to move subtitle file: {move_error}")
                        # If move fails, try to serve from original location in songs folder as a last resort
                        actual_lyrics_url = f"/songs/{lyrics_basename}" if os.path.exists(found_path) else None
                        print(f"  WARNING: Could not move, attempting to serve from SONGS_FOLDER: {actual_lyrics_url}")
                else: # Found directly in LYRICS_FOLDER
                    actual_lyrics_url = f"/lyrics/{lyrics_basename}"
                    print(f"  SUCCESS (Glob): Found lyrics in LYRICS_FOLDER: {found_path}, URL: {actual_lyrics_url}")
            else:
                print(f"  No VTT subtitles found after glob search in {LYRICS_FOLDER} or {SONGS_FOLDER}.")
            print("--- End Glob Search ---")
        
        if not actual_lyrics_url:
            print("\n--- FINAL LYRICS STATUS: No lyrics URL constructed. ---")
        
        if not os.path.exists(audio_full_path):
            raise Exception(f"Audio file not found after download: {audio_full_path}")

        # --- Final Response Sent to Frontend ---
        response_data = {
            "url": f"/songs/{os.path.basename(audio_full_path)}",
            "title": title,
            "lyrics_url": actual_lyrics_url
        }
        print(f"\n--- Backend Response to Frontend ---")
        print(json.dumps(response_data, indent=2))
        print("--- End Backend Response ---")

        return jsonify(response_data)
    except Exception as e:
        print(f"\n--- ERROR DURING DOWNLOAD ---")
        print(f"Error: {e}")
        # Clean up partially downloaded files if any
        if os.path.exists(audio_full_path):
            os.remove(audio_full_path)
        # Also try to clean up any subtitle files that might have been created by yt-dlp in unexpected places
        for f in glob.glob(os.path.join(LYRICS_FOLDER, f"{song_filename_base}.*.vtt")):
            try: os.remove(f)
            except OSError: pass # File might be in use or not exist
        for f in glob.glob(os.path.join(SONGS_FOLDER, f"{song_filename_base}.*.vtt")): # Check songs folder too
            try: os.remove(f)
            except OSError: pass
        print(f"--- END ERROR ---")
        return jsonify({"error": str(e)}), 500

@app.route('/lyrics/<filename>')
def serve_lyrics(filename):
    print(f"Serving lyrics file: {filename}")
    # Prioritize serving from LYRICS_FOLDER, but also check SONGS_FOLDER as a fallback
    lyrics_path_in_lyrics_folder = os.path.join(LYRICS_FOLDER, filename)
    lyrics_path_in_songs_folder = os.path.join(SONGS_FOLDER, filename) # Fallback

    if os.path.exists(lyrics_path_in_lyrics_folder):
        return send_from_directory(LYRICS_FOLDER, filename)
    elif os.path.exists(lyrics_path_in_songs_folder):
        print(f"Warning: Lyrics file found in SONGS_FOLDER. Consider running cleanup or re-downloading to move it.")
        return send_from_directory(SONGS_FOLDER, filename) # Serve from here if found
    else:
        print(f"Error: Lyrics file {filename} not found in LYRICS_FOLDER or SONGS_FOLDER.")
        return jsonify({"error": "Lyrics file not found"}), 404


# --- PLAYLIST IMPORT/EXPORT ---

@app.route('/export_playlists', methods=['GET'])
def export_playlists():
    if os.path.exists(PLAYLISTS_FILE):
        return send_file(PLAYLISTS_FILE, as_attachment=True, download_name='playlists_export.json')
    return jsonify({"error": "No playlists to export"}), 404

@app.route('/import_playlists', methods=['POST'])
def import_playlists():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and file.filename.endswith('.json'):
        try:
            imported_playlists = json.load(file.stream)
            if not isinstance(imported_playlists, list):
                return jsonify({"error": "Invalid JSON format: expected a list of playlists"}), 400
            
            current_playlists = load_playlists_data()
            imported_count = 0
            for imported_pl in imported_playlists:
                if 'name' in imported_pl and not any(p['name'] == imported_pl['name'] for p in current_playlists):
                    current_playlists.append(imported_pl)
                    imported_count += 1
            
            save_playlists_data(current_playlists)
            return jsonify({"message": f"Successfully imported {imported_count} new playlists."}), 200
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON file"}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to import playlists: {str(e)}"}), 500
    return jsonify({"error": "Invalid file type. Please upload a .json file."}), 400


# --- STATIC FRONTEND ---

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)