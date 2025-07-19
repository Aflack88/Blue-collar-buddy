import React, { useState, useRef } from 'react';
import { Search, Camera, Mic, MicOff, ExternalLink, DollarSign, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://blue-collar-buddy-production.up.railway.app'
    : 'http://localhost:3001');

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userCredits, setUserCredits] = useState(8);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError('');
    setUserCredits(prev => Math.max(0, prev - 1));
    
    try {
      console.log(`Searching for: ${query}`);
      console.log(`API URL: ${API_BASE_URL}/api/search`);
      
      const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }
      
      console.log('API Response:', data);
      
      // Transform backend data to match frontend format
      const transformedResults = data.results.map((part, index) => ({
        id: index + 1,
        partNumber: part.partNumber,
        name: part.name,
        category: 'Industrial Parts',
        dimensions: part.dimensions || 'Contact supplier for specifications',
        specs: {
          supplier: part.supplier,
          availability: part.availability || 'Available',
          lastUpdated: part.lastUpdated
        },
        suppliers: [{
          name: part.supplier,
          price: part.price || 0,
          inStock: part.inStock !== false,
          shipping: 'Contact Supplier',
          url: part.productUrl || '#'
        }],
        alternatives: [],
        equipment: ['Equipment compatibility data coming soon']
      }));
      
      setSearchResults(transformedResults);
      
    } catch (error) {
      console.error('Search failed:', error);
      setError(`Search failed: ${error.message}`);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSearch = () => {
    if (!isListening) {
      setIsListening(true);
      setTimeout(() => {
        setSearchQuery('6203 bearing');
        setIsListening(false);
        handleSearch('6203 bearing');
      }, 2000);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Simulate image recognition
      setTimeout(() => {
        setSearchQuery('6203-2Z bearing');
        handleSearch('6203-2Z bearing');
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Blue Collar AI
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-slate-700 px-3 py-1 rounded-full text-sm">
              <span className="text-gray-300">Credits: </span>
              <span className={`font-bold ${userCredits <= 2 ? 'text-red-400' : 'text-green-400'}`}>
                {userCredits}
              </span>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Upgrade Pro
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4">
            Find the Right Part in <span className="text-blue-400">Seconds</span>
          </h2>
          <p className="text-xl text-gray-300 mb-6">
            Stop wasting 25% of your time searching. Get instant part identification, pricing, and availability.
          </p>
          {API_BASE_URL.includes('your-railway-url') && (
            <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
              ⚠️ Please update the API_BASE_URL in src/App.js with your actual Railway URL
            </div>
          )}
        </div>

        {/* Search Interface */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8 border border-slate-700">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Enter part number, equipment model, or description..."
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              />
            </div>
            <button
              onClick={() => handleSearch(searchQuery)}
              disabled={isLoading || userCredits === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
            >
              <Camera className="h-5 w-5" />
              <span>Photo ID</span>
            </button>
            <button
              onClick={handleVoiceSearch}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              <span>{isListening ? 'Listening...' : 'Voice Search'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Quick Access Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Bearings', query: '6203 bearing' },
            { label: 'Gaskets', query: 'hydraulic gasket' },
            { label: 'Fasteners', query: 'M8 bolt' },
            { label: 'Seals', query: 'oil seal' }
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => handleSearch(item.query)}
              className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg text-center transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-6">
            {searchResults.map((part) => (
              <div key={part.id} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{part.name}</h3>
                    <p className="text-gray-300 mb-1">Part #: <span className="font-mono text-blue-400">{part.partNumber}</span></p>
                    <p className="text-gray-300">Category: {part.category}</p>
                  </div>
                </div>

                {/* Suppliers */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-green-400" />
                    Supplier Information
                  </h4>
                  <div className="grid gap-3">
                    {part.suppliers.map((supplier, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="font-medium text-white">{supplier.name}</div>
                          <div className="flex items-center space-x-2 text-sm text-gray-300">
                            {supplier.inStock ? (
                              <><CheckCircle className="h-4 w-4 text-green-400" /> Available</>
                            ) : (
                              <><AlertCircle className="h-4 w-4 text-red-400" /> Check Availability</>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {supplier.price > 0 && (
                            <div className="text-2xl font-bold text-green-400">${supplier.price}</div>
                          )}
                          <a
                            href={supplier.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span>View Details</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Equipment Compatibility */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Equipment Information</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {part.equipment.map((equipment, index) => (
                      <div key={index} className="p-2 bg-slate-700 rounded text-sm text-gray-300">
                        {equipment}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {searchResults.length === 0 && searchQuery && !isLoading && !error && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-300 text-lg">No parts found for "{searchQuery}"</p>
            <p className="text-gray-400 text-sm mt-2">Try a different part number or equipment model</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
