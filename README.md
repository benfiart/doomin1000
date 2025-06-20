# Doomsday Countdown - 1000 Days

A lightweight, responsive website that visualizes a countdown to a pre-set doomsday date, exactly 1000 days from a fixed start point.

## Features

- **Main Countdown Timer**: Large, centered display showing time remaining in days/hours/minutes/seconds
- **Visual Calendar**: Grid of 1000 checkboxes that automatically mark themselves as time progresses
- **Lightweight & Responsive**: No external libraries, scales cleanly to mobile and desktop
- **Minimalist Aesthetic**: Dark mode default, bold typography, simple layout
- **Customizable Preset Date**: Easily change the start date in the configuration
- **Smart Layout**: Designed to avoid scrolling unless necessary

## How to Use

1. Clone or download this repository
2. Open `src/index.html` in your web browser
3. The countdown will automatically start based on the configured start date


## Customization

### Changing the Start Date

To change the start date, open `src/app.js` or `src/app.ts` and modify the `startDate` value in the CONFIG object:

```javascript
const CONFIG = {
    // Set your start date here (format: YYYY-MM-DD)
    startDate: new Date('2025-06-01'),
    // Total days to count
    totalDays: 1000,
    // Update interval in milliseconds
    updateInterval: 1000,
};
```

### Styling

The website uses CSS variables for easy styling. To change the colors or other visual aspects, modify the variables in `src/styles.css`:

```css
:root {
    --bg-color: #121212;
    --text-color: #ffffff;
    --accent-color: #ff4757;
    --grid-item-color: #1e1e1e;
    --grid-item-checked: #2ecc71;
    --grid-item-hover: #333333;
}
```

## Development

This project uses TypeScript for type safety. If you want to make changes to the TypeScript file:

1. Modify `src/app.ts`
2. Compile it to JavaScript using a TypeScript compiler
3. Alternatively, you can directly edit `src/app.js` if you don't need TypeScript

## Project Structure

- `src/index.html` - Main HTML file
- `src/styles.css` - CSS styles
- `src/app.ts` - TypeScript source code
- `src/app.js` - Compiled JavaScript code
- `src/img/` - Directory containing images
- `tsconfig.json` - TypeScript configuration

## License

MIT
