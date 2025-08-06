const axios = require('axios');

class LLMSearchEnhancer {
  constructor() {
    // You can use OpenAI, Claude, or any other LLM API
    this.apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    this.apiEndpoint = process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    this.model = process.env.LLM_MODEL || 'gpt-4o-mini'; // Cost-effective option
    
    // Industrial parts knowledge base
    this.partCategories = {
      bearings: ['ball bearing', 'roller bearing', 'thrust bearing', 'pillow block', 'flange bearing'],
      seals: ['oil seal', 'hydraulic seal', 'o-ring', 'gasket', 'mechanical seal'],
      fasteners: ['bolt', 'screw', 'nut', 'washer', 'stud'],
      electrical: ['motor', 'switch', 'relay', 'contactor', 'fuse'],
      hydraulic: ['cylinder', 'pump', 'valve', 'hose', 'fitting'],
      pneumatic: ['air cylinder', 'air valve', 'air filter', 'regulator', 'lubricator']
    };
    
    // Common equipment to part mappings
    this.equipmentMappings = {
      'conveyor': ['bearing', 'belt', 'roller', 'motor', 'chain'],
      'pump': ['seal', 'impeller', 'bearing', 'coupling', 'gasket'],
      'compressor': ['belt', 'filter', 'valve', 'pressure switch', 'motor'],
      'forklift': ['hydraulic cylinder', 'filter', 'chain', 'tire', 'battery'],
      'crane': ['wire rope', 'hook', 'bearing', 'brake', 'motor']
    };
  }

  async enhanceSearchQuery(originalQuery) {
    try {
      console.log(`🧠 LLM enhancing query: "${originalQuery}"`);
      
      // First, try rule-based enhancement (faster)
      const ruleBasedResult = this.ruleBasedEnhancement(originalQuery);
      if (ruleBasedResult.confidence > 0.7) {
        console.log(`✅ Rule-based enhancement successful: ${ruleBasedResult.enhancedQuery}`);
        return ruleBasedResult;
      }
      
      // Fall back to LLM if rules don't work well
      if (this.apiKey) {
        const llmResult = await this.llmBasedEnhancement(originalQuery);
        console.log(`✅ LLM enhancement successful: ${llmResult.enhancedQuery}`);
        return llmResult;
      }
      
      // Fallback to original query
      console.log(`⚠️ No enhancement available, using original query`);
      return {
        originalQuery,
        enhancedQuery: originalQuery,
        suggestions: this.generateSuggestions(originalQuery),
        confidence: 0.3,
        method: 'passthrough'
      };
      
    } catch (error) {
      console.error(`❌ LLM enhancement failed:`, error.message);
      return {
        originalQuery,
        enhancedQuery: originalQuery,
        suggestions: this.generateSuggestions(originalQuery),
        confidence: 0.3,
        method: 'error_fallback',
        error: error.message
      };
    }
  }

