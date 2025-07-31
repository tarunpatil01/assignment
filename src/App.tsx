
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
  const [viewingSelected, setViewingSelected] = useState(false);
  const toast = useRef<Toast>(null);

  // Performance optimization: Request cache to avoid re-fetching
  const requestCache = useRef(new Map<string, { data: any; timestamp: number }>());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // Optimized fetch function with caching and performance tracking
  const fetchWithCache = async (url: string) => {
    const startTime = performance.now();
    const cached = requestCache.current.get(url);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      performanceMetrics.current.cacheHits++;
      logPerformance(`Cache hit for ${url}`, performance.now() - startTime);
      return cached.data;
    }

    performanceMetrics.current.cacheMisses++;
    const response = await fetch(url, {
      keepalive: true,
      priority: 'high'
    });
    const data = await response.json();
    
    // Cache the result
    requestCache.current.set(url, { data, timestamp: Date.now() });
    logPerformance(`Fetch and cache for ${url}`, performance.now() - startTime);
    return data;
  };

  // Performance optimization: Web Worker for background processing
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          if (type === 'processArtworks') {
            const { artworks, selectedIds, remainingToSelect } = data;
            const newSelected = new Set(selectedIds);
            let remaining = remainingToSelect;
            
            for (const artwork of artworks) {
              if (!newSelected.has(artwork.id) && remaining > 0) {
                newSelected.add(artwork.id);
                remaining--;
              }
            }
            
            self.postMessage({
              type: 'artworksProcessed',
              data: {
                newSelected: Array.from(newSelected),
                remainingToSelect: remaining
              }
            });
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));
      
      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
        }
      };
    }
  }, []);

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
    setCurrentPage(newPage);
    
    // If we have selections and are viewing selected items, show selected artworks for this page
    if (selectedArtworks.size > 0 && viewingSelected) {
      fetchSelectedArtworksForPage(newPage);
    } else {
      // Otherwise fetch regular page data
      fetchArtworks(newPage);
    }
  };

  // Update select all state based on current selections
  const updateSelectAll = (selected: Set<number>) => {
    const allIds = new Set(artworks.map(artwork => artwork.id));
    // This function is now just for logging/debugging since PrimeReact handles selection
    console.log('Selection updated:', selected.size, 'of', allIds.size, 'items selected');
  };

  // Optimized bulk selection with advanced performance enhancements
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

    const startTime = performance.now();
    setLoading(true);
    setIsBulkSelecting(true);
    setSelectionProgress(0);
    
    // Try ultra-fast bulk ID selection for very large numbers (>500)
    const bulkIdResult = await handleBulkIdSelection(count);
    if (bulkIdResult) {
      setLoading(false);
      setIsBulkSelecting(false);
      setSelectionProgress(0);
      setShowSelectionWindow(false);
      setSelectionCount('');
      return;
    }
    
    // Try ultra-fast selection for large numbers (>100)
    const ultraFastResult = await handleUltraFastSelection(count);
    if (ultraFastResult) {
      setLoading(false);
      setIsBulkSelecting(false);
      setSelectionProgress(0);
      setShowSelectionWindow(false);
      setSelectionCount('');
      return;
    }
    
    // Try hybrid selection for medium numbers (50-100)
    const hybridResult = await handleHybridSelection(count);
    if (hybridResult) {
      setLoading(false);
      setIsBulkSelecting(false);
      setSelectionProgress(0);
      setShowSelectionWindow(false);
      setSelectionCount('');
      return;
    }




    
    // For small selections (1-50 items), use traditional approach
    const newSelected = new Set(selectedArtworks);
    let remainingToSelect = count - selectedArtworks.size;
    
    try {
      // Select from current page first
      artworks.forEach(artwork => {
        if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
          newSelected.add(artwork.id);
          remainingToSelect--;
        }
      });
      
      // If we need more items, fetch additional pages (only for small selections)
      if (remainingToSelect > 0) {
        const pagesToFetch = Math.ceil(remainingToSelect / rowsPerPage);
        const maxPagesToFetch = Math.min(pagesToFetch, 3); // Limit to 3 pages for small selections
        
        for (let page = currentPage + 1; page <= currentPage + maxPagesToFetch && remainingToSelect > 0; page++) {
          try {
            const url = `https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`;
            const data = await fetchWithCache(url);
            
            data.data.forEach((artwork: Artwork) => {
              if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
                newSelected.add(artwork.id);
                remainingToSelect--;
              }
            });
          } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
            break;
          }
        }
      }
      
      setSelectedArtworks(newSelected);
      updateSelectAll(newSelected);

      const totalTime = performance.now() - startTime;
      
      toast.current?.show({
        severity: 'success',
        summary: 'Selection Complete',
        detail: `${newSelected.size} artworks selected in ${Math.round(totalTime)}ms`,
        life: 3000
      });
      
      logPerformance(`Small selection operation`, totalTime);

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



  // Ultra-fast selection mode for any large selection
  const handleUltraFastSelection = async (count: number) => {
    // Use mathematical approach for any selection > 100 items
    if (count > 100) {
      const startTime = performance.now();
      
      const newSelected = new Set(selectedArtworks);
      let remainingToSelect = count - selectedArtworks.size;
      
      // First, select all items from current page
      let selectedFromCurrentPage = 0;
      artworks.forEach(artwork => {
        if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
          newSelected.add(artwork.id);
          remainingToSelect--;
          selectedFromCurrentPage++;
        }
      });
      
      // Calculate all needed page numbers for parallel fetching
      const neededPages = [];
      let pageToFetch = currentPage;
      const maxPages = Math.ceil(totalRecords / rowsPerPage);
      
      // Calculate how many pages we need to fetch based on remaining items
      const pagesNeeded = Math.ceil(remainingToSelect / rowsPerPage);
      for (let i = 1; i <= pagesNeeded && pageToFetch + i <= maxPages; i++) {
        neededPages.push(pageToFetch + i);
      }
      
      if (neededPages.length > 0) {
        setSelectionProgress(10); // Initial progress after current page
        
        // Fire all requests in parallel with batching for better performance
        const batchSize = 10; // Process 10 pages at a time to avoid overwhelming the API
        const batches = [];
        
        for (let i = 0; i < neededPages.length; i += batchSize) {
          batches.push(neededPages.slice(i, i + batchSize));
        }
        
        let processedPages = 0;
        const totalPagesToProcess = neededPages.length;
        
        for (const batch of batches) {
          // Fetch this batch in parallel
          const batchPromises = batch.map(page =>
            fetchWithCache(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`)
          );
          
          const batchResults = await Promise.allSettled(batchPromises);
          
          // Process results from this batch
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.data) {
              result.value.data.forEach((artwork: Artwork) => {
                if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
                  newSelected.add(artwork.id);
                  remainingToSelect--;
                }
              });
            }
            processedPages++;
          });
          
          // Stop if we've reached our target
          if (remainingToSelect <= 0) {
            break;
          }
          
          // Update progress after each batch
          const progress = Math.round(((processedPages / totalPagesToProcess) * 80) + 10); // 10-90% range
          setSelectionProgress(progress);
          setSelectedArtworks(new Set(newSelected));
          
          // Small delay to allow UI to update
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      setSelectedArtworks(newSelected);
      setSelectionProgress(100);
      setViewingSelected(true); // Switch to viewing selected items
      
      // Fetch actual artwork data for the first few selected items to display in current page
      const currentPageIds = Array.from(newSelected).slice(0, rowsPerPage);
      if (currentPageIds.length > 0) {
        try {
          // Fetch data for the first page of selected items
          const url = `https://api.artic.edu/api/v1/artworks?ids=${currentPageIds.join(',')}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`;
          const data = await fetchWithCache(url);
          
          // Update current page with selected artworks
          if (data.data && data.data.length > 0) {
            setArtworks(data.data);
          }
        } catch (error) {
          console.error('Error fetching selected artwork data:', error);
        }
      }
      
      const totalTime = performance.now() - startTime;
      
      toast.current?.show({
        severity: 'success',
        summary: 'Ultra-Fast Selection Complete',
        detail: `${newSelected.size} artworks selected in ${Math.round(totalTime)}ms using parallel approach`,
        life: 3000
      });
      
      logPerformance(`Ultra-fast selection of ${count} items`, totalTime);
      
      return true;
    }
    return false;
  };

  // Hybrid selection for medium-sized selections (50-100 items)
  const handleHybridSelection = async (count: number) => {
    if (count > 50 && count <= 100) {
      const startTime = performance.now();
      
      const newSelected = new Set(selectedArtworks);
      let remainingToSelect = count - selectedArtworks.size;
      
      // First, select from current page
      let selectedFromCurrentPage = 0;
      artworks.forEach(artwork => {
        if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
          newSelected.add(artwork.id);
          remainingToSelect--;
          selectedFromCurrentPage++;
        }
      });
      
      // Calculate all needed page numbers for parallel fetching
      const neededPages = [];
      let pageToFetch = currentPage;
      const maxPages = Math.ceil(totalRecords / rowsPerPage);
      
      // Calculate how many pages we need to fetch
      const pagesNeeded = Math.ceil(remainingToSelect / rowsPerPage);
      for (let i = 1; i <= pagesNeeded && pageToFetch + i <= maxPages; i++) {
        neededPages.push(pageToFetch + i);
      }
      
      if (neededPages.length > 0) {
        setSelectionProgress(10); // Initial progress after current page
        
        // Fire all requests in parallel
        const batchPromises = neededPages.map(page =>
          fetchWithCache(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process all results
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.data) {
            result.value.data.forEach((artwork: Artwork) => {
              if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
                newSelected.add(artwork.id);
                remainingToSelect--;
              }
            });
          }
        });
        
        setSelectionProgress(100);
      }
      
      setSelectedArtworks(newSelected);
      setViewingSelected(true); // Switch to viewing selected items
      
      // Fetch actual artwork data for display
      const selectedIds = Array.from(newSelected).slice(0, rowsPerPage);
      if (selectedIds.length > 0) {
        try {
          const url = `https://api.artic.edu/api/v1/artworks?ids=${selectedIds.join(',')}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`;
          const data = await fetchWithCache(url);
          
          if (data.data && data.data.length > 0) {
            setArtworks(data.data);
          }
        } catch (error) {
          console.error('Error fetching selected artwork data:', error);
        }
      }
      
      const totalTime = performance.now() - startTime;
      
      toast.current?.show({
        severity: 'success',
        summary: 'Hybrid Selection Complete',
        detail: `${newSelected.size} artworks selected in ${Math.round(totalTime)}ms using parallel approach`,
        life: 3000
      });
      
      logPerformance(`Hybrid selection of ${count} items`, totalTime);
      
      return true;
    }
    return false;
  };

  // Ultra-fast bulk selection using ID collection and bulk fetching
  const handleBulkIdSelection = async (count: number) => {
    if (count > 500) { // Use this method for very large selections
      const startTime = performance.now();
      
      const newSelected = new Set(selectedArtworks);
      let remainingToSelect = count - selectedArtworks.size;
      
      // First, select all items from current page
      let selectedFromCurrentPage = 0;
      artworks.forEach(artwork => {
        if (!newSelected.has(artwork.id) && remainingToSelect > 0) {
          newSelected.add(artwork.id);
          remainingToSelect--;
          selectedFromCurrentPage++;
        }
      });
      
      setSelectionProgress(10);
      
      // Calculate all needed page numbers
      const neededPages = [];
      let pageToFetch = currentPage;
      const maxPages = Math.ceil(totalRecords / rowsPerPage);
      
      // Calculate how many pages we need to fetch
      const pagesNeeded = Math.ceil(remainingToSelect / rowsPerPage);
      for (let i = 1; i <= pagesNeeded && pageToFetch + i <= maxPages; i++) {
        neededPages.push(pageToFetch + i);
      }
      
      if (neededPages.length > 0) {
        // Step 1: Collect all IDs from needed pages in parallel
        setSelectionProgress(20);
        
        const idCollectionPromises = neededPages.map(page =>
          fetchWithCache(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}&fields=id`)
        );
        
        const idResults = await Promise.allSettled(idCollectionPromises);
        
        // Collect all IDs
        const allIds: number[] = [];
        idResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value.data) {
            result.value.data.forEach((artwork: { id: number }) => {
              allIds.push(artwork.id);
            });
          }
        });
        
        setSelectionProgress(50);
        
        // Step 2: Add IDs to selection until we reach the target count
        for (const id of allIds) {
          if (!newSelected.has(id) && remainingToSelect > 0) {
            newSelected.add(id);
            remainingToSelect--;
          }
        }
        
        setSelectionProgress(80);
        
        // Step 3: Fetch full data for the first page of selected items using bulk endpoint
        const currentPageIds = Array.from(newSelected).slice(0, rowsPerPage);
        if (currentPageIds.length > 0) {
          try {
            const url = `https://api.artic.edu/api/v1/artworks?ids=${currentPageIds.join(',')}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`;
            const data = await fetchWithCache(url);
            
            if (data.data && data.data.length > 0) {
              setArtworks(data.data);
            }
          } catch (error) {
            console.error('Error fetching selected artwork data:', error);
          }
        }
      }
      
      setSelectedArtworks(newSelected);
      setSelectionProgress(100);
      setViewingSelected(true);
      
      const totalTime = performance.now() - startTime;
      
      toast.current?.show({
        severity: 'success',
        summary: 'Bulk Selection Complete',
        detail: `${newSelected.size} artworks selected in ${Math.round(totalTime)}ms using bulk ID approach`,
        life: 3000
      });
      
      logPerformance(`Bulk ID selection of ${count} items`, totalTime);
      
      return true;
    }
    return false;
  };

  // Fetch and display selected artworks for current page
  const fetchSelectedArtworksForPage = async (page: number) => {
    if (selectedArtworks.size === 0) return;
    
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageSelectedIds = Array.from(selectedArtworks).slice(startIndex, endIndex);
    
    if (pageSelectedIds.length > 0) {
      try {
        const url = `https://api.artic.edu/api/v1/artworks?ids=${pageSelectedIds.join(',')}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`;
        const data = await fetchWithCache(url);
        
        if (data.data && data.data.length > 0) {
          setArtworks(data.data);
        } else {
          setArtworks([]); // No data for this page
        }
      } catch (error) {
        console.error('Error fetching selected artwork data for page:', error);
        setArtworks([]); // Set empty array on error
      }
    } else {
      setArtworks([]); // No selected items for this page
    }
  };

  // Performance monitoring
  const performanceMetrics = useRef({
    startTime: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  });

  const logPerformance = (operation: string, duration: number) => {
    console.log(`🚀 ${operation}: ${duration}ms`);
    if (duration > 1000) {
      console.warn(`⚠️ Slow operation detected: ${operation} took ${duration}ms`);
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
          {selectedCount > 0 && (
            <Button
              label={viewingSelected ? "View All" : "View Selected"}
              icon={viewingSelected ? "pi pi-list" : "pi pi-check-square"}
              size="small"
              severity={viewingSelected ? "secondary" : "info"}
              onClick={() => {
                setViewingSelected(!viewingSelected);
                if (!viewingSelected) {
                  // Switch to viewing selected items
                  fetchSelectedArtworksForPage(currentPage);
                } else {
                  // Switch back to viewing all items
                  fetchArtworks(currentPage);
                }
              }}
            />
          )}
        </div>
        {selectedCount > 0 && (
          <Button
            label="Clear Selection"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            onClick={() => {
              setSelectedArtworks(new Set());
              setViewingSelected(false);
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
                {parseInt(selectionCount) > 500 && (
                  <p className="text-xs text-green-600 mt-1">
                    🚀 Will use ultra-fast bulk ID approach
                  </p>
                )}
                {parseInt(selectionCount) > 100 && parseInt(selectionCount) <= 500 && (
                  <p className="text-xs text-blue-600 mt-1">
                    ⚡ Will use parallel batch approach
                  </p>
                )}
                {parseInt(selectionCount) > 50 && parseInt(selectionCount) <= 100 && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚡ Will use parallel approach
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
            totalRecords={viewingSelected ? selectedArtworks.size : totalRecords}
            onPageChange={onPageChange}
            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate={viewingSelected ? 
              `Showing {first} to {last} of ${selectedArtworks.size} selected artworks` : 
              "Showing {first} to {last} of {totalRecords} artworks"
            }
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
            <div>
              <strong>Cache Hits:</strong> {performanceMetrics.current.cacheHits}
            </div>
            <div>
              <strong>Cache Misses:</strong> {performanceMetrics.current.cacheMisses}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default App;
