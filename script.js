const DISCORD_ID = "708077224598962335";

// Lanyard WebSocket Integration
let socket = new WebSocket("wss://api.lanyard.rest/socket");

socket.onopen = () => {
    socket.send(JSON.stringify({
        op: 2,
        d: { subscribe_to_id: DISCORD_ID }
    }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.t === "INIT_STATE" || data.t === "PRESENCE_UPDATE") {
        updatePresence(data.d);
    }
};

function updatePresence(presence) {
    const statusEl = document.getElementById("discord-status");
    const activityEl = document.getElementById("discord-activity");
    const avatarEl = document.getElementById("discord-avatar");
    
    // Status Text
    const status = presence.discord_status;
    statusEl.innerText = status.charAt(0).toUpperCase() + status.slice(1);
    statusEl.style.color = getStatusColor(status);

    // Spotify / Activity
    if (presence.spotify) {
        updateSpotify(presence.spotify);
        activityEl.innerText = "Escuchando Spotify";
    } else if (presence.activities.length > 0) {
        // Look for custom status or game
        const activity = presence.activities.find(a => a.type !== 4) || presence.activities[0];
        activityEl.innerText = activity.type === 4 ? activity.state : `Jugando ${activity.name}`;
        resetSpotify();
    } else {
        activityEl.innerText = "No estoy haciendo nada especial";
        resetSpotify();
    }

    // Avatar
    if (presence.discord_user.avatar) {
        avatarEl.src = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${presence.discord_user.avatar}.png`;
        avatarEl.classList.remove("hidden");
    }
}

function getStatusColor(status) {
    switch (status) {
        case "online": return "#43b581";
        case "idle": return "#faa61a";
        case "dnd": return "#f04747";
        default: return "#747f8d";
    }
}

// Spotify PKCE + Web Playback SDK
const SPOTIFY_CLIENT_ID = "44d07a5874b849e9972d4a57fd429c0a";
const REDIRECT_URI = window.location.origin + window.location.pathname.replace(/\/$/, '');
const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing"
].join(" ");

let spotifyPlayer = null;
let spotifyAccessToken = null;
let spotifyDeviceId = null;
let progressInterval = null;

// PKCE helpers
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function exchangeCode(code, verifier) {
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        }),
    });
    return res.json();
}

async function refreshAccessToken(refreshToken) {
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });
    return res.json();
}

function startSpotifyAuth() {
    const verifier = generateCodeVerifier();
    localStorage.setItem('spotify_verifier', verifier);
    generateCodeChallenge(verifier).then(challenge => {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: SPOTIFY_CLIENT_ID,
            scope: SCOPES,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            redirect_uri: REDIRECT_URI,
        });
        window.location.href = `https://accounts.spotify.com/authorize?${params}`;
    });
}

