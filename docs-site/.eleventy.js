// Eleventy configuration for the DVS trust framework GOV.UK-styled site.
//
// Design notes:
// - Input is the repository root (`..` from this config file's folder), so
//   Eleventy renders the existing Markdown in place. No content duplication.
// - The Eleventy scaffolding (layouts, includes, data, assets, node_modules)
//   lives under `docs-site/` so the rest of the repository is unchanged.
// - Permalinks use the file's path so URLs mirror the repo layout exactly.
//   README.md files become directory-index pages.
// - Cross-file `.md` links in the publication source are rewritten to pretty
//   URLs at output time via a transform, so they resolve on the rendered site
//   without changing the source files.

const markdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const fs = require('node:fs');
const path = require('node:path');
const govSpeakPlugin = require('./govspeak');

// BASEURL can be set by CI (e.g. from actions/configure-pages) to handle
// GitHub Pages subpath deploys. Trailing slashes are stripped so template
// concatenation like `{{ site.baseurl }}/assets/...` never produces doubles.
const BASEURL = (process.env.BASEURL || '').replace(/\/+$/, '');

module.exports = function (eleventyConfig) {
  // ---------------------------------------------------------------------------
  // Override baseurl in site data from env if provided
  // ---------------------------------------------------------------------------
  eleventyConfig.addGlobalData('site', () => {
    const site = require('./_data/site.json');
    return { ...site, baseurl: BASEURL || site.baseurl || '' };
  });

  // ---------------------------------------------------------------------------
  // Build-time asset preparation
  // ---------------------------------------------------------------------------
  // govuk-frontend's CSS references assets at absolute /assets/... paths.
  // For subpath deploys (e.g. user.github.io/dvs-trust-framework/) that would
  // resolve to the domain root and break. Rewrite those to ${BASEURL}/assets/
  // at build time so the CSS works everywhere.
  eleventyConfig.on('eleventy.before', async () => {
    const src = path.join(__dirname, 'node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.css');
    const dst = path.join(__dirname, '_site/stylesheets/govuk-frontend.min.css');
    if (!fs.existsSync(src)) return; // not yet installed; --serve first run
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    let css = fs.readFileSync(src, 'utf8');
    if (BASEURL) {
      css = css.replace(/url\(\/assets\//g, `url(${BASEURL}/assets/`);
    }
    fs.writeFileSync(dst, css);
  });

  // ---------------------------------------------------------------------------
  // Markdown pipeline
  // ---------------------------------------------------------------------------
  const md = markdownIt({
    html: true,          // pass inline HTML through (we use <a id="..."></a>)
    breaks: false,
    linkify: true,
    typographer: true
  }).use(markdownItAnchor, {
    // Generate IDs on headings automatically (in addition to our explicit
    // <a id="..."> anchors from the publication source) so the in-page TOC
    // has stable targets.
    permalink: false
  });

  // GOV.UK-publishing extensions: $CTA, $E, warning/notice blocks, heading
  // classes, govuk-body, govuk-inset-text, etc.
  md.use(govSpeakPlugin);

  eleventyConfig.setLibrary('md', md);

  // ---------------------------------------------------------------------------
  // Preprocessor — strip GitHub Alert labels (> [!CAUTION] etc.)
  // ---------------------------------------------------------------------------
  // GitHub Alerts render natively on github.com but not in plain markdown-it.
  // Strip the label line and let the remaining blockquote content render with
  // the govuk-inset-text class that the govspeak plugin applies to blockquotes.
  eleventyConfig.addPreprocessor('stripGithubAlerts', 'md', (data, content) => {
    return content.replace(/^> \[!(CAUTION|WARNING|IMPORTANT|NOTE|TIP)\]\s*\r?\n/gm, '');
  });

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  // Build a table of contents from rendered HTML headings.
  eleventyConfig.addFilter('toc', function (content) {
    if (!content) return [];
    const headingRegex = /<h([1-6])(?:\s+[^>]*?id="([^"]+)")?[^>]*>([\s\S]+?)<\/h[1-6]>/gi;
    const headings = [];
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = parseInt(match[1], 10);
      const explicitId = match[2];
      const rawText = match[3]
        .replace(/<a[^>]*>.*?<\/a>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
      if (!rawText) continue;
      const slug = explicitId || rawText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      headings.push({ level, text: rawText, slug });
    }
    return headings;
  });

  // ---------------------------------------------------------------------------
  // Transform — rewrite .md links to pretty URLs at output time
  // ---------------------------------------------------------------------------
  eleventyConfig.addTransform('rewriteMdLinks', function (content) {
    const outputPath = this.page && this.page.outputPath;
    if (!outputPath || !outputPath.endsWith('.html')) return content;
    // Rewrite href="...path/foo.md" or href="...path/foo.md#frag" to
    // href="...path/foo/" or href="...path/foo/#frag".
    // Skip external URLs.
    return content.replace(
      /href="(?!https?:)([^"#]+?)\.md(#[^"]*)?"/g,
      (_m, hrefPath, frag) => `href="${hrefPath}/${frag || ''}"`
    );
  });

  // ---------------------------------------------------------------------------
  // Passthrough copies
  // ---------------------------------------------------------------------------
  // Publication figures and any other media
  eleventyConfig.addPassthroughCopy({ '../media': 'media' });

  // GOV.UK Design System assets from npm.
  // Note: govuk-frontend.min.css is NOT passthrough-copied — it is written
  // above in the eleventy.before hook so asset URLs can be rewritten for
  // subpath deploys. We do passthrough the other assets verbatim.
  eleventyConfig.addPassthroughCopy({
    'node_modules/govuk-frontend/dist/govuk/assets': 'assets',
    'node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js': 'javascripts/govuk-frontend.min.js',
    'node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js.map': 'javascripts/govuk-frontend.min.js.map'
  });

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    markdownTemplateEngine: 'liquid',
    htmlTemplateEngine: 'liquid',
    dataTemplateEngine: 'liquid',
    templateFormats: ['md', 'liquid', 'html'],
    dir: {
      input: '..',
      output: '_site',
      includes: 'docs-site/_includes',
      layouts: 'docs-site/_layouts',
      data: 'docs-site/_data'
    }
  };
};
