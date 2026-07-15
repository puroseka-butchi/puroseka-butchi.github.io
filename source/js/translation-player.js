'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const sourceElements = [...document.querySelectorAll('.translation-bgm-source')];
  if (!sourceElements.length || document.querySelector('.translation-bgm-player')) return;

  const tracks = sourceElements
    .map(element => ({
      src: element.dataset.src,
      title: element.dataset.title || 'Nhạc nền',
      autoplay: element.dataset.autoplay === 'true'
    }))
    .filter(track => track.src);
  if (!tracks.length) return;

  const storage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, String(value)); } catch { /* Storage có thể bị chặn. */ }
    }
  };
  const audio = new Audio();
  const player = document.createElement('aside');
  const toggle = document.createElement('button');
  const information = document.createElement('div');
  const title = document.createElement('strong');
  const status = document.createElement('span');
  const next = document.createElement('button');
  const volume = document.createElement('input');
  let trackIndex = 0;

  player.className = 'translation-bgm-player';
  player.setAttribute('aria-label', 'Trình phát nhạc nền');
  toggle.className = 'translation-bgm-player__toggle';
  toggle.type = 'button';
  information.className = 'translation-bgm-player__information';
  title.className = 'translation-bgm-player__title';
  status.className = 'translation-bgm-player__status';
  next.className = 'translation-bgm-player__next';
  next.type = 'button';
  next.textContent = '⏭';
  next.title = 'Bản tiếp theo';
  next.setAttribute('aria-label', 'Phát bản nhạc tiếp theo');
  next.hidden = tracks.length < 2;
  volume.className = 'translation-bgm-player__volume';
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.05';
  volume.title = 'Âm lượng';
  volume.setAttribute('aria-label', 'Âm lượng nhạc nền');

  const savedVolume = Number.parseFloat(storage.get('translation-bgm-volume'));
  audio.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.35;
  volume.value = String(audio.volume);
  audio.preload = 'metadata';

  information.append(title, status);
  player.append(toggle, information, next, volume);
  document.body.append(player);

  function updateUi(message) {
    const playing = !audio.paused;
    player.classList.toggle('is-playing', playing);
    toggle.textContent = playing ? '⏸' : '▶';
    toggle.title = playing ? 'Tạm dừng nhạc' : 'Bật nhạc';
    toggle.setAttribute('aria-label', toggle.title);
    title.textContent = tracks[trackIndex].title;
    status.textContent = message || (playing ? 'Đang phát' : 'Đã tạm dừng');
  }

  function loadTrack(index) {
    trackIndex = (index + tracks.length) % tracks.length;
    audio.src = tracks[trackIndex].src;
    audio.loop = tracks.length === 1;
    updateUi('Sẵn sàng phát');
  }

  async function play(userInitiated = false) {
    try {
      await audio.play();
      storage.set('translation-bgm-enabled', 'true');
      updateUi();
    } catch (error) {
      if (error && error.name === 'NotAllowedError') {
        updateUi('Trình duyệt chặn tự phát — nhấn ▶');
      } else {
        updateUi('Không thể phát file nhạc');
        if (userInitiated) console.error('Không thể phát nhạc nền:', error);
      }
    }
  }

  toggle.addEventListener('click', () => {
    if (audio.paused) {
      play(true);
    } else {
      audio.pause();
      storage.set('translation-bgm-enabled', 'false');
      updateUi();
    }
  });

  next.addEventListener('click', () => {
    loadTrack(trackIndex + 1);
    play(true);
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    storage.set('translation-bgm-volume', audio.volume);
  });

  audio.addEventListener('ended', () => {
    if (tracks.length > 1) {
      loadTrack(trackIndex + 1);
      play();
    }
  });
  audio.addEventListener('error', () => updateUi('File nhạc không tải được'));
  audio.addEventListener('play', () => updateUi());
  audio.addEventListener('pause', () => updateUi());

  loadTrack(0);
  const autoplayRequested = tracks.some(track => track.autoplay);
  const userDisabled = storage.get('translation-bgm-enabled') === 'false';
  if (autoplayRequested && !userDisabled) play();
});

