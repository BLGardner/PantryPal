# 🍳 Kitchen PantryPal

A powerful, mobile-first web app for managing your pantry, recipes, shopping lists, and meal planning. Built with vanilla JavaScript and IndexedDB for offline-capable, client-side storage.

## ✨ Features

### 📖 Recipe Management
- **Smart Recipe Import**: Use the built-in Recipe-Clipper bookmarklet to extract recipes from any website
- **Ingredient Normalization**: Automatically format ingredients with quantity, unit, name, and detail fields
- **Interactive Review**: Edit and match ingredients with your pantry items before importing
- **Recipe Linking**: Link recipes within recipes (e.g., "See: Pie Crust Recipe")
- **Category Organization**: Filter recipes by category and availability
- **Availability Tracking**: Instantly see which recipes you can make with current pantry items

### 🥫 Pantry Management
- Track what ingredients you have available
- Quick add/edit/delete functionality
- Sort alphabetically or by availability
- Import pantry lists from text files
- One-click shopping list integration

### 🛒 Smart Shopping List
- Add missing recipe ingredients automatically
- Mark items as purchased to update pantry
- Quick add/remove items
- Mark all purchased in bulk
- Syncs with pantry availability

### 📅 Weekly Meal Planner
- 7-day calendar view with breakfast, lunch, and dinner slots
- Visual indicators: green border for recipes you can make, red for missing ingredients
- Search and filter recipes when planning meals
- Quick meal changes and removal

### 🔄 Import/Export
- **Full Backup**: Export all data (recipes, pantry, shopping, meal plans)
- **Recipe Sharing**: Export recipes only for sharing with others
- **Flexible Import**: Import JSON or text-formatted recipes
- **Duplicate Handling**: Smart detection and options for handling existing recipes

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/BLGardner/PantryPal.git
cd kitchen-pantrypal
```

2. Open `index.html` in your web browser

That's it! No build process, no dependencies, no server required.

### Using the Recipe-Clipper

1. Open Kitchen PantryPal and go to the Import Recipes modal
2. Drag the **Recipe-Clipper** bookmarklet link to your bookmarks bar
3. Navigate to any recipe website
4. Click the Recipe-Clipper bookmark
5. Copy the extracted recipe text
6. Paste into Kitchen PantryPal
7. Click **Normalize** to clean up formatting (can click twice for better results)
8. Click **Review Ingredients** to match with pantry items
9. Click **Import** to save

## 📱 Mobile Optimized

Kitchen PantryPal is designed with mobile-first principles:
- Responsive layouts that adapt to all screen sizes
- Touch-friendly buttons and controls
- Compact interface optimized for phones
- Fixed headers with scrollable content
- Separate scrolling for recipe lists and details

## 🛠️ Technology Stack

- **Pure JavaScript (ES6 modules)** - No frameworks
- **IndexedDB** - Client-side database for offline storage
- **CSS Grid & Flexbox** - Modern, responsive layouts
- **No build process** - Just open and use

## 📂 File Structure

```
kitchen-pantrypal/
├── index.html          # Main HTML structure
├── styles.css          # All styling and responsive design
├── app.js              # Core app logic, database, utilities
├── recipes.js          # Recipe management and import
├── pantry.js           # Pantry and shopping list
├── planner.js          # Weekly meal planner
├── normalize.js        # Ingredient normalization engine
├── logo.png            # App logo
├── favicon.ico         # Browser favicon
└── README.md           # This file
```

## 💾 Data Storage

All data is stored locally in your browser using IndexedDB:
- **No server required** - Works completely offline
- **Privacy-focused** - Your data never leaves your device
- **Persistent** - Data survives browser restarts
- **Backup/Restore** - Export/import for data portability

## 🎯 Recipe Format

Kitchen PantryPal uses a pipe-delimited format for ingredients:

```
TITLE Recipe Name
CATEGORY Category Name
INGREDIENTS
Qty|Unit|Name|Detail
2|cups|All-Purpose Flour|sifted
1|tsp|Salt
INSTRUCTIONS
Mix ingredients...
---
(Use --- to separate multiple recipes)
```

## 🔧 Customization

The app is highly customizable:
- Edit `styles.css` to change colors and spacing
- Modify `COMMON_QUANTITIES` and `COMMON_UNITS` in `recipes.js` for different suggestions
- Update the bookmarklet code for different recipe extraction patterns

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Known Issues

- Recipe-Clipper works best on recipe websites with standard formatting
- Some websites may require manual cleanup after extraction
- Browser storage limits apply (typically 50MB+)

## 🚧 Roadmap

- [ ] Recipe scaling (2x, 0.5x servings)
- [ ] Nutrition information tracking
- [ ] Recipe ratings and notes
- [ ] Print-friendly recipe cards
- [ ] Dark/light theme toggle
- [ ] Multi-language support

## 💡 Tips

- **Double Normalize**: Click the Normalize button twice for best results when importing recipes
- **Pantry Matching**: Use the Review Ingredients feature to ensure recipe ingredients match your pantry exactly
- **Recipe Linking**: In ingredient details, use "See: Recipe Name" to create clickable links to sub-recipes
- **Backup Regularly**: Export your data periodically to avoid data loss

## 📧 Support

Found a bug or have a feature request? Please [open an issue](https://github.com/BLGardner/PantryPal/issues).

## 🙏 Acknowledgments

- Built with love for home cooks everywhere
- Inspired by the need for a simple, privacy-focused recipe manager
- Special thanks to the open web and standard technologies that make this possible

---

**Made with 🍴 by BLGardner**

*Star ⭐ this repo if you find it useful!*
