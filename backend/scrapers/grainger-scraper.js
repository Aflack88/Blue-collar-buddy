const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

class GraingerPriceScraper {
  constructor() {
    this.browser = null;
    this.baseUrl = 'https://www.grainger.com';
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
    
    // Enhanced selectors based on current Grainger DOM structure
    this.selectors = {
      // Product containers - ordered by reliability
      productContainer: [
        '[data-automation-id="product-tile"]',
        'article[data-testid="product-tile"]',
        '.ProductTile',
        '.search-result-item',
        '.product-tile'
      ],
      
      // Price selectors - multiple fallbacks
      price: [
        '[data-automation-id="product-price"] .price-value',
        '[data-automation-id="product-price"]',
        '.price-current',
        '.price-value',
        '.product-price .price',
        '.price-display',
        '[data-testid="price"]',
        '.price'
      ],
      
      // Part number selectors
      partNumber: [
        '[data-automation-id="product-item-number"]',
        '.item-number',
        '.product-number',
        '[data-testid="item-number"]'
      ],
      
      // Product name selectors
      productName: [
        '[data-automation-id="product-title"] a',
        '[data-automation-id="product-title"]',
        'h3[data-testid="product-title"]',
        '.product-title a',
        '.product-title'
      ],
      
      // Availability selectors
      availability: [
        '[data-automation-id="product-availability"]',
        '.availability-status',
        '.stock-status',
        '.availability'
      ],
      
      // Quantity pricing table (for bulk pricing)
      quantityPricing: [
        '.quantity-pricing-table tbody tr',
        '.tier-pricing tbody tr',
        '.price-break-table tbody tr'
      ]
    };
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
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
          '--disable-ipc-flooding-protection',
          '--window-size=1366,768'
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

  // Fast Axios-based scraping (primary method)
  async getPricesWithAxios(query, maxResults = 10) {
    const searchUrl = `${this.baseUrl}/search?searchQuery=${encodeURIComponent(query)}`;
    
    try {
      console.log(`🌐 Grainger Axios price check: ${query}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000,
        maxRedirects: 3
      });

      return this.parseHTMLForPrices(response.data, maxResults);
      
    } catch (error) {
      console.error(`❌ Axios failed for Grainger:`, error.message);
      throw error;
    }
  }

  // Puppeteer-based scraping (fallback method)
  async getPricesWithPuppeteer(query, maxResults = 10) {
    const searchUrl = `${this.baseUrl}/search?searchQuery=${encodeURIComponent(query)}`;
    let page;

    try {
      console.log(`🤖 Grainger Puppeteer price check: ${query}`);
      
      const browser = await this.initBrowser();
      page = await browser.newPage();
      
      // Set realistic browser profile
      await page.setUserAgent(this.getRandomUserAgent());
      await page.setViewport({ width: 1366, height: 768 });
      
      // Block unnecessary resources for speed
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate with retry logic
      let retries = 2;
      while (retries > 0) {
        try {
          await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
          });
          break;
        } catch (e) {
          retries--;
          if (retries === 0) throw e;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Wait for products to load
      await this.waitForProducts(page);

      // Extract pricing data
      const results = await this.extractPricingData(page, maxResults);
      
      return results;

    } catch (error) {
      console.error(`❌ Puppeteer failed for Grainger:`, error.message);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async waitForProducts(page) {
    // Try multiple selectors to wait for product containers
    for (const selector of this.selectors.productContainer) {
      try {
        await page.waitForSelector(selector, { timeout: 8000 });
        console.log(`✅ Found products with selector: ${selector}`);
        return;
      } catch (e) {
        continue;
      }
    }
    throw new Error('No product containers found on Grainger page');
  }

  async extractPricingData(page, maxResults) {
    return await page.evaluate((selectors, maxResults) => {
      const products = [];
      
      // Find product containers
      let containers = [];
      for (const selector of selectors.productContainer) {
        containers = document.querySelectorAll(selector);
        if (containers.length > 0) break;
      }

      containers.forEach((container, index) => {
        if (index >= maxResults) return;
        
        const getTextBySelectors = (selectorArray) => {
          for (const selector of selectorArray) {
            const element = container.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return '';
        };

        const getAttributeBySelectors = (selectorArray, attribute) => {
          for (const selector of selectorArray) {
            const element = container.querySelector(selector);
            if (element && element.getAttribute(attribute)) {
              return element.getAttribute(attribute);
            }
          }
          return '';
        };

        // Extract core data
        const partNumber = getTextBySelectors(selectors.partNumber);
        const productName = getTextBySelectors(selectors.productName);
        const priceText = getTextBySelectors(selectors.price);
        const availability = getTextBySelectors(selectors.availability);
        
        // Get product URL
        const linkElement = container.querySelector('a[href*="/product/"]');
        const productUrl = linkElement ? linkElement.href : '';

        if (partNumber && productName && priceText) {
          products.push({
            partNumber,
            productName,
            priceText,
            availability,
            productUrl,
            containerHTML: container.outerHTML.substring(0, 500) // Debug info
          });
        }
      });

      return products;
    }, this.selectors, maxResults);
  }

  parseHTMLForPrices(html, maxResults) {
    const $ = cheerio.load(html);
    const results = [];

    // Try each container selector
    for (const containerSelector of this.selectors.productContainer) {
      const containers = $(containerSelector);
      
      if (containers.length > 0) {
        console.log(`📋 Found ${containers.length} products with: ${containerSelector}`);
        
        containers.each((index, element) => {
          if (index >= maxResults) return false;
          
          const $container = $(element);
          
          const getTextBySelectors = (selectors) => {
            for (const selector of selectors) {
              const text = $container.find(selector).first().text().trim();
              if (text) return text;
            }
            return '';
          };

          const partNumber = getTextBySelectors(this.selectors.partNumber);
          const productName = getTextBySelectors(this.selectors.productName);
          const priceText = getTextBySelectors(this.selectors.price);
          const availability = getTextBySelectors(this.selectors.availability);
          
          // Get product URL
          const productLink = $container.find('a[href*="/product/"]').first().attr('href');
          const productUrl = productLink ? `${this.baseUrl}${productLink}` : '';

          if (partNumber && productName && priceText) {
            results.push({
              partNumber,
              productName,
              priceText,
              availability,
              productUrl
            });
          }
        });
        break; // Stop after finding results with first working selector
      }
    }

    return this.normalizeResults(results);
  }

  normalizeResults(results) {
    return results.map(item => {
      const price = this.parsePrice(item.priceText);
      
      return {
        partNumber: item.partNumber,
        name: item.productName,
        price: price,
        priceText: item.priceText,
        availability: item.availability || 'Contact supplier',
        inStock: this.parseAvailability(item.availability),
        supplier: 'grainger',
        productUrl: item.productUrl,
        lastUpdated: new Date().toISOString(),
        confidence: this.calculateConfidence(item)
      };
    });
  }

  parsePrice(priceText) {
    if (!priceText) return null;
    
    // Handle various price formats
    const patterns = [
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,  // $123.45 or $1,234.56
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)/i,  // 123.45 USD
      /Price:\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i  // Price: $123.45
    ];
    
    for (const pattern of patterns) {
      const match = priceText.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }
    
    return null;
  }

  parseAvailability(availabilityText) {
    if (!availabilityText) return true;
    
    const text = availabilityText.toLowerCase();
    const unavailableKeywords = [
      'out of stock', 'discontinued', 'unavailable', 
      'backordered', 'special order', 'not available'
    ];
    
    return !unavailableKeywords.some(keyword => text.includes(keyword));
  }

  calculateConfidence(item) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on data quality
    if (item.priceText && this.parsePrice(item.priceText)) confidence += 0.3;
    if (item.partNumber && item.partNumber.length > 3) confidence += 0.1;
    if (item.productUrl) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  // Main public method - attempts Axios first, falls back to Puppeteer
  async getLivePrices(query, maxResults = 10) {
    if (!query || query.trim().length < 2) {
      throw new Error('Query must be at least 2 characters');
    }

    console.log(`🔍 Starting Grainger price lookup for: "${query}"`);
    
    try {
      // Try fast Axios method first
      const results = await this.getPricesWithAxios(query, maxResults);
      
      if (results.length > 0) {
        console.log(`✅ Axios successful: ${results.length} results`);
        return results;
      }
      
      console.log(`⚠️ Axios returned no results, trying Puppeteer...`);
      
      // Fall back to Puppeteer
      const puppeteerResults = await this.getPricesWithPuppeteer(query, maxResults);
      console.log(`✅ Puppeteer successful: ${puppeteerResults.length} results`);
      
      return puppeteerResults;
      
    } catch (error) {
      console.error(`❌ All Grainger methods failed:`, error.message);
      throw new Error(`Grainger price lookup failed: ${error.message}`);
    }
  }

  // Get detailed pricing for a specific part number
  async getDetailedPricing(partNumber) {
    try {
      const results = await this.getLivePrices(partNumber, 1);
      
      if (results.length === 0) {
        return null;
      }
      
      const product = results[0];
      
      // If we have a product URL, we could scrape the product page for quantity pricing
      // For now, return the basic pricing info
      return {
        ...product,
        quantityPricing: [], // Could be enhanced to scrape qty breaks
        specifications: {}, // Could be enhanced to scrape specs
        images: [] // Could be enhanced to scrape images
      };
      
    } catch (error) {
      console.error(`❌ Detailed pricing failed for ${partNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = GraingerPriceScraper;

// Usage example:
/*
const scraper = new GraingerPriceScraper();

async function testGraingerPrices() {
  try {
    // Basic price lookup
    const results = await scraper.getLivePrices('6203 bearing', 5);
    console.log('Results:', results);
    
    // Detailed pricing for specific part
    const detailed = await scraper.getDetailedPricing('6203-2Z');
    console.log('Detailed:', detailed);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await scraper.closeBrowser();
  }
}

// testGraingerPrices();
*/
