document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const playlistGallery = document.getElementById('playlist-gallery');
    const newPlaylistForm = document.getElementById('new-playlist-form');
    const newPlaylistName = document.getElementById('new-playlist-name');
    const newPlaylistImage = document.getElementById('new-playlist-image');
    const playlistSection = document.getElementById('playlist-section');
    const playlistHeader = document.getElementById('playlist-header');
    const playlistImage = document.getElementById('playlist-image');
    const playlistTitle = document.getElementById('playlist-title');
    const closePlaylistBtn = document.getElementById('close-playlist');
    const songList = document.getElementById('song-list');
    const songUrlInput = document.getElementById('song-url-input');
    const addSongUrlBtn = document = document.getElementById('add-song-url');
    const addLocalSongBtn = document.getElementById('add-local-song');
    const localFileInput = document.getElementById('local-file-input');
    const onlineSearchInput = document.getElementById('online-search-input');
    const onlineSearchBtn = document.getElementById('online-search-btn');
    const onlineResultsList = document.getElementById('online-results-list');
    const showMoreOnlineResultsBtn = document.getElementById('show-more-online-results-btn');
    const downloadOnlineBtn = document.getElementById('download-online-btn');
    const audio = document.getElementById('audio-player');
    const seekSlider = document.getElementById('seek-slider');
    const currentTitle = document.getElementById('current-title');
    const repeatBtn = document.getElementById('repeat-btn');

    // New interactive elements
    const currentTimeSpan = document.getElementById('current-time');
    const totalTimeSpan = document.getElementById('total-time');
    const prevBtn = document.getElementById('prev-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const nextBtn = document.getElementById('next-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const lyricsBtn = document.getElementById('lyrics-btn');
    const lyricsSection = document.getElementById('lyrics-section');
    const lyricsContent = document.getElementById('lyrics-content');
    const upNextSection = document.getElementById('up-next-section');
    const upNextList = document.getElementById('up-next-list');
    const editPlaylistBtn = document.getElementById('edit-playlist-btn');
    const deletePlaylistBtn = document.getElementById('delete-playlist-btn');
    const exportPlaylistsBtn = document.getElementById('export-playlists-btn');
    const importPlaylistsBtn = document.getElementById('import-playlists-btn');
    const importPlaylistsFileInput = document.getElementById('import-playlists-file-input');

    // Mini-player elements
    const miniPlayer = document.getElementById('mini-player');
    const miniPlayerImage = document.getElementById('mini-player-image');
    const miniPlayerTitle = document.getElementById('mini-player-title');
    const miniPlayerCurrentTime = document.getElementById('mini-player-current-time');
    const miniPlayerTotalTime = document.getElementById('mini-player-total-time');
    const miniPlayerSeekProgress = document.getElementById('mini-player-seek-progress');
    const miniPrevBtn = document.getElementById('mini-prev-btn');
    const miniPlayPauseBtn = document.getElementById('mini-play-pause-btn');
    const miniNextBtn = document.getElementById('mini-next-btn');
    const miniExpandBtn = document.getElementById('mini-expand-btn');


    // --- State Variables ---
    let playlists = [];
    let currentPlaylist = null;
    let currentSongIndex = -1;
    let onlineResults = [];
    let repeatMode = false;
    let isPlaying = false;
    let shuffleMode = false;
    let shuffledPlaylistIndexes = []; // Stores shuffled order
    let upNextQueue = []; // Queue for next songs

    let currentSearchQuery = ''; // To remember the last search query
    const INITIAL_SEARCH_COUNT = 5; // How many results to show initially
    const LOAD_MORE_COUNT = 10; // How many more results to load each time


    // --- Utility Functions ---
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    // Function to show transient notifications
    function showNotification(message, type = 'info') {
        const notificationBar = document.createElement('div');
        notificationBar.className = `notification ${type}`; // Add styling class
        notificationBar.textContent = message;
        document.body.appendChild(notificationBar);

        setTimeout(() => {
            notificationBar.classList.add('hide');
            notificationBar.addEventListener('transitionend', () => notificationBar.remove());
        }, 3000); // Hide after 3 seconds
    }

    function togglePlayPause() {
        if (!currentPlaylist || currentPlaylist.songs.length === 0) {
            showNotification('No songs to play. Add some first!', 'warning');
            return;
        }

        if (currentSongIndex === -1) { // If nothing selected, start from first song
            playSong(0);
        } else if (audio.paused) {
            audio.play();
            isPlaying = true;
            playPauseBtn.textContent = 'pause';
            miniPlayPauseBtn.textContent = 'pause';
        } else {
            audio.pause();
            isPlaying = false;
            playPauseBtn.textContent = 'play_arrow';
            miniPlayPauseBtn.textContent = 'play_arrow';
        }
        updatePlayerButtonStates();
    }

    function updatePlayerButtonStates() {
        const hasSongs = currentPlaylist && currentPlaylist.songs.length > 0;

        // Main player buttons
        prevBtn.disabled = (!hasSongs || (currentSongIndex <= 0 && !shuffleMode && audio.currentTime < 3)); // Disable if at start and not shuffle
        nextBtn.disabled = (!hasSongs || (currentSongIndex >= (shuffleMode ? shuffledPlaylistIndexes.length : currentPlaylist.songs.length) - 1 && upNextQueue.length === 0 && !repeatMode));
        playPauseBtn.disabled = !hasSongs;
        seekSlider.disabled = !hasSongs;
        volumeSlider.disabled = !hasSongs;
        repeatBtn.disabled = !hasSongs;
        shuffleBtn.disabled = !hasSongs;
        lyricsBtn.disabled = !(hasSongs && currentSongIndex !== -1 && currentPlaylist.songs[currentSongIndex]?.lyrics_url); // Only enable if current song has lyrics

        // Mini-player buttons
        miniPrevBtn.disabled = prevBtn.disabled;
        miniNextBtn.disabled = nextBtn.disabled;
        miniPlayPauseBtn.disabled = playPauseBtn.disabled;

        // Other buttons
        // Download button enabled only if a result is selected AND a playlist is open
        downloadOnlineBtn.disabled = !currentPlaylist || onlineResultsList.children.length === 0 || !Array.from(onlineResultsList.children).some(li => li.classList.contains('selected'));
        onlineSearchBtn.disabled = onlineSearchInput.value.trim() === '';
        addSongUrlBtn.disabled = songUrlInput.value.trim() === '';
        addLocalSongBtn.disabled = false; // Always allow adding local songs

        // Edit/Delete playlist buttons
        editPlaylistBtn.disabled = !currentPlaylist;
        deletePlaylistBtn.disabled = !currentPlaylist;

        // Show More button
        showMoreOnlineResultsBtn.style.display = (onlineResults.length > 0 && onlineResults.length % INITIAL_SEARCH_COUNT === 0) ? 'block' : 'none'; // Only show if there are results and it's a multiple of initial count
    }

    function updateShuffleOrder() {
        if (shuffleMode && currentPlaylist && currentPlaylist.songs.length > 0) {
            shuffledPlaylistIndexes = Array.from({ length: currentPlaylist.songs.length }, (_, i) => i);
            
            // If a song is currently playing, ensure it's the first in the new shuffled list
            const currentSongActualIndex = currentSongIndex !== -1 ? currentSongIndex : 0;
            if (currentSongActualIndex !== -1 && shuffledPlaylistIndexes.includes(currentSongActualIndex)) {
                // Remove the current song from its original position
                shuffledPlaylistIndexes = shuffledPlaylistIndexes.filter(idx => idx !== currentSongActualIndex);
                // Fisher-Yates shuffle the rest
                for (let i = shuffledPlaylistIndexes.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledPlaylistIndexes[i], shuffledPlaylistIndexes[j]] = [shuffledPlaylistIndexes[j], shuffledPlaylistIndexes[i]];
                }
                // Add the current song to the beginning
                shuffledPlaylistIndexes.unshift(currentSongActualIndex);
            } else {
                // If no song playing or current song not found, just shuffle all
                for (let i = shuffledPlaylistIndexes.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledPlaylistIndexes[i], shuffledPlaylistIndexes[j]] = [shuffledPlaylistIndexes[j], shuffledPlaylistIndexes[i]];
                }
            }
        } else {
            shuffledPlaylistIndexes = [];
        }
        updatePlayerButtonStates();
    }

    function updateUpNextQueue() {
        upNextList.innerHTML = '';
        if (upNextQueue.length === 0) {
            const placeholder = document.createElement('li');
            placeholder.className = 'placeholder-item';
            placeholder.textContent = 'Queue is empty.';
            upNextList.appendChild(placeholder);
            return;
        }

        upNextQueue.forEach((song, idx) => {
            const li = document.createElement('li');
            li.textContent = `${idx + 1}. ${song.title}`;
            // Add a "remove from queue" button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'remove_circle'; // Material Icon
            removeBtn.className = 'action-btn material-icons';
            removeBtn.title = 'Remove from Up Next';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                upNextQueue.splice(idx, 1);
                updateUpNextQueue();
                showNotification(`Removed "${song.title}" from Up Next.`);
            };
            li.appendChild(removeBtn); // Corrected: Append to li directly, not buttonGroup
            upNextList.appendChild(li);
        });
    }

    // --- Playlist Gallery ---
    async function loadPlaylists() {
        const res = await fetch('/playlists');
        playlists = await res.json();
        playlistGallery.innerHTML = '';
        if (playlists.length === 0) {
            playlistGallery.innerHTML = '<p style="text-align: center; color: #888;">No playlists yet. Create one!</p>';
        }
        playlists.forEach(pl => {
            const card = document.createElement('div');
            card.className = 'playlist-card';
            card.innerHTML = `
                <img src="/playlist_images/${pl.image}" alt="playlist">
                <div>${pl.name}</div>
            `;
            card.onclick = () => openPlaylist(pl.name);
            playlistGallery.appendChild(card);
        });
        updatePlayerButtonStates();
    }

    newPlaylistForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', newPlaylistName.value);
        formData.append('image', newPlaylistImage.files[0]);
        const res = await fetch('/playlists', { method: 'POST', body: formData });
        if (res.ok) {
            newPlaylistName.value = '';
            newPlaylistImage.value = '';
            await loadPlaylists();
            showNotification('Playlist created successfully!', 'success');
        } else {
            showNotification('Failed to create playlist. Name and image required.', 'error');
        }
    };

    // --- Playlist View ---
    async function openPlaylist(name) {
        const res = await fetch(`/playlist/${encodeURIComponent(name)}`);
        if (!res.ok) {
            showNotification('Playlist not found', 'error');
            return;
        }
        currentPlaylist = await res.json();
        playlistSection.style.display = 'block';
        miniPlayer.style.display = 'none'; // Hide mini-player when full playlist is open
        playlistImage.src = `/playlist_images/${currentPlaylist.image}`;
        playlistTitle.textContent = currentPlaylist.name;
        renderSongList();
        updateShuffleOrder(); // Re-shuffle when opening playlist
        updatePlayerButtonStates();
    }

    closePlaylistBtn.onclick = () => {
        playlistSection.style.display = 'none';
        if (isPlaying || currentSongIndex !== -1) { // If a song was playing or selected, show mini-player
            miniPlayer.style.display = 'flex';
        }
        lyricsSection.style.display = 'none'; // Hide lyrics when closing playlist
        updatePlayerButtonStates(); // Re-evaluate button states
    };

    deletePlaylistBtn.onclick = async () => {
        if (!currentPlaylist) return;
        if (confirm(`Are you sure you want to delete the playlist "${currentPlaylist.name}"? This action cannot be undone.`)) {
            const res = await fetch(`/playlist/${encodeURIComponent(currentPlaylist.name)}`, { method: 'DELETE' });
            if (res.ok) {
                showNotification('Playlist deleted successfully!', 'success');
                closePlaylistBtn.click(); // Close the playlist view
                await loadPlaylists(); // Refresh playlist gallery
            } else {
                showNotification('Failed to delete playlist.', 'error');
            }
        }
    };

    editPlaylistBtn.onclick = async () => {
        if (!currentPlaylist) return;
        const newName = prompt(`Enter new name for playlist "${currentPlaylist.name}":`, currentPlaylist.name);
        if (newName && newName.trim() !== currentPlaylist.name) {
            const formData = new FormData();
            formData.append('name', newName.trim());
            
            const res = await fetch(`/playlist/${encodeURIComponent(currentPlaylist.name)}`, {
                method: 'PUT',
                body: formData
            });

            if (res.ok) {
                currentPlaylist.name = newName.trim(); // Update client-side state
                playlistTitle.textContent = currentPlaylist.name; // Update UI
                await loadPlaylists(); // Refresh gallery
                showNotification('Playlist name updated!', 'success');
            } else {
                showNotification('Failed to update playlist name.', 'error');
            }
        }
    };


    function renderSongList() {
        songList.innerHTML = '';
        if (!currentPlaylist || currentPlaylist.songs.length === 0) {
            const emptyMsg = document.createElement('li');
            emptyMsg.textContent = 'No songs in this playlist yet. Add some!';
            emptyMsg.style.fontStyle = 'italic';
            emptyMsg.style.color = '#888';
            emptyMsg.style.justifyContent = 'center';
            songList.appendChild(emptyMsg);
            return;
        }

        currentPlaylist.songs.forEach((song, idx) => {
            const li = document.createElement('li');
            const songTitleSpan = document.createElement('span');
            songTitleSpan.textContent = song.title;
            li.appendChild(songTitleSpan);

            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'song-actions';

            // Add to Up Next Queue button
            const addToQueueBtn = document.createElement('button');
            addToQueueBtn.textContent = 'queue_music'; // Material Icon
            addToQueueBtn.className = 'action-btn material-icons';
            addToQueueBtn.title = 'Add to Up Next';
            addToQueueBtn.onclick = (e) => {
                e.stopPropagation();
                upNextQueue.push(song);
                updateUpNextQueue();
                showNotification(`Added "${song.title}" to Up Next!`);
            };
            buttonGroup.appendChild(addToQueueBtn);

            // Up button
            const upBtn = document.createElement('button');
            upBtn.textContent = 'arrow_upward'; // Material Icon
            upBtn.className = 'action-btn material-icons';
            upBtn.title = 'Move Up';
            upBtn.onclick = (e) => {
                e.stopPropagation();
                if (idx > 0) {
                    [currentPlaylist.songs[idx - 1], currentPlaylist.songs[idx]] = [currentPlaylist.songs[idx], currentPlaylist.songs[idx - 1]];
                    if (currentSongIndex === idx) currentSongIndex--;
                    else if (currentSongIndex === idx - 1) currentSongIndex++;
                    saveCurrentPlaylist();
                }
            };
            buttonGroup.appendChild(upBtn);

            // Down button
            const downBtn = document.createElement('button');
            downBtn.textContent = 'arrow_downward'; // Material Icon
            downBtn.className = 'action-btn material-icons';
            downBtn.title = 'Move Down';
            downBtn.onclick = (e) => {
                e.stopPropagation();
                if (idx < currentPlaylist.songs.length - 1) {
                    [currentPlaylist.songs[idx + 1], currentPlaylist.songs[idx]] = [currentPlaylist.songs[idx], currentPlaylist.songs[idx + 1]];
                    if (currentSongIndex === idx) currentSongIndex++;
                    else if (currentSongIndex === idx + 1) currentSongIndex--;
                    saveCurrentPlaylist();
                }
            };
            buttonGroup.appendChild(downBtn);

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'delete'; // Material Icon
            removeBtn.className = 'action-btn remove-btn material-icons';
            removeBtn.title = 'Remove Song';
            removeBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to remove "${song.title}" from this playlist?`)) {
                    const wasPlaying = (currentSongIndex === idx);
                    currentPlaylist.songs.splice(idx, 1);
                    await saveCurrentPlaylist(); // save and re-render

                    if (wasPlaying) {
                        if (currentPlaylist.songs.length > 0) {
                            // If current song removed, play next or first if last removed
                            playSong(Math.min(idx, currentPlaylist.songs.length - 1));
                        } else {
                            // If last song removed, stop playback
                            audio.pause();
                            isPlaying = false;
                            playPauseBtn.textContent = 'play_arrow';
                            miniPlayPauseBtn.textContent = 'play_arrow';
                            currentTitle.textContent = 'No song playing';
                            miniPlayerTitle.textContent = 'No song playing';
                            currentSongIndex = -1;
                            currentTimeSpan.textContent = '0:00';
                            totalTimeSpan.textContent = '0:00';
                            miniPlayerCurrentTime.textContent = '0:00';
                            miniPlayerTotalTime.textContent = '0:00';
                            miniPlayerSeekProgress.style.width = '0%';
                            miniPlayer.style.display = 'none'; // Hide mini-player if no songs left
                        }
                    } else if (currentSongIndex > idx) {
                        currentSongIndex--; // Adjust index if song before current was removed
                    }
                    updatePlayerButtonStates();
                    showNotification(`"${song.title}" removed.`, 'info');
                }
            };
            buttonGroup.appendChild(removeBtn);

            li.appendChild(buttonGroup);

            li.onclick = () => playSong(idx);
            songList.appendChild(li);
        });
        // Ensure the currently playing song is highlighted after re-render
        if (currentPlaylist && currentSongIndex !== -1 && songList.children[currentSongIndex]) {
            songList.children[currentSongIndex].classList.add('selected');
        }
    }

    async function saveCurrentPlaylist() {
        await fetch(`/playlist/${encodeURIComponent(currentPlaylist.name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs: currentPlaylist.songs })
        });
        renderSongList();
        updateShuffleOrder(); // Re-shuffle after changes
    }

    // --- Add Song by URL ---
    addSongUrlBtn.onclick = async () => {
        const url = songUrlInput.value.trim();
        if (!url) {
            showNotification('Please enter a song URL.', 'warning');
            return;
        }
        if (!currentPlaylist) {
            showNotification('Please open a playlist first to add songs.', 'warning');
            return;
        }

        const title = url.split('/').pop().split('?')[0].replace(/%20/g, ' '); // Basic title
        currentPlaylist.songs.push({ title, url });
        songUrlInput.value = '';
        await saveCurrentPlaylist();
        showNotification(`"${title}" added by URL.`, 'success');
        updatePlayerButtonStates();
    };
    songUrlInput.oninput = () => updatePlayerButtonStates(); // Enable/disable button

    // --- Add Local Song ---
    addLocalSongBtn.onclick = () => localFileInput.click();
    localFileInput.onchange = async (e) => {
        if (!currentPlaylist) {
            showNotification('Please open a playlist first to add songs.', 'warning');
            return;
        }
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        files.forEach(file => {
            const url = URL.createObjectURL(file);
            currentPlaylist.songs.push({ title: file.name, url, isLocal: true });
        });
        await saveCurrentPlaylist();
        showNotification(`${files.length} local song(s) added!`, 'success');
        updatePlayerButtonStates();
    };

    // --- Play Song ---
    function playSong(idx) {
        if (!currentPlaylist || currentPlaylist.songs.length === 0) {
            currentTitle.textContent = 'No songs in playlist.';
            miniPlayerTitle.textContent = 'No songs in playlist.';
            updatePlayerButtonStates();
            return;
        }

        let actualIdxToPlay = idx;
        if (shuffleMode && shuffledPlaylistIndexes.length > 0) {
             // If shuffle is on, play from the shuffled list
            const currentSongInShuffledOrder = shuffledPlaylistIndexes.indexOf(currentSongIndex);
            if (currentSongInShuffledOrder !== -1) {
                // Determine new index in shuffled list
                if (idx === currentSongIndex + 1) { // Next (from button click)
                    actualIdxToPlay = shuffledPlaylistIndexes[(currentSongInShuffledOrder + 1) % shuffledPlaylistIndexes.length];
                } else if (idx === currentSongIndex - 1) { // Prev (from button click)
                    actualIdxToPlay = shuffledPlaylistIndexes[(currentSongInShuffledOrder - 1 + shuffledPlaylistIndexes.length) % shuffledPlaylistIndexes.length];
                } else { // Direct click on a song while shuffle is on, restart shuffle with that song first
                    shuffledPlaylistIndexes = shuffledPlaylistIndexes.filter(val => val !== idx);
                    shuffledPlaylistIndexes.unshift(idx); // Put clicked song at the front
                    actualIdxToPlay = idx; // Play the clicked song
                }
            } else { // No song playing, start with first in shuffled list
                actualIdxToPlay = shuffledPlaylistIndexes[0];
            }
        }
        
        // Ensure index is within bounds of actual songs array
        if (actualIdxToPlay < 0 || actualIdxToPlay >= currentPlaylist.songs.length) {
            actualIdxToPlay = 0; // Fallback to first song
        }
        currentSongIndex = actualIdxToPlay;


        const song = currentPlaylist.songs[currentSongIndex];
        console.log("Playing song:", song); // Debugging: Log the song object that's being played

        // Remove 'selected' from all and add to current
        Array.from(songList.children).forEach((el, i) => {
            if (i === currentSongIndex) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });

        audio.src = song.isLocal ? song.url : song.url;
        audio.load(); // Load the new source
        audio.play();
        isPlaying = true;
        playPauseBtn.textContent = 'pause';
        miniPlayPauseBtn.textContent = 'pause';
        currentTitle.textContent = "Playing: " + song.title;
        miniPlayerTitle.textContent = song.title;
        miniPlayerImage.src = `/playlist_images/${currentPlaylist.image}`; // Use playlist image for mini-player
        miniPlayer.style.display = 'flex'; // Ensure mini-player is visible when playing
        
        // Handle lyrics display based on the song's lyrics_url property
        if (song.lyrics_url) {
            console.log("Lyrics URL found for current song:", song.lyrics_url); // Debugging: Confirm lyrics URL received
            fetchLyrics(song.lyrics_url);
            lyricsSection.style.display = 'block'; // Make sure the section is visible
        } else {
            console.log("No lyrics URL found for current song:", song.title); // Debugging: No lyrics URL for this song
            lyricsContent.textContent = 'No lyrics available for this song.'; // Display message
            lyricsSection.style.display = 'block'; // Show section with message
            showNotification('No lyrics found for this song.', 'warning');
        }
        updatePlayerButtonStates();
    }

    // --- Audio Player Controls & Events ---
    playPauseBtn.onclick = togglePlayPause;
    miniPlayPauseBtn.onclick = togglePlayPause;

    prevBtn.onclick = () => {
        if (!currentPlaylist || currentPlaylist.songs.length === 0) return;
        if (shuffleMode && shuffledPlaylistIndexes.length > 0) {
            const currentShuffledIndex = shuffledPlaylistIndexes.indexOf(currentSongIndex);
            const prevShuffledIndex = (currentShuffledIndex - 1 + shuffledPlaylistIndexes.length) % shuffledPlaylistIndexes.length;
            playSong(shuffledPlaylistIndexes[prevShuffledIndex]);
        } else {
            if (currentSongIndex > 0) {
                playSong(currentSongIndex - 1);
            } else {
                playSong(currentPlaylist.songs.length - 1); // Loop to end of playlist
            }
        }
    };
    miniPrevBtn.onclick = prevBtn.onclick;


    nextBtn.onclick = () => {
        if (!currentPlaylist || currentPlaylist.songs.length === 0) return;
        if (upNextQueue.length > 0) { // Prioritize up next queue
            const nextSongInQueue = upNextQueue.shift();
            const actualIndex = currentPlaylist.songs.indexOf(nextSongInQueue);
            if (actualIndex !== -1) {
                playSong(actualIndex);
            } else {
                // If song from queue is no longer in playlist, play next from main list
                playNextSongInMainList();
            }
            updateUpNextQueue();
        } else if (shuffleMode && shuffledPlaylistIndexes.length > 0) {
            const currentShuffledIndex = shuffledPlaylistIndexes.indexOf(currentSongIndex);
            const nextShuffledIndex = (currentShuffledIndex + 1) % shuffledPlaylistIndexes.length;
            playSong(shuffledPlaylistIndexes[nextShuffledIndex]);
        } else {
            if (currentSongIndex < currentPlaylist.songs.length - 1) {
                playSong(currentSongIndex + 1);
            } else {
                // Looping behavior when currentSongIndex is the last song
                playSong(0); // Loop to the first song in the playlist
            }
        }
    };
    miniNextBtn.onclick = nextBtn.onclick;

    function playNextSongInMainList() {
        if (!currentPlaylist || currentPlaylist.songs.length === 0) return;

        if (shuffleMode && shuffledPlaylistIndexes.length > 0) {
            const currentShuffledIndex = shuffledPlaylistIndexes.indexOf(currentSongIndex);
            const nextShuffledIndex = (currentShuffledIndex + 1) % shuffledPlaylistIndexes.length;
            playSong(shuffledPlaylistIndexes[nextShuffledIndex]);
        } else {
            if (currentSongIndex < currentPlaylist.songs.length - 1) {
                playSong(currentSongIndex + 1);
            } else {
                playSong(0); // Loop to the first song
            }
        }
    }


    audio.addEventListener('timeupdate', () => {
        if (audio.duration && isFinite(audio.duration)) {
            const progress = (audio.currentTime / audio.duration) * 100;
            seekSlider.value = progress;
            miniPlayerSeekProgress.style.width = `${progress}%`;
            currentTimeSpan.textContent = formatTime(audio.currentTime);
            miniPlayerCurrentTime.textContent = formatTime(audio.currentTime);
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) {
            totalTimeSpan.textContent = formatTime(audio.duration);
            miniPlayerTotalTime.textContent = formatTime(audio.duration);
        } else {
            totalTimeSpan.textContent = '--:--';
            miniPlayerTotalTime.textContent = '--:--';
        }
        if (audio.paused && !isPlaying) {
             playPauseBtn.textContent = 'play_arrow';
             miniPlayPauseBtn.textContent = 'play_arrow';
        } else if (isPlaying) {
             playPauseBtn.textContent = 'pause';
             miniPlayPauseBtn.textContent = 'pause';
        }
        updatePlayerButtonStates();
    });

    seekSlider.addEventListener('input', () => {
        if (audio.duration && isFinite(audio.duration)) {
            audio.currentTime = (seekSlider.value / 100) * audio.duration;
        }
    });

    // Volume Control
    volumeSlider.oninput = () => {
        audio.volume = volumeSlider.value / 100;
    };

    // --- Online Search & Download ---
    onlineSearchBtn.onclick = async () => {
        currentSearchQuery = onlineSearchInput.value.trim();
        if (!currentSearchQuery) {
            showNotification('Please enter a search query.', 'warning');
            return;
        }
        onlineResultsList.innerHTML = '<li style="color: var(--accent-primary);">Searching...</li>';
        onlineSearchBtn.disabled = true;
        downloadOnlineBtn.disabled = true; // Disable download button during search

        const res = await fetch('/search_online', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: currentSearchQuery, count: INITIAL_SEARCH_COUNT }) // Request initial count
        });
        
        onlineSearchBtn.disabled = false;
        if (res.ok) {
            onlineResults = await res.json();
            renderOnlineResults(); // Render the initial results
        } else {
            onlineResultsList.innerHTML = '<li style="color: var(--error-color);">Error during search.</li>';
            showMoreOnlineResultsBtn.style.display = 'none';
        }
        updatePlayerButtonStates();
    };

    showMoreOnlineResultsBtn.onclick = async () => {
        showMoreOnlineResultsBtn.disabled = true;
        showMoreOnlineResultsBtn.textContent = 'Loading More...';

        const res = await fetch('/search_online', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: currentSearchQuery, count: onlineResults.length + LOAD_MORE_COUNT }) // Request more
        });

        showMoreOnlineResultsBtn.disabled = false;
        showMoreOnlineResultsBtn.textContent = 'Show More';

        if (res.ok) {
            const newResults = await res.json();
            // Append only new results to avoid duplicates
            const existingUrls = new Set(onlineResults.map(r => r.url));
            const uniqueNewResults = newResults.filter(r => !existingUrls.has(r.url));
            onlineResults = [...onlineResults, ...uniqueNewResults];
            renderOnlineResults(); // Re-render all results
        } else {
            showNotification('Failed to load more results.', 'error');
        }
        updatePlayerButtonStates();
    };

    function renderOnlineResults() {
        onlineResultsList.innerHTML = '';
        if (onlineResults.length === 0) {
            onlineResultsList.innerHTML = '<li style="color: #888;">No results found.</li>';
            showMoreOnlineResultsBtn.style.display = 'none';
            return;
        }
        onlineResults.forEach((item, idx) => {
            const li = document.createElement('li');
            li.textContent = item.title;
            li.onclick = () => {
                Array.from(onlineResultsList.children).forEach(child => child.classList.remove('selected'));
                li.classList.add('selected');
                updatePlayerButtonStates();
            };
            onlineResultsList.appendChild(li);
        });
        // Only show "Show More" if we got the maximum requested and there might be more
        // This is a heuristic; actual "more" depends on backend having more results
        if (onlineResults.length >= INITIAL_SEARCH_COUNT && onlineResults.length % LOAD_MORE_COUNT === 0) {
             showMoreOnlineResultsBtn.style.display = 'block';
        } else {
             showMoreOnlineResultsBtn.style.display = 'none';
        }
    }


    onlineSearchInput.oninput = () => {
        onlineResults = []; // Clear results when input changes
        onlineResultsList.innerHTML = '';
        showMoreOnlineResultsBtn.style.display = 'none';
        updatePlayerButtonStates();
    };


    downloadOnlineBtn.onclick = async () => {
        if (!currentPlaylist) {
            showNotification('Please open a playlist first to download songs into it.', 'warning');
            return;
        }

        const selectedLi = Array.from(onlineResultsList.children).find(li => li.classList.contains('selected'));
        if (!selectedLi) {
            showNotification('Select a song from the online results first!', 'warning');
            return;
        }
        const selectedIdx = Array.from(onlineResultsList.children).indexOf(selectedLi);
        const songToDownload = onlineResults[selectedIdx];

        downloadOnlineBtn.textContent = 'Downloading...';
        downloadOnlineBtn.disabled = true;
        onlineSearchBtn.disabled = true;

        try {
            const res = await fetch('/download_online', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: songToDownload.url, title: songToDownload.title })
            });

            const data = await res.json();
            console.log("Backend download response data:", data); // Debugging: Log the full response from backend
            
            if (res.ok) {
                // Ensure currentPlaylist is not null and then push the song
                if (currentPlaylist) {
                    currentPlaylist.songs.push({ title: data.title, url: data.url, lyrics_url: data.lyrics_url });
                    await saveCurrentPlaylist(); // This will also re-render the song list
                    showNotification(`"${data.title}" downloaded and added to playlist!`, 'success');
                } else {
                    showNotification('Downloaded, but no playlist was open to add the song to.', 'info');
                }
            } else {
                showNotification(`Failed to download "${songToDownload.title}": ${data.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Download fetch error:', error); // Log network fetch errors
            showNotification(`An error occurred during download: ${error.message}`, 'error');
        } finally { // Ensure buttons are re-enabled in all cases
            downloadOnlineBtn.textContent = 'Download Selected Song';
            downloadOnlineBtn.disabled = false;
            onlineSearchBtn.disabled = false;
            updatePlayerButtonStates();
        }
    };

    // --- Repeat Mode Button ---
    repeatBtn.onclick = () => {
        repeatMode = !repeatMode;
        repeatBtn.classList.toggle('active', repeatMode);
        repeatBtn.title = repeatMode ? 'Repeat: On' : 'Repeat: Off';
        updatePlayerButtonStates();
    };

    // --- Shuffle Mode Button ---
    shuffleBtn.onclick = () => {
        shuffleMode = !shuffleMode;
        shuffleBtn.classList.toggle('active', shuffleMode);
        shuffleBtn.title = shuffleMode ? 'Shuffle: On' : 'Shuffle: Off';
        updateShuffleOrder();
        updatePlayerButtonStates();
        showNotification(`Shuffle ${shuffleMode ? 'On' : 'Off'}`, 'info');
    };

    // --- Lyrics Display ---
    lyricsBtn.onclick = async () => {
        if (!currentPlaylist || currentSongIndex === -1 || !currentPlaylist.songs[currentSongIndex]) {
            showNotification('No song playing to show lyrics for.', 'warning');
            lyricsSection.style.display = 'none'; // Ensure hidden
            return;
        }

        const song = currentPlaylist.songs[currentSongIndex];
        
        if (lyricsSection.style.display === 'block') {
            lyricsSection.style.display = 'none'; // Hide if already visible
        } else {
            if (song.lyrics_url) {
                console.log("Attempting to fetch lyrics for:", song.title, "from URL:", song.lyrics_url); // Debugging: Confirm fetch URL
                fetchLyrics(song.lyrics_url);
                lyricsSection.style.display = 'block'; // Show section
            } else {
                console.log("No lyrics_url found for song:", song.title); // Debugging: No lyrics URL for this song
                lyricsContent.textContent = 'No lyrics available for this song.'; // Display message
                lyricsSection.style.display = 'block'; // Show section with message
                showNotification('No lyrics found for this song.', 'warning');
            }
        }
    };

    async function fetchLyrics(lyricsUrl) {
        lyricsContent.textContent = 'Loading lyrics...';
        try {
            const res = await fetch(lyricsUrl);
            console.log("Fetch lyrics response status:", res.status, res.statusText); // Debugging: Log fetch status
            if (res.ok) {
                let lyricsText = await res.text();
                // Basic cleanup for VTT: remove WebVTT header and timestamps
                lyricsText = lyricsText.replace(/WEBVTT\n/, '');
                lyricsText = lyricsText.replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n?/g, '');
                lyricsText = lyricsText.replace(/<[^>]*>/g, ''); // Remove any HTML tags if present (e.g., from VTT styles)
                lyricsContent.textContent = lyricsText.trim() || 'No visible lyrics content.';
                console.log("Lyrics fetched successfully. Displaying content."); // Debugging: Confirm success
            } else {
                lyricsContent.textContent = 'Failed to load lyrics.';
                console.error('Failed to load lyrics:', res.status, res.statusText); // Debugging: Log fetch error
                showNotification('Failed to load lyrics. Check console for details.', 'error');
            }
        } catch (error) {
            lyricsContent.textContent = 'Error fetching lyrics.';
            console.error('Error fetching lyrics:', error); // Debugging: Log general error
            showNotification('Error fetching lyrics. Check console for details.', 'error');
        }
    }

    // --- Audio Ended Event: Loop/Next Song ---
    audio.addEventListener('ended', () => {
        if (repeatMode) {
            audio.currentTime = 0;
            audio.play();
        } else if (upNextQueue.length > 0) {
            const nextSongInQueue = upNextQueue.shift();
            const actualIndex = currentPlaylist.songs.indexOf(nextSongInQueue);
            if (actualIndex !== -1) {
                playSong(actualIndex);
            } else {
                playNextSongInMainList(); // Fallback if queued song is removed from playlist
            }
            updateUpNextQueue();
        } else if (currentPlaylist && currentPlaylist.songs.length > 0) {
            if (shuffleMode && shuffledPlaylistIndexes.length > 0) {
                const currentShuffledIndex = shuffledPlaylistIndexes.indexOf(currentSongIndex);
                const nextShuffledIndex = (currentShuffledIndex + 1) % shuffledPlaylistIndexes.length;
                playSong(shuffledPlaylistIndexes[nextShuffledIndex]);
            } else {
                // Looping behavior when currentSongIndex is the last song
                if (currentSongIndex < currentPlaylist.songs.length - 1) {
                    playSong(currentSongIndex + 1);
                } else {
                    playSong(0); // Loop to the first song in the playlist
                }
            }
        } else {
            currentTitle.textContent = 'No song playing';
            miniPlayerTitle.textContent = 'No song playing';
            currentSongIndex = -1;
            isPlaying = false;
            playPauseBtn.textContent = 'play_arrow';
            miniPlayPauseBtn.textContent = 'play_arrow';
            currentTimeSpan.textContent = '0:00';
            totalTimeSpan.textContent = '0:00';
            miniPlayerCurrentTime.textContent = '0:00';
            miniPlayerTotalTime.textContent = '0:00';
            miniPlayerSeekProgress.style.width = '0%';
            miniPlayer.style.display = 'none';
        }
        updatePlayerButtonStates();
    });

    // --- Mini-Player Logic ---
    miniExpandBtn.onclick = () => {
        if (currentPlaylist) {
            playlistSection.style.display = 'block';
            miniPlayer.style.display = 'none';
        } else {
            showNotification('No active playlist to expand.', 'info');
        }
    };


    // --- Playlist Import/Export ---
    exportPlaylistsBtn.onclick = async () => {
        try {
            const res = await fetch('/export_playlists');
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'playlists_export.json';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                showNotification('Playlists exported!', 'success');
            } else {
                const errorData = await res.json();
                showNotification(`Export failed: ${errorData.error}`, 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            showNotification('An error occurred during export.', 'error');
        }
    };

    importPlaylistsBtn.onclick = () => importPlaylistsFileInput.click();
    importPlaylistsFileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
            showNotification('No file selected.', 'warning');
            return;
        }
        if (file.type !== 'application/json') {
            showNotification('Please select a JSON file.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/import_playlists', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                showNotification(data.message, 'success');
                await loadPlaylists(); // Reload gallery after import
            } else {
                showNotification(`Import failed: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Import error:', error);
            showNotification('An error occurred during import.', 'error');
        }
        importPlaylistsFileInput.value = null; // Clear input
    };


    // --- Initial Setup ---
    audio.volume = volumeSlider.value / 100; // Set initial volume from slider
    updatePlayerButtonStates(); // Set initial button states
    loadPlaylists();
    updateUpNextQueue(); // Initialize up next display
});