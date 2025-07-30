# Art Institute of Chicago Collection Browser

A React application that allows users to browse and select artworks from the Art Institute of Chicago's collection using PrimeReact DataTable with advanced features.

## 🎨 Features

### Core Functionality
- **Artwork Browsing**: Display artworks from the Art Institute of Chicago API
- **Server-Side Pagination**: Efficient data loading with fresh API calls on each page change
- **Row Selection**: Select individual artworks or all artworks on the current page
- **Persistent Selection**: Selections persist across page navigation
- **Custom Search**: Search and select artworks based on title, artist, origin, or inscriptions

### Data Display
- **Artwork Information**: Title, Artist, Place of Origin, Date Range, and Inscriptions
- **Responsive Design**: Modern UI with Tailwind CSS styling
- **Loading States**: Visual feedback during data fetching
- **Error Handling**: User-friendly error messages and notifications

### Selection Features
- **Individual Row Selection**: Checkbox for each artwork row
- **Select All**: Header checkbox to select all items on current page
- **Custom Selection Window**: Dropdown with search functionality
- **Selection Summary**: Real-time count of selected artworks
- **Clear Selection**: Button to deselect all items

## 🛠️ Technology Stack

- **React 19.1.0** - Frontend framework
- **TypeScript** - Type safety and development experience
- **Vite** - Fast build tool and development server
- **PrimeReact** - UI component library
- **Tailwind CSS** - Utility-first CSS framework
- **Art Institute of Chicago API** - Data source

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd assignment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 🚀 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## 📊 API Integration

The application fetches data from the Art Institute of Chicago API:
```
https://api.artic.edu/api/v1/artworks
```

### API Parameters
- `page`: Current page number
- `limit`: Number of items per page (default: 12)
- `fields`: Specific fields to retrieve (id, title, place_of_origin, artist_display, inscriptions, date_start, date_end)

### Data Structure
```typescript
interface Artwork {
  id: number;
  title: string;
  place_of_origin: string;
  artist_display: string;
  inscriptions: string;
  date_start: number;
  date_end: number;
}
```

## 🎯 Key Implementation Details

### Server-Side Pagination
- Each page change triggers a new API call
- No client-side data accumulation to prevent memory issues
- Fresh data loading ensures up-to-date information

### Row Selection System
- Uses PrimeReact's built-in `selectionMode="multiple"`
- Selection state managed with `Set<number>` for efficient lookups
- Selections persist across page navigation
- Custom selection window with search functionality

### Search Functionality
- Case-insensitive search across multiple fields
- Real-time selection of matching artworks
- Toast notifications for user feedback
- Keyboard support (Enter key to submit)

## 🎨 UI Components

### PrimeReact Components Used
- `DataTable` - Main data display with built-in selection
- `Column` - Column configuration with sorting
- `Paginator` - Page navigation controls
- `ProgressSpinner` - Loading indicators
- `Button` - Action buttons
- `Card` - Content container
- `Toast` - User notifications

### Custom Components
- Selection Panel - Shows selected count and clear button
- Selection Window - Custom dropdown with search
- Date Range Template - Formats date display
- Text Truncation - Handles long text gracefully

## 🔧 Configuration

### Environment Setup
- No environment variables required
- API endpoints are hardcoded for simplicity
- All configuration is in the source code

### Styling
- Tailwind CSS for utility classes
- PrimeReact theme (Lara Light Blue)
- Custom CSS for specific components

## 📱 Browser Support

- Modern browsers with ES6+ support
- Responsive design for desktop and tablet
- Optimized for Chrome, Firefox, Safari, and Edge

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational purposes and uses the Art Institute of Chicago API for data.

## 🙏 Acknowledgments

- Art Institute of Chicago for providing the API
- PrimeReact team for the excellent UI components
- React and Vite communities for the development tools
