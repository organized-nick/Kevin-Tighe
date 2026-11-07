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

    // Live Hole Bearing Compass Elements
    this.compassEls = {};
    ['hole_dockside', 'hole_pine_root', 'hole_shoreline', 'hole_bluff_shaft'].forEach((id) => {
      this.compassEls[id] = {
        arrow: document.getElementById(`dir_${id}`),
        dist: document.getElementById(`dist_${id}`)
      };
    });

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

    // 6. Live Zone Readout & Camera-Relative Hole Compass Bearings
    if (gameState.playerPos) {
      this.updateZoneAndCompass(gameState.playerPos, gameState.cameraYaw || 0, gameState.holes || []);
    }
  }

  /**
   * Updates top zone indicator and relative directional arrows (▲ ↗ ▶ ▼ ◀ ↖) for all 4 holes.
   */
  updateZoneAndCompass(playerPos, cameraYaw, holes) {
    if (this.elZoneName) {
      const px = playerPos.x;
      const pz = playerPos.z;
      const py = playerPos.y;
      let zone = 'SUNLIT LAKESIDE RETREAT';
      if (py >= 16.0 || px < -32.0) zone = 'GRANITE BLUFFS OVERLOOK';
      else if (Math.abs(px) <= 2.4 && pz >= 5.5 && pz <= 30.5) zone = 'WOODEN LAKESIDE PIER';
      else if (px >= 14.0 && px <= 36.0 && pz >= -24.0 && pz <= -5.0) zone = 'CEDAR LOG CABIN CLEARING';
      else if (px > 36.0 || pz < -26.0) zone = 'NORTHERN PINE HIGHLANDS';
      else if (pz > 5.0 && px >= 6.0 && px <= 18.0) zone = 'GOLDEN SANDBAR SPIT';
      if (this.elZoneName.textContent !== zone) {
        this.elZoneName.textContent = zone;
      }
    }

    if (!Array.isArray(holes) || holes.length === 0) return;

    // Camera Forward in (X, Z) is (-sin(yaw), -cos(yaw)); Camera Right is (+cos(yaw), -sin(yaw))
    const fwdX = -Math.sin(cameraYaw);
    const fwdZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    for (const h of holes) {
      const els = this.compassEls[h.id];
      if (!els || !h.position) continue;

      const dx = h.position.x - playerPos.x;
      const dz = h.position.z - playerPos.z;
      const dist = Math.round(Math.hypot(dx, dz));

      if (els.dist) {
        els.dist.textContent = `${dist}m`;
      }

      if (els.arrow) {
        if (dist <= 2) {
          els.arrow.textContent = '●';
        } else {
          const fDot = dx * fwdX + dz * fwdZ;
          const rDot = dx * rightX + dz * rightZ;
          const deg = (Math.atan2(rDot, fDot) * 180) / Math.PI;
          let arrow = '▲';
          if (deg > -22.5 && deg <= 22.5) arrow = '▲';
          else if (deg > 22.5 && deg <= 67.5) arrow = '↗';
          else if (deg > 67.5 && deg <= 112.5) arrow = '▶';
          else if (deg >= -67.5 && deg <= -22.5) arrow = '↖';
          else if (deg >= -112.5 && deg < -67.5) arrow = '◀';
          else arrow = '▼';
          els.arrow.textContent = arrow;
        }
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
