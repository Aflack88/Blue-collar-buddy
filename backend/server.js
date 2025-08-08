const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer');

// Import specialized scrapers
const GraingerPriceScraper = require('./scrapers/grainger-scraper');
const LLMSearchEnhancer = require('./scrapers/llm-search-enhancer');

const app = express();
app.set('trust proxy', true);
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://blue-collar-buddy-git-main-aidans-projects-ae1d702a.vercel.app',
    'https://*.vercel.app',
    'https://blue-collar-ai.vercel.app',
    'https://your-vercel-domain.vercel.app',
    // Dynamic environment-based CORS
    process.env.NODE_ENV === 'production' 
      ? ['https://*.vercel.app', 'https://blue-collar-ai.vercel.app']
      : ['http://localhost:3000', 'http://localhost:3001']
  ].flat(),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Rate limiting - production ready
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Enhanced scraping configurations
const SCRAPING_CONFIG = {
  timeout: 30000,
  maxRetries: 2,
  retryDelay: 3000,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
};

// Supplier configurations (excluding Grainger - handled by specialized scraper)
const SUPPLIERS = {
  mcmaster: {
    baseUrl: 'https://www.mcmaster.com',
    searchPath: '/search',
    selectors: {
      productContainer: [
        '.ProductTableRow',
        'tr[data-testid="product-row"]',
        '.product-row'
      ],
      partNumber: [
        '.PartNumber',
        '.part-number',
        'td:first-child'
      ],
      productName: [
        '.ProductDescription',
        '.description',
        'td:nth-child(2)'
      ],
      price: [
        '.Price',
        '.price',
        '.cost'
      ]
    }
  },
  mscdirect: {
    baseUrl: 'https://www.mscdirect.com',
    searchPath: '/browse/search',
    selectors: {
      productContainer: [
        '.product-tile',
        '.search-result'
      ],
      partNumber: [
        '.product-number',
        '.item-number'
      ],
      productName: [
        '.product-title',
        '.product-name'
      ],
      price: [
        '.price',
        '.product-price'
      ]
    }
  }
};

class ProductScraper {
  constructor() {
    this.browser = null;
    this.activeSessions = 0;
    this.maxConcurrentSessions = 3;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--memory-pressure-off',
          '--disable-background-timer-throttling',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ]
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getRandomUserAgent() {
    return SCRAPING_CONFIG.userAgents[Math.floor(Math.random() * SCRAPING_CONFIG.userAgents.length)];
  }

