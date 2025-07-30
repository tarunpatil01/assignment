
import { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Paginator } from 'primereact/paginator';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';

// PrimeReact CSS imports
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

interface Artwork {
  id: number;
  title: string;
  place_of_origin: string;
  artist_display: string;
  inscriptions: string;
  date_start: number;
  date_end: number;
}

interface ApiResponse {
  data: Artwork[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    total_pages: number;
    current_page: number;
  };
}

function App() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [rowsPerPage] = useState(12);
  const [selectedArtworks, setSelectedArtworks] = useState<Set<number>>(new Set());
  const [showSelectionWindow, setShowSelectionWindow] = useState(false);
  const [selectionSearchText, setSelectionSearchText] = useState('');
  const toast = useRef<Toast>(null);

  // Close selection window when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showSelectionWindow && !target.closest('.selection-window') && !target.closest('.chevron-icon')) {
        setShowSelectionWindow(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSelectionWindow]);

  // Fetch data from API
  const fetchArtworks = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`);
      const data: ApiResponse = await response.json();
      
      setArtworks(data.data);
      setTotalRecords(data.pagination.total);
      setCurrentPage(page);
      
      // Update select all state after data loads
      updateSelectAll(selectedArtworks);
    } catch (error) {
      console.error('Error fetching artworks:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to fetch artworks',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchArtworks(1);
  }, []);

  // Handle page change
  const onPageChange = (event: { first: number; rows: number; page: number }) => {
    const newPage = event.page + 1;
    fetchArtworks(newPage);
  };

  // Update select all state based on current selections
  const updateSelectAll = (selected: Set<number>) => {
    const allIds = new Set(artworks.map(artwork => artwork.id));
    // This function is now just for logging/debugging since PrimeReact handles selection
    console.log('Selection updated:', selected.size, 'of', allIds.size, 'items selected');
  };

  // Search functionality
  const handleSearch = () => {
    if (!selectionSearchText.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please enter search text',
        life: 3000
      });
      return;
    }

    const searchTerm = selectionSearchText.toLowerCase().trim();
    const matchingIds: number[] = [];

    artworks.forEach(artwork => {
      const title = artwork.title?.toLowerCase() || '';
      const artist = artwork.artist_display?.toLowerCase() || '';
      const origin = artwork.place_of_origin?.toLowerCase() || '';
      const inscriptions = artwork.inscriptions?.toLowerCase() || '';

      if (title.includes(searchTerm) || 
          artist.includes(searchTerm) || 
          origin.includes(searchTerm) || 
          inscriptions.includes(searchTerm)) {
        matchingIds.push(artwork.id);
      }
    });

    if (matchingIds.length === 0) {
      toast.current?.show({
        severity: 'info',
        summary: 'No Results',
        detail: 'No artworks found matching your search',
        life: 3000
      });
      return;
    }

    // Add matching results to selection
    const newSelected = new Set(selectedArtworks);
    matchingIds.forEach(id => newSelected.add(id));
    setSelectedArtworks(newSelected);
    updateSelectAll(newSelected);

    toast.current?.show({
      severity: 'success',
      summary: 'Search Complete',
      detail: `${matchingIds.length} artworks selected based on search`,
      life: 3000
    });

    setShowSelectionWindow(false);
    setSelectionSearchText('');
  };



  // Custom row selection panel
  const selectionPanel = () => {
    const selectedCount = selectedArtworks.size;
    const totalCount = totalRecords;
    
    return (
      <div className="flex align-items-center justify-content-between p-3 border-round bg-blue-50">
        <div className="flex align-items-center gap-2">
          <i className="pi pi-check-circle text-blue-600"></i>
          <span className="font-medium">
            {selectedCount} of {totalCount} artworks selected
          </span>
        </div>
        {selectedCount > 0 && (
          <Button
            label="Clear Selection"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            onClick={() => {
              setSelectedArtworks(new Set());
            }}
          />
        )}
      </div>
    );
  };

  // Format date range
  const dateRangeTemplate = (artwork: Artwork) => {
    if (artwork.date_start && artwork.date_end) {
      return `${artwork.date_start} - ${artwork.date_end}`;
    } else if (artwork.date_start) {
      return `${artwork.date_start}`;
    } else if (artwork.date_end) {
      return `${artwork.date_end}`;
    }
    return 'Unknown';
  };

  // Truncate long text
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return 'N/A';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Toast ref={toast} />
      
      <Card className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Art Institute of Chicago Collection
          </h1>
          <p className="text-gray-600">
            Browse and select artworks from the museum's collection
          </p>
        </div>

        {/* Selection Panel */}
        {selectedArtworks.size > 0 && selectionPanel()}

        {/* DataTable */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="text-center">
                <ProgressSpinner />
                <p className="mt-2 text-gray-600">Loading artworks...</p>
              </div>
            </div>
          )}
          
          {/* Selection Window */}
          {showSelectionWindow && (
            <div className="absolute top-0 left-0 z-20 bg-white border border-gray-300 rounded-md shadow-lg p-3 min-w-64 selection-window">
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Select rows..."
                  value={selectionSearchText}
                  onChange={(e) => setSelectionSearchText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex justify-center">
                <Button
                  label="Submit"
                  size="small"
                  onClick={handleSearch}
                  className="px-4 py-1"
                />
              </div>
            </div>
          )}
          
          <DataTable
            value={artworks}
            loading={loading}
            stripedRows
            showGridlines
            className="border-round"
            emptyMessage="No artworks found"
            selectionMode="multiple"
            selection={artworks.filter(artwork => selectedArtworks.has(artwork.id))}
            onSelectionChange={(e) => {
              console.log('Selection changed:', e.value);
              const newSelected = new Set(selectedArtworks);
              
              // Add newly selected items
              (e.value as Artwork[]).forEach((artwork: Artwork) => {
                newSelected.add(artwork.id);
              });
              
              // Remove deselected items from current page
              artworks.forEach((artwork: Artwork) => {
                if (!(e.value as Artwork[]).some((selected: Artwork) => selected.id === artwork.id)) {
                  newSelected.delete(artwork.id);
                }
              });
              
              setSelectedArtworks(newSelected);
              updateSelectAll(newSelected);
            }}
            dataKey="id"
          >
            <Column
              selectionMode="multiple"
              header={() => (
                <div className="flex align-items-center gap-1">
                  <i 
                    className="pi pi-chevron-down cursor-pointer text-gray-600 hover:text-gray-800 chevron-icon"
                    onClick={() => setShowSelectionWindow(!showSelectionWindow)}
                    style={{ fontSize: '1.0 rem' }}
                  />
                </div>
              )}
              style={{ width: '3rem' }}
            />
            
            <Column
              field="title"
              header="Title"
              body={(artwork) => (
                <div className="font-medium text-gray-900">
                  {truncateText(artwork.title, 60)}
                </div>
              )}
              sortable
            />
            
            <Column
              field="artist_display"
              header="Artist"
              body={(artwork) => (
                <div className="text-gray-700">
                  {truncateText(artwork.artist_display, 40)}
                </div>
              )}
              sortable
            />
            
            <Column
              field="place_of_origin"
              header="Origin"
              body={(artwork) => (
                <div className="text-gray-600">
                  {truncateText(artwork.place_of_origin, 30)}
                </div>
              )}
              sortable
            />
            
            <Column
              field="date_start"
              header="Date Range"
              body={dateRangeTemplate}
              sortable
            />
            
            <Column
              field="inscriptions"
              header="Inscriptions"
              body={(artwork) => (
                <div className="text-gray-600 text-sm">
                  {truncateText(artwork.inscriptions, 40)}
                </div>
              )}
            />
          </DataTable>
        </div>

        {/* Pagination */}
        <div className="mt-4">
          <Paginator
            first={(currentPage - 1) * rowsPerPage}
            rows={rowsPerPage}
            totalRecords={totalRecords}
            onPageChange={onPageChange}
            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} artworks"
            rowsPerPageOptions={[12, 24, 48]}
          />
        </div>

        {/* Debug Info */}
        <div className="mt-4 p-3 bg-gray-100 border-round text-sm text-gray-600">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Current Page:</strong> {currentPage}
            </div>
            <div>
              <strong>Selected Items:</strong> {selectedArtworks.size}
            </div>
            <div>
              <strong>Total Records:</strong> {totalRecords}
            </div>
            <div>
              <strong>Records Per Page:</strong> {rowsPerPage}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default App;
