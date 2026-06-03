const DISCORD_ID = "708077224598962335";

// ─── Lanyard WebSocket ───
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
    const dot = document.getElementById("status-dot");

    const status = presence.discord_status;
    statusEl.innerText = status.charAt(0).toUpperCase() + status.slice(1);
    statusEl.style.color = getStatusColor(status);
    dot.style.background = getStatusColor(status);

    if (presence.spotify) {
        activityEl.innerText = `${getLangText("listening")} ${presence.spotify.song} - ${presence.spotify.artist}`;
    } else if (presence.activities.length > 0) {
        const activity = presence.activities.find(a => a.type !== 4) || presence.activities[0];
        activityEl.innerText = activity.type === 4 ? activity.state : `${getLangText("playing")} ${activity.name}`;
    } else {
        activityEl.innerText = getLangText("nothing");
    }

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

function formatTime(ms) {
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / (1000 * 60)) % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ─── Typing Effect ───
const TYPING_TEXTS = {
    es: [
        "Developer & Content Creator",
        "Apasionado por la tecnologia",
        "Creador de contenido"
    ],
    en: [
        "Developer & Content Creator",
        "Tech enthusiast",
        "Content creator"
    ]
};

let currentTexts = TYPING_TEXTS.es;
let textIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingElement = document.getElementById("typing-text");

function typeEffect() {
    const current = currentTexts[textIndex];
    if (!isDeleting) {
        typingElement.textContent = current.substring(0, charIndex + 1);
        charIndex++;
        if (charIndex === current.length) {
            isDeleting = true;
            setTimeout(typeEffect, 2000);
            return;
        }
        setTimeout(typeEffect, 80 + Math.random() * 50);
    } else {
        typingElement.textContent = current.substring(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % currentTexts.length;
            setTimeout(typeEffect, 500);
            return;
        }
        setTimeout(typeEffect, 30);
    }
}

setTimeout(typeEffect, 1000);

// ─── Language Switcher ───
const LANGS = {
    es: {
        skills: "Habilidades",
        projects: "Proyectos",
        listening: "Escuchando",
        playing: "Jugando",
        nothing: "No estoy haciendo nada especial",
        lang: "EN",
    },
    en: {
        skills: "Skills",
        projects: "Projects",
        listening: "Listening to",
        playing: "Playing",
        nothing: "Not doing anything special",
        lang: "ES",
    }
};

let currentLang = "es";

function getLangText(key) {
    return LANGS[currentLang][key] || key;
}

function setLanguage(lang) {
    currentLang = lang;
    document.getElementById("html").lang = lang;
    document.getElementById("lang-btn").textContent = LANGS[lang].lang;

    currentTexts = TYPING_TEXTS[lang];
    textIndex = 0;
    charIndex = 0;
    isDeleting = false;
    typingElement.textContent = "";

    const titles = document.querySelectorAll("[data-lang]");
    titles.forEach(el => {
        const key = el.dataset.lang;
        el.textContent = LANGS[lang][key] || el.textContent;
    });

    setTimeout(typeEffect, 1000);
}

document.getElementById("lang-btn").addEventListener("click", () => {
    setLanguage(currentLang === "es" ? "en" : "es");
});

// ─── Skill Bars Animation ───
const skillsSection = document.getElementById("skills");
if (skillsSection) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                skillsSection.querySelectorAll(".skill-item").forEach(item => {
                    const fill = item.querySelector(".skill-fill");
                    fill.style.width = item.dataset.width + "%";
                });
                observer.unobserve(skillsSection);
            }
        });
    }, { threshold: 0.3 });
    observer.observe(skillsSection);
}

// ─── GitHub Projects ───
async function fetchProjects() {
    try {
        const res = await fetch("https://api.github.com/users/MatixArg/repos?sort=updated&per_page=6");
        const repos = await res.json();
        const grid = document.getElementById("projects-grid");
        grid.innerHTML = "";

        for (const repo of repos) {
            if (repo.fork) continue;
            const card = document.createElement("a");
            card.href = repo.html_url;
            card.target = "_blank";
            card.className = "project-card";

            const desc = repo.description || (currentLang === "es" ? "Sin descripcion" : "No description");
            const lang = repo.language ? `<span><i class="fas fa-code"></i> ${repo.language}</span>` : "";
            const stars = repo.stargazers_count ? `<span><i class="fas fa-star"></i> ${repo.stargazers_count}</span>` : "";

            card.innerHTML = `
                <h3>${repo.name}</h3>
                <p>${desc}</p>
                <div class="project-meta">${lang}${stars}</div>
            `;
            grid.appendChild(card);
        }
    } catch (e) {
        document.getElementById("projects-grid").innerHTML = "<p style='opacity:0.5;font-size:0.9rem'>No se pudieron cargar los proyectos</p>";
    }
}

fetchProjects();

// ─── Visitor Counter ───
async function updateCounter() {
    try {
        const res = await fetch("https://api.countapi.xyz/hit/portaldev.tech/visits");
        const data = await res.json();
        document.getElementById("count").textContent = data.value;
    } catch (e) {
        document.getElementById("count").textContent = "---";
    }
}
updateCounter();

// ─── Easter Egg (Naruto) ───
let typedKeys = "";
const EASTER_EGG = "naruto";

document.addEventListener("keydown", (e) => {
    typedKeys += e.key.toLowerCase();
    if (typedKeys.length > EASTER_EGG.length) {
        typedKeys = typedKeys.slice(-EASTER_EGG.length);
    }
    if (typedKeys === EASTER_EGG) {
        triggerNarutoEasterEgg();
        typedKeys = "";
    }
});

function triggerNarutoEasterEgg() {
    const colors = ["#ff6b35", "#f7d94f", "#ff4d4d", "#ff8c00", "#fff"];
    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            const el = document.createElement("div");
            el.style.cssText = `
                position: fixed; left: ${Math.random() * 100}vw; top: -20px;
                font-size: ${Math.random() * 20 + 10}px;
                color: ${colors[Math.floor(Math.random() * colors.length)]};
                pointer-events: none; z-index: 10000;
                animation: narutoFall ${Math.random() * 2 + 1.5}s linear forwards;
            `;
            el.textContent = ["🍥", "🌀", "⭐", "✨", "🔥", "💥"][Math.floor(Math.random() * 6)];
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3500);
        }, i * 30);
    }
}

const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes narutoFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
`;
document.head.appendChild(styleSheet);

// ─── Cursor Particles (disabled on touch) ───
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const cursorCanvas = document.getElementById("cursor-canvas");
const cursorCtx = cursorCanvas?.getContext("2d");
if (cursorCanvas) {
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
}

let cursorParticles = [];
const MAX_CURSOR = 30;
let lastMouseX = 0, lastMouseY = 0;
let mouseMoved = false;

class CursorParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 2;
        this.speedY = (Math.random() - 0.5) * 2;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
        this.color = `hsl(${Math.random() * 60 + 340}, 100%, 60%)`;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.98;
    }
    draw() {
        cursorCtx.save();
        cursorCtx.globalAlpha = this.life;
        cursorCtx.fillStyle = this.color;
        cursorCtx.shadowBlur = 10;
        cursorCtx.shadowColor = this.color;
        cursorCtx.beginPath();
        cursorCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        cursorCtx.fill();
        cursorCtx.restore();
    }
}

if (!isTouchDevice) {
    document.addEventListener("mousemove", (e) => {
        if (!mouseMoved) {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            mouseMoved = true;
        }
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.min(Math.ceil(dist / 8), 20);
        for (let s = 0; s <= steps; s++) {
            const x = lastMouseX + (dx * s) / steps;
            const y = lastMouseY + (dy * s) / steps;
            cursorParticles.push(new CursorParticle(x, y));
        }
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        if (cursorParticles.length > MAX_CURSOR * 3) {
            cursorParticles.splice(0, cursorParticles.length - MAX_CURSOR * 3);
        }
    });

    function animateCursorParticles() {
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
        cursorParticles = cursorParticles.filter(p => p.life > 0);
        for (const p of cursorParticles) {
            p.update();
            p.draw();
        }
        requestAnimationFrame(animateCursorParticles);
    }

    animateCursorParticles();
}

// ─── Snow Particles (existing) ───
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
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
    initParticles();
});

initParticles();
animateParticles();

// ─── UI Controls ───
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
