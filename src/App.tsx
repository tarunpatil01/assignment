
import { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Paginator } from 'primereact/paginator';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ProgressBar } from 'primereact/progressbar';
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
  const [selectionCount, setSelectionCount] = useState('');
  const [selectionProgress, setSelectionProgress] = useState(0);
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
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

  // Optimized bulk selection with progress tracking
  const handleSelectNRows = async () => {
    const count = parseInt(selectionCount.trim());
    
    if (!selectionCount.trim() || isNaN(count) || count <= 0) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please enter a valid number of rows to select',
        life: 3000
      });
      return;
    }

    if (count <= selectedArtworks.size) {
      toast.current?.show({
        severity: 'info',
        summary: 'Info',
        detail: `Already have ${selectedArtworks.size} items selected. Please enter a larger number.`,
        life: 3000
      });
      return;
    }

    // Calculate how many pages we need to fetch
    const maxPages = Math.ceil(totalRecords / rowsPerPage);
    const pagesNeeded = Math.ceil((count - selectedArtworks.size) / rowsPerPage);
    const startPage = currentPage;
    const endPage = Math.min(startPage + pagesNeeded, maxPages);

    if (endPage > maxPages) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: `Only ${totalRecords} items available. Cannot select ${count} items.`,
        life: 3000
      });
      return;
    }

    setLoading(true);
    setIsBulkSelecting(true);
    setSelectionProgress(0);
    const newSelected = new Set(selectedArtworks);
    let remainingToSelect = count - selectedArtworks.size;
    let processedPages = 0;
    const totalPagesToProcess = endPage - startPage + 1;

    try {
      // First, select all items on current page that aren't already selected
      artworks.forEach(artwork => {
        if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
          newSelected.add(artwork.id);
          remainingToSelect--;
        }
      });
      processedPages++;

      // Batch fetch multiple pages concurrently for better performance
      const batchSize = 5; // Process 5 pages at a time
      const pageBatches = [];
      
      for (let i = startPage + 1; i <= endPage; i += batchSize) {
        const batchEnd = Math.min(i + batchSize - 1, endPage);
        pageBatches.push({ start: i, end: batchEnd });
      }

      // Process batches with progress updates
      for (const batch of pageBatches) {
        // Fetch batch of pages concurrently
        const fetchPromises = [];
        for (let page = batch.start; page <= batch.end; page++) {
          fetchPromises.push(
            fetch(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`)
              .then(response => response.json())
              .catch(error => {
                console.error(`Error fetching page ${page}:`, error);
                return null;
              })
          );
        }

        // Wait for batch to complete
        const batchResults = await Promise.all(fetchPromises);
        
                 // Process batch results
         for (const result of batchResults) {
           if (result && result.data) {
             result.data.forEach((artwork: Artwork) => {
               if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
                 newSelected.add(artwork.id);
                 remainingToSelect--;
               }
             });
             processedPages++;
           }
         }

        // Update progress and allow UI to refresh
        setSelectedArtworks(new Set(newSelected));
        
        // Update progress state
        const progress = Math.round((processedPages / totalPagesToProcess) * 100);
        setSelectionProgress(progress);
        
        // Show progress toast
        toast.current?.show({
          severity: 'info',
          summary: 'Selection Progress',
          detail: `${progress}% complete - ${newSelected.size} items selected`,
          life: 1000
        });

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final update
      setSelectedArtworks(newSelected);
      updateSelectAll(newSelected);

      toast.current?.show({
        severity: 'success',
        summary: 'Selection Complete',
        detail: `${newSelected.size} artworks selected across ${processedPages} pages`,
        life: 3000
      });

      setShowSelectionWindow(false);
      setSelectionCount('');
    } catch (error) {
      console.error('Error selecting rows:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to select rows',
        life: 3000
      });
    } finally {
      setLoading(false);
      setIsBulkSelecting(false);
      setSelectionProgress(0);
    }
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

        {/* Bulk Selection Progress */}
        {isBulkSelecting && (
          <div className="mb-4 p-3 border-round bg-blue-50">
            <div className="flex align-items-center justify-content-between mb-2">
              <span className="font-medium text-blue-800">Bulk Selection in Progress</span>
              <span className="text-sm text-blue-600">{selectionProgress}%</span>
            </div>
            <ProgressBar 
              value={selectionProgress} 
              className="h-2"
              color="blue"
            />
            <p className="text-xs text-blue-600 mt-1">
              Processing pages... Please wait
            </p>
          </div>
        )}

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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of rows to select:
                </label>
                <input
                  type="number"
                  placeholder="Enter number (e.g., 20)"
                  value={selectionCount}
                  onChange={(e) => setSelectionCount(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSelectNRows();
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Currently selected: {selectedArtworks.size} items
                </p>
                {parseInt(selectionCount) > 100 && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Large selections may take time to process
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  label="Select Rows"
                  size="small"
                  onClick={handleSelectNRows}
                  className="px-4 py-1"
                  disabled={loading}
                />
                <Button
                  label={`Select All (${totalRecords})`}
                  size="small"
                  severity="secondary"
                  onClick={() => {
                    setSelectionCount(totalRecords.toString());
                    handleSelectNRows();
                  }}
                  className="px-4 py-1"
                  disabled={loading}
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
