"use strict";
/**
 * Doomsday Countdown App
 * A countdown timer to a preset doomsday date, 1000 days from a fixed start point.
 */
// ================================
// CONFIGURATION & CONSTANTS
// ================================
const CONFIG = {
    startDate: new Date('2025-06-11'),
    totalDays: 1000,
    updateInterval: 1000,
    // Timezone settings (auto-detects browser timezone)
    timezoneOffset: -(new Date().getTimezoneOffset() / 60), // Auto-detect browser timezone
    // Animation timings (in milliseconds)
    fadeOutDuration: 250,
    fadeInDuration: 500,
    gridAnimationDuration: 500,
    // Grid performance settings
    initialGridItems: 500,
    gridBatchSize: 100,
    gridBatchDelay: 50,
    gridLoadDelay: 100,
    // API settings
    maxOutputTokens: 100,
    temperature: 0.7,
};
const END_DATE = new Date(CONFIG.startDate);
END_DATE.setDate(END_DATE.getDate() + CONFIG.totalDays);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
// ================================
// DOM ELEMENTS
// ================================
const daysElement = document.getElementById('days');
const hoursElement = document.getElementById('hours');
const minutesElement = document.getElementById('minutes');
const secondsElement = document.getElementById('seconds');
const gridContainer = document.getElementById('grid-container');
const quoteTextElement = document.getElementById('quote-text');
const quoteDayElement = document.getElementById('quote-day');
const tickerTextElement = document.getElementById('ticker-text');
// ================================
// FALLBACK DATA
// ================================
const FALLBACK_QUOTES = [
    "The future is not some place we are going, but one we are creating.",
    "In the face of uncertainty, we find our truest selves.",
    "Change is the only constant. Embrace the transformation.",
    "Every moment brings us closer to who we are meant to become.",
    "What appears as an ending is merely a transition."
];
const FALLBACK_NEWS = [
    "OpenAI releases new multimodal AI model with enhanced capabilities",
    "Google DeepMind achieves breakthrough in quantum computing algorithms",
    "Microsoft announces AI copilot integration across Office applications",
    "Meta unveils advanced AI avatars for virtual reality platforms",
    "Tesla's FSD system reaches new milestone in autonomous driving"
];
// ================================
// UTILITY FUNCTIONS
// ================================
function getFallbackContent(dayNumber, fallbackArray, count = 1) {
    const startIndex = (dayNumber - 1) * count % fallbackArray.length;
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(fallbackArray[(startIndex + i) % fallbackArray.length]);
    }
    return result;
}
// ================================
// API FUNCTIONS
// ================================
async function generateWithGemini(prompt) {
    // Use Netlify function instead of direct API call
    const response = await fetch('/.netlify/functions/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}. Please try again later.`);
    }
    const data = await response.json();
    if (data.error) {
        throw new Error(data.error);
    }
    if (!data.text) {
        throw new Error('No content generated from AI. Please try again.');
    }
    return data.text;
}
async function generateQuote(dayNumber) {
    const themes = [
        'time and urgency',
        'human potential and growth',
        'facing uncertainty',
        'technological progress',
        'collective action',
        'resilience and adaptation',
        'the future we create'
    ];
    const selectedTheme = themes[dayNumber % themes.length];
    const prompt = `Generate a unique philosophical quote about ${selectedTheme} for day ${dayNumber} of 1000. Make it thought-provoking and distinct, 15-25 words. Focus on ${selectedTheme} specifically. Return only the quote text.`;
    try {
        return await generateWithGemini(prompt);
    }
    catch (_a) {
        return getFallbackContent(dayNumber, FALLBACK_QUOTES)[0];
    }
}
async function generateNews(dayNumber) {
    const prompts = [
        `Generate a realistic AI news headline about breakthroughs or research. 10-20 words maximum, professional news style. Return only the headline.`,
        `Generate a realistic AI news headline about industry developments or company announcements. 10-20 words maximum, professional news style. Return only the headline.`,
        `Generate a realistic AI news headline about AI applications or technology trends. 10-20 words maximum, professional news style. Return only the headline.`
    ];
    try {
        const newsPromises = prompts.map(prompt => generateWithGemini(prompt));
        return await Promise.all(newsPromises);
    }
    catch (_a) {
        return getFallbackContent(dayNumber, FALLBACK_NEWS, 3);
    }
}
// ================================
// STORAGE FUNCTIONS
// ================================
function getStorageKey(type, day) {
    return `doomsday-${type}-${day}`;
}
function saveToStorage(type, data) {
    localStorage.setItem(getStorageKey(type, data.day), JSON.stringify(data));
}
function getFromStorage(type, day) {
    try {
        const stored = localStorage.getItem(getStorageKey(type, day));
        if (!stored)
            return null;
        const data = JSON.parse(stored);
        return data.date === new Date().toDateString() ? data : null;
    }
    catch (_a) {
        return null;
    }
}
function clearExpiredCache() {
    const today = new Date().toDateString();
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!(key === null || key === void 0 ? void 0 : key.startsWith('doomsday-')))
            continue;
        try {
            const stored = localStorage.getItem(key);
            if (!stored)
                continue;
            const data = JSON.parse(stored);
            if (data.date !== today) {
                localStorage.removeItem(key);
            }
        }
        catch (_a) {
            // Remove corrupted cache entries
            localStorage.removeItem(key);
        }
    }
}
// ================================
// CONTENT MANAGEMENT
// ================================
async function getDailyContent(type, dayNumber, generator, fallbackArray, fallbackCount = 1) {
    const cached = getFromStorage(type, dayNumber);
    if (cached)
        return cached;
    try {
        const generated = await generator(dayNumber);
        const content = Object.assign(Object.assign({}, (type === 'quote'
            ? { text: generated }
            : { headlines: generated })), { day: dayNumber, date: new Date().toDateString() });
        saveToStorage(type, content);
        return content;
    }
    catch (_a) {
        const fallbackData = getFallbackContent(dayNumber, fallbackArray, fallbackCount);
        const content = Object.assign(Object.assign({}, (type === 'quote'
            ? { text: fallbackData[0] }
            : { headlines: fallbackData })), { day: dayNumber, date: new Date().toDateString() });
        return content;
    }
}
async function getDailyQuote(dayNumber) {
    return getDailyContent('quote', dayNumber, generateQuote, FALLBACK_QUOTES);
}
async function getDailyNews(dayNumber) {
    return getDailyContent('news', dayNumber, generateNews, FALLBACK_NEWS, 3);
}
// ================================
// UI UPDATE FUNCTIONS
// ================================
function updateQuoteDisplay(quote) {
    quoteDayElement.textContent = `Day ${quote.day}`;
    quoteTextElement.classList.add('fade-out');
    setTimeout(() => {
        quoteTextElement.textContent = quote.text;
        quoteTextElement.classList.remove('fade-out');
        quoteTextElement.classList.add('fade-in');
        setTimeout(() => quoteTextElement.classList.remove('fade-in'), CONFIG.fadeInDuration);
    }, CONFIG.fadeOutDuration);
}
async function updateQuote(dayNumber) {
    try {
        const quote = await getDailyQuote(dayNumber);
        updateQuoteDisplay(quote);
    }
    catch (_a) {
        updateQuoteDisplay({
            text: getFallbackContent(dayNumber, FALLBACK_QUOTES)[0],
            day: dayNumber,
            date: new Date().toDateString()
        });
    }
}
function updateTicker(news) {
    const tickerContent = news.headlines.join('   •   ') + '   •   ';
    tickerTextElement.textContent = tickerContent;
}
async function updateNews(dayNumber) {
    try {
        const news = await getDailyNews(dayNumber);
        updateTicker(news);
    }
    catch (_a) {
        updateTicker({
            headlines: getFallbackContent(dayNumber, FALLBACK_NEWS, 3),
            day: dayNumber,
            date: new Date().toDateString()
        });
    }
}
// ================================
// TIME CALCULATION FUNCTIONS
// ================================
function toConfiguredTimezone(date) {
    const newDate = new Date(date);
    const year = newDate.getUTCFullYear();
    const month = newDate.getUTCMonth();
    const day = newDate.getUTCDate();
    const hours = newDate.getUTCHours();
    const minutes = newDate.getUTCMinutes();
    const seconds = newDate.getUTCSeconds();
    const milliseconds = newDate.getUTCMilliseconds();
    const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
    utcDate.setUTCHours(utcDate.getUTCHours() + CONFIG.timezoneOffset);
    return utcDate;
}
function getMidnightInTimezone(date) {
    const timezoneDate = toConfiguredTimezone(date);
    const year = timezoneDate.getUTCFullYear();
    const month = timezoneDate.getUTCMonth();
    const day = timezoneDate.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}