  async scrapeWithAxios(supplier, query) {
    const config = SUPPLIERS[supplier];
    const searchUrl = `${config.baseUrl}${config.searchPath}?searchQuery=${encodeURIComponent(query)}`;
    
    try {
      console.log(`🌐 Axios scraping ${supplier}: ${query}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: SCRAPING_CONFIG.timeout
      });

      return this.parseHTML(response.data, config, supplier);
    } catch (error) {
      console.error(`❌ Axios scraping failed for ${supplier}:`, error.message);
      return [];
    }
  }

  async scrapeWithPuppeteer(supplier, query) {
    if (this.activeSessions >= this.maxConcurrentSessions) {
      throw new Error('Maximum concurrent sessions reached');
    }

    const config = SUPPLIERS[supplier];
    const searchUrl = `${config.baseUrl}${config.searchPath}?searchQuery=${encodeURIComponent(query)}`;
    
    let page;
    this.activeSessions++;

    try {
      console.log(`🤖 Puppeteer scraping ${supplier}: ${query}`);
      
      const browser = await this.initBrowser();
      page = await browser.newPage();
      
      await page.setUserAgent(this.getRandomUserAgent());
      await page.setViewport({ 
        width: 1366 + Math.floor(Math.random() * 200), 
        height: 768 + Math.floor(Math.random() * 200) 
      });

      // Block unnecessary resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate with random delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: SCRAPING_CONFIG.timeout 
      });

      // Wait for product containers
      let foundSelector = null;
      for (const selector of config.selectors.productContainer) {
        try {
          await page.waitForSelector(selector, { timeout: 8000 });
          foundSelector = selector;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!foundSelector) {
        throw new Error(`No product containers found for ${supplier}`);
      }

      // Extract data
      const results = await page.evaluate((config, supplier) => {
        const products = [];
        const containers = document.querySelectorAll(config.selectors.productContainer[0]);
        
        containers.forEach((container, index) => {
          if (index >= 10) return; // Limit results
          
          const getTextBySelectors = (selectors) => {
            for (const selector of selectors) {
              const element = container.querySelector(selector);
              if (element && element.textContent.trim()) {
                return element.textContent.trim();
              }
            }
            return '';
          };

          const partNumber = getTextBySelectors(config.selectors.partNumber);
          const productName = getTextBySelectors(config.selectors.productName);
          const priceText = getTextBySelectors(config.selectors.price);
          const availability = getTextBySelectors(config.selectors.availability || []);

          if (partNumber && productName) {
            products.push({
              partNumber,
              productName,
              priceText,
              availability,
              supplier
            });
          }
        });

        return products;
      }, config, supplier);

      return this.normalizeResults(results, supplier);

    } catch (error) {
      console.error(`❌ Puppeteer scraping failed for ${supplier}:`, error.message);
      return [];
    } finally {
      if (page) {
        await page.close();
      }
      this.activeSessions--;
    }
  }

  parseHTML(html, config, supplier) {
    const $ = cheerio.load(html);
    const results = [];

    for (const containerSelector of config.selectors.productContainer) {
      const containers = $(containerSelector);
      
      if (containers.length > 0) {
        console.log(`📋 Found ${containers.length} products with selector: ${containerSelector}`);
        
        containers.each((index, element) => {
          if (index >= 10) return false; // Limit results
          
          const $container = $(element);
          const getTextBySelectors = (selectors) => {
            for (const selector of selectors) {
              const text = $container.find(selector).first().text().trim();
              if (text) return text;
            }
            return '';
          };

          const partNumber = getTextBySelectors(config.selectors.partNumber);
          const productName = getTextBySelectors(config.selectors.productName);
          const priceText = getTextBySelectors(config.selectors.price);
          const availability = getTextBySelectors(config.selectors.availability || []);

          if (partNumber && productName) {
            results.push({
              partNumber,
              productName,
              priceText,
              availability,
              supplier
            });
          }
        });
        break;
      }
    }

    return this.normalizeResults(results, supplier);
  }

  normalizeResults(results, supplier) {
    return results.map(item => ({
      partNumber: item.partNumber,
      name: item.productName,
      price: this.parsePrice(item.priceText),
      priceText: item.priceText,
      availability: item.availability || 'Contact supplier',
      inStock: this.parseAvailability(item.availability),
      supplier: supplier,
      productUrl: SUPPLIERS[supplier].baseUrl,
      lastUpdated: new Date().toISOString(),
      source: 'live_scraping'
    }));
  }

  parsePrice(priceText) {
    if (!priceText) return null;
    const match = priceText.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : null;
  }

  parseAvailability(availabilityText) {
    if (!availabilityText) return true;
    const text = availabilityText.toLowerCase();
    return !text.includes('out of stock') && 
           !text.includes('discontinued') && 
           !text.includes('unavailable');
  }

  // Updated method to work with a single query (used by LLM enhancer)
  async searchSingleQuery(query, maxResults = 10) {
    const searchPromises = [];
    const supplierNames = Object.keys(SUPPLIERS);
    
    // Add Grainger to the list since it's handled separately
    const allSuppliers = [...supplierNames, 'grainger'];
    
    for (const supplier of allSuppliers) {
      if (supplier === 'grainger') {
        // Use specialized Grainger scraper
        searchPromises.push(
          graingerScraper.getLivePrices(query, Math.ceil(maxResults / allSuppliers.length))
            .catch(error => {
              console.error(`Failed to scrape ${supplier}:`, error.message);
              return [];
            })
        );
      } else {
        // Use existing logic for other suppliers
        searchPromises.push(
          this.scrapeWithAxios(supplier, query)
            .then(results => results.length > 0 ? results : this.scrapeWithPuppeteer(supplier, query))
            .catch(error => {
              console.error(`Failed to scrape ${supplier}:`, error.message);
              return [];
            })
        );
      }
    }

    try {
      const allResults = await Promise.all(searchPromises);
      const combinedResults = allResults.flat();
      
      // Remove duplicates and limit results
      const uniqueResults = this.removeDuplicates(combinedResults);
      return uniqueResults.slice(0, maxResults);
      
    } catch (error) {
      console.error('Error in searchSingleQuery:', error);
      return [];
    }
  }

  // Enhanced search using LLM
  async searchAllSuppliers(query, maxResults = 10) {
    console.log(`🧠 Starting LLM-enhanced search for: "${query}"`);
    
    // Use LLM enhancer for smart search
    const searchResult = await llmEnhancer.smartSearch(query, async (enhancedQuery) => {
      return await this.searchSingleQuery(enhancedQuery, maxResults);
    });
    
    return searchResult.results;
  }

  removeDuplicates(results) {
    const seen = new Set();
    return results.filter(item => {
      const key = `${item.partNumber}-${item.name}`.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Initialize scrapers
const scraper = new ProductScraper();
const graingerScraper = new GraingerPriceScraper();
const llmEnhancer = new LLMSearchEnhancer();

// Cleanup on exit
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing browsers...');
  await scraper.closeBrowser();
  await graingerScraper.closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing browsers...');
  await scraper.closeBrowser();
  await graingerScraper.closeBrowser();
  process.exit(0);
});

// API Routes

// Enhanced search endpoint with LLM integration
app.get('/api/search', async (req, res) => {
  const { q: query, limit = 10 } = req.query;
  
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ 
      error: 'Query parameter must be at least 2 characters',
      example: '/api/search?q=6203%20bearing'
    });
  }

  console.log(`🔍 LLM-enhanced search: "${query}"`);
  
  try {
    // Use LLM enhancer for intelligent search
    const searchResult = await llmEnhancer.smartSearch(query, async (enhancedQuery) => {
      return await scraper.searchSingleQuery(enhancedQuery, parseInt(limit));
    });
    
    if (searchResult.results.length === 0) {
      return res.status(404).json({
        message: 'No parts found',
        query: searchResult.query,
        originalQuery: searchResult.originalQuery,
        enhancementMethod: searchResult.method,
        suggestions: searchResult.suggestions || [
          'Try a more specific part number',
          'Check spelling',
          'Use manufacturer part numbers when possible',
          'Try broader search terms'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ 
      results: searchResult.results,
      query: searchResult.query,
      originalQuery: searchResult.originalQuery,
      enhancementMethod: searchResult.method,
      confidence: searchResult.confidence,
      resultCount: searchResult.results.length,
      timestamp: new Date().toISOString(),
      searchMethod: 'llm_enhanced_scraping',
      suppliersSearched: ['grainger', ...Object.keys(SUPPLIERS)]
    });
    
  } catch (error) {
    console.error('❌ Search API error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message,
      query,
      timestamp: new Date().toISOString()
    });
  }
});

// Query enhancement endpoint (for testing LLM)
app.get('/api/enhance-query', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query) {
    return res.status(400).json({ 
      error: 'Query parameter required',
      example: '/api/enhance-query?q=bearing'
    });
  }
  
  try {
    console.log(`🧠 Testing query enhancement: "${query}"`);
    const enhancement = await llmEnhancer.enhanceSearchQuery(query);
    
    res.json({
      originalQuery: query,
      enhancement,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Query enhancement error:', error);
    res.status(500).json({ 
      error: 'Query enhancement failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for Grainger scraper specifically
app.get('/api/test-grainger', async (req, res) => {
  const { q: query, limit = 5 } = req.query;
  
  if (!query) {
    return res.status(400).json({ 
      error: 'Query parameter required',
      example: '/api/test-grainger?q=6203%20bearing'
    });
  }
  
  try {
    console.log(`🔧 Testing Grainger scraper: "${query}"`);
    const results = await graingerScraper.getLivePrices(query, parseInt(limit));
    
    res.json({ 
      results,
      query,
      resultCount: results.length,
      method: 'specialized_grainger_scraper',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Grainger test error:', error);
    res.status(500).json({ 
      error: 'Grainger scraper test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '4.0.0',
    features: [
      'LLM-Enhanced Search', 
      'Live Web Scraping', 
      'Multi-Supplier Support', 
      'Specialized Grainger Scraper',
      'Smart Query Enhancement',
      'No Sample Data'
    ],
    activeSessions: scraper.activeSessions,
    supportedSuppliers: ['grainger', ...Object.keys(SUPPLIERS)],
    llmEnhancerStatus: 'integrated',
    environmentVariables: {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasLLMKey: !!process.env.LLM_API_KEY,
      llmModel: process.env.LLM_MODEL || 'gpt-4o-mini'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Blue Collar AI Backend API - LLM-Enhanced Industrial Parts Search',
    version: '4.0.0',
    features: [
      'LLM-enhanced query processing', 
      'Live scraping only', 
      'Multi-supplier support', 
      'Specialized Grainger scraper',
      'Smart search suggestions',
      'Production-ready'
    ],
    supportedSuppliers: ['grainger', ...Object.keys(SUPPLIERS)],
    endpoints: {
      search: '/api/search?q=YOUR_QUERY',
      enhanceQuery: '/api/enhance-query?q=YOUR_QUERY',
      health: '/api/health',
      testGrainger: '/api/test-grainger?q=YOUR_QUERY'
    },
    examples: {
      generalSearch: '/api/search?q=bearing',
      enhancedQuery: '/api/enhance-query?q=bearing',
      graingerTest: '/api/test-grainger?q=6203%20bearing'
    },
    llmIntegration: {
      enabled: true,
      fallbackToRules: true,
      enhancesGenericQueries: true
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Blue Collar AI Backend v4.0 running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/api/health`);
  console.log(`🔍 Search example: http://localhost:${port}/api/search?q=bearing`);
  console.log(`🧠 Query enhancement: http://localhost:${port}/api/enhance-query?q=bearing`);
  console.log(`🏪 Grainger test: http://localhost:${port}/api/test-grainger?q=6203%20bearing`);
  console.log(`🎯 LLM-enhanced live scraping with smart query processing`);
  console.log(`🏪 Supported suppliers: grainger, ${Object.keys(SUPPLIERS).join(', ')}`);
  console.log(`🌐 Backend URL: https://blue-collar-buddy-production.up.railway.app`);
  
  // LLM configuration status
  const hasLLM = !!(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);
  console.log(`🧠 LLM Enhancement: ${hasLLM ? 'ENABLED' : 'RULE-BASED FALLBACK'}`);
  if (hasLLM) {
    console.log(`🤖 LLM Model: ${process.env.LLM_MODEL || 'gpt-4o-mini'}`);
  }
});
