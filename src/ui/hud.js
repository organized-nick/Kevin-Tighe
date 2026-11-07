/**
 * src/ui/hud.js
 * Kevin Tighe: 3D Lakeside Retreat - Real-Time HUD Overlay & Notifications Controller
 *
 * Implements:
 * - Dynamic binding to #hud DOM elements (oranges, score, holes, dust gauge)
 * - Pixie dust bar fill and low-fuel warning glow
 * - Subterranean depth gauge needle and status pills (0-50ft sweet spot vs hazard)
 * - Sonar readiness and cooldown opacity feedback
 * - Toast quip notifications for pickups, sonar detections, and holy grail milestones
 */

export class HUDManager {
  constructor() {
    // Top Stats Bar
    this.elOranges = document.getElementById('hudOranges');
    this.elScore = document.getElementById('hudScore');
    this.elHoles = document.getElementById('hudHoles');
    this.elZoneName = document.getElementById('hudZoneName');
    this.elZoneSub = document.getElementById('hudZoneSub');

    // Pixie Dust Flight Energy Meter
    this.elDustFill = document.getElementById('hudDustFill');
    this.elDustVal = document.getElementById('hudDustVal');

    // Subterranean Depth HUD
    this.elSubHud = document.getElementById('subterraneanHud');
    this.elDepthNum = document.getElementById('liveDepthNum');
    this.elDepthStatus = document.getElementById('liveDepthStatus');
    this.elDepthNeedle = document.getElementById('depthNeedle');

    // Golden Fever Mode Banner
    this.elGoldenFeverBanner = document.getElementById('goldenFeverBanner');
    this.elFeverProgressFill = document.getElementById('feverProgressFill');
    this.elFeverCountdown = document.getElementById('feverCountdown');

    // Prompts & Toasts
    this.elSonarPrompt = document.getElementById('sonarPrompt');
    this.elToastContainer = document.getElementById('toastContainer');

    // Internal tracker to animate value changes
    this.lastOranges = 0;
    this.lastScore = 0;
  }

  /**
   * Synchronizes HUD with live Game State
   * @param {object} gameState
   */
  update(gameState) {
    if (!gameState) return;

    // 1. Oranges Counter
    if (this.elOranges && gameState.oranges !== undefined) {
      if (gameState.oranges !== this.lastOranges) {
        this.elOranges.textContent = gameState.oranges;
        this.lastOranges = gameState.oranges;
      }
    }

    // 2. Score Counter
    if (this.elScore && gameState.score !== undefined) {
      if (gameState.score !== this.lastScore) {
        this.elScore.textContent = gameState.score.toLocaleString();
        this.lastScore = gameState.score;
      }
    }

    // 3. Holes Conquered
    if (this.elHoles && gameState.legalHolesConquered !== undefined) {
      this.elHoles.textContent = `${gameState.legalHolesConquered} / 4`;
    }

    // 4. Pixie Dust Flight Energy Meter
    if (this.elDustFill && this.elDustVal && gameState.pixieDust !== undefined) {
      const dust = Math.max(0, Math.min(100, gameState.pixieDust));
      this.elDustFill.style.width = `${dust}%`;
      this.elDustVal.textContent = `${Math.round(dust)}%`;

      if (dust < 20) {
        this.elDustFill.style.boxShadow = '0 0 14px #ef4444';
      } else {
        this.elDustFill.style.boxShadow = '0 0 10px #fbbf24';
      }
    }

    // 5. Sonar Cooldown Visual State
    if (this.elSonarPrompt && gameState.sonarCooldownRemaining !== undefined) {
      if (gameState.sonarCooldownRemaining > 0) {
        this.elSonarPrompt.style.opacity = '0.55';
      } else {
        this.elSonarPrompt.style.opacity = '1.0';
      }
    }
  }