function getTimeRemaining() {
    const now = new Date();
    const nowInTimezone = toConfiguredTimezone(now);
    const startMidnight = getMidnightInTimezone(CONFIG.startDate);
    const nowMidnight = getMidnightInTimezone(now);
    const endMidnight = getMidnightInTimezone(END_DATE);
    const daysDifference = Math.floor((nowMidnight.getTime() - startMidnight.getTime()) / MILLISECONDS_PER_DAY);
    const daysPassed = daysDifference >= 0 ? daysDifference + 1 : 0;
    const daysRemaining = Math.floor((endMidnight.getTime() - nowMidnight.getTime()) / MILLISECONDS_PER_DAY);
    const nextMidnight = new Date(Date.UTC(nowMidnight.getUTCFullYear(), nowMidnight.getUTCMonth(), nowMidnight.getUTCDate() + 1, 0, 0, 0, 0));
    const timeUntilNextDay = nextMidnight.getTime() - nowInTimezone.getTime();
    const hours = Math.floor(timeUntilNextDay / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilNextDay % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeUntilNextDay % (1000 * 60)) / 1000);
    const totalRemaining = (daysRemaining * MILLISECONDS_PER_DAY) + timeUntilNextDay;
    return {
        total: Math.max(0, totalRemaining),
        days: daysRemaining,
        hours,
        minutes,
        seconds,
        daysPassed: daysDifference < 0 ? 0 : Math.min(daysPassed, CONFIG.totalDays)
    };
}
// ================================
// GRID SYSTEM
// ================================
function initializeGrid() {
    const fragment = document.createDocumentFragment();
    const initialItems = Math.min(CONFIG.totalDays, CONFIG.initialGridItems);
    for (let i = 0; i < initialItems; i++) {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.dataset.day = (i + 1).toString();
        fragment.appendChild(gridItem);
    }
    gridContainer.appendChild(fragment);
    if (CONFIG.totalDays > CONFIG.initialGridItems) {
        setTimeout(() => lazyLoadRemainingGridItems(CONFIG.initialGridItems), CONFIG.gridLoadDelay);
    }
}
function lazyLoadRemainingGridItems(startIndex) {
    const fragment = document.createDocumentFragment();
    let currentIndex = startIndex;
    function loadBatch() {
        const endIndex = Math.min(currentIndex + CONFIG.gridBatchSize, CONFIG.totalDays);
        for (let i = currentIndex; i < endIndex; i++) {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';
            gridItem.dataset.day = (i + 1).toString();
            fragment.appendChild(gridItem);
        }
        gridContainer.appendChild(fragment.cloneNode(true));
        currentIndex = endIndex;
        if (currentIndex < CONFIG.totalDays) {
            setTimeout(loadBatch, CONFIG.gridBatchDelay);
        }
    }
    loadBatch();
}
let lastCheckedDay = -1;
let currentContentDay = -1;
function updateGrid(daysPassed) {
    if (daysPassed > lastCheckedDay) {
        const gridItems = document.querySelectorAll('.grid-item');
        for (let i = lastCheckedDay + 1; i <= daysPassed; i++) {
            if (i > 0 && i <= gridItems.length) {
                const item = gridItems[i - 1];
                item.classList.add('checked', 'animate');
                setTimeout(() => item.classList.remove('animate'), CONFIG.gridAnimationDuration);
            }
        }
        lastCheckedDay = daysPassed;
    }
    if (daysPassed !== currentContentDay && daysPassed > 0) {
        currentContentDay = daysPassed;
        updateQuote(daysPassed);
        updateNews(daysPassed);
    }
}
// ================================
// MAIN APPLICATION FUNCTIONS
// ================================
function updateCountdown() {
    const timeRemaining = getTimeRemaining();
    daysElement.textContent = timeRemaining.days.toString().padStart(3, '0');
    hoursElement.textContent = timeRemaining.hours.toString().padStart(2, '0');
    minutesElement.textContent = timeRemaining.minutes.toString().padStart(2, '0');
    secondsElement.textContent = timeRemaining.seconds.toString().padStart(2, '0');
    updateGrid(timeRemaining.daysPassed);
    if (timeRemaining.total <= 0) {
        clearInterval(countdownInterval);
        daysElement.textContent = '000';
        hoursElement.textContent = '00';
        minutesElement.textContent = '00';
        secondsElement.textContent = '00';
    }
}
async function initializeApp() {
    try {
        clearExpiredCache();
        initializeGrid();
        updateCountdown();
        const timeRemaining = getTimeRemaining();
        const dayToLoad = timeRemaining.daysPassed > 0 ? timeRemaining.daysPassed : 1;
        quoteTextElement.textContent = 'Loading today\'s reflection...';
        tickerTextElement.textContent = 'Loading AI news...';
        try {
            await updateQuote(dayToLoad);
            await updateNews(dayToLoad);
        }
        catch (error) {
            console.error('Failed to load initial content:', error);
        }
        countdownInterval = setInterval(updateCountdown, CONFIG.updateInterval);
    }
    catch (error) {
        console.error('App initialization failed:', error);
    }
}
let countdownInterval;
document.addEventListener('DOMContentLoaded', initializeApp);
