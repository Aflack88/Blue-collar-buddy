"use client";

import React, { useState, useRef } from 'react';
import { Search, Camera, Mic, MicOff, ShoppingCart, ExternalLink, Star, Clock, MapPin, DollarSign, Zap, CheckCircle, AlertCircle } from 'lucide-react';

const BlueCollarAI = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [userCredits, setUserCredits] = useState(8); // Free tier starts with 10, user has used 2
  const fileInputRef = useRef(null);

  // Sample parts database - in production this would be your PostgreSQL database
  const samplePartsDB = [
    {
      id: 1,
      partNumber: '6203-2Z',
      name: 'SKF Deep Groove Ball Bearing',
      category: 'Bearings',
      dimensions: '17x40x12mm',
      specs: {
        loadRating: '9.56kN',
        speed: '24,000 RPM',
        type: 'Deep Groove Ball Bearing'
      },
      suppliers: [
        { name: 'Grainger', price: 12.45, inStock: true, shipping: 'Same Day', url: '#' },
        { name: 'McMaster-Carr', price: 11.80, inStock: true, shipping: '2-Day', url: '#' },
        { name: 'MSC Industrial', price: 13.20, inStock: true, shipping: 'Next Day', url: '#' }
      ],
      alternatives: [
        { partNumber: 'TIMKEN-203PP', name: 'Timken 203PP', price: 9.34, savings: 25 },
        { partNumber: 'NTN-6203LLU', name: 'NTN 6203LLU Premium', price: 15.20, premium: true },
        { partNumber: 'GENERIC-6203ZZ', name: 'Generic 6203-ZZ', price: 7.50, budget: true }
      ],
      equipment: [
        'Caterpillar 3516 Engine (Drive Belt)',
        'Carrier 30GT Chiller (Compressor)',
        'Trane CVHF Chiller (Motor)',
        'York YK Centrifugal Chiller',
        'Sullair 185 Compressor'
      ]
    },
    {
      id: 2,
      partNumber: 'RG-1250',
      name: 'Radiator Gasket - DRC Heat Transfer',
      category: 'Gaskets & Seals',
      dimensions: '12" x 8" x 0.125"',
      specs: {
        material: 'Nitrile Rubber',
        tempRange: '-40°F to 250°F',
        pressure: '150 PSI'
      },
      suppliers: [
        { name: 'DRC Direct', price: 24.50, inStock: true, shipping: 'Same Day', url: '#' },
        { name: 'Grainger', price: 28.75, inStock: false, shipping: '3-5 Days', url: '#' },
        { name: 'Industrial Parts Co', price: 22.00, inStock: true, shipping: 'Next Day', url: '#' }
      ],
      alternatives: [
        { partNumber: 'FELPRO-RG1250', name: 'Fel-Pro Equivalent', price: 19.50, savings: 20 },
        { partNumber: 'VICTOR-RG1250', name: 'Victor Gasket', price: 21.25, savings: 13 }
      ],
      equipment: [
        'CAT 3512 Radiator',
        'Cummins QSK19 Cooling System',
        'Detroit Diesel Series 60',
        'Caterpillar C15 Engine',
        'Volvo D13 Engine'
      ]
    }
  ];

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setUserCredits(prev => Math.max(0, prev - 1)); // Consume one credit
    
    // Simulate API call delay
    setTimeout(() => {
      const results = samplePartsDB.filter(part => 
        part.partNumber.toLowerCase().includes(query.toLowerCase()) ||
        part.name.toLowerCase().includes(query.toLowerCase()) ||
        part.category.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
      setIsLoading(false);
    }, 800);
  };

  const handleVoiceSearch = () => {
    if (!isListening) {
      setIsListening(true);
      // Simulate voice recognition
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
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        // Simulate image recognition
        setTimeout(() => {
          setSearchQuery('6203-2Z bearing');
          handleSearch('6203-2Z bearing');
        }, 1500);
      };
      reader.readAsDataURL(file);
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

        {/* Quick Access Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Bearings', query: '6203 bearing' },
            { label: 'Gaskets', query: 'RG-1250' },
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
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Dimensions</div>
                    <div className="font-mono text-white">{part.dimensions}</div>
                  </div>
                </div>

                {/* Specifications */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-700 rounded-lg">
                  {Object.entries(part.specs).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-sm text-gray-400">{key}</div>
                      <div className="text-white font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Suppliers */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-green-400" />
                    Price Comparison
                  </h4>
                  <div className="grid gap-3">
                    {part.suppliers.map((supplier, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="font-medium text-white">{supplier.name}</div>
                          <div className="flex items-center space-x-2 text-sm text-gray-300">
                            {supplier.inStock ? (
                              <><CheckCircle className="h-4 w-4 text-green-400" /> In Stock</>
                            ) : (
                              <><AlertCircle className="h-4 w-4 text-red-400" /> Out of Stock</>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">{supplier.shipping}</div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl font-bold text-green-400">${supplier.price}</div>
                          <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
                            <ExternalLink className="h-4 w-4" />
                            <span>Buy Now</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alternatives */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3">Compatible Alternatives</h4>
                  <div className="grid gap-2">
                    {part.alternatives.map((alt, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div>
                          <span className="font-medium text-white">{alt.name}</span>
                          <span className="ml-2 text-sm text-gray-400">({alt.partNumber})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400 font-bold">${alt.price}</span>
                          {alt.savings && (
                            <span className="text-xs bg-green-600 px-2 py-1 rounded-full">
                              {alt.savings}% off
                            </span>
                          )}
                          {alt.premium && (
                            <span className="text-xs bg-yellow-600 px-2 py-1 rounded-full">
                              Premium
                            </span>
                          )}
                          {alt.budget && (
                            <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">
                              Budget
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Equipment Compatibility */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Fits Equipment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
        {searchResults.length === 0 && searchQuery && !isLoading && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-300 text-lg">No parts found for &quot;{searchQuery}&quot;</p>
            <p className="text-gray-400 text-sm mt-2">Try a different part number or equipment model</p>
          </div>
        )}

        {/* Credit Warning */}
        {userCredits <= 2 && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg max-w-sm">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Low Credits!</span>
            </div>
            <p className="text-sm mt-1">You have {userCredits} searches left. Upgrade to Pro for unlimited searches.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueCollarAI;