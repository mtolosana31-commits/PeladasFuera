// ==========================================
// IMÁGENES DE OBSTÁCULOS
// ==========================================
const obstacleImages = [
    'images/obstacle1.png',
    'images/obstacle2.png',
    'images/obstacle3.png',
    'images/obstacle4.png',
    'images/obstacle5.jpeg',
    'images/obstacle6.png'
];

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
const world = document.getElementById('world');
const ground = document.getElementById('ground');
const playerElement = document.getElementById('player');
const scoreElement = document.getElementById('score-value');
const speedElement = document.getElementById('speed-value');
const highscoreElement = document.getElementById('highscore-value');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const finalHighscoreElement = document.getElementById('final-highscore');
const newRecordElement = document.getElementById('new-record');
const restartButton = document.getElementById('restart-button');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const collisionFlash = document.getElementById('collision-flash');
const gameContainer = document.getElementById('game-container');
const touchControls = document.getElementById('touch-controls');
const bgCanvas = document.getElementById('bg-canvas');
const crashedFace = document.getElementById('crashed-face');

const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');

// ==========================================
// VARIABLES DEL JUEGO
// ==========================================
let isGameRunning = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('fuckPeladasHighScore')) || 0;
let gameSpeed = 8;           // MUCHO más lento — los obstáculos se ven venir
const BASE_SPEED = 8;
let obstacleTimer = null;
let gameLoop = null;
let lastObstacleImageIndex = -1;
let lastCrashedImage = '';

// Jugador
let playerX = 0;
let playerY = 0;
let velocityY = 0;
let velocityX = 0;
const gravity = 1.4;
const jumpPower = 22;
const playerSpeed = 13;
const groundY = 0;

// Teclas
const keys = { left: false, right: false };

// Obstáculos
let obstacles = [];
let groundOffsetZ = 0;

// ==========================================
// FONDO ANIMADO — ESTRELLAS (suave)
// ==========================================
const bgCtx = bgCanvas.getContext('2d');
let stars = [];

function initBackground() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    stars = [];

    // Estrellas estáticas con twinkle suave
    const count = Math.floor((bgCanvas.width * bgCanvas.height) / 5000);
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * bgCanvas.width,
            y: Math.random() * bgCanvas.height,
            r: Math.random() * 1.4 + 0.3,
            twinkleSpeed: Math.random() * 0.008 + 0.002, // MUY suave
            twinklePhase: Math.random() * Math.PI * 2,
            baseAlpha: Math.random() * 0.5 + 0.15
        });
    }
}

