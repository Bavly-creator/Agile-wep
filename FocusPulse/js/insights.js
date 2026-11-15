/**
 * FocusPulse - Insights Module
 * Implements S17: Weekly statistics chart (5 points).
 * Pure Vanilla HTML5 Canvas rendering for responsive weekly bars and course donut charts.
 */

const Insights = {
  // Calculate daily totals for current week (Monday through Sunday)
  getWeeklyData() {
    const user = Storage.getCurrentUser();
    const weekDates = Utils.getCurrentWeekDates();
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    if (!user) {
      return { labels: dayLabels, values: [0, 0, 0, 0, 0, 0, 0], totalMinutes: 0, avgDailyMinutes: 0 };
    }

    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, [])
      .filter(s => s.userId === user.id && s.status === 'completed');

    const values = weekDates.map(dateStr => {
      return sessions
        .filter(s => s.dateStr === dateStr)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    });

    const totalMinutes = values.reduce((sum, v) => sum + v, 0);
    const avgDailyMinutes = Math.round(totalMinutes / 7);

    return {
      labels: dayLabels,
      dates: weekDates,
      values: values,
      totalMinutes: totalMinutes,
      avgDailyMinutes: avgDailyMinutes
    };
  },

  // S17: Render Weekly Bar Chart on HTML5 Canvas
  renderWeeklyBarChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const data = this.getWeeklyData();
    const maxVal = Math.max(120, ...data.values) * 1.15; // At least 120 min ceiling

    const padding = { top: 30, right: 20, bottom: 35, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const yVal = Math.round((maxVal / gridLines) * i);
      const yPos = padding.top + chartHeight - (i / gridLines) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(width - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(`${yVal}m`, padding.left - 8, yPos + 4);
    }

    // Draw bars
    const barCount = data.values.length;
    const barWidth = Math.min(36, (chartWidth / barCount) * 0.55);
    const step = chartWidth / barCount;

    data.values.forEach((val, i) => {
      const x = padding.left + i * step + (step - barWidth) / 2;
      const barHeight = (val / maxVal) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // Bar gradient (Violet to Cyan)
      const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
      grad.addColorStop(0, '#a855f7');
      grad.addColorStop(1, '#06b6d4');

      ctx.fillStyle = val > 0 ? grad : 'rgba(255, 255, 255, 0.04)';

      // Draw rounded top bar
      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(x, padding.top + chartHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, padding.top + chartHeight);
      ctx.closePath();
      ctx.fill();

      // Top Glow cap if val > 0
      if (val > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${val}m`, x + barWidth / 2, y - 6);
      }

      // Day label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.labels[i], x + barWidth / 2, height - 12);
    });
  },

  // S17: Render Course Distribution Donut Chart
  renderCourseDonutChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const user = Storage.getCurrentUser();
    const courses = Courses.getAll();
    const sessions = Storage.getData(STORAGE_KEYS.SESSIONS, []).filter(s => s.userId === user?.id && s.status === 'completed');

    const courseMinutes = courses.map(c => {
      const mins = sessions
        .filter(s => s.courseId === c.id)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      return { name: c.name, color: c.color, minutes: mins };
    }).filter(c => c.minutes > 0);

    const totalMinutes = courseMinutes.reduce((sum, c) => sum + c.minutes, 0);

    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(centerX, centerY) - 20;
    const innerRadius = outerRadius * 0.65;

    if (totalMinutes === 0) {
      // Empty placeholder ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();
      return;
    }

    let startAngle = -Math.PI / 2;
    courseMinutes.forEach(c => {
      const sliceAngle = (c.minutes / totalMinutes) * (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = c.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${totalMinutes}m`, centerX, centerY + 2);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('TOTAL FOCUS', centerX, centerY + 20);
  }
};
