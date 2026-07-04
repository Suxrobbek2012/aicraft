import axios from 'axios'

export interface SearchResult {
  title: string
  link: string
  snippet: string
}

export class SearchService {
  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        }
      )

      const html = response.data as string
      return this.parseHtml(html).slice(0, 5) // Return top 5 results
    } catch (error) {
      console.error('Search error:', error)
      return []
    }
  }

  private parseHtml(html: string): SearchResult[] {
    const results: SearchResult[] = []

    // DuckDuckGo HTML results are grouped in divs with web-result class
    const resultBlocks = html.split('<div class="result results_links results_links_deep web-result')
    for (let i = 1; i < resultBlocks.length; i++) {
      const block = resultBlocks[i].split('</div></div>')[0]

      // Extract title/link
      const titleMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
      // Extract snippet description
      const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)

      if (titleMatch) {
        let link = titleMatch[1]
        // Decode DDG redirect URL wrapper if present
        if (link.includes('uddg=')) {
          const match = link.match(/uddg=([^&]+)/)
          if (match) {
            link = decodeURIComponent(match[1])
          }
        }

        const title = this.cleanHtml(titleMatch[2])
        const snippet = snippetMatch ? this.cleanHtml(snippetMatch[1]) : ''

        if (title && link) {
          results.push({ title, link, snippet })
        }
      }
    }

    return results
  }

  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // strip any residual html tag
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }
}
