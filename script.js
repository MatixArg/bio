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

// Spotify Sync
function updateSpotify(spotify) {
    document.getElementById("song-name").innerText = spotify.song;
    document.getElementById("artist-name").innerText = spotify.artist;
    document.getElementById("spotify-album-art").src = spotify.album_art_url;
    
    // Calculate progress
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

function resetSpotify() {
    document.getElementById("song-name").innerText = "Not Listening to Anything";
    document.getElementById("artist-name").innerText = "Spotify";
    document.getElementById("spotify-album-art").src = "https://raw.githubusercontent.com/Lanyard-Project/Lanyard/main/assets/spotify_placeholder.png";
    document.getElementById("progress").style.width = "0%";
    document.getElementById("current-time").innerText = "0:00";
    document.getElementById("total-time").innerText = "0:00";
}

function formatTime(ms) {
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