function drawBackground(time) {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    // Nebulosa sutil estática
    const nebGrad = bgCtx.createRadialGradient(
        bgCanvas.width * 0.3, bgCanvas.height * 0.35, 0,
        bgCanvas.width * 0.3, bgCanvas.height * 0.35, bgCanvas.width * 0.45
    );
    nebGrad.addColorStop(0, 'rgba(40, 0, 80, 0.06)');
    nebGrad.addColorStop(1, 'transparent');
    bgCtx.fillStyle = nebGrad;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    // Estrellas con twinkle MUY suave
    stars.forEach(s => {
        const alpha = s.baseAlpha + Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.15;
        bgCtx.beginPath();
        bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(255,255,255,${Math.max(0.05, alpha)})`;
        bgCtx.fill();
    });

    requestAnimationFrame(drawBackground);
}

initBackground();
drawBackground(0);
window.addEventListener('resize', initBackground);

// ==========================================
// INIT
// ==========================================
highscoreElement.innerText = highScore;

function init() {
    isGameRunning = true;
    score = 0;
    gameSpeed = BASE_SPEED;
    playerX = 0;
    playerY = groundY;
    velocityY = 0;
    velocityX = 0;

    obstacles.forEach(obs => obs.element.remove());
    obstacles = [];

    document.querySelectorAll('.collision-particle').forEach(p => p.remove());

    scoreElement.innerText = '0';
    speedElement.innerText = '1.0x';
    gameOverScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    touchControls.classList.remove('hidden');

    collisionFlash.classList.remove('active');
    collisionFlash.style.opacity = '0';
    gameContainer.classList.remove('screen-shake');

    gameLoop = requestAnimationFrame(update);
    scheduleNextObstacle();
}

// ==========================================
// GAME LOOP
// ==========================================
function update() {
    if (!isGameRunning) return;

    // Movimiento lateral suave
    if (keys.left) velocityX = lerp(velocityX, -playerSpeed, 0.22);
    else if (keys.right) velocityX = lerp(velocityX, playerSpeed, 0.22);
    else velocityX *= 0.8;

    if (Math.abs(velocityX) < 0.4) velocityX = 0;

    playerX += velocityX;
    playerX = clamp(playerX, -280, 280);

    // Salto
    velocityY -= gravity;
    playerY += velocityY;

    if (playerY <= groundY) {
        playerY = groundY;
        velocityY = 0;
        playerElement.classList.remove('jumping');
    }

    // Actualizar mundo 3D — mover la cámara lateral
    world.style.transform = `translate3d(${-playerX}px, ${playerY}px, 0)`;

    // Jugador visual (inclinación)
    const tilt = clamp(velocityX * 1.2, -20, 20);
    playerElement.style.transform = `translateY(${-playerY}px) rotateZ(${tilt}deg)`;

    // Sombra del jugador
    const shadow = document.getElementById('player-shadow');
    if (shadow) {
        const shadowScale = Math.max(0.3, 1 - (playerY / 250));
        shadow.style.transform = `translateX(-50%) scale(${shadowScale})`;
        shadow.style.opacity = shadowScale * 0.7;
    }

    // Mover suelo — velocidad reducida para no marear
    groundOffsetZ += gameSpeed * 0.4;
    if (groundOffsetZ > 60) groundOffsetZ -= 60;
    ground.style.transform = `rotateX(85deg) translateZ(-50px) translateY(${groundOffsetZ}px)`;

    // ==========================================
    // ACTUALIZAR OBSTÁCULOS
    // ==========================================
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.z += gameSpeed;

        // Solo aplicar translate3d — SIN scale adicional
        // CSS perspective se encarga de hacer crecer el obstáculo naturalmente
        obs.element.style.transform = `translate3d(${obs.x}px, -${obs.y}px, ${obs.z}px)`;

        // Opacidad: fade in suave desde el horizonte
        // z va de -2000 (lejos) a +400 (pasó la cámara)
        // Queremos: invisible a z=-2000, visible a z=-1500, full a z=-800
        const fadeStart = -1800;
        const fadeFull = -800;
        if (obs.z < fadeStart) {
            obs.element.style.opacity = '0';
        } else if (obs.z < fadeFull) {
            const t = (obs.z - fadeStart) / (fadeFull - fadeStart); // 0→1
            obs.element.style.opacity = t.toFixed(2);
        } else {
            obs.element.style.opacity = '1';
        }

        // ==========================================
        // COLISIÓN
        // ==========================================
        // Solo detectar cuando el obstáculo está JUSTO en la posición del jugador
        // El jugador está en z=0 en el mundo 3D
        if (obs.z > -40 && obs.z < 40 && !obs.hit) {
            const playerHalfW = 18;
            const obsHalfW = 32;
            const obsHeight = 75;

            const distX = Math.abs(obs.x - playerX);
            const hitX = distX < (playerHalfW + obsHalfW);
            const hitY = playerY < obsHeight; // Si el jugador NO está saltando por encima

            if (hitX && hitY) {
                obs.hit = true;
                lastCrashedImage = obs.imageSrc;
                obs.element.classList.add('hit');
                triggerCollision();
                return;
            }
        }

        // Eliminar si ya pasó la cámara
        if (obs.z > 500) {
            obs.element.remove();
            obstacles.splice(i, 1);
        }
    }

    // Puntuación y dificultad
    score += 0.1;
    const displayScore = Math.floor(score);
    scoreElement.innerText = displayScore;

    // Dificultad aumenta muy gradualmente
    const speedMult = (1 + score * 0.002).toFixed(1);
    speedElement.innerText = speedMult + 'x';
    gameSpeed = BASE_SPEED + (score * 0.03);

    gameLoop = requestAnimationFrame(update);
}

// ==========================================
// HELPERS
// ==========================================
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// ==========================================
// SALTO
// ==========================================
function jump() {
    if (!isGameRunning) return;
    if (playerY === groundY) {
        velocityY = jumpPower;
        playerElement.classList.add('jumping');
    }
}

// ==========================================
// SPAWN DE OBSTÁCULOS
// ==========================================
function getRandomObstacleImage() {
    let index;
    do {
        index = Math.floor(Math.random() * obstacleImages.length);
    } while (index === lastObstacleImageIndex && obstacleImages.length > 1);
    lastObstacleImageIndex = index;
    return obstacleImages[index];
}

function spawnObstacle() {
    if (!isGameRunning) return;

    const obstacleEl = document.createElement('div');
    obstacleEl.classList.add('obstacle');

    const imageSrc = getRandomObstacleImage();
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Pelada';
    img.draggable = false;
    obstacleEl.appendChild(img);

    // 3 carriles
    const lanes = [-180, 0, 180];
    const randomLane = lanes[Math.floor(Math.random() * lanes.length)];

    // Empezar LEJOS — a z=-2000
    // Con perspective=700px, un objeto a z=-2000 se ve a scale 700/(700+2000) ≈ 0.26
    // Es decir 26% de su tamaño → 26px de un obstáculo de 100px → visible como un punto
    // Se irá agrandando naturalmente mientras se acerca a z=0
    obstacleEl.style.opacity = '0'; // Empieza invisible, el loop lo fade-in

    world.appendChild(obstacleEl);

    obstacles.push({
        element: obstacleEl,
        x: randomLane,
        y: 50,
        z: -2000,       // Punto de spawn visible en el horizonte
        hit: false,
        imageSrc: imageSrc
    });

    scheduleNextObstacle();
}

function scheduleNextObstacle() {
    // Tiempo entre obstáculos — empieza espaciado, se aprieta con la dificultad
    const minDelay = Math.max(600, 1200 - score * 3);
    const maxDelay = Math.max(1200, 2200 - score * 5);
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    clearTimeout(obstacleTimer);
    obstacleTimer = setTimeout(spawnObstacle, delay);
}

// ==========================================
// COLISIÓN
// ==========================================
function triggerCollision() {
    isGameRunning = false;
    cancelAnimationFrame(gameLoop);
    clearTimeout(obstacleTimer);

    // Flash rojo
    collisionFlash.classList.add('active');

    // Screen shake
    gameContainer.classList.add('screen-shake');

    // Partículas de explosión
    spawnCollisionParticles();

    // Vibración en móvil
    if (navigator.vibrate) {
        navigator.vibrate([80, 40, 150, 30, 80]);
    }

    setTimeout(() => {
        gameOver();
    }, 600);
}

function spawnCollisionParticles() {
    const container = document.getElementById('ui-layer');
    const colors = ['#ff1744', '#ff6d00', '#ffd600', '#fff', '#ff4081'];
    const playerRect = playerElement.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();
    const cx = playerRect.left - containerRect.left + playerRect.width / 2;
    const cy = playerRect.top - containerRect.top + playerRect.height / 2;

    for (let i = 0; i < 18; i++) {
        const p = document.createElement('div');
        p.className = 'collision-particle';
        const angle = (Math.PI * 2 * i) / 18;
        const dist = 30 + Math.random() * 70;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        const size = 3 + Math.random() * 5;

        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.boxShadow = `0 0 6px ${p.style.background}`;
        p.style.transition = `all ${0.3 + Math.random() * 0.3}s cubic-bezier(0.25, 1, 0.5, 1)`;
        p.style.opacity = '1';

        container.appendChild(p);
        p.offsetHeight; // force reflow

        requestAnimationFrame(() => {
            p.style.transform = `translate(${tx}px, ${ty}px) scale(0.1)`;
            p.style.opacity = '0';
        });

        setTimeout(() => p.remove(), 800);
    }
}

function gameOver() {
    const finalScore = Math.floor(score);
    finalScoreElement.innerText = finalScore;

    let isNewRecord = false;
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('fuckPeladasHighScore', highScore);
        highscoreElement.innerText = highScore;
        isNewRecord = true;
    }

    finalHighscoreElement.innerText = highScore;

    // Mostrar la cara que te mató
    crashedFace.innerHTML = '';
    if (lastCrashedImage) {
        const img = document.createElement('img');
        img.src = lastCrashedImage;
        img.alt = 'La pelada que te mató';
        crashedFace.appendChild(img);
    }

    if (isNewRecord) {
        newRecordElement.classList.remove('hidden');
    } else {
        newRecordElement.classList.add('hidden');
    }

    gameOverScreen.classList.remove('hidden');
    touchControls.classList.add('hidden');
}

// ==========================================
// CONTROLES
// ==========================================
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (isGameRunning) {
            jump();
        } else if (!startScreen.classList.contains('hidden')) {
            init();
        } else if (!gameOverScreen.classList.contains('hidden')) {
            init();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

// Táctiles
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
btnLeft.addEventListener('mousedown', () => keys.left = true);
btnLeft.addEventListener('mouseup', () => keys.left = false);
btnLeft.addEventListener('mouseleave', () => keys.left = false);

btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
btnRight.addEventListener('mousedown', () => keys.right = true);
btnRight.addEventListener('mouseup', () => keys.right = false);
btnRight.addEventListener('mouseleave', () => keys.right = false);

btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
btnJump.addEventListener('mousedown', jump);

// Botones
startButton.addEventListener('click', init);
restartButton.addEventListener('click', init);