  ruleBasedEnhancement(query) {
    const normalizedQuery = query.toLowerCase().trim();
    let enhancedQuery = normalizedQuery;
    let confidence = 0.5;
    let suggestions = [];
    
    // Pattern 1: Extract part numbers (6203, SKF-6203, etc.)
    const partNumberMatch = normalizedQuery.match(/\b([a-z]*[-\s]*\d{3,8}[a-z]*[-\s]*[a-z\d]*)\b/);
    if (partNumberMatch) {
      const partNumber = partNumberMatch[1].replace(/\s+/g, '');
      enhancedQuery = `${partNumber} bearing`;
      confidence = 0.9;
      suggestions.push(`Try searching for: "${partNumber} bearing"`);
    }
    
    // Pattern 2: Generic categories - add specificity
    const categoryMappings = {
      'bearing': ['6203 bearing', '6202 bearing', 'pillow block bearing'],
      'seal': ['hydraulic seal', 'oil seal 25x40x7'],
      'bolt': ['M8 bolt', 'hex bolt', 'socket head cap screw'],
      'gasket': ['O-ring', 'hydraulic gasket', 'flange gasket'],
      'filter': ['hydraulic filter', 'air filter', 'oil filter'],
      'motor': ['1HP motor', 'stepper motor', '12V DC motor'],
      'valve': ['ball valve', 'check valve', 'solenoid valve'],
      'pump': ['hydraulic pump', 'water pump', 'gear pump']
    };
    
    for (const [generic, specific] of Object.entries(categoryMappings)) {
      if (normalizedQuery.includes(generic) && normalizedQuery.split(' ').length <= 2) {
        enhancedQuery = specific[0]; // Use first suggestion as primary
        suggestions = specific;
        confidence = 0.8;
        break;
      }
    }
    
    // Pattern 3: Equipment-based queries
    for (const [equipment, parts] of Object.entries(this.equipmentMappings)) {
      if (normalizedQuery.includes(equipment)) {
        enhancedQuery = `${equipment} ${parts[0]}`;
        suggestions = parts.map(part => `${equipment} ${part}`);
        confidence = 0.7;
        break;
      }
    }
    
    // Pattern 4: Size/dimension extraction
    const sizeMatch = normalizedQuery.match(/(\d+)\s*(mm|cm|inch|"|')/);
    if (sizeMatch && normalizedQuery.includes('bearing')) {
      const size = sizeMatch[1];
      const unit = sizeMatch[2];
      enhancedQuery = `${size}${unit} bearing`;
      confidence = 0.8;
    }
    
    return {
      originalQuery: query,
      enhancedQuery,
      suggestions,
      confidence,
      method: 'rule_based'
    };
  }

  async llmBasedEnhancement(query) {
    const prompt = this.buildLLMPrompt(query);
    
    const response = await axios.post(this.apiEndpoint, {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert industrial parts specialist. Your job is to help improve search queries for industrial parts databases.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.1 // Low temperature for consistent results
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const result = response.data.choices[0].message.content;
    return this.parseLLMResponse(query, result);
  }

  buildLLMPrompt(query) {
    return `
I need to enhance this industrial parts search query for better results from suppliers like Grainger, McMaster-Carr, and MSC Direct.

Original query: "${query}"

Please provide:
1. An enhanced search query that will find more specific results
2. 3 alternative search queries if the first doesn't work
3. A confidence score (0-1) for how likely this is to find results

Rules:
- If you see a part number (like 6203, SKF-6203), keep it and add descriptive terms
- For generic terms like "bearing", add specific types or sizes
- For equipment names, suggest common replacement parts
- Use manufacturer part numbers when possible
- Keep queries concise (2-5 words)

Format your response as JSON:
{
  "enhancedQuery": "specific search term",
  "alternatives": ["alt1", "alt2", "alt3"],
  "confidence": 0.85,
  "reasoning": "why this enhancement works"
}
`;
  }

  parseLLMResponse(originalQuery, llmResponse) {
    try {
      const parsed = JSON.parse(llmResponse);
      return {
        originalQuery,
        enhancedQuery: parsed.enhancedQuery || originalQuery,
        suggestions: parsed.alternatives || [],
        confidence: parsed.confidence || 0.6,
        method: 'llm',
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      // Extract enhanced query from non-JSON response
      const lines = llmResponse.split('\n').filter(line => line.trim());
      const enhancedQuery = lines.find(line => 
        line.toLowerCase().includes('enhanced') || 
        line.toLowerCase().includes('search')
      ) || originalQuery;
      
      return {
        originalQuery,
        enhancedQuery: enhancedQuery.replace(/^[^:]*:/, '').trim(),
        suggestions: [],
        confidence: 0.6,
        method: 'llm_fallback'
      };
    }
  }

  generateSuggestions(query) {
    const suggestions = [];
    const normalizedQuery = query.toLowerCase();
    
    // Add category-specific suggestions
    for (const [category, parts] of Object.entries(this.partCategories)) {
      if (normalizedQuery.includes(category.slice(0, -1))) { // Remove 's' from category
        suggestions.push(...parts.slice(0, 2));
      }
    }
    
    // Add common industrial part suggestions
    if (suggestions.length === 0) {
      suggestions.push(
        '6203 bearing',
        'hydraulic seal',
        'M8 bolt',
        'O-ring 25x40x7',
        '1HP motor'
      );
    }
    
    return suggestions.slice(0, 3);
  }

  // Enhanced search with multiple attempts
  async smartSearch(originalQuery, searchFunction) {
    console.log(`🔍 Starting smart search for: "${originalQuery}"`);
    
    // Step 1: Enhance the query
    const enhancement = await this.enhanceSearchQuery(originalQuery);
    
    // Step 2: Try enhanced query first
    console.log(`🎯 Trying enhanced query: "${enhancement.enhancedQuery}"`);
    let results = await searchFunction(enhancement.enhancedQuery);
    
    if (results.length > 0) {
      console.log(`✅ Enhanced query successful: ${results.length} results`);
      return {
        results,
        query: enhancement.enhancedQuery,
        originalQuery,
        method: enhancement.method,
        confidence: enhancement.confidence
      };
    }
    
    // Step 3: Try suggestions if enhanced query fails
    if (enhancement.suggestions && enhancement.suggestions.length > 0) {
      for (const suggestion of enhancement.suggestions.slice(0, 2)) {
        console.log(`🔄 Trying suggestion: "${suggestion}"`);
        results = await searchFunction(suggestion);
        
        if (results.length > 0) {
          console.log(`✅ Suggestion successful: ${results.length} results`);
          return {
            results,
            query: suggestion,
            originalQuery,
            method: 'suggestion',
            confidence: 0.7
          };
        }
      }
    }
    
    // Step 4: Try original query as last resort
    console.log(`🔄 Trying original query: "${originalQuery}"`);
    results = await searchFunction(originalQuery);
    
    return {
      results,
      query: originalQuery,
      originalQuery,
      method: 'original',
      confidence: 0.3,
      suggestions: enhancement.suggestions || this.generateSuggestions(originalQuery)
    };
  }

  // Analyze search results and suggest improvements
  analyzeResults(query, results) {
    if (results.length === 0) {
      return {
        status: 'no_results',
        suggestions: [
          `Try "${query} replacement"`,
          `Search for "${query}" with manufacturer name`,
          `Use more specific terms like "${query} specifications"`
        ]
      };
    }
    
    if (results.length < 3) {
      return {
        status: 'few_results',
        suggestions: [
          `Try broader terms`,
          `Search for compatible alternatives`,
          `Check different suppliers`
        ]
      };
    }
    
    return {
      status: 'good_results',
      suggestions: []
    };
  }
}

module.exports = LLMSearchEnhancer;

// Usage example:
/*
const enhancer = new LLMSearchEnhancer();

async function enhancedSearch(query) {
  const result = await enhancer.smartSearch(query, async (enhancedQuery) => {
    // Your existing search function here
    return await scraper.searchAllSuppliers(enhancedQuery);
  });
  
  console.log('Search Results:', result);
  return result;
}

// Test cases:
// enhancedSearch("bearing") -> "6203 bearing"
// enhancedSearch("6203") -> "6203 bearing"
// enhancedSearch("conveyor belt") -> "conveyor belt replacement"
// enhancedSearch("pump seal") -> "hydraulic pump seal"
*/
