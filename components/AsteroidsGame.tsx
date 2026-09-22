'use client';

import { useEffect, useRef, useState } from 'react';
import { AsteroidsGame, GameState } from '@/lib/asteroids-game';

interface AsteroidsScore {
  score: number;
  level: number;
  timestamp: number;
}

function saveScore(score: number, level: number): void {
  const scores: AsteroidsScore[] = JSON.parse(
    localStorage.getItem('asteroids_scores') || '[]'
  );
  scores.push({ score, level, timestamp: Date.now() });
  localStorage.setItem('asteroids_scores', JSON.stringify(scores));
}

function getBestScore(): AsteroidsScore | null {
  const scores: AsteroidsScore[] = JSON.parse(
    localStorage.getItem('asteroids_scores') || '[]'
  );
  return scores.length > 0
    ? scores.reduce((best, s) => (s.score > best.score ? s : best))
    : null;
}

export default function AsteroidsGameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bestScore, setBestScore] = useState<AsteroidsScore | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize game
    const game = new AsteroidsGame(800, 600);
    gameRef.current = game;
    setGameState(game.getState());
    setBestScore(getBestScore());

    // Input handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR'].includes(e.code)) {
        e.preventDefault();
      }
      gameRef.current?.setKeyDown(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current?.setKeyUp(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      const dt =
        lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      gameRef.current?.update(dt);
      const state = gameRef.current?.getState();
      setGameState({ ...state } as GameState);

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 800, 600);

      if (state) {
        // Draw particles
        state.particles.forEach((p) => {
          const alpha = p.ttl / p.life;
          ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.stroke();
        });

        // Draw asteroids
        state.asteroids.forEach((a) => {
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rot);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(a.verts[0][0], a.verts[0][1]);
          for (let i = 1; i < a.verts.length; i++)
            ctx.lineTo(a.verts[i][0], a.verts[i][1]);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        });

        // Draw bullets
        state.bullets.forEach((b) => {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw ship
        if (!state.ship.dead) {
          if (state.ship.invincible <= 0 || Math.floor(state.ship.invincible * 8) % 2 === 0) {
            ctx.save();
            ctx.translate(state.ship.x, state.ship.y);
            ctx.rotate(state.ship.angle);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(-12, -9);
            ctx.lineTo(-7, 0);
            ctx.lineTo(-12, 9);
            ctx.closePath();
            ctx.stroke();

            // Thruster flame
            if (state.ship.thrusting && Math.random() > 0.35) {
              ctx.beginPath();
              ctx.moveTo(-8, -4);
              ctx.lineTo(-8 - (Math.random() * 8 + 6), 0);
              ctx.lineTo(-8, 4);
              ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
              ctx.stroke();
            }

            ctx.restore();
          }
        }

        // Draw HUD
        ctx.fillStyle = '#fff';
        ctx.font = '15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE  ${state.score}`, 14, 26);

        ctx.textAlign = 'center';
        ctx.fillText(`LEVEL ${state.level}`, 400, 26);

        ctx.textAlign = 'right';
        for (let i = 0; i < state.lives; i++) {
          drawLifeIcon(ctx, 800 - 16 - i * 22, 18);
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const handleRestart = () => {
    if (gameRef.current && gameState && gameState.state === 'gameover') {
      saveScore(gameState.score, gameState.level);
      setBestScore(getBestScore());
      gameRef.current.reset();
      setGameState(gameRef.current.getState());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border-2 border-white"
        />
        {gameState?.state === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
            <h1 className="text-white text-6xl font-mono font-bold mb-4">
              GAME OVER
            </h1>
            <div className="text-white text-xl font-mono mb-8 text-center">
              <p>PUNTAJE: {gameState.score}</p>
              <p>NIVEL: {gameState.level}</p>
              {bestScore && (
                <p className="mt-4 text-cyan-400">
                  MEJOR: {bestScore.score} (Nivel {bestScore.level})
                </p>
              )}
            </div>
            <button
              onClick={handleRestart}
              className="px-6 py-3 bg-white text-black font-mono font-bold text-lg hover:bg-gray-200 transition"
            >
              REINICIAR
            </button>
            <div className="text-gray-400 text-sm font-mono mt-8 text-center">
              <p>↑↓←→ Mover | SPACE Disparar | R Reiniciar</p>
            </div>
          </div>
        )}
      </div>
      {bestScore && gameState?.state !== 'gameover' && (
        <div className="mt-6 text-white font-mono text-center text-sm">
          <p>Mejor puntuación: {bestScore.score} (Nivel {bestScore.level})</p>
        </div>
      )}
    </div>
  );
}

function drawLifeIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
