// ==UserScript==
// @name         TikTok to yt-dlp
// @namespace    https://github.com/dinoosauro/tiktok-to-ytdlp
// @version      2.0.0
// @description  Extract TikTok video URLs for use with yt-dlp. Supports profiles, hashtags, sounds, search results, collections, and slideshows.
// @author       dinoosauro
// @match        https://www.tiktok.com/*
// @match        https://tiktok.com/*
// @icon         https://www.tiktok.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ==================== CONFIGURATION ====================
    const scriptOptions = {
        scrolling_min_time: 1300,
        scrolling_max_time: 2100,
        min_views: -1,
        delete_from_next_txt: true,
        output_name_type: 2,
        adapt_text_output: true,
        allow_images: true,
        keep_only_images: false,
        export_format: "txt",
        exclude_from_json: [],
        get_img_link: true,
        date_after: null,
        date_before: null,
        advanced: {
            get_array_after_scroll: false,
            get_link_by_filter: true,
            check_nullish_link: true,
            log_link_error: true,
            maximum_downloads: Infinity,
            delete_from_dom: false,
        },
        node: {
            resolve: null,
            isNode: false,
            isResolveTime: false
        }
    };

    // ==================== STATE ====================
    let height = document.body.scrollHeight;
    let containerMap = new Map([]);
    let skipLinks = [];
    let isRunning = false;
    let shouldStop = false;
    let itemCount = 0;

    // ==================== STYLES ====================
    const styles = `
        #ttydlp-fab {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
            -webkit-tap-highlight-color: transparent;
        }
        #ttydlp-fab:hover, #ttydlp-fab:active {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        #ttydlp-fab svg {
            width: 28px;
            height: 28px;
            fill: white;
        }
        #ttydlp-panel {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: min(340px, calc(100vw - 40px));
            max-height: calc(100vh - 120px);
            background: #1a1a1a;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            z-index: 999998;
            overflow: hidden;
            display: none;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        }
        #ttydlp-panel.open {
            display: flex;
            animation: ttydlp-slide-up 0.25s ease-out;
        }
        @keyframes ttydlp-slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #ttydlp-header {
            padding: 16px;
            background: linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        #ttydlp-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        #ttydlp-close {
            background: rgba(255,255,255,0.2);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            -webkit-tap-highlight-color: transparent;
        }
        #ttydlp-body {
            padding: 16px;
            overflow-y: auto;
            flex: 1;
        }
        #ttydlp-status {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            text-align: center;
        }
        #ttydlp-status-text {
            font-size: 14px;
            color: #aaa;
            margin-bottom: 4px;
        }
        #ttydlp-count {
            font-size: 28px;
            font-weight: 700;
            color: #25f4ee;
        }
        .ttydlp-btn-group {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }
        .ttydlp-btn {
            flex: 1;
            padding: 12px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            -webkit-tap-highlight-color: transparent;
        }
        .ttydlp-btn-primary {
            background: #fe2c55;
            color: white;
        }
        .ttydlp-btn-primary:hover, .ttydlp-btn-primary:active {
            background: #e02850;
        }
        .ttydlp-btn-primary:disabled {
            background: #666;
            cursor: not-allowed;
        }
        .ttydlp-btn-secondary {
            background: #333;
            color: white;
        }
        .ttydlp-btn-secondary:hover, .ttydlp-btn-secondary:active {
            background: #444;
        }
        .ttydlp-btn-success {
            background: #25f4ee;
            color: #000;
        }
        .ttydlp-btn-success:hover, .ttydlp-btn-success:active {
            background: #1fd4cf;
        }
        .ttydlp-section {
            margin-bottom: 16px;
        }
        .ttydlp-section-title {
            font-size: 12px;
            font-weight: 600;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .ttydlp-option {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #333;
        }
        .ttydlp-option:last-child {
            border-bottom: none;
        }
        .ttydlp-option-label {
            font-size: 14px;
            color: #ddd;
        }
        .ttydlp-option-desc {
            font-size: 11px;
            color: #777;
            margin-top: 2px;
        }
        .ttydlp-toggle {
            position: relative;
            width: 48px;
            height: 28px;
            flex-shrink: 0;
        }
        .ttydlp-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .ttydlp-toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #444;
            transition: 0.3s;
            border-radius: 28px;
        }
        .ttydlp-toggle-slider:before {
            position: absolute;
            content: "";
            height: 22px;
            width: 22px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
        }
        .ttydlp-toggle input:checked + .ttydlp-toggle-slider {
            background-color: #fe2c55;
        }
        .ttydlp-toggle input:checked + .ttydlp-toggle-slider:before {
            transform: translateX(20px);
        }
        .ttydlp-select {
            background: #333;
            color: white;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            min-width: 100px;
        }
        .ttydlp-input {
            background: #333;
            color: white;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 14px;
            width: 80px;
            text-align: right;
        }
        .ttydlp-input:focus, .ttydlp-select:focus {
            outline: none;
            border-color: #fe2c55;
        }
        .ttydlp-collapsible {
            background: #2a2a2a;
            border-radius: 8px;
            margin-bottom: 8px;
            overflow: hidden;
        }
        .ttydlp-collapsible-header {
            padding: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            -webkit-tap-highlight-color: transparent;
        }
        .ttydlp-collapsible-header:hover {
            background: #333;
        }
        .ttydlp-collapsible-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
            padding: 0 12px;
        }
        .ttydlp-collapsible.open .ttydlp-collapsible-content {
            max-height: 500px;
            padding: 0 12px 12px;
        }
        .ttydlp-collapsible-arrow {
            transition: transform 0.3s;
        }
        .ttydlp-collapsible.open .ttydlp-collapsible-arrow {
            transform: rotate(180deg);
        }
        .ttydlp-progress {
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }
        .ttydlp-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #fe2c55, #25f4ee);
            width: 0%;
            transition: width 0.3s;
            animation: ttydlp-progress-pulse 1.5s infinite;
        }
        @keyframes ttydlp-progress-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        /* Mobile optimizations */
        @media (max-width: 480px) {
            #ttydlp-fab {
                bottom: 80px;
                right: 16px;
                width: 52px;
                height: 52px;
            }
            #ttydlp-panel {
                bottom: 0;
                right: 0;
                left: 0;
                width: 100%;
                max-height: 70vh;
                border-radius: 16px 16px 0 0;
            }
            #ttydlp-panel.open {
                animation: ttydlp-slide-up-mobile 0.3s ease-out;
            }
            @keyframes ttydlp-slide-up-mobile {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            .ttydlp-btn {
                padding: 14px 16px;
            }
        }
        
        /* Overlay for mobile */
        #ttydlp-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999997;
            display: none;
            -webkit-tap-highlight-color: transparent;
        }
        #ttydlp-overlay.open {
            display: block;
        }
    `;

    // ==================== UI CREATION ====================
    function createUI() {
        // Add styles
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(styles);
        } else {
            const styleEl = document.createElement('style');
            styleEl.textContent = styles;
            document.head.appendChild(styleEl);
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'ttydlp-overlay';
        overlay.addEventListener('click', togglePanel);
        document.body.appendChild(overlay);

        // Create FAB
        const fab = document.createElement('button');
        fab.id = 'ttydlp-fab';
        fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
        fab.addEventListener('click', togglePanel);
        fab.title = 'TikTok to yt-dlp';
        document.body.appendChild(fab);

        // Create panel
        const panel = document.createElement('div');
        panel.id = 'ttydlp-panel';
        panel.innerHTML = `
            <div id="ttydlp-header">
                <h2>📥 TikTok to yt-dlp</h2>
                <button id="ttydlp-close">×</button>
            </div>
            <div id="ttydlp-body">
                <div id="ttydlp-status">
                    <div id="ttydlp-status-text">Videos found</div>
                    <div id="ttydlp-count">0</div>
                    <div class="ttydlp-progress" style="display: none;">
                        <div class="ttydlp-progress-bar"></div>
                    </div>
                </div>
                
                <div class="ttydlp-btn-group">
                    <button class="ttydlp-btn ttydlp-btn-primary" id="ttydlp-start">▶ Start</button>
                    <button class="ttydlp-btn ttydlp-btn-secondary" id="ttydlp-stop" disabled>⏹ Stop</button>
                </div>
                
                <div class="ttydlp-btn-group">
                    <button class="ttydlp-btn ttydlp-btn-success" id="ttydlp-download">💾 Download</button>
                    <button class="ttydlp-btn ttydlp-btn-secondary" id="ttydlp-copy">📋 Copy</button>
                </div>
                
                <div class="ttydlp-collapsible">
                    <div class="ttydlp-collapsible-header">
                        <span>📁 Output Settings</span>
                        <span class="ttydlp-collapsible-arrow">▼</span>
                    </div>
                    <div class="ttydlp-collapsible-content">
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Export Format</div>
                            </div>
                            <select class="ttydlp-select" id="ttydlp-format">
                                <option value="txt">TXT</option>
                                <option value="json">JSON</option>
                            </select>
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Filename Source</div>
                            </div>
                            <select class="ttydlp-select" id="ttydlp-filename">
                                <option value="2">Page Header (h1)</option>
                                <option value="0">Data Tags</option>
                                <option value="1">Page Title</option>
                            </select>
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Safe Filenames</div>
                                <div class="ttydlp-option-desc">Replace Windows-invalid chars</div>
                            </div>
                            <label class="ttydlp-toggle">
                                <input type="checkbox" id="ttydlp-sanitize" checked>
                                <span class="ttydlp-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="ttydlp-collapsible">
                    <div class="ttydlp-collapsible-header">
                        <span>🖼️ Content Filters</span>
                        <span class="ttydlp-collapsible-arrow">▼</span>
                    </div>
                    <div class="ttydlp-collapsible-content">
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Include Slideshows</div>
                                <div class="ttydlp-option-desc">Save TikTok photo posts</div>
                            </div>
                            <label class="ttydlp-toggle">
                                <input type="checkbox" id="ttydlp-images" checked>
                                <span class="ttydlp-toggle-slider"></span>
                            </label>
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Only Slideshows</div>
                                <div class="ttydlp-option-desc">Skip regular videos</div>
                            </div>
                            <label class="ttydlp-toggle">
                                <input type="checkbox" id="ttydlp-only-images">
                                <span class="ttydlp-toggle-slider"></span>
                            </label>
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Min. Views</div>
                                <div class="ttydlp-option-desc">-1 = no limit</div>
                            </div>
                            <input type="number" class="ttydlp-input" id="ttydlp-minviews" value="-1">
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Max Downloads</div>
                                <div class="ttydlp-option-desc">0 = unlimited</div>
                            </div>
                            <input type="number" class="ttydlp-input" id="ttydlp-maxdownloads" value="0" min="0">
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Posts After</div>
                                <div class="ttydlp-option-desc">Only include posts on/after date</div>
                            </div>
                            <input type="date" class="ttydlp-input" id="ttydlp-date-after" style="width: auto;">
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Posts Before</div>
                                <div class="ttydlp-option-desc">Only include posts on/before date</div>
                            </div>
                            <input type="date" class="ttydlp-input" id="ttydlp-date-before" style="width: auto;">
                        </div>
                    </div>
                </div>
                
                <div class="ttydlp-collapsible">
                    <div class="ttydlp-collapsible-header">
                        <span>⚡ Performance</span>
                        <span class="ttydlp-collapsible-arrow">▼</span>
                    </div>
                    <div class="ttydlp-collapsible-content">
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Scroll Delay (ms)</div>
                                <div class="ttydlp-option-desc">Min - Max range</div>
                            </div>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <input type="number" class="ttydlp-input" id="ttydlp-scroll-min" value="1300" style="width: 60px;">
                                <span>-</span>
                                <input type="number" class="ttydlp-input" id="ttydlp-scroll-max" value="2100" style="width: 60px;">
                            </div>
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Auto-remove DOM</div>
                                <div class="ttydlp-option-desc">For large pages (experimental)</div>
                            </div>
                            <label class="ttydlp-toggle">
                                <input type="checkbox" id="ttydlp-deletedom">
                                <span class="ttydlp-toggle-slider"></span>
                            </label>
                        </div>
                        <div class="ttydlp-option">
                            <div>
                                <div class="ttydlp-option-label">Collect After Scroll</div>
                                <div class="ttydlp-option-desc">Wait until page fully scrolled</div>
                            </div>
                            <label class="ttydlp-toggle">
                                <input type="checkbox" id="ttydlp-afterscroll">
                                <span class="ttydlp-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('ttydlp-close').addEventListener('click', togglePanel);
        document.getElementById('ttydlp-start').addEventListener('click', startDownload);
        document.getElementById('ttydlp-stop').addEventListener('click', stopDownload);
        document.getElementById('ttydlp-download').addEventListener('click', downloadNow);
        document.getElementById('ttydlp-copy').addEventListener('click', copyToClipboard);

        // Collapsible sections
        panel.querySelectorAll('.ttydlp-collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('open');
            });
        });

        // Settings sync
        syncSettingsFromUI();
        panel.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', syncSettingsFromUI);
        });

        // Load saved settings
        loadSettings();
    }

    function togglePanel() {
        const panel = document.getElementById('ttydlp-panel');
        const overlay = document.getElementById('ttydlp-overlay');
        panel.classList.toggle('open');
        overlay.classList.toggle('open');
    }

    function updateCount() {
        const countEl = document.getElementById('ttydlp-count');
        if (countEl) {
            countEl.textContent = containerMap.size;
        }
    }

    function setRunningState(running) {
        isRunning = running;
        const startBtn = document.getElementById('ttydlp-start');
        const stopBtn = document.getElementById('ttydlp-stop');
        const statusText = document.getElementById('ttydlp-status-text');
        const progressBar = document.querySelector('.ttydlp-progress');

        if (startBtn) startBtn.disabled = running;
        if (stopBtn) stopBtn.disabled = !running;
        if (statusText) statusText.textContent = running ? 'Scrolling...' : 'Videos found';
        if (progressBar) progressBar.style.display = running ? 'block' : 'none';
    }

    function syncSettingsFromUI() {
        const getValue = (id, defaultVal) => {
            const el = document.getElementById(id);
            if (!el) return defaultVal;
            if (el.type === 'checkbox') return el.checked;
            if (el.type === 'number') return parseInt(el.value, 10) || defaultVal;
            return el.value;
        };

        scriptOptions.export_format = getValue('ttydlp-format', 'txt');
        scriptOptions.output_name_type = parseInt(getValue('ttydlp-filename', '2'), 10);
        scriptOptions.adapt_text_output = getValue('ttydlp-sanitize', true);
        scriptOptions.allow_images = getValue('ttydlp-images', true);
        scriptOptions.keep_only_images = getValue('ttydlp-only-images', false);
        scriptOptions.min_views = getValue('ttydlp-minviews', -1);
        scriptOptions.scrolling_min_time = getValue('ttydlp-scroll-min', 1300);
        scriptOptions.scrolling_max_time = getValue('ttydlp-scroll-max', 2100);
        scriptOptions.advanced.delete_from_dom = getValue('ttydlp-deletedom', false);
        scriptOptions.advanced.get_array_after_scroll = getValue('ttydlp-afterscroll', false);
        
        const maxDl = getValue('ttydlp-maxdownloads', 0);
        scriptOptions.advanced.maximum_downloads = maxDl === 0 ? Infinity : maxDl;

        const dateAfterEl = document.getElementById('ttydlp-date-after');
        scriptOptions.date_after = dateAfterEl?.value || null;
        const dateBeforeEl = document.getElementById('ttydlp-date-before');
        scriptOptions.date_before = dateBeforeEl?.value || null;

        saveSettings();
    }

    function saveSettings() {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue('ttydlp_settings', JSON.stringify({
                export_format: scriptOptions.export_format,
                output_name_type: scriptOptions.output_name_type,
                adapt_text_output: scriptOptions.adapt_text_output,
                allow_images: scriptOptions.allow_images,
                keep_only_images: scriptOptions.keep_only_images,
                min_views: scriptOptions.min_views,
                scrolling_min_time: scriptOptions.scrolling_min_time,
                scrolling_max_time: scriptOptions.scrolling_max_time,
                delete_from_dom: scriptOptions.advanced.delete_from_dom,
                get_array_after_scroll: scriptOptions.advanced.get_array_after_scroll,
                maximum_downloads: scriptOptions.advanced.maximum_downloads,
                date_after: scriptOptions.date_after,
                date_before: scriptOptions.date_before
            }));
        }
    }

    function loadSettings() {
        if (typeof GM_getValue !== 'undefined') {
            try {
                const saved = GM_getValue('ttydlp_settings', null);
                if (saved) {
                    const settings = JSON.parse(saved);
                    
                    const setVal = (id, val) => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        if (el.type === 'checkbox') el.checked = val;
                        else el.value = val;
                    };

                    setVal('ttydlp-format', settings.export_format);
                    setVal('ttydlp-filename', settings.output_name_type);
                    setVal('ttydlp-sanitize', settings.adapt_text_output);
                    setVal('ttydlp-images', settings.allow_images);
                    setVal('ttydlp-only-images', settings.keep_only_images);
                    setVal('ttydlp-minviews', settings.min_views);
                    setVal('ttydlp-scroll-min', settings.scrolling_min_time);
                    setVal('ttydlp-scroll-max', settings.scrolling_max_time);
                    setVal('ttydlp-deletedom', settings.delete_from_dom);
                    setVal('ttydlp-afterscroll', settings.get_array_after_scroll);
                    setVal('ttydlp-maxdownloads', settings.maximum_downloads === Infinity ? 0 : settings.maximum_downloads);
                    setVal('ttydlp-date-after', settings.date_after ?? '');
                    setVal('ttydlp-date-before', settings.date_before ?? '');

                    syncSettingsFromUI();
                }
            } catch (e) {
                console.warn('TikTok to yt-dlp: Failed to load settings', e);
            }
        }
    }

    // ==================== CORE FUNCTIONALITY ====================
    function loadWebpage() {
        if (shouldStop) {
            shouldStop = false;
            setRunningState(false);
            return;
        }

        function downloadFile() {
            scriptOptions.node.isResolveTime = true;
            ytDlpScript();
            skipLinks = [];
            setRunningState(false);
        }

        if (window.location.href.indexOf("/photo/") !== -1) {
            downloadFile();
            return;
        }

        if (!document.querySelector('[class$="--DivLoadingContainer"]')) {
            !scriptOptions.advanced.get_array_after_scroll && scriptOptions.advanced.delete_from_dom && 
                window.scrollTo({ top: document.body.scrollHeight - (window.outerHeight * (window.devicePixelRatio || 1)), behavior: 'smooth' });
            
            setTimeout(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                setTimeout(() => {
                    if (height !== document.body.scrollHeight) {
                        if (!scriptOptions.advanced.get_array_after_scroll) {
                            addArray();
                            updateCount();
                            if (scriptOptions.advanced.maximum_downloads < (Array.from(containerMap).length + skipLinks.length)) {
                                ytDlpScript();
                                setRunningState(false);
                                return;
                            }
                        }
                        setTimeout(() => {
                            height = document.body.scrollHeight;
                            loadWebpage();
                        }, Math.floor(Math.random() * scriptOptions.scrolling_max_time + scriptOptions.scrolling_min_time));
                    } else {
                        setTimeout(() => {
                            if (!document.querySelector('[class$="--DivLoadingContainer"]') && height == document.body.scrollHeight) {
                                downloadFile();
                            } else {
                                loadWebpage();
                            }
                        }, 3500);
                    }
                }, 150);
            }, !scriptOptions.advanced.get_array_after_scroll && scriptOptions.advanced.delete_from_dom ? Math.floor(Math.random() * 600 + 600) : 1);
        } else {
            setTimeout(function () {
                loadWebpage();
            }, 1000);
        }
    }

    function addArray() {
        const e2eLinks = "[data-e2e=user-liked-item], [data-e2e=music-item], [data-e2e=user-post-item], [data-e2e=favorites-item], [data-e2e=challenge-item], [data-e2e=search_top-item], [data-e2e=user-repost-item], [data-e2e=search_video-item], [data-e2e=video-item], [data-e2e=collection-item]";
        let container = Array.from(document.querySelectorAll(e2eLinks)).map(item => item.parentElement);
        
        if (window.location.href.indexOf("/photo/") !== -1 && scriptOptions.get_img_link) {
            container = [document.createElement("div")];
        }

        for (let tikTokItem of container) {
            try {
                if (tikTokItem?.getAttribute("data-e2e") === "search_video-item") tikTokItem = tikTokItem.parentElement;
                if (!tikTokItem) continue;

                let getLink = scriptOptions.advanced.get_link_by_filter 
                    ? Array.from(tikTokItem.querySelectorAll("a")).filter(e => e.href.indexOf("/video/") !== -1 || e.href.indexOf("/photo/") !== -1)[0]?.href 
                    : tikTokItem.querySelector(`[data-e2e=user-post-item-desc], ${e2eLinks}`)?.querySelector("a")?.href;

                if (window.location.href.indexOf("/photo/") !== -1 && scriptOptions.get_img_link) {
                    const images = new Set(Array.from(document.querySelectorAll(`[class*="--DivVideoContainer"] .swiper-slide > img[class*="--ImgPhotoSlide"], [class*="--DivPhotoPlayerContainer"] .swiper-slide > img[class*="--ImgPhotoSlide"]`)).map(i => i.src));
                    if (images.size > 0) {
                        getLink = scriptOptions.export_format === "json" ? Array.from(images) : Array.from(images).join("\n");
                    }
                }

                const linkStr = typeof getLink === "string" ? getLink : "";
                if (!scriptOptions.allow_images && linkStr.indexOf("/photo/") !== -1) continue;
                if (scriptOptions.allow_images && scriptOptions.keep_only_images && linkStr.indexOf("/photo/") === -1 && linkStr !== "") continue;
                if (scriptOptions.date_after || scriptOptions.date_before) {
                    const postDate = extractDateFromUrl(linkStr);
                    if (postDate) {
                        if (scriptOptions.date_after && postDate < new Date(scriptOptions.date_after)) continue;
                        if (scriptOptions.date_before && postDate > new Date(scriptOptions.date_before)) continue;
                    }
                }

                if (scriptOptions.advanced.check_nullish_link && linkStr === "") {
                    if (scriptOptions.advanced.log_link_error) console.log("TikTok to yt-dlp: Failed to get link!");
                    continue;
                }

                if (skipLinks.indexOf(getLink) === -1) {
                    const views = tikTokItem.querySelector("[class$=\"-SpanPlayCount\"], [data-e2e=video-views]")?.innerHTML ?? "0";
                    const caption = (tikTokItem.querySelector("[class$=\"-DivDesContainer\"] a span"))?.textContent ?? 
                        tikTokItem.querySelector("[class$=\"-AVideoContainer\"] picture img")?.alt ?? 
                        Array.from((tikTokItem.firstChild?.parentElement ?? document.body).querySelector("[data-e2e=search-card-video-caption], [data-e2e=video-desc], [data-e2e=browse-video-desc]")?.querySelectorAll("a, span") ?? []).map(i => i.textContent).filter(i => typeof i !== "undefined").join("") ?? "";
                    
                    const parentEl = tikTokItem.firstChild?.parentElement ?? document.body;
                    
                    containerMap.set(getLink, {
                        views: parseNumberForJson(views),
                        caption,
                        likes: parseNumberForJson(parentEl.querySelector(`[data-e2e="like-count"], [data-e2e="browse-like-count"]`)?.textContent),
                        favorites: parseNumberForJson(parentEl.querySelector(`[data-e2e="undefined-count"]`)?.textContent),
                        comments: parseNumberForJson(parentEl.querySelector(`[data-e2e="comment-count"], [data-e2e="browse-comment-count"]`)?.textContent),
                        shares: parseNumberForJson(parentEl.querySelector(`[data-e2e="share-count"]`)?.textContent),
                    });
                }
            } catch (err) {
                if (scriptOptions.advanced.log_link_error) console.log("TikTok to yt-dlp: Failed to process item:", err);
                continue;
            }
        }

        if (!scriptOptions.advanced.get_array_after_scroll && scriptOptions.advanced.delete_from_dom) {
            for (const item of Array.from(container).slice(0, container.length - 20)) item.remove();
        }
    }

    function extractDateFromUrl(url) {
        const match = typeof url === "string" && url.match(/\/(video|photo)\/(\d+)/);
        if (!match) return null;
        try {
            const timestamp = Number(BigInt(match[2]) >> 32n);
            return new Date(timestamp * 1000);
        } catch (e) {
            return null;
        }
    }

    function parseNumberForJson(views) {
        if (typeof views === "undefined" || views === null) return;
        const str = String(views).trim();
        if (str === "") return;
        
        const match = str.match(/^([\d.]+)\s*([KMB])?$/i);
        if (!match) return str;
        
        const num = parseFloat(match[1]);
        const suffix = (match[2] || "").toUpperCase();
        
        const multipliers = { "K": 1000, "M": 1000000, "B": 1000000000 };
        const result = suffix ? Math.round(num * multipliers[suffix]) : num;
        
        return String(result);
    }

    function sanitizeName(name) {
        return name.replaceAll("<", "‹").replaceAll(">", "›").replaceAll(":", "∶").replaceAll("\"", "″").replaceAll("/", "∕").replaceAll("\\", "∖").replaceAll("|", "¦").replaceAll("?", "¿").replaceAll("*", "");
    }

    function deleteUnrequestedContent(obj) {
        for (const key in obj) {
            if (scriptOptions.exclude_from_json.indexOf(key) !== -1) delete obj[key];
        }
        if (Object.keys(obj).length === 1) return obj[Object.keys(obj)[0]];
        return obj;
    }

    function generateOutput() {
        addArray();
        updateCount();
        
        let output = scriptOptions.export_format === "json" ? [] : "";
        for (const [url, obj] of Array.from(containerMap)) {
            if (+obj.views < scriptOptions.min_views) continue;
            scriptOptions.export_format === "json" 
                ? output.push(deleteUnrequestedContent({ ...obj, url })) 
                : output += `${url}\n`;
        }
        return output;
    }

    function ytDlpScript() {
        const output = generateOutput();
        downloadScript(typeof output === "object" ? JSON.stringify(output, null, 2) : output);
    }

    function getFileName() {
        let name = `TikTokLinks.${scriptOptions.export_format}`;
        switch (scriptOptions.output_name_type) {
            case 0:
                name = document.querySelector("[data-e2e=user-title]")?.textContent.trim() ?? 
                    document.querySelector("[data-e2e=browse-username]")?.firstChild?.textContent.trim() ?? 
                    document.querySelector("[data-e2e=browse-username]")?.textContent.trim() ?? 
                    document.querySelector("[data-e2e=challenge-title]")?.textContent.trim() ?? 
                    document.querySelector("[data-e2e=music-title]")?.textContent.trim() ?? 
                    `TikTokLinks.${scriptOptions.export_format}`;
                break;
            case 1:
                name = `${document.title.substring(0, document.title.indexOf(" | TikTok"))}.${scriptOptions.export_format}`;
                break;
            case 2:
                name = `${document.querySelector("h1")?.textContent.trim() ?? "TikTokLinks"}.${scriptOptions.export_format}`;
                break;
        }
        if (typeof scriptOptions.output_name_type === "string") name = scriptOptions.output_name_type;
        if (scriptOptions.adapt_text_output) name = sanitizeName(name);
        if (!name.endsWith(`.${scriptOptions.export_format}`)) name += `.${scriptOptions.export_format}`;
        return name;
    }

    function downloadScript(script) {
        const blob = new Blob([script], { type: scriptOptions.export_format === "json" ? "application/json" : "text/plain" });
        const link = document.createElement("a");
        const name = getFileName();
        link.href = URL.createObjectURL(new File([blob], name, { type: scriptOptions.export_format === "json" ? "application/json" : "text/plain" }));
        link.download = name;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ==================== UI ACTIONS ====================
    function startDownload() {
        containerMap = new Map([]);
        skipLinks = [];
        height = document.body.scrollHeight;
        shouldStop = false;
        setRunningState(true);
        updateCount();
        loadWebpage();
    }

    function stopDownload() {
        shouldStop = true;
    }

    function downloadNow() {
        const output = generateOutput();
        if (containerMap.size === 0) {
            alert('No videos found yet. Click Start to begin collecting.');
            return;
        }
        downloadScript(typeof output === "object" ? JSON.stringify(output, null, 2) : output);
    }

    function copyToClipboard() {
        const output = generateOutput();
        if (containerMap.size === 0) {
            alert('No videos found yet. Click Start to begin collecting.');
            return;
        }
        const text = typeof output === "object" ? JSON.stringify(output, null, 2) : output;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('ttydlp-copy');
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }

    // ==================== INIT ====================
    function init() {
        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createUI);
        } else {
            createUI();
        }
    }

    init();
})();
