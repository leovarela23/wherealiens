const canvas = document.getElementById('snake');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const bestScoreEl = document.getElementById('best-score');
    const controls = document.querySelectorAll('[data-dir]');
    const leaderboardList = document.getElementById('leaderboard-list');
    const leaderboardForm = document.getElementById('leaderboard-form');
    const playerNameInput = document.getElementById('player-name');
    const leaderboardKey = 'wormhole-snake-top5';
    const leaderboardApi = '';
    const leaderboardEnabled = false;
    const gridSize = 18;
    const tileCount = canvas.width / gridSize;

    let snake;
    let velocity;
    let nextVelocity;
    let food;
    let score;
    let gameOver;
    let pulse = 0;
    let pendingLeaderboardScore = null;

    function loadLocalLeaderboard() {
      try {
        const raw = localStorage.getItem(leaderboardKey);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    function saveLocalLeaderboard(entries) {
      localStorage.setItem(leaderboardKey, JSON.stringify(entries.slice(0, 5)));
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    async function fetchSharedLeaderboard() {
      if (!leaderboardEnabled) return loadLocalLeaderboard();
      try {
        const response = await fetch(leaderboardApi, { cache: 'no-store' });
        if (!response.ok) throw new Error('request failed');
        const data = await response.json();
        const scores = Array.isArray(data?.scores) ? data.scores : [];
        saveLocalLeaderboard(scores);
        return scores;
      } catch (e) {
        return loadLocalLeaderboard();
      }
    }

    async function submitSharedScore(name, score, turnstileToken) {
      if (!leaderboardEnabled) {
        const entries = loadLocalLeaderboard();
        entries.push({ name, score });
        entries.sort((a, b) => b.score - a.score);
        const top5 = entries.slice(0, 5);
        saveLocalLeaderboard(top5);
        return top5;
      }
      try {
        const response = await fetch(leaderboardApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, score, turnstileToken })
        });
        if (!response.ok) throw new Error('submit failed');
        const data = await response.json();
        const scores = Array.isArray(data?.scores) ? data.scores : [];
        saveLocalLeaderboard(scores);
        return scores;
      } catch (e) {
        const entries = loadLocalLeaderboard();
        entries.push({ name, score });
        entries.sort((a, b) => b.score - a.score);
        const top5 = entries.slice(0, 5);
        saveLocalLeaderboard(top5);
        return top5;
      }
    }

    function renderLeaderboard(entries) {
      bestScoreEl.textContent = entries[0]?.score ?? 0;
      if (!entries.length) {
        leaderboardList.innerHTML = '<li><strong>No scores yet</strong></li>';
        return;
      }
      leaderboardList.innerHTML = entries.map(entry => `<li><strong>${escapeHtml(entry.name)}</strong> · ${Number(entry.score) || 0}</li>`).join('');
    }

    async function refreshLeaderboard() {
      const entries = await fetchSharedLeaderboard();
      renderLeaderboard(entries);
      return entries;
    }

    function qualifiesForEntries(entries, value) {
      if (value <= 0) return false;
      if (entries.length < 5) return true;
      return value > entries[entries.length - 1].score;
    }

    async function qualifiesForLeaderboard(value) {
      const localEntries = loadLocalLeaderboard();
      if (qualifiesForEntries(localEntries, value)) return true;
      const sharedEntries = await fetchSharedLeaderboard();
      return qualifiesForEntries(sharedEntries, value);
    }

    function showLeaderboardForm(value) {
      pendingLeaderboardScore = value;
      leaderboardForm.style.display = 'block';
      playerNameInput.value = '';
      playerNameInput.blur();
      requestAnimationFrame(() => playerNameInput.focus());
    }

    function hideLeaderboardForm(clearScore = true) {
      if (clearScore) pendingLeaderboardScore = null;
      leaderboardForm.style.display = 'none';
    }

    function randomCell() {
      return Math.floor(Math.random() * tileCount);
    }

    function placeFood() {
      do {
        food = { x: randomCell(), y: randomCell() };
      } while (snake.some(part => part.x === food.x && part.y === food.y));
    }

    function resetGame() {
      snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ];
      velocity = { x: 1, y: 0 };
      nextVelocity = { x: 1, y: 0 };
      score = 0;
      gameOver = false;
      pulse = 0;
      scoreEl.textContent = score;
      hideLeaderboardForm(false);
      placeFood();
      draw();
    }

    function flashControl(direction) {
      const button = document.querySelector(`[data-dir="${direction}"]`);
      if (!button) return;
      button.classList.add('is-active');
      setTimeout(() => button.classList.remove('is-active'), 90);
    }

    function setDirection(direction) {
      const map = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };
      const proposed = map[direction];
      if (!proposed) return;

      flashControl(direction);

      if (gameOver) {
        if (pendingLeaderboardScore !== null) return;
        resetGame();
        nextVelocity = proposed;
        velocity = proposed;
        return;
      }

      if (proposed.x === -velocity.x && proposed.y === -velocity.y) return;
      nextVelocity = proposed;
    }

    function drawCell(x, y, color, glow) {
      const px = x * gridSize;
      const py = y * gridSize;
      ctx.fillStyle = color;
      ctx.shadowBlur = glow;
      ctx.shadowColor = color;
      ctx.fillRect(px + 2, py + 2, gridSize - 4, gridSize - 4);
      ctx.shadowBlur = 0;
    }

    function drawGrid() {
      ctx.fillStyle = 'rgba(7, 10, 24, 0.95)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let x = 0; x < tileCount; x++) {
        for (let y = 0; y < tileCount; y++) {
          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
      }
    }

    function draw() {
      drawGrid();
      pulse += 0.08;
      const foodGlow = 14 + Math.sin(pulse) * 4;

      snake.forEach((part, index) => {
        drawCell(part.x, part.y, index === 0 ? '#efe9ff' : '#b8a3ff', index === 0 ? 20 : 12);
      });
      drawCell(food.x, food.y, '#8de7ff', foodGlow);

      if (gameOver) {
        ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f7f9ff';
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillText('Signal lost', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '15px Inter, sans-serif';
        ctx.fillStyle = '#a3aed1';
        ctx.fillText('Tap a direction or press a key to restart', canvas.width / 2, canvas.height / 2 + 24);
      }
    }

    async function endGame() {
      gameOver = true;
      draw();
      const localEntries = loadLocalLeaderboard();
      if (qualifiesForEntries(localEntries, score)) {
        showLeaderboardForm(score);
        return;
      }
      if (await qualifiesForLeaderboard(score)) {
        showLeaderboardForm(score);
      } else {
        hideLeaderboardForm();
      }
    }

    function tick() {
      if (gameOver) {
        draw();
        return;
      }

      velocity = nextVelocity;
      const head = {
        x: (snake[0].x + velocity.x + tileCount) % tileCount,
        y: (snake[0].y + velocity.y + tileCount) % tileCount
      };

      if (snake.some(part => part.x === head.x && part.y === head.y)) {
        endGame();
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 1;
        scoreEl.textContent = score;
        placeFood();
      } else {
        snake.pop();
      }

      draw();
    }

    leaderboardForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pendingLeaderboardScore === null) return;
      const turnstileToken = window.turnstile?.getResponse();
      if (!turnstileToken) {
        alert('Please complete the verification first.');
        return;
      }
      const name = playerNameInput.value.trim() || 'Anonymous';
      const scores = await submitSharedScore(name, pendingLeaderboardScore, turnstileToken);
      renderLeaderboard(scores);
      hideLeaderboardForm();
      window.turnstile?.reset();
    });

    document.addEventListener('keydown', (event) => {
      if (pendingLeaderboardScore !== null && event.target === playerNameInput) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') setDirection('up');
      else if (key === 'arrowdown' || key === 's') setDirection('down');
      else if (key === 'arrowleft' || key === 'a') setDirection('left');
      else if (key === 'arrowright' || key === 'd') setDirection('right');
    });

    controls.forEach(button => {
      const dir = button.dataset.dir;
      const handler = (event) => {
        event.preventDefault();
        setDirection(dir);
      };
      button.addEventListener('pointerdown', handler);
      button.addEventListener('click', handler);
    });

    window.onload = async function () {
      await refreshLeaderboard();
      resetGame();
      setInterval(tick, 96);
    };
