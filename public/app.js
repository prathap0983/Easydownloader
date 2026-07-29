document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://easydownloader-szei.onrender.com";
  const form = document.getElementById("downloader-form");
  const urlInput = document.getElementById("pinterest-url");
  const submitBtn = document.getElementById("get-video-btn");
  const container = document.getElementById("dynamic-state-container");

  // DOM Elements to update dynamically during Tab switching
  const mainHeading = document.querySelector(".main-heading");
  const subHeading = document.querySelector(".sub-heading");
  const badge = document.querySelector(".badge");

  // Active Downloader Mode State
  let currentMode = "pinterest"; // 'pinterest' or 'youtube'

  // Tab Switch Event Listeners
  const pinterestTab = document.getElementById("platform-tab-pinterest");
  const youtubeTab = document.getElementById("platform-tab-youtube");

  if (pinterestTab && youtubeTab) {
    pinterestTab.addEventListener("click", () => {
      switchMode("pinterest");
    });
    youtubeTab.addEventListener("click", () => {
      switchMode("youtube");
    });
  }

  function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    // Clear results/errors
    container.innerHTML = "";

    // Update active tab styles
    pinterestTab.classList.remove("active");
    youtubeTab.classList.remove("active");

    if (mode === "pinterest") {
      pinterestTab.classList.add("active");
      // Update Headings & Placeholders
      badge.innerHTML =
        '<span class="badge-dot"></span> Fast & Free Pinterest Downloader';
      mainHeading.innerHTML =
        'Pinterest <span class="highlight-text">Video</span> Downloader';
      subHeading.textContent =
        "Download your favorite Pinterest videos in high quality with one click. Fast, secure, and completely free.";
      urlInput.placeholder = "Paste Pinterest Link here...";
    } else if (mode === "youtube") {
      youtubeTab.classList.add("active");
      // Update Headings & Placeholders
      badge.innerHTML =
        '<span class="badge-dot"></span> Fast & Free YouTube Downloader';
      mainHeading.innerHTML =
        'YouTube <span class="highlight-text">Song & Video</span> Downloader';
      subHeading.textContent =
        "Download your favorite YouTube videos and audio songs in high quality with one click. Fast, secure, and completely free.";
      urlInput.placeholder = "Paste YouTube Video Link here...";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputUrl = urlInput.value.trim();

    // 1. Basic Client Side Validation
    if (!inputUrl) {
      showError(
        `Please paste a ${currentMode === "pinterest" ? "Pinterest" : "YouTube"} link first.`,
      );
      return;
    }

    if (currentMode === "pinterest") {
      const pinterestRegex = /pin(terest\.com|\.it)/i;
      if (!pinterestRegex.test(inputUrl)) {
        showError(
          "Please enter a valid Pinterest link (e.g., pinterest.com/pin/... or pin.it/...)",
        );
        return;
      }
    } else if (currentMode === "youtube") {
      const youtubeRegex = /(youtube\.com|youtu\.be)/i;
      if (!youtubeRegex.test(inputUrl)) {
        showError(
          "Please enter a valid YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...)",
        );
        return;
      }
    }

    // 2. Set Loading State
    setLoading(true);

    try {
      if (currentMode === "pinterest") {
        // 3. Pinterest Integration (POST /api/download)
        const response = await fetch(`${API_BASE}/api/download`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: inputUrl }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to process the Pinterest video. Please check the link and try again.",
          );
        }

        // 4. Success State - Render Video result
        showResult(data);
      } else if (currentMode === "youtube") {
        // 3. YouTube Integration (POST /api/youtube)
        const response = await fetch(`${API_BASE}/api/youtube`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: inputUrl }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to process the YouTube video. Please check the link and try again.",
          );
        }

        // 4. Success State - Render YouTube options
        showYoutubeResult(data);
      }
    } catch (err) {
      // 5. Error State
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  // Helper to toggle form loading state
  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing...";

      // Insert spinning loader inside the dynamic container
      container.innerHTML = `
        <div class="loader-container fade-in">
          <div class="spinner"></div>
          <span class="loader-text">Analyzing ${currentMode === "pinterest" ? "Pinterest link" : "YouTube video"}...</span>
        </div>
      `;
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = "Get Video";
    }
  }

  // Helper to display errors
  function showError(message) {
    container.innerHTML = `
      <div class="error-alert fade-in">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="error-content">
          <strong>Error:</strong> ${escapeHtml(message)}
        </div>
      </div>
    `;
  }

  // Helper to display success result for Pinterest
  function showResult(data) {
    container.innerHTML = `
      <div class="result-card fade-in">
        <div class="video-container" style="position: relative;">
          <video class="video-player" controls poster="${escapeHtml(data.thumbnail_url)}" playsinline>
            <source src="${escapeHtml(data.video_url)}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
          <a href="${API_BASE}/api/proxy?url=${encodeURIComponent(data.thumbnail_url)}" download="${escapeHtml(data.title)}_thumbnail.jpg" class="thumbnail-dl-btn" title="Download Thumbnail" style="position: absolute; bottom: 12px; right: 12px; background: rgba(0, 0, 0, 0.65); color: #fff; border: none; border-radius: 30px; padding: 8px 16px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; backdrop-filter: blur(6px); transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Thumbnail</span>
          </a>
        </div>
        <div class="result-info">
          <div class="result-meta">
            <h4 class="video-title">${escapeHtml(data.title)}</h4>
            <div class="meta-badges">
              <span class="meta-badge">Duration: ${escapeHtml(data.duration)}</span>
              ${
                data.quality
                  ? `
                <span class="meta-badge">Resolution: ${escapeHtml(data.quality.resolution)}</span>
                <span class="meta-badge">FPS: ${escapeHtml(data.quality.fps)}</span>
                <span class="meta-badge highlight">${escapeHtml(data.quality.label)}</span>
              `
                  : ""
              }
            </div>
          </div>
        </div>
        <button onclick="window.forceDownload('${escapeHtml(data.video_url)}', '${escapeHtml(data.title)}.mp4', this)" class="btn btn-primary btn-download">
          <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Video
        </button>
      </div>
    `;
  }

  function setupCustomDropdown(containerId, hiddenSelectId) {
    const container = document.getElementById(containerId);
    const select = document.getElementById(hiddenSelectId);
    if (!container || !select) return;

    const trigger = container.querySelector(".custom-select-trigger");
    const triggerText = container.querySelector(".custom-select-trigger-text");
    const optionsContainer = container.querySelector(".custom-select-options");

    // Populate custom options from hidden select options
    optionsContainer.innerHTML = "";
    Array.from(select.options).forEach((opt) => {
      const optDiv = document.createElement("div");
      optDiv.className = "custom-select-option";
      if (opt.selected) {
        optDiv.classList.add("selected");
        if (triggerText) triggerText.textContent = opt.textContent;
      }
      optDiv.textContent = opt.textContent;
      optDiv.dataset.value = opt.value;

      optDiv.addEventListener("click", (e) => {
        e.stopPropagation();

        // Update hidden select
        select.value = opt.value;
        select.dispatchEvent(new Event("change"));

        // Update trigger UI
        if (triggerText) triggerText.textContent = opt.textContent;

        // Update selected class
        container
          .querySelectorAll(".custom-select-option")
          .forEach((el) => el.classList.remove("selected"));
        optDiv.classList.add("selected");

        // Close dropdown
        container.classList.remove("active");
      });

      optionsContainer.appendChild(optDiv);
    });

    // Toggle dropdown on trigger click
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();

      // Close other custom dropdowns
      document.querySelectorAll(".custom-select-container").forEach((c) => {
        if (c !== container) c.classList.remove("active");
      });

      container.classList.toggle("active");
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener("click", () => {
    document
      .querySelectorAll(".custom-select-container")
      .forEach((c) => c.classList.remove("active"));
  });

  // Helper to display success result for YouTube
  function showYoutubeResult(data) {
    // Helper to start and track download jobs inline
    async function handleDownloadJob(postData, downloadType) {
      const progressId =
        downloadType === "audio"
          ? "youtube-audio-progress"
          : "youtube-video-progress";
      const progressEl = document.getElementById(progressId);
      const valEl = progressEl
        ? progressEl.querySelector(".progress-val")
        : null;

      try {
        if (progressEl && valEl) {
          valEl.textContent = "Starting...";
          progressEl.style.display = "inline-flex";
        }

        const response = await fetch(`${API_BASE}/api/youtube/download/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(postData),
        });

        if (!response.ok) {
          throw new Error("Failed to start download job.");
        }

        const resData = await response.json();
        const jobId = resData.jobId;

        // Start polling
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(
              `${API_BASE}/api/youtube/download/status?jobId=${jobId}`,
            );
            if (!statusRes.ok) throw new Error("Status check failed");

            const statusData = await statusRes.json();

            if (
              statusData.status === "downloading" ||
              statusData.status === "merging"
            ) {
              if (valEl) {
                valEl.textContent = statusData.phase || "Downloading...";
              }
            } else if (statusData.status === "completed") {
              clearInterval(pollInterval);
              if (valEl) valEl.textContent = "Done!";

              // Trigger actual file download
              window.location.href = `${API_BASE}/api/youtube/download/file?jobId=${jobId}`;

              setTimeout(() => {
                if (progressEl) progressEl.style.display = "none";
              }, 3000);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              alert(
                "Download failed: " + (statusData.error || "Unknown error"),
              );
              if (progressEl) progressEl.style.display = "none";
            }
          } catch (err) {
            clearInterval(pollInterval);
            console.error("Polling error:", err);
            if (valEl) valEl.textContent = "Error checking progress";
            setTimeout(() => {
              if (progressEl) progressEl.style.display = "none";
            }, 3000);
          }
        }, 1000);
      } catch (err) {
        console.error("Download trigger error:", err);
        alert("Failed to start download: " + err.message);
        if (progressEl) progressEl.style.display = "none";
      }
    }

    window.downloadSelectedYoutube = function (btnElement) {
      const selectEl = document.getElementById("youtube-video-select");
      if (!selectEl) return;
      const selectedHeight = selectEl.value;
      if (!selectedHeight) return;

      const linkInput = document.getElementById("pinterest-url");
      if (!linkInput) return;
      const youtubeUrl = linkInput.value.trim();

      handleDownloadJob(
        {
          url: youtubeUrl,
          height: selectedHeight,
          title: data.title,
        },
        "video",
      );
    };

    window.downloadYoutubeAudio = function (btnElement) {
      const linkInput = document.getElementById("pinterest-url");
      if (!linkInput) return;
      const youtubeUrl = linkInput.value.trim();

      handleDownloadJob(
        {
          url: youtubeUrl,
          type: "audio",
          bitrate: "320k",
          title: data.title,
        },
        "audio",
      );
    };

    const hasVideoOptions = data.videoOptions && data.videoOptions.length > 0;

    container.innerHTML = `
      <div class="result-card fade-in">
        <div class="video-container" style="display: flex; align-items: center; justify-content: center; background: #000; position: relative;">
          <img src="${escapeHtml(data.thumbnail_url)}" alt="${escapeHtml(data.title)}" style="max-height: 100%; max-width: 100%; object-fit: contain;">
          <a href="${API_BASE}/api/proxy?url=${encodeURIComponent(data.thumbnail_url)}" download="${escapeHtml(data.title)}_thumbnail.jpg" class="thumbnail-dl-btn" title="Download Thumbnail" style="position: absolute; bottom: 12px; right: 12px; background: rgba(0, 0, 0, 0.65); color: #fff; border: none; border-radius: 30px; padding: 8px 16px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; backdrop-filter: blur(6px); transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Thumbnail</span>
          </a>
        </div>
        <div class="result-info">
          <div class="result-meta">
            <h4 class="video-title">${escapeHtml(data.title)}</h4>
            <div class="meta-badges">
              <span class="meta-badge">Duration: ${escapeHtml(data.duration)}</span>
              <span class="meta-badge highlight">YouTube Media</span>
            </div>
          </div>
        </div>
        <div class="youtube-selectors-panel" style="width: 100%; display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
          ${
            hasVideoOptions
              ? `
            <div class="selector-group">
              <label class="selector-label">Select Video Quality:</label>
              <div class="selector-controls" style="display: flex; flex-direction: column; gap: 8px;">
                
                <!-- Custom Dropdown Container -->
                <div class="custom-select-container" id="custom-video-select-container">
                  <div class="custom-select-trigger">
                    <span class="custom-select-trigger-text">Select Video Quality</span>
                    <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                  <div class="custom-select-options"></div>
                </div>

                <select id="youtube-video-select" class="quality-select" style="display: none;">
                  ${data.videoOptions.map((opt) => `<option value="${escapeHtml(opt.height)}">${escapeHtml(opt.label)}</option>`).join("")}
                </select>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                  <button onclick="window.downloadSelectedYoutube(this)" class="btn btn-primary btn-select-download">
                    <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download Video
                  </button>
                  <span id="youtube-video-progress" class="inline-progress" style="display: none; font-size: 0.9rem; color: #e60023; font-weight: 600; white-space: nowrap;">
                    <span class="inline-spinner"></span> <span class="progress-val">Starting...</span>
                  </span>
                </div>
              </div>
            </div>
          `
              : `
            <div class="error-alert" style="margin-top: 10px; padding: 12px 16px;">No video options with sound found.</div>
          `
          }
          
          <div class="selector-group" style="margin-top: 8px;">
            <label class="selector-label">Audio Song Downloader:</label>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%;">
              <button onclick="window.downloadYoutubeAudio(this)" class="btn btn-primary btn-download" style="flex: 1; min-width: 200px;">
                <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Audio Song (Full Quality MP3)
              </button>
              <span id="youtube-audio-progress" class="inline-progress" style="display: none; font-size: 0.9rem; color: #e60023; font-weight: 600; white-space: nowrap;">
                <span class="inline-spinner"></span> <span class="progress-val">Starting...</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize custom selectors
    if (hasVideoOptions) {
      setupCustomDropdown(
        "custom-video-select-container",
        "youtube-video-select",
      );
    }
  }

  // Force direct MP4 download via backend proxy to bypass CORS
  window.forceDownload = async function (videoUrl, fileName, btnElement) {
    if (!videoUrl) return;
    const originalContent = btnElement.innerHTML;

    try {
      btnElement.disabled = true;
      btnElement.innerHTML = "⏳ Downloading...";

      const proxyUrl = `${API_BASE}/api/proxy?url=${encodeURIComponent(videoUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch video stream.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const tempLink = document.createElement("a");
      tempLink.style.display = "none";
      tempLink.href = objectUrl;
      tempLink.download = fileName || "pinterest-video.mp4";

      document.body.appendChild(tempLink);
      tempLink.click();

      document.body.removeChild(tempLink);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Direct download failed:", err);
      alert(
        "Direct download failed. Try playing the video and right-clicking it to save.",
      );
    } finally {
      btnElement.disabled = false;
      btnElement.innerHTML = originalContent;
    }
  };

  // Accordion FAQ Toggles
  const accordions = document.querySelectorAll(".accordion-header");
  accordions.forEach((header) => {
    header.addEventListener("click", () => {
      const item = header.parentElement;
      const isActive = item.classList.contains("active");

      // Close all other items
      document.querySelectorAll(".accordion-item").forEach((el) => {
        el.classList.remove("active");
      });

      // Toggle current
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });

  // Contact Form Submission (Redirect directly to Gmail Compose)
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const subject = document.getElementById("contact-subject").value.trim();
      const body = document.getElementById("contact-body").value.trim();

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=prathapsivam2004@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, "_blank");
    });
  }

  // Simple HTML escaping helper for security
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