  /**
   * Updates Subterranean Descent Depth Gauge
   * @param {boolean} active Whether Kevin is inside a hole
   * @param {number} depthFt Current vertical depth in feet
   * @param {string} tier 'shallow' | 'sweet_spot' | 'deep'
   */
  setSubterraneanDepth(active, depthFt = 0.0, tier = 'sweet_spot') {
    if (!this.elSubHud) return;

    if (!active) {
      this.elSubHud.classList.add('hidden');
      return;
    }

    this.elSubHud.classList.remove('hidden');

    if (this.elDepthNum) {
      this.elDepthNum.textContent = depthFt.toFixed(1);
    }

    // Position needle on 0-90ft calibrated scale
    if (this.elDepthNeedle) {
      const percentage = Math.max(0, Math.min(100, (depthFt / 90.0) * 100));
      this.elDepthNeedle.style.top = `${percentage}%`;
    }

    // Status pill
    if (this.elDepthStatus) {
      if (Math.abs(depthFt - 50.0) < 0.25) {
        this.elDepthStatus.textContent = '⭐ 50FT PINNACLE ⭐';
        this.elDepthStatus.style.background = 'rgba(251, 191, 36, 0.35)';
        this.elDepthStatus.style.color = '#ffd800';
      } else if (depthFt < 10.0) {
        this.elDepthStatus.textContent = 'TOO SHALLOW';
        this.elDepthStatus.style.background = 'rgba(148, 163, 184, 0.25)';
        this.elDepthStatus.style.color = '#94a3b8';
      } else if (depthFt <= 50.0) {
        this.elDepthStatus.textContent = 'LEGAL ZONE (10-50FT)';
        this.elDepthStatus.style.background = 'rgba(16, 185, 129, 0.25)';
        this.elDepthStatus.style.color = '#34d399';
      } else {
        this.elDepthStatus.textContent = 'HAZARD >50FT';
        this.elDepthStatus.style.background = 'rgba(239, 68, 68, 0.35)';
        this.elDepthStatus.style.color = '#ef4444';
      }
    }
  }

  showGoldenFeverBanner(duration = 15.0) {
    if (this.elGoldenFeverBanner) {
      this.elGoldenFeverBanner.classList.remove('hidden');
    }
    this.updateGoldenFeverProgress(duration, duration);
  }

  updateGoldenFeverProgress(remaining, duration = 15.0) {
    if (this.elFeverCountdown) {
      this.elFeverCountdown.textContent = `${Math.max(0, remaining).toFixed(1)}s`;
    }
    if (this.elFeverProgressFill) {
      const pct = Math.max(0, Math.min(100, (remaining / duration) * 100));
      this.elFeverProgressFill.style.width = `${pct}%`;
    }
  }

  hideGoldenFeverBanner() {
    if (this.elGoldenFeverBanner) {
      this.elGoldenFeverBanner.classList.add('hidden');
    }
  }

  /**
   * Displays a stylish toast banner
   * @param {string} message
   * @param {'info'|'bonus'|'grail'|'warn'} type
   * @param {number} duration Duration in ms
   */
  showToast(message, type = 'info', duration = 3000) {
    if (!this.elToastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    if (type === 'bonus') {
      toast.style.borderColor = '#ffd800';
      toast.style.color = '#ffd800';
      toast.innerHTML = `🤔 ${message}`;
    } else if (type === 'grail') {
      toast.style.borderColor = '#10b981';
      toast.style.color = '#34d399';
      toast.style.fontSize = '16px';
      toast.innerHTML = `🪶 ⭐ ${message} ⭐ 🪶`;
    } else if (type === 'warn') {
      toast.style.borderColor = '#ef4444';
      toast.style.color = '#f87171';
      toast.innerHTML = `⚠️ ${message}`;
    } else {
      toast.innerHTML = message;
    }

    this.elToastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);
  }

  showSonarPingNotification(scanResult) {
    if (!scanResult || !scanResult.detectedHoles) return;
    const count = scanResult.detectedHoles.length;
    if (count === 0) {
      this.showToast('Sonar scan: No subterranean holes within 100ft.', 'info', 2000);
    } else {
      const nearest = scanResult.detectedHoles[0];
      this.showToast(
        `Sonar ping: ${count} hole${count > 1 ? 's' : ''} detected! Nearest: ${nearest.name || 'Hole'} (${nearest.depthFt.toFixed(1)}ft) at ${Math.round(nearest.distance)}m`,
        'bonus',
        3000
      );
    }
  }
}