async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || params.get('error')) return false;

    const verifier = localStorage.getItem('spotify_verifier');
    if (!verifier) return false;

    const data = await exchangeCode(code, verifier);
    if (data.access_token) {
        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.setItem('spotify_token_expiry', Date.now() + data.expires_in * 1000);
        localStorage.removeItem('spotify_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }
    return false;
}

async function getValidToken() {
    let token = localStorage.getItem('spotify_access_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    const refresh = localStorage.getItem('spotify_refresh_token');

    if (!token || !refresh) return null;

    if (Date.now() >= parseInt(expiry)) {
        const data = await refreshAccessToken(refresh);
        if (data.access_token) {
            token = data.access_token;
            localStorage.setItem('spotify_access_token', token);
            localStorage.setItem('spotify_token_expiry', Date.now() + data.expires_in * 1000);
            if (data.refresh_token) {
                localStorage.setItem('spotify_refresh_token', data.refresh_token);
            }
        } else {
            return null;
        }
    }
    return token;
}

function showConnectedUI() {
    document.getElementById('spotify-disconnected').classList.add('hidden');
    document.getElementById('spotify-connected').classList.remove('hidden');
}

function showDisconnectedUI() {
    document.getElementById('spotify-connected').classList.add('hidden');
    document.getElementById('spotify-disconnected').classList.remove('hidden');
    clearProgressBar();
}

function clearProgressBar() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    document.getElementById('progress').style.width = '0%';
    document.getElementById('current-time').innerText = '0:00';
    document.getElementById('total-time').innerText = '0:00';
}

function updatePlayerUI(state) {
    if (!state || !state.track_window || !state.track_window.current_track) {
        document.getElementById('song-name').innerText = 'Not Playing';
        document.getElementById('artist-name').innerText = 'Spotify';
        document.getElementById('spotify-album-art').src = 'https://raw.githubusercontent.com/Lanyard-Project/Lanyard/main/assets/spotify_placeholder.png';
        clearProgressBar();
        document.getElementById('play-pause').className = 'fas fa-play';
        return;
    }

    const track = state.track_window.current_track;
    document.getElementById('song-name').innerText = track.name;
    document.getElementById('artist-name').innerText = track.artists.map(a => a.name).join(', ');
    document.getElementById('spotify-album-art').src = track.album.images[0]?.url || 'https://via.placeholder.com/60';

    const isPlaying = !state.paused;
    document.getElementById('play-pause').className = isPlaying ? 'fas fa-pause' : 'fas fa-play';

    clearProgressBar();
    if (isPlaying) {
        const total = state.duration;
        document.getElementById('total-time').innerText = formatTime(total);

        progressInterval = setInterval(() => {
            const elapsed = state.position + (Date.now() - state.timestamp);
            const percent = Math.min((elapsed / total) * 100, 100);
            document.getElementById('progress').style.width = `${percent}%`;
            document.getElementById('current-time').innerText = formatTime(elapsed);
        }, 1000);
    } else {
        document.getElementById('progress').style.width = `${(state.position / state.duration) * 100}%`;
        document.getElementById('current-time').innerText = formatTime(state.position);
        document.getElementById('total-time').innerText = formatTime(state.duration);
    }
}

function initSpotifyPlayer(token) {
    spotifyAccessToken = token;
    showConnectedUI();

    if (window.Spotify) {
        createPlayer();
    } else {
        window.onSpotifyWebPlaybackSDKReady = createPlayer;
    }
}

function createPlayer() {
    spotifyPlayer = new Spotify.Player({
        name: 'Matix Bio',
        getOAuthToken: cb => cb(spotifyAccessToken),
        volume: 0.5,
    });

    spotifyPlayer.addListener('ready', ({ device_id }) => {
        spotifyDeviceId = device_id;
        fetch(`https://api.spotify.com/v1/me/player`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${spotifyAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(() => {});
        getCurrentPlayback();
    });

    spotifyPlayer.addListener('player_state_changed', state => {
        updatePlayerUI(state);
    });

    spotifyPlayer.addListener('not_ready', () => {
        clearProgressBar();
    });

    spotifyPlayer.connect().catch(() => {});
}

async function getCurrentPlayback() {
    try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${spotifyAccessToken}` },
        });
        if (res.status === 200) {
            const data = await res.json();
            if (data && data.item) {
                updatePlayerUI({
                    paused: !data.is_playing,
                    duration: data.item.duration_ms,
                    position: data.progress_ms,
                    timestamp: Date.now(),
                    track_window: {
                        current_track: {
                            name: data.item.name,
                            artists: data.item.artists,
                            album: data.item.album,
                        }
                    }
                });
            }
        }
    } catch (e) {}
}

// Spotify Buttons
document.addEventListener('DOMContentLoaded', async () => {
    const connectBtn = document.getElementById('connect-spotify');
    if (connectBtn) {
        connectBtn.addEventListener('click', startSpotifyAuth);
    }

    document.getElementById('play-pause')?.addEventListener('click', async () => {
        if (!spotifyPlayer) return;
        const state = await spotifyPlayer.getCurrentState();
        if (state && !state.paused) {
            await spotifyPlayer.pause();
        } else {
            await spotifyPlayer.resume();
        }
    });

    document.getElementById('prev-btn')?.addEventListener('click', () => {
        spotifyPlayer?.previous();
    });

    document.getElementById('next-btn')?.addEventListener('click', () => {
        spotifyPlayer?.next();
    });

    // Handle OAuth redirect
    const handled = await handleRedirect();
    if (!handled) {
        const token = await getValidToken();
        if (token) {
            initSpotifyPlayer(token);
        }
    } else {
        const token = await getValidToken();
        if (token) {
            initSpotifyPlayer(token);
            getCurrentPlayback();
        }
    }
});

// Legacy Lanyard Spotify sync (compatibility)
function updateSpotify(spotify) {
    if (!spotifyAccessToken) {
        document.getElementById("song-name").innerText = spotify.song;
        document.getElementById("artist-name").innerText = spotify.artist;
        document.getElementById("spotify-album-art").src = spotify.album_art_url;
        const start = spotify.timestamps.start;
        const end = spotify.timestamps.end;
        const total = end - start;
        document.getElementById("total-time").innerText = formatTime(total);
        const updateProgress = () => {
            const now = Date.now();
            const elapsed = now - start;
            const percent = Math.min((elapsed / total) * 100, 100);
            document.getElementById("progress").style.width = `${percent}%`;
            document.getElementById("current-time").innerText = formatTime(elapsed);
            if (percent < 100) requestAnimationFrame(updateProgress);
        };
        requestAnimationFrame(updateProgress);
    }
}

function resetSpotify() {
    if (!spotifyAccessToken) {
        document.getElementById("song-name").innerText = "Not Listening to Anything";
        document.getElementById("artist-name").innerText = "Spotify";
        document.getElementById("spotify-album-art").src = "https://raw.githubusercontent.com/Lanyard-Project/Lanyard/main/assets/spotify_placeholder.png";
        document.getElementById("progress").style.width = "0%";
        document.getElementById("current-time").innerText = "0:00";
        document.getElementById("total-time").innerText = "0:00";
    }
}

function formatTime(ms) {
    if (!ms || isNaN(ms)) return "0:00";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Particles System (Snow)
const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1 + 0.5;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.y > canvas.height) {
            this.y = -10;
            this.x = Math.random() * canvas.width;
        }
    }
    draw() {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particlesArray = [];
    for (let i = 0; i < 100; i++) {
        particlesArray.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
    }
    requestAnimationFrame(animateParticles);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
});

initParticles();
animateParticles();

// UI Controls
const video = document.getElementById("bg-video");
const muteBtn = document.getElementById("mute-btn");

video.play().catch(() => {});

if (muteBtn) {
    muteBtn.addEventListener('click', async () => {
        video.muted = !video.muted;
        if (!video.muted) {
            try { await video.play(); } catch (e) {}
        }
        muteBtn.innerHTML = video.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    });
}
